// download-queue.js - Enhanced download queue for STEPTWO V2
// Enhanced with image filtering, duplicate detection, resume capability, and advanced progress tracking

// Note: ES6 export commented out for importScripts compatibility
// export class DownloadQueue {
class DownloadQueue {
  constructor({concurrency = 5, retryLimit = 3, hostLimit = 3, maxConcurrency = 10, maxHostLimit = 10, retryConfig = {}} = {}) {
    this.concurrency = concurrency;
    this.hostLimit = hostLimit;
    this.retryLimit = retryLimit;
    this.maxConcurrency = maxConcurrency; // Maximum allowed concurrency for large galleries
    this.maxHostLimit = maxHostLimit; // Maximum allowed host limit for large galleries
    
    // Progressive ramp-up configuration for large galleries
    this.enableProgressiveRampUp = false;
    this.rampUpStartConcurrency = 3;
    this.rampUpInterval = null;
    this.lastRampUpCheck = 0;
    this.rampUpCheckInterval = 30000; // Check every 30 seconds
    
    // Enhanced retry configuration
    this.retryConfig = {
      enableJitter: retryConfig.enableJitter !== false, // Default: true
      jitterPercent: retryConfig.jitterPercent || 0.25, // 25% jitter
      authRetryEnabled: retryConfig.authRetryEnabled || false, // Don't retry auth errors
      customDelays: retryConfig.customDelays || {}, // Custom error-specific delays
      maxDelayOverride: retryConfig.maxDelayOverride, // Override max delays
      circuitBreakerThreshold: retryConfig.circuitBreakerThreshold || 10, // Stop after N consecutive failures
      ...retryConfig
    };
    
    this.queue = [];
    this.active = new Map(); // downloadId -> job
    this.completed = [];
    this.failed = [];
    this.duplicates = new Set(); // Track duplicate URLs/hashes
    this.contentHashes = new Map(); // For content-based deduplication
    this.onProgress = () => {};
    this.paused = false;
    this.stopped = false;
    
    // Circuit breaker for authentication failures
    this.consecutiveAuthFailures = 0;
    this.authFailureHosts = new Map(); // Track auth failures per host
    
    this.stats = {
      totalItems: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      startTime: null,
      endTime: null,
      // Performance statistics
      batchesProcessed: 0,
      largeScaleBypasses: 0,
      performanceModeUsage: 0,
      averageBatchTime: 0,
      totalBatchTime: 0,
      // Enhanced retry statistics
      totalRetries: 0,
      authFailures: 0,
      captchaFailures: 0,
      rateLimitHits: 0,
      serverErrors: 0,
      networkErrors: 0,
      retriesByType: {}
    };
    
    // Use common utilities for consistent filter defaults
    this.filters = StepTwoUtils.createDefaultFilters();
    // Add performance optimization settings
    this.filters.enablePerformanceDuplication = false;
    this.filters.bypassDuplicationForLargeScale = false;
    this.filters.largeScaleThreshold = 1000;
    this.filters.batchProcessingSize = 20;
    this.filters.enableIncrementalProcessing = true;
    this.errors = [];
    this.hostQueue = new Map(); // Track per-host queue limits
  }

  // Enhanced performance optimization with adaptive concurrency for large galleries
  enablePerformanceMode(gallerySize) {
    if (gallerySize >= 1000) {
      console.log(`📈 Enabling adaptive performance mode for large gallery: ${gallerySize} items`);
      
      // Adaptive concurrency based on gallery size and system performance
      const adaptiveConcurrency = this.calculateAdaptiveConcurrency(gallerySize);
      const adaptiveHostLimit = this.calculateAdaptiveHostLimit(gallerySize);
      
      this.setConcurrency(adaptiveConcurrency);
      this.setHostLimit(adaptiveHostLimit);
      this.filters.enablePerformanceDuplication = true;
      this.filters.bypassDuplicationForLargeScale = gallerySize > 5000;
      this.stats.performanceModeUsage++;
      
      // Enable progressive ramp-up for very large galleries
      if (gallerySize >= 10000) {
        this.enableProgressiveRampUp = true;
        this.rampUpStartConcurrency = Math.min(3, adaptiveConcurrency);
        console.log(`🚀 Progressive ramp-up enabled: starting at ${this.rampUpStartConcurrency} threads`);
      }
      
      this.onProgress({
        state: 'performance_mode_enabled',
        gallerySize,
        concurrency: this.concurrency,
        hostLimit: this.hostLimit,
        adaptiveConcurrency,
        adaptiveHostLimit,
        progressiveRampUp: this.enableProgressiveRampUp,
        stats: this.getStats()
      });
    }
  }

  // Calculate optimal concurrency based on gallery size and estimated system capacity
  calculateAdaptiveConcurrency(gallerySize) {
    if (gallerySize < 1000) {return this.concurrency;}
    if (gallerySize < 10000) {return Math.min(8, this.maxConcurrency);}
    if (gallerySize < 50000) {return Math.min(12, this.maxConcurrency);}
    if (gallerySize < 100000) {return Math.min(15, this.maxConcurrency);}
    return Math.min(20, this.maxConcurrency); // Cap at 20 for 100k+ items
  }

  // Calculate optimal host limit to prevent overwhelming servers
  calculateAdaptiveHostLimit(gallerySize) {
    if (gallerySize < 1000) {return this.hostLimit;}
    if (gallerySize < 10000) {return Math.min(5, this.maxHostLimit);}
    if (gallerySize < 50000) {return Math.min(7, this.maxHostLimit);}
    return Math.min(10, this.maxHostLimit); // Cap at 10 for large galleries
  }

