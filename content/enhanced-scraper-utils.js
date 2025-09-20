// enhanced-scraper-utils.js - Production-ready scraping utilities
// Enhanced error handling, retry logic, rate limiting, and performance monitoring

if (!window.EnhancedScraperUtils) {
  
  class EnhancedScraperUtils {
    constructor(options = {}) {
      this.options = {
        // Rate limiting
        requestsPerSecond: options.requestsPerSecond || 2,
        burstLimit: options.burstLimit || 5,
        cooldownPeriod: options.cooldownPeriod || 30000,
        
        // Retry configuration
        maxRetries: options.maxRetries || 3,
        baseDelay: options.baseDelay || 1000,
        maxDelay: options.maxDelay || 10000,
        backoffMultiplier: options.backoffMultiplier || 2,
        jitterFactor: options.jitterFactor || 0.1,
        
        // Content validation
        minImageSize: options.minImageSize || 100,
        maxImageSize: options.maxImageSize || 50 * 1024 * 1024, // 50MB
        allowedFormats: options.allowedFormats || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
        
        // Performance monitoring
        enableMetrics: options.enableMetrics !== false,
        metricsInterval: options.metricsInterval || 5000,
        
        // Content filtering
        enableDuplicateDetection: options.enableDuplicateDetection !== false,
        enableContentValidation: options.enableContentValidation !== false,
        
        ...options
      };
      
      // Rate limiting state
      this.requestQueue = [];
      this.requestHistory = [];
      this.isThrottled = false;
      this.throttledUntil = 0;
      
      // Retry tracking
      this.retryAttempts = new Map();
      this.failureHistory = new Map();
      
      // Content tracking
      this.processedUrls = new Set();
      this.contentHashes = new Set();
      this.duplicateCount = 0;
      
      // Performance metrics
      this.metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        retriedRequests: 0,
        duplicatesSkipped: 0,
        averageResponseTime: 0,
        errorDistribution: new Map(),
        performanceHistory: [],
        throughput: { requests: 0, data: 0 }
      };
      
      // Initialize monitoring
      if (this.options.enableMetrics) {
        this.startMetricsCollection();
      }
      
      console.log('✅ Enhanced scraper utilities initialized');
    }
    
    // Enhanced request with rate limiting and retry logic
    async makeEnhancedRequest(url, options = {}) {
      // Check if we should rate limit
      if (this.shouldRateLimit()) {
        await this.waitForRateLimit();
      }
      
      // Record request attempt
      this.recordRequest();
      
      const requestId = `${url}-${Date.now()}`;
      const startTime = performance.now();
      
      try {
        const response = await this.executeRequestWithRetry(url, options, requestId);
        
        // Record success metrics
        const responseTime = performance.now() - startTime;
        this.recordSuccess(responseTime);
        
        return response;
      } catch (error) {
        // Record failure metrics
        this.recordFailure(error, url);
        throw error;
      }
    }
    
    // Execute request with exponential backoff retry logic
    async executeRequestWithRetry(url, options, requestId) {
      let lastError = null;
      const maxRetries = this.options.maxRetries;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = this.calculateBackoffDelay(attempt);
            console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for ${url} after ${delay}ms`);
            await this.sleep(delay);
            this.metrics.retriedRequests++;
          }
          
          // Sanitize headers to remove forbidden browser headers
          const sanitizedHeaders = this.sanitizeHeaders({
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            ...options.headers
          });
          
          // Make the actual request with sanitized headers
          // Create safe options without headers to prevent override of sanitizedHeaders
          const safeOptions = { ...options };
          delete safeOptions.headers; // Remove headers to prevent override
          
          const response = await fetch(url, {
            ...safeOptions,
            method: options.method || 'GET',
            signal: options.signal,
            headers: sanitizedHeaders // Headers are final and cannot be overridden
          });
          
          // Check if response is ok
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          // Validate content if enabled
          if (this.options.enableContentValidation) {
            await this.validateResponse(response, url);
          }
          
          return response;
          
        } catch (error) {
          lastError = error;
          
          // Check if we should retry based on error type
          if (!this.isRetryableError(error) || attempt === maxRetries) {
            break;
          }
          
          console.warn(`⚠️ Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        }
      }
      
      // All retries exhausted
      this.recordRetryExhaustion(requestId, url, lastError);
      throw lastError;
    }
    
    // Calculate exponential backoff delay with jitter
    calculateBackoffDelay(attempt) {
      const baseDelay = this.options.baseDelay;
      const backoffMultiplier = this.options.backoffMultiplier;
      const maxDelay = this.options.maxDelay;
      const jitterFactor = this.options.jitterFactor;
      
      // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
      let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
      
      // Add jitter to prevent thundering herd
      const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
      delay += jitter;
      
      // Cap at max delay
      return Math.min(Math.max(delay, baseDelay), maxDelay);
    }
    
    // Check if error is retryable
    isRetryableError(error) {
      // Network errors are generally retryable
      if (error.name === 'TypeError' || error.name === 'NetworkError') {
        return true;
      }
      
      // HTTP status codes that are retryable
      if (error.message.includes('HTTP')) {
        const statusMatch = error.message.match(/HTTP (\d+)/);
        if (statusMatch) {
          const status = parseInt(statusMatch[1]);
          // Retry on 5xx (server errors) and some 4xx (rate limiting)
          return status >= 500 || status === 429 || status === 408;
        }
      }
      
      // Timeout errors are retryable
      if (error.message.includes('timeout') || error.message.includes('aborted')) {
        return true;
      }
      
      return false;
    }
    
    // Rate limiting logic
    shouldRateLimit() {
      const now = Date.now();
      
      // Check if we're in cooldown period
      if (now < this.throttledUntil) {
        return true;
      }
      
      // Clean old requests from history (keep last 60 seconds)
      this.requestHistory = this.requestHistory.filter(
        timestamp => now - timestamp < 60000
      );
      
      // Check requests per second limit
      const recentRequests = this.requestHistory.filter(
        timestamp => now - timestamp < 1000
      );
      
      if (recentRequests.length >= this.options.requestsPerSecond) {
        return true;
      }
      
      // Check burst limit
      const burstWindow = this.requestHistory.filter(
        timestamp => now - timestamp < 5000
      );
      
      if (burstWindow.length >= this.options.burstLimit) {
        console.log('🚦 Rate limit: Burst limit reached, applying throttle');
        this.throttledUntil = now + this.options.cooldownPeriod;
        return true;
      }
      
      return false;
    }
    
    // Wait for rate limit to clear
    async waitForRateLimit() {
      const now = Date.now();
      const waitTime = Math.max(
        this.throttledUntil - now,
        1000 - (now - Math.max(...this.requestHistory.slice(-1), 0))
      );
      
      if (waitTime > 0) {
        console.log(`🚦 Rate limiting: waiting ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }
    
    // Record request for rate limiting
    recordRequest() {
      this.requestHistory.push(Date.now());
      this.metrics.totalRequests++;
    }
    
    // Enhanced duplicate detection using content hashing
    async detectDuplicate(url, content) {
      if (!this.options.enableDuplicateDetection) {
        return false;
      }
      
      // URL-based detection
      if (this.processedUrls.has(url)) {
        this.metrics.duplicatesSkipped++;
        return true;
      }
      
      // Content-based detection using hash
      if (content) {
        const hash = await this.calculateContentHash(content);
        if (this.contentHashes.has(hash)) {
          this.metrics.duplicatesSkipped++;
          return true;
        }
        this.contentHashes.add(hash);
      }
      
      this.processedUrls.add(url);
      return false;
    }
    
    // Calculate content hash for duplicate detection
    async calculateContentHash(content) {
      if (typeof content === 'string') {
        content = new TextEncoder().encode(content);
      }
      
      // Use SubtleCrypto if available, fallback to simple hash
      if (window.crypto && window.crypto.subtle) {
        try {
          const hashBuffer = await window.crypto.subtle.digest('SHA-256', content);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
          console.warn('⚠️ Crypto hash failed, using fallback');
        }
      }
      
      // Simple hash fallback
      let hash = 0;
      const str = content.toString();
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(16);
    }
    
    // Validate response content
    async validateResponse(response, url) {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      
      // Check content type
      if (contentType.startsWith('image/')) {
        const format = contentType.split('/')[1];
        if (!this.options.allowedFormats.includes(format)) {
          throw new Error(`Unsupported image format: ${format}`);
        }
      }
      
      // Check content size
      if (contentLength > 0) {
        if (contentLength < this.options.minImageSize) {
          throw new Error(`Image too small: ${contentLength} bytes`);
        }
        if (contentLength > this.options.maxImageSize) {
          throw new Error(`Image too large: ${contentLength} bytes`);
        }
      }
      
      return true;
    }
    
    // Enhanced error tracking and analysis
    recordFailure(error, url) {
      this.metrics.failedRequests++;
      
      // Track error types
      const errorType = this.categorizeError(error);
      const currentCount = this.metrics.errorDistribution.get(errorType) || 0;
      this.metrics.errorDistribution.set(errorType, currentCount + 1);
      
      // Track failure history for pattern analysis
      const domain = this.extractDomain(url);
      if (!this.failureHistory.has(domain)) {
        this.failureHistory.set(domain, []);
      }
      this.failureHistory.get(domain).push({
        timestamp: Date.now(),
        error: errorType,
        message: error.message
      });
      
      console.error(`❌ Request failed for ${url}:`, error);
    }
    
    // Categorize errors for better analysis
    categorizeError(error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('fetch')) {
        return 'NETWORK_ERROR';
      }
      if (message.includes('timeout') || message.includes('aborted')) {
        return 'TIMEOUT_ERROR';
      }
      if (message.includes('http 4')) {
        return 'CLIENT_ERROR';
      }
      if (message.includes('http 5')) {
        return 'SERVER_ERROR';
      }
      if (message.includes('cors')) {
        return 'CORS_ERROR';
      }
      if (message.includes('ssl') || message.includes('certificate')) {
        return 'SSL_ERROR';
      }
      
      return 'UNKNOWN_ERROR';
    }
    
    // Record successful requests
    recordSuccess(responseTime) {
      this.metrics.successfulRequests++;
      
      // Update average response time
      const totalSuccessful = this.metrics.successfulRequests;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful;
      
      // Track performance history
      this.metrics.performanceHistory.push({
        timestamp: Date.now(),
        responseTime,
        success: true
      });
      
      // Keep only recent history (last 1000 entries)
      if (this.metrics.performanceHistory.length > 1000) {
        this.metrics.performanceHistory.shift();
      }
    }
    
    // Start metrics collection
    startMetricsCollection() {
      setInterval(() => {
        this.updateThroughputMetrics();
        this.logPerformanceMetrics();
      }, this.options.metricsInterval);
    }
    
    // Update throughput metrics
    updateThroughputMetrics() {
      const now = Date.now();
      const fiveMinutesAgo = now - 300000; // 5 minutes
      
      const recentRequests = this.metrics.performanceHistory.filter(
        entry => entry.timestamp > fiveMinutesAgo
      );
      
      this.metrics.throughput.requests = recentRequests.length / 5; // requests per minute
    }
    
    // Log performance metrics
    logPerformanceMetrics() {
      const successRate = this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(1) : 0;
      
      console.log(`📊 Scraper Metrics - Success Rate: ${successRate}%, ` +
        `Avg Response: ${this.metrics.averageResponseTime.toFixed(0)}ms, ` +
        `Duplicates Skipped: ${this.metrics.duplicatesSkipped}, ` +
        `Throughput: ${this.metrics.throughput.requests.toFixed(1)} req/min`);
    }
    
    // Get comprehensive metrics report
    getMetricsReport() {
      const errorBreakdown = {};
      for (const [error, count] of this.metrics.errorDistribution.entries()) {
        errorBreakdown[error] = count;
      }
      
      return {
        summary: {
          totalRequests: this.metrics.totalRequests,
          successfulRequests: this.metrics.successfulRequests,
          failedRequests: this.metrics.failedRequests,
          successRate: this.metrics.totalRequests > 0 ? 
            (this.metrics.successfulRequests / this.metrics.totalRequests * 100) : 0,
          averageResponseTime: this.metrics.averageResponseTime,
          duplicatesSkipped: this.metrics.duplicatesSkipped
        },
        performance: {
          throughput: this.metrics.throughput,
          recentPerformance: this.metrics.performanceHistory.slice(-10)
        },
        errors: {
          distribution: errorBreakdown,
          recentFailures: Array.from(this.failureHistory.entries()).slice(-5)
        }
      };
    }
    
    // Helper methods
    extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch {
        return 'unknown';
      }
    }
    
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    recordRetryExhaustion(requestId, url, error) {
      console.error(`💀 Retry exhausted for ${url}:`, error.message);
    }
    
    // Sanitize headers to remove forbidden browser headers
    sanitizeHeaders(headers) {
      if (!headers) return {};
      
      // List of headers that are forbidden or restricted in browser fetch requests
      const forbiddenHeaders = [
        'user-agent',
        'referer', 
        'origin',
        'host',
        'connection',
        'content-length',
        'date',
        'dnt',
        'expect',
        'feature-policy',
        'keep-alive',
        'proxy-authorization',
        'sec-',
        'te',
        'trailer',
        'transfer-encoding',
        'upgrade',
        'via'
      ];
      
      const sanitized = {};
      
      for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase();
        
        // Skip forbidden headers
        if (forbiddenHeaders.some(forbidden => 
          lowerKey === forbidden || lowerKey.startsWith(forbidden)
        )) {
          console.warn(`🚫 Stripped forbidden header: ${key}`);
          continue;
        }
        
        // Keep allowed headers
        sanitized[key] = value;
      }
      
      return sanitized;
    }
  }
  
  // Export to global scope
  window.EnhancedScraperUtils = EnhancedScraperUtils;
  console.log('✅ Enhanced scraper utilities loaded');
}