  // Progressive ramp-up for very large galleries to avoid overwhelming systems
  async rampUpConcurrency() {
    if (!this.enableProgressiveRampUp || this.stopped || this.paused) {return;}
    
    const currentSuccess = this.stats.successful;
    const currentFailed = this.stats.failed;
    const successRate = currentSuccess / (currentSuccess + currentFailed || 1);
    
    // Only ramp up if success rate is good (>90%) and we have some completed downloads
    if (successRate > 0.9 && currentSuccess > 10 && this.concurrency < this.maxConcurrency) {
      const newConcurrency = Math.min(this.concurrency + 2, this.maxConcurrency);
      console.log(`📈 Ramping up concurrency: ${this.concurrency} → ${newConcurrency} (success rate: ${(successRate * 100).toFixed(1)}%)`);
      this.setConcurrency(newConcurrency);
      
      this.onProgress({
        state: 'concurrency_ramped_up',
        oldConcurrency: this.concurrency - 2,
        newConcurrency: this.concurrency,
        successRate,
        stats: this.getStats()
      });
    }
  }

  async addItems(items, options = {}) {
    // Enable performance mode for large galleries (1000+ images)
    if (items.length >= 1000) {
      this.enablePerformanceMode(items.length);
    }
    
    const processedItems = items.map(item => this.processItem(item, options));
    
    // Apply filters
    const filteredItems = options.skipFiltering ? processedItems : 
      processedItems.filter(item => this.passesFilters(item));
    
    // Check for duplicates if enabled
    const uniqueItems = this.filters.skipDuplicates ? 
      await this.removeDuplicates(filteredItems) : filteredItems;
    
    // Add to queue
    uniqueItems.forEach(item => {
      item.id = this.generateItemId();
      item.addedAt = Date.now();
      item.status = 'queued';
      item.retryCount = 0;
      this.queue.push(item);
    });
    
    this.stats.totalItems = this.queue.length + this.completed.length + this.failed.length;
    this.onProgress({
      state: 'items_added',
      added: uniqueItems.length,
      filtered: processedItems.length - filteredItems.length,
      duplicates: filteredItems.length - uniqueItems.length,
      total: this.queue.length,
      stats: this.getStats()
    });
    
    // Start processing if not paused
    if (!this.paused && !this.stopped) {
      this._next();
    }
    
    return uniqueItems.length;
  }

  // Security: Validate URLs to prevent malicious downloads
  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL: URL must be a non-empty string');
    }

    // Parse URL and validate
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format: ${error.message}`);
    }

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Unsafe protocol: ${parsedUrl.protocol}. Only HTTP/HTTPS allowed`);
    }

    // Block suspicious TLDs and domains
    const blockedTLDs = ['.onion', '.bit', '.exit'];
    const hostname = parsedUrl.hostname.toLowerCase();
    
    if (blockedTLDs.some(tld => hostname.endsWith(tld))) {
      throw new Error(`Blocked domain: ${hostname}`);
    }

    // Block localhost and private IPs in production
    const privateIpRegex = /^(127\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[0-1]\.|192\.168\.)/;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || privateIpRegex.test(hostname)) {
      console.warn(`Warning: Downloading from private/localhost: ${hostname}`);
    }

    // Check for suspicious paths
    const suspiciousPaths = ['/admin', '/wp-admin', '/../', '/..\\', '/.env', '/config'];
    const path = parsedUrl.pathname.toLowerCase();
    if (suspiciousPaths.some(suspPath => path.includes(suspPath))) {
      throw new Error(`Suspicious path detected: ${path}`);
    }

    return true;
  }

  // Security: Validate file extension
  validateFileExtension(filename) {
    if (!filename) {return false;}
    
    const allowedExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif',
      '.pdf', '.txt', '.json', '.csv', '.xlsx', '.zip'
    ];
    
    const blockedExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.js', '.vbs', '.jar',
      '.msi', '.dll', '.sh', '.py', '.php', '.asp', '.jsp', '.pl'
    ];
    
    const ext = `.${filename.toLowerCase().split('.').pop()}`;
    
    // Block dangerous file types
    if (blockedExtensions.includes(ext)) {
      throw new Error(`Blocked file type: ${ext}. Security risk detected.`);
    }
    
    // Warn for unusual extensions
    if (!allowedExtensions.includes(ext)) {
      console.warn(`Warning: Unusual file extension: ${ext}`);
      return false;
    }
    
    return true;
  }

  // Security: Validate MIME type
  validateMimeType(mimeType) {
    if (!mimeType) {return true;} // Optional validation
    
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'image/bmp', 'image/tiff', 'application/pdf', 'text/plain',
      'application/json', 'text/csv', 'application/zip'
    ];
    
    const blockedMimes = [
      'application/x-executable', 'application/x-msdownload',
      'application/x-msdos-program', 'text/javascript', 'application/javascript'
    ];
    
    if (blockedMimes.includes(mimeType.toLowerCase())) {
      throw new Error(`Blocked MIME type: ${mimeType}. Security risk detected.`);
    }
    
    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      console.warn(`Warning: Unusual MIME type: ${mimeType}`);
    }
    
    return true;
  }

  processItem(item, options = {}) {
    const url = item.url || item.src || item.href;
    
    // Security validation
    this.validateUrl(url);
    
    const processed = {
      url: url,
      filename: item.filename || this.generateFilename(item),
      referrer: item.referrer || `chrome-extension://${  chrome.runtime.id}`,
      headers: item.headers || {},
      metadata: {
        sourceUrl: item.sourceUrl || 'unknown',
        extractedAt: Date.now(),
        selector: item.selector,
        index: item.index,
        ...item.metadata
      },
      ...item
    };
    
    // Validate required fields
    if (!processed.url) {
      throw new Error('Item must have a URL');
    }
    
    // Validate filename if provided
    if (processed.filename) {
      this.validateFileExtension(processed.filename);
    }
    
    return processed;
  }

  async removeDuplicates(items) {
    const startTime = Date.now();
    
    // Check if we should bypass duplication for large-scale operations
    if (this.filters.bypassDuplicationForLargeScale && 
        items.length > this.filters.largeScaleThreshold) {
      console.log(`🚀 Large-scale mode: bypassing duplication checks for ${items.length} items`);
      this.stats.largeScaleBypasses++;
      
      // Still track URLs to avoid immediate re-processing, but skip content hashing
      items.forEach(item => this.duplicates.add(item.url));
      
      return items;
    }
    
    const uniqueItems = [];
    const seenUrls = new Set(this.duplicates);
    
    // Use performance mode for faster processing if enabled
    if (this.filters.enablePerformanceDuplication) {
      for (const item of items) {
        // Fast URL-based deduplication only
        if (seenUrls.has(item.url)) {
          this.stats.duplicates++;
          this.onProgress({
            state: 'duplicate_skipped',
            item: item,
            reason: 'url_fast',
            stats: this.getStats()
          });
          continue;
        }
        
        seenUrls.add(item.url);
        uniqueItems.push(item);
      }
    } else {
      // Full duplication checking including content hashes
      for (const item of items) {
        // URL-based deduplication
        if (seenUrls.has(item.url)) {
          this.stats.duplicates++;
          this.onProgress({
            state: 'duplicate_skipped',
            item: item,
            reason: 'url',
            stats: this.getStats()
          });
          continue;
        }
        
        // Content hash deduplication (if available)
        if (item.contentHash && this.contentHashes.has(item.contentHash)) {
          this.stats.duplicates++;
          this.onProgress({
            state: 'duplicate_skipped',
            item: item,
            reason: 'content_hash',
            stats: this.getStats()
          });
          continue;
        }
        
        // Add to seen sets
        seenUrls.add(item.url);
        if (item.contentHash) {
          this.contentHashes.set(item.contentHash, item);
        }
        
        uniqueItems.push(item);
      }
    }
    
    // Update duplicates set
    seenUrls.forEach(url => this.duplicates.add(url));
    
    const processingTime = Date.now() - startTime;
    if (processingTime > 100) { // Log if deduplication takes significant time
      console.log(`Deduplication took ${processingTime}ms for ${items.length} items (${uniqueItems.length} unique)`);
    }
    
    return uniqueItems;
  }

  passesFilters(item) {
    // Size filters (if metadata available)
    if (item.width && this.filters.minWidth && item.width < this.filters.minWidth) {
      this.logFilter(item, 'min_width', `${item.width} < ${this.filters.minWidth}`);
      return false;
    }
    
    if (item.height && this.filters.minHeight && item.height < this.filters.minHeight) {
      this.logFilter(item, 'min_height', `${item.height} < ${this.filters.minHeight}`);
      return false;
    }
    
    if (item.fileSize && this.filters.maxSize && item.fileSize > this.filters.maxSize) {
      this.logFilter(item, 'max_size', `${item.fileSize} > ${this.filters.maxSize}`);
      return false;
    }
    
    // File type filters
    const extension = this.getFileExtension(item.url || item.filename || '');
    if (extension && this.filters.allowedTypes.length > 0) {
      if (!this.filters.allowedTypes.includes(extension.toLowerCase())) {
        this.logFilter(item, 'file_type', `${extension} not in allowed types`);
        return false;
      }
    }
    
    return true;
  }

  logFilter(item, reason, details) {
    this.stats.skipped++;
    this.onProgress({
      state: 'item_filtered',
      item: item,
      reason: reason,
      details: details,
      stats: this.getStats()
    });
  }

  getFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([^.]+)$/);
      return match ? match[1] : null;
    } catch (_e) {
      const match = url.match(/\.([^.]+)$/);
      return match ? match[1] : null;
    }
  }

  generateFilename(item) {
    // Use filename mask if available
    if (this.filenameMask) {
      return this.applyFilenameMask(item);
    }
    
    // Extract from URL
    try {
      const url = new URL(item.url);
      const pathname = url.pathname;
      let filename = pathname.split('/').pop();
      
      if (!filename || !filename.includes('.')) {
        filename = `image_${Date.now()}.jpg`;
      }
      
      return this.sanitizeFilename(filename);
    } catch (_e) {
      return `download_${Date.now()}.bin`;
    }
  }

  applyFilenameMask(item) {
    // This would integrate with the enhanced filename-mask.js
    // Placeholder implementation
    const timestamp = Date.now();
    const extension = this.getFileExtension(item.url) || 'jpg';
    return `${item.name || 'download'}_${timestamp}.${extension}`;
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }

  generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  stop() {
    this.stopped = true;
    this.paused = true;
    // Cancel all active downloads
    for (const [_downloadId, job] of this.active) {
      if (job.controller) {
        job.controller.abort();
      }
    }
    this.active.clear();
    this.stats.endTime = Date.now();
    
    // Clear memory to prevent unbounded growth
    this.clearMemoryOptimizations();
    
    this.onProgress({state:'stopped', stats: this.getStats()});
  }

  clear() {
    this.stop();
    this.queue = [];
    this.completed = [];
    this.failed = [];
    this.duplicates.clear();
    this.contentHashes.clear();
    this.errors = [];
    this.hostQueue.clear();
    
    // Reset all performance statistics
    this.stats = {
      totalItems: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      startTime: null,
      endTime: null,
      // Performance statistics
      batchesProcessed: 0,
      largeScaleBypasses: 0,
      performanceModeUsage: 0,
      averageBatchTime: 0,
      totalBatchTime: 0
    };
    
    // Additional memory cleanup
    this.clearMemoryOptimizations();
    
    this.stopped = false;
    this.onProgress({state:'cleared', stats: this.getStats()});
  }
  
  // Clear memory optimizations and reset performance mode
  clearMemoryOptimizations() {
    console.log('🧹 Clearing memory optimizations...');
    
    // Reset performance mode settings
    this.filters.enablePerformanceDuplication = false;
    this.filters.bypassDuplicationForLargeScale = false;
    
    // Clear any cached processed items
    if (this.processedItemsCache) {
      this.processedItemsCache.clear();
    }
    
    // Force garbage collection hint (service workers don't have access to window.gc)
    // This was a browser-specific optimization that's not available in service workers
    
    console.log('✅ Memory optimizations cleared');
  }

  getStats() {
    const now = Date.now();
    const elapsed = this.stats.startTime ? (now - this.stats.startTime) / 1000 : 0;
    const rate = elapsed > 0 ? this.stats.processed / elapsed : 0;
    const remaining = this.queue.length + this.active.size;
    const eta = rate > 0 ? remaining / rate : 0;
    
    return {
      ...this.stats,
      elapsed,
      rate: Math.round(rate * 100) / 100,
      eta: Math.round(eta),
      queueSize: this.queue.length,
      activeDownloads: this.active.size,
      remaining
    };
  }

  setProgressCallback(cb) {
    this.onProgress = typeof cb === 'function' ? cb : () => {};
  }

  setFilters(filters) {
    Object.assign(this.filters, filters);
  }

  async add(job) {
    if (this.stopped) {return false;}
    
    // Validate job
    if (!job.url || typeof job.url !== 'string') {
      this.errors.push('Invalid job: missing URL');
      return false;
    }

    // Check for duplicate URLs
    if (this.filters.skipDuplicates && this.duplicates.has(job.url)) {
      this.stats.duplicates++;
      this.onProgress({
        state: 'duplicate_skipped',
        job,
        stats: this.getStats()
      });
      return false;
    }

    // Apply filters
    if (!(await this._passesFilters(job))) {
      this.stats.skipped++;
      this.onProgress({
        state: 'filtered_out',
        job,
        stats: this.getStats()
      });
      return false;
    }

    // Generate unique ID if not provided
    if (!job.id) {
      job.id = `job_${  Date.now()  }_${  Math.random().toString(36).substr(2, 9)}`;
    }

    // Add retry count
    job.retries = job.retries || 0;
    job.createdAt = Date.now();

    // Mark as seen
    this.duplicates.add(job.url);
    
    // Add to queue
    this.queue.push(job);
    this.stats.totalItems++;
    
    if (!this.stats.startTime) {
      this.stats.startTime = Date.now();
    }

    this.onProgress({
      state: 'job_added',
      job,
      stats: this.getStats()
    });

    // Start processing if not paused
    if (!this.paused) {
      setTimeout(() => this._next(), 0);
    }

    return true;
  }

  async _passesFilters(job) {
    try {
      // Use common utilities for validation
      if (!StepTwoUtils.isValidUrl(job.url)) {
        return false;
      }
      
      // Check file extension using common utility
      const ext = StepTwoUtils.getFileExtension(job.url);
      if (ext && !this.filters.allowedTypes.includes(ext)) {
        return false;
      }

      // Image-specific validation
      if (!StepTwoUtils.isImageUrl(job.url)) {
        return false;
      }

      // For image size filtering, we'd need to check headers or download partially
      if (this.filters.minWidth > 0 || this.filters.minHeight > 0) {
        // TODO: Implement image dimension checking via HEAD request
        // For now, use metadata if available
        if (job.width && job.height) {
          return StepTwoUtils.isValidImageSize(job.width, job.height, this.filters.minWidth, this.filters.minHeight);
        }
      }

      return true;
    } catch (error) {
      this.errors.push(`Filter error: ${error.message}`);
      return false;
    }
  }

  // Remove duplicate _getFileExtension method since we now use StepTwoUtils.getFileExtension

  getItems() {
    const items = [];
    
    // Queued items
    this.queue.forEach(job => {
      items.push({
        id: job.id || job.url,
        url: job.url,
        filename: job.filename,
        status: 'queued',
        retries: job.retries || 0
      });
    });
    
    // Active items
    for (const [downloadId, job] of this.active) {
      items.push({
        id: job.id || job.url,
        url: job.url,
        filename: job.filename,
        status: 'downloading',
        downloadId,
        retries: job.retries || 0
      });
    }
    
    // Completed items (last 20)
    this.completed.slice(-20).forEach(job => {
      items.push({
        id: job.id || job.url,
        url: job.url,
        filename: job.filename,
        status: 'completed',
        completedAt: job.completedAt
      });
    });
    
    // Failed items (last 10)
    this.failed.slice(-10).forEach(job => {
      items.push({
        id: job.id || job.url,
        url: job.url,
        filename: job.filename,
        status: 'failed',
        error: job.error,
        retries: job.retries || 0
      });
    });
    
    return items;
  }

  async add(job) {
    try {
      // Generate unique ID for job
      job.id = job.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      job.retries = 0;
      job.addedAt = Date.now();

      // Check for duplicate URLs
      if (this.filters.skipDuplicates && this.duplicates.has(job.url)) {
        this.onProgress({state:'duplicate_skipped', job, reason: 'URL already processed'});
        return false;
      }

      // Apply image filters
      const filterResult = await this._applyFilters(job);
      if (!filterResult.passed) {
        this.onProgress({state:'filtered', job, reason: filterResult.reason});
        return false;
      }

      // Add to duplicates set
      if (this.filters.skipDuplicates) {
        this.duplicates.add(job.url);
      }

      this.queue.push(job);
      this.onProgress({state:'added', job, queueLength: this.queue.length});
      this._next();
      return true;
    } catch (error) {
      this.onProgress({state:'add_error', job, error: error.message});
      return false;
    }
  }

  async _applyFilters(job) {
    try {
      // Check file extension
      const url = new URL(job.url);
      const pathname = url.pathname.toLowerCase();
      const extension = pathname.split('.').pop();
      
      if (!this.filters.allowedTypes.includes(extension)) {
        return { passed: false, reason: `File type ${extension} not allowed` };
      }

      // Check image dimensions (only available in content script/UI contexts, not service workers)
      if ((this.filters.minWidth > 0 || this.filters.minHeight > 0) && typeof document !== 'undefined') {
        const dimensions = await this._getImageDimensions(job.url);
        if (dimensions) {
          if (this.filters.minWidth > 0 && dimensions.width < this.filters.minWidth) {
            return { passed: false, reason: `Image width ${dimensions.width}px below minimum ${this.filters.minWidth}px` };
          }
          if (this.filters.minHeight > 0 && dimensions.height < this.filters.minHeight) {
            return { passed: false, reason: `Image height ${dimensions.height}px below minimum ${this.filters.minHeight}px` };
          }
        }
      }

      return { passed: true };
    } catch (error) {
      // If filtering fails, allow the download
      return { passed: true, warning: error.message };
    }
  }

  async _getImageDimensions(url) {
    // Image constructor is not available in service workers
    if (typeof Image === 'undefined') {
      return null;
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        resolve(null);
      };
      // Set timeout to avoid hanging
      setTimeout(() => resolve(null), 5000);
      img.src = url;
    });
  }

  _next() {
    if (this.paused) {return;}
    if (this.active.size >= this.concurrency) {return;}
    
    // Progressive ramp-up monitoring for large galleries
    if (this.enableProgressiveRampUp) {
      const now = Date.now();
      if (now - this.lastRampUpCheck > this.rampUpCheckInterval) {
        this.lastRampUpCheck = now;
        this.rampUpConcurrency();
      }
    }
    
    // find next job whose host has free slot
    const idx = this.queue.findIndex(job => {
      const host = new URL(job.url).host;
      const count = Array.from(this.active.values()).filter(j => new URL(j.url).host===host).length;
      return count < this.hostLimit;
    });
    
    if(idx===-1) {return;} // no job can run now
    
    const [job] = this.queue.splice(idx,1);
    const host = new URL(job.url).host;
    
    const options = {
      url: job.url,
      filename: job.filename,
      conflictAction: 'uniquify',
      saveAs: false
    };
    
    chrome.downloads.download(options, downloadId => {
      if (downloadId === undefined) {
        this._handleError(job, 'Download creation failed');
        return;
      }
      job.host = host;
      job.startedAt = Date.now();
      this.active.set(downloadId, job);
      this.onProgress({state:'started', job, downloadId, activeCount: this.active.size});
    });
  }

  _handleError(job, error = 'Unknown error') {
    job.error = error;
    job.lastErrorAt = Date.now();
    
    // Enhanced error classification
    const errorInfo = this._classifyError(error, job);
    job.errorType = errorInfo.type;
    job.errorCategory = errorInfo.category;
    
    // Update failure tracking
    this._updateAuthFailureTracking(job, errorInfo);
    
    // Check if we should retry based on error type and attempt count
    if (this._shouldRetry(job, errorInfo)) {
      job.retries += 1;
      
      // Enhanced exponential backoff with jitter and error-specific delays
      const delay = this._calculateRetryDelay(job.retries, errorInfo);
      
      // Add retry metadata
      job.retryHistory = job.retryHistory || [];
      job.retryHistory.push({
        attempt: job.retries,
        error: error,
        errorType: errorInfo.type,
        delay: delay,
        timestamp: Date.now()
      });
      
      setTimeout(() => { 
        this.queue.unshift(job); 
        this._next(); 
      }, delay);
      
      this.onProgress({
        state: 'retry', 
        job, 
        delay, 
        attempt: job.retries,
        errorType: errorInfo.type,
        errorCategory: errorInfo.category,
        description: errorInfo.noRetryReason || errorInfo.description || 'Retrying after error',
        maxRetries: this.retryLimit,
        circuitBreakerActive: this._isCircuitBreakerActive(job.url)
      });
    } else {
      job.failedAt = Date.now();
      job.finalError = error;
      job.finalErrorType = errorInfo.type;
      this.failed.push(job);
      
      this.onProgress({
        state: 'failed', 
        job, 
        failedCount: this.failed.length,
        errorType: errorInfo.type,
        errorCategory: errorInfo.category,
        reason: errorInfo.noRetryReason || `Max retries exceeded (${this.retryLimit})`,
        circuitBreakerActive: this._isCircuitBreakerActive(job.url)
      });
    }
    
    // Continue flow
    this._next();
  }

  /**
   * Check if circuit breaker is active for a given URL
   */
  _isCircuitBreakerActive(url) {
    try {
      const host = new URL(url).hostname;
      const failures = this.authFailureHosts.get(host) || 0;
      return failures >= this.retryConfig.circuitBreakerThreshold;
    } catch {
      return false;
    }
  }

  /**
   * Classify error types for intelligent retry handling
   */
  _classifyError(error, job) {
    const errorStr = error.toString().toLowerCase();
    const _url = job.url || '';
    
    // Authentication errors (don't retry - require manual intervention)
    if (errorStr.includes('unauthorized') || 
        errorStr.includes('forbidden') || 
        errorStr.includes('login required') ||
        errorStr.includes('authentication') ||
        errorStr.includes('401') ||
        errorStr.includes('403')) {
      return {
        type: 'AUTH_ERROR',
        category: 'authentication',
        noRetryReason: 'Authentication required - manual login needed'
      };
    }
    
    // Captcha/bot detection (don't retry - require manual intervention)
    if (errorStr.includes('captcha') || 
        errorStr.includes('bot') ||
        errorStr.includes('automated') ||
        errorStr.includes('verification')) {
      return {
        type: 'CAPTCHA_ERROR',
        category: 'authentication',
        noRetryReason: 'Captcha or bot detection - manual verification needed'
      };
    }
    
    // Rate limiting (retry with longer delays)
    if (errorStr.includes('rate limit') || 
        errorStr.includes('too many requests') ||
        errorStr.includes('429')) {
      return {
        type: 'RATE_LIMIT',
        category: 'throttling'
      };
    }
    
    // Server errors (temporary, worth retrying)
    if (errorStr.includes('500') || 
        errorStr.includes('502') || 
        errorStr.includes('503') ||
        errorStr.includes('504') ||
        errorStr.includes('server error') ||
        errorStr.includes('internal error')) {
      return {
        type: 'SERVER_ERROR',
        category: 'temporary'
      };
    }
    
    // Network errors (worth retrying)
    if (errorStr.includes('network') || 
        errorStr.includes('timeout') ||
        errorStr.includes('connection') ||
        errorStr.includes('dns') ||
        errorStr.includes('unreachable')) {
      return {
        type: 'NETWORK_ERROR',
        category: 'temporary'
      };
    }
    
    // File not found (don't retry)
    if (errorStr.includes('404') || 
        errorStr.includes('not found')) {
      return {
        type: 'NOT_FOUND',
        category: 'permanent',
        noRetryReason: 'File not found on server'
      };
    }
    
    // User cancelled (don't retry)
    if (errorStr.includes('user_canceled') || 
        errorStr.includes('cancelled')) {
      return {
        type: 'USER_CANCELLED',
        category: 'permanent',
        noRetryReason: 'Download cancelled by user'
      };
    }
    
    // Default to unknown retryable error
    return {
      type: 'UNKNOWN',
      category: 'unknown'
    };
  }

  /**
   * Determine if we should retry based on error type and configuration
   */
  _shouldRetry(job, errorInfo) {
    // Check max retries
    if (job.retries >= this.retryLimit) {
      return false;
    }
    
    // Circuit breaker: check for too many consecutive auth failures
    if (errorInfo.category === 'authentication') {
      const host = new URL(job.url).hostname;
      const hostFailures = this.authFailureHosts.get(host) || 0;
      
      if (hostFailures >= this.retryConfig.circuitBreakerThreshold) {
        this.onProgress({
          state: 'circuit_breaker_triggered',
          host: host,
          failures: hostFailures,
          threshold: this.retryConfig.circuitBreakerThreshold,
          message: `Circuit breaker triggered for ${host} after ${hostFailures} auth failures`
        });
        return false;
      }
    }
    
    // Never retry certain error types unless explicitly enabled
    if (errorInfo.category === 'authentication' && !this.retryConfig.authRetryEnabled) {
      return false;
    }
    
    if (errorInfo.category === 'permanent') {
      return false;
    }
    
    return true;
  }

  /**
   * Update authentication failure tracking for circuit breaker
   */
  _updateAuthFailureTracking(job, errorInfo) {
    if (errorInfo.category === 'authentication') {
      const host = new URL(job.url).hostname;
      const currentFailures = this.authFailureHosts.get(host) || 0;
      this.authFailureHosts.set(host, currentFailures + 1);
      this.consecutiveAuthFailures++;
      
      // Update statistics
      if (errorInfo.type === 'AUTH_ERROR') {
        this.stats.authFailures++;
      } else if (errorInfo.type === 'CAPTCHA_ERROR') {
        this.stats.captchaFailures++;
      }
    } else {
      // Reset consecutive auth failures on successful non-auth operations
      this.consecutiveAuthFailures = 0;
    }
    
    // Update retry statistics
    this.stats.totalRetries++;
    this.stats.retriesByType[errorInfo.type] = (this.stats.retriesByType[errorInfo.type] || 0) + 1;
    
    // Update specific error type counters
    switch (errorInfo.type) {
      case 'RATE_LIMIT':
        this.stats.rateLimitHits++;
        break;
      case 'SERVER_ERROR':
        this.stats.serverErrors++;
        break;
      case 'NETWORK_ERROR':
        this.stats.networkErrors++;
        break;
    }
  }

  /**
   * Calculate retry delay with enhanced exponential backoff
   */
  _calculateRetryDelay(attempt, errorInfo) {
    let baseDelay = 1000; // 1 second
    let maxDelay = 30000; // 30 seconds
    
    // Check for custom configuration overrides
    if (this.retryConfig.customDelays[errorInfo.type]) {
      const custom = this.retryConfig.customDelays[errorInfo.type];
      baseDelay = custom.baseDelay || baseDelay;
      maxDelay = custom.maxDelay || maxDelay;
    } else {
      // Adjust delays based on error type
      switch (errorInfo.type) {
        case 'RATE_LIMIT':
          baseDelay = 5000; // Start with 5 seconds for rate limiting
          maxDelay = this.retryConfig.maxDelayOverride || 120000; // Up to 2 minutes for rate limiting
          break;
        case 'SERVER_ERROR':
          baseDelay = 2000; // Start with 2 seconds for server errors
          maxDelay = this.retryConfig.maxDelayOverride || 60000; // Up to 1 minute for server errors
          break;
        case 'NETWORK_ERROR':
          baseDelay = 1000; // Standard delay for network issues
          maxDelay = this.retryConfig.maxDelayOverride || 30000; // Standard max for network issues
          break;
        default:
          baseDelay = 1000;
          maxDelay = this.retryConfig.maxDelayOverride || 30000;
      }
    }
    
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    
    let finalDelay = Math.min(maxDelay, exponentialDelay);
    
    // Add jitter (±25%) to prevent thundering herd if enabled
    if (this.retryConfig.enableJitter) {
      const jitter = this.retryConfig.jitterPercent || 0.25;
      const jitterMultiplier = 1 + (Math.random() * 2 - 1) * jitter;
      finalDelay = finalDelay * jitterMultiplier;
    }
    
    return Math.round(finalDelay);
  }

  /**
   * Get site profile for authentication checking
   */
  _getSiteProfile(_hostname) {
    // This would integrate with the site profiles system
    // For now, return null - this will be enhanced when profiles are loaded
    return null;
  }

  /**
   * Reset circuit breaker for a specific host or all hosts
   */
  resetCircuitBreaker(hostname = null) {
    if (hostname) {
      this.authFailureHosts.delete(hostname);
      this.onProgress({
        state: 'circuit_breaker_reset',
        host: hostname,
        message: `Circuit breaker reset for ${hostname}`
      });
    } else {
      this.authFailureHosts.clear();
      this.consecutiveAuthFailures = 0;
      this.onProgress({
        state: 'circuit_breaker_reset',
        host: 'all',
        message: 'All circuit breakers reset'
      });
    }
  }

  /**
   * Get comprehensive retry statistics
   */
  getRetryStatistics() {
    const now = Date.now();
    const _elapsed = this.stats.startTime ? (now - this.stats.startTime) / 1000 : 0;
    
    return {
      totalRetries: this.stats.totalRetries,
      authFailures: this.stats.authFailures,
      captchaFailures: this.stats.captchaFailures,
      rateLimitHits: this.stats.rateLimitHits,
      serverErrors: this.stats.serverErrors,
      networkErrors: this.stats.networkErrors,
      retriesByType: { ...this.stats.retriesByType },
      avgRetriesPerFailure: this.failed.length > 0 ? this.stats.totalRetries / this.failed.length : 0,
      circuitBreakerHosts: Array.from(this.authFailureHosts.entries()).map(([host, failures]) => ({
        host,
        failures,
        active: failures >= this.retryConfig.circuitBreakerThreshold
      })),
      retryConfiguration: {
        retryLimit: this.retryLimit,
        enableJitter: this.retryConfig.enableJitter,
        jitterPercent: this.retryConfig.jitterPercent,
        authRetryEnabled: this.retryConfig.authRetryEnabled,
        circuitBreakerThreshold: this.retryConfig.circuitBreakerThreshold
      }
    };
  }

  /**
   * Configure retry behavior
   */
  setRetryConfiguration(newConfig) {
    this.retryConfig = { ...this.retryConfig, ...newConfig };
    this.onProgress({
      state: 'retry_config_updated',
      configuration: this.retryConfig,
      message: 'Retry configuration updated'
    });
  }

  _handleDownloadChanged(delta) {
    if (!delta.state || !delta.state.current) {return;}
    const job = this.active.get(delta.id);
    if (!job) {return;}
    
    if (delta.state.current === 'complete') {
      this.active.delete(delta.id);
      job.completedAt = Date.now();
      job.duration = job.completedAt - job.startedAt;
      this.completed.push(job);
      this.onProgress({
        state:'completed', 
        job, 
        downloadId: delta.id, 
        completedCount: this.completed.length,
        activeCount: this.active.size
      });
      this._next();
    } else if (delta.state.current === 'interrupted') {
      this.active.delete(delta.id);
      const errorReason = delta.error ? delta.error.current : 'Download interrupted';
      this._handleError(job, errorReason);
    } else if (delta.bytesReceived) {
      // Progress update
      job.bytesReceived = delta.bytesReceived.current;
      job.totalBytes = delta.totalBytes?.current;
      this.onProgress({
        state:'progress', 
        job, 
        downloadId: delta.id, 
        progress: job.totalBytes ? (job.bytesReceived / job.totalBytes) : 0
      });
    }
  }

  attachListeners() {
    this._onChanged = this._handleDownloadChanged.bind(this);
    chrome.downloads.onChanged.addListener(this._onChanged);
  }

  detachListeners() {
    if (this._onChanged) {chrome.downloads.onChanged.removeListener(this._onChanged);}
  }

  setConcurrency(n){
    if(typeof n==='number'&&n>0){
      this.concurrency = n;
      this._next();
    }
  }

  setRetryLimit(n){
    if(typeof n==='number'&&n>=0){
      this.retryLimit = n;
    }
  }

  setHostLimit(n){
    if(typeof n==='number'&&n>=1){
      this.hostLimit = n;
    }
  }

  // Export functionality
  generateReport() {
    const retryStats = this.getRetryStatistics();
    
    return {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      retryStatistics: retryStats,
      summary: {
        totalProcessed: this.completed.length + this.failed.length,
        successRate: this.completed.length / Math.max(1, this.completed.length + this.failed.length),
        avgDownloadTime: this.completed.reduce((sum, job) => sum + (job.duration || 0), 0) / Math.max(1, this.completed.length),
        authenticationIssues: retryStats.authFailures + retryStats.captchaFailures,
        networkReliability: 1 - (retryStats.networkErrors / Math.max(1, this.stats.totalItems))
      },
      completed: this.completed.map(job => ({
        url: job.url,
        filename: job.filename,
        duration: job.duration,
        retries: job.retries || 0,
        completedAt: new Date(job.completedAt).toISOString()
      })),
      failed: this.failed.map(job => ({
        url: job.url,
        filename: job.filename,
        error: job.finalError || job.error,
        errorType: job.finalErrorType || job.errorType,
        retries: job.retries || 0,
        retryHistory: job.retryHistory || [],
        failedAt: new Date(job.failedAt).toISOString()
      })),
      settings: {
        concurrency: this.concurrency,
        retryLimit: this.retryLimit,
        hostLimit: this.hostLimit,
        retryConfiguration: this.retryConfig,
        filters: this.filters
      },
      circuitBreakers: retryStats.circuitBreakerHosts.filter(cb => cb.active)
    };
  }
  
  // Enhanced batch processing with performance optimizations
  async addItemsBatch(items, options = {}) {
    const batchStartTime = Date.now();
    const batchSize = options.batchSize || this.filters.batchProcessingSize;
    const enableIncremental = options.enableIncremental !== false && this.filters.enableIncrementalProcessing;
    
    let totalAdded = 0;
    const totalFiltered = 0;
    const totalDuplicates = 0;
    
    // Process in batches to avoid blocking the main thread
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Yield control between batches for better responsiveness
      if (enableIncremental && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      const result = await this.addItems(batch, { ...options, skipFiltering: false });
      totalAdded += result;
      
      // Progress reporting
      this.onProgress({
        state: 'batch_progress',
        batchIndex: Math.floor(i / batchSize),
        totalBatches: Math.ceil(items.length / batchSize),
        processed: i + batch.length,
        total: items.length,
        added: totalAdded,
        stats: this.getStats()
      });
    }
    
    const batchTime = Date.now() - batchStartTime;
    this.stats.batchesProcessed++;
    this.stats.totalBatchTime += batchTime;
    this.stats.averageBatchTime = this.stats.totalBatchTime / this.stats.batchesProcessed;
    
    if (this.filters.enablePerformanceDuplication || this.filters.bypassDuplicationForLargeScale) {
      this.stats.performanceModeUsage++;
    }
    
    console.log(`📊 Batch processed ${items.length} items in ${batchTime}ms (${totalAdded} added)`);
    
    return {
      totalAdded,
      totalFiltered,
      totalDuplicates,
      processingTime: batchTime,
      batchSize,
      performanceMode: this.filters.enablePerformanceDuplication || this.filters.bypassDuplicationForLargeScale
    };
  }
  
  // Performance optimization controls
  enablePerformanceMode(options = {}) {
    this.filters.enablePerformanceDuplication = true;
    this.filters.bypassDuplicationForLargeScale = options.bypassLargeScale !== false;
    this.filters.largeScaleThreshold = options.threshold || this.filters.largeScaleThreshold;
    this.filters.batchProcessingSize = options.batchSize || this.filters.batchProcessingSize;
    
    console.log('🚀 Performance mode enabled for download queue');
  }
  
  disablePerformanceMode() {
    this.filters.enablePerformanceDuplication = false;
    this.filters.bypassDuplicationForLargeScale = false;
    
    console.log('🔄 Performance mode disabled, using full duplication detection');
  }
}

// Support both ES modules and legacy importScripts
// (DownloadQueue class already exported via export keyword)

// Export for importScripts compatibility
if (typeof self !== 'undefined') {
  self.DownloadQueue = DownloadQueue;
}