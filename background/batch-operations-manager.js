// batch-operations-manager.js - Batch processing for multiple galleries
// Allows simultaneous processing of multiple gallery pages and bulk operations

class BatchOperationsManager {
  constructor(options = {}) {
    this.options = {
      maxConcurrentTabs: options.maxConcurrentTabs || 5,
      tabProcessingDelay: options.tabProcessingDelay || 1000,
      enableProgressTracking: options.enableProgressTracking !== false,
      enableBatchReports: options.enableBatchReports !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000,
      ...options
    };

    this.activeBatches = new Map();
    this.batchQueue = [];
    this.processingQueue = false;
    this.batchHistory = [];
    this.tabManager = new BatchTabManager();
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Listen for tab updates during batch processing
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.handleTabLoadComplete(tabId, tab);
      }
    });

    // Listen for tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });
  }

  async startBatchOperation(batchConfig) {
    try {
      const batchId = this.generateBatchId();
      const batch = {
        id: batchId,
        config: batchConfig,
        urls: batchConfig.urls || [],
        status: 'initializing',
        startTime: Date.now(),
        endTime: null,
        progress: {
          total: batchConfig.urls?.length || 0,
          completed: 0,
          failed: 0,
          inProgress: 0
        },
        results: [],
        errors: [],
        tabs: new Map()
      };

      this.activeBatches.set(batchId, batch);
      
      console.log(`🚀 Starting batch operation ${batchId} with ${batch.progress.total} URLs`);

      // Validate URLs first
      batch.urls = await this.validateAndPrepareUrls(batch.urls);
      batch.progress.total = batch.urls.length;

      if (batch.urls.length === 0) {
        throw new Error('No valid URLs provided for batch operation');
      }

      // Start processing
      batch.status = 'processing';
      await this.processBatch(batch);

      return batchId;
    } catch (error) {
      console.error('❌ Batch operation failed to start:', error);
      throw error;
    }
  }

  async processBatch(batch) {
    try {
      const chunks = this.chunkArray(batch.urls, this.options.maxConcurrentTabs);
      
      for (const chunk of chunks) {
        if (batch.status === 'cancelled') {
          break;
        }
        
        await this.processChunk(batch, chunk);
        
        // Add delay between chunks to prevent overwhelming the browser
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await this.delay(this.options.tabProcessingDelay);
        }
      }

      // Complete the batch
      batch.status = batch.errors.length > 0 ? 'completed_with_errors' : 'completed';
      batch.endTime = Date.now();
      
      this.generateBatchReport(batch);
      this.notifyBatchComplete(batch);
      
      // Move to history
      this.batchHistory.push({
        ...batch,
        tabs: undefined // Don't store tab references in history
      });
      
      // Clean up after some time
      setTimeout(() => {
        this.activeBatches.delete(batch.id);
      }, 300000); // 5 minutes

    } catch (error) {
      batch.status = 'failed';
      batch.endTime = Date.now();
      batch.errors.push({
        type: 'batch_error',
        message: error.message,
        timestamp: Date.now()
      });
      
      console.error('❌ Batch processing failed:', error);
      this.notifyBatchError(batch, error);
    }
  }

  async processChunk(batch, urls) {
    const chunkPromises = urls.map(url => this.processUrl(batch, url));
    await Promise.allSettled(chunkPromises);
  }

  async processUrl(batch, url) {
    try {
      batch.progress.inProgress++;
      
      // Create a new tab for this URL
      const tab = await chrome.tabs.create({
        url: url,
        active: false // Background processing
      });

      batch.tabs.set(tab.id, {
        url: url,
        status: 'loading',
        startTime: Date.now(),
        retryCount: 0
      });

      // Wait for tab to load and process
      const result = await this.waitForTabProcessing(batch, tab);
      
      if (result.success) {
        batch.progress.completed++;
        batch.results.push(result);
      } else {
        batch.progress.failed++;
        batch.errors.push({
          url: url,
          error: result.error,
          timestamp: Date.now()
        });
      }

      // Close the tab
      try {
        await chrome.tabs.remove(tab.id);
      } catch (closeError) {
        console.warn('Failed to close tab:', closeError);
      }
      
      batch.tabs.delete(tab.id);
      batch.progress.inProgress--;

    } catch (error) {
      batch.progress.inProgress--;
      batch.progress.failed++;
      batch.errors.push({
        url: url,
        error: error.message,
        timestamp: Date.now()
      });
      console.error(`❌ Failed to process URL ${url}:`, error);
    }
  }

  async waitForTabProcessing(batch, tab, timeout = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(async () => {
        try {
          // Check if tab still exists
          const tabInfo = batch.tabs.get(tab.id);
          if (!tabInfo) {
            clearInterval(checkInterval);
            resolve({ success: false, error: 'Tab was closed unexpectedly' });
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            resolve({ success: false, error: 'Processing timeout' });
            return;
          }

          // Try to inject and run scraper
          const result = await this.injectAndRunScraper(tab.id);
          
          if (result.completed) {
            clearInterval(checkInterval);
            resolve({
              success: true,
              url: tab.url,
              items: result.items || [],
              metadata: result.metadata || {}
            });
          }
          
        } catch (error) {
          // Tab might not be ready yet, continue checking
          console.log('Tab not ready yet, retrying...', error.message);
        }
      }, 2000); // Check every 2 seconds
    });
  }

  async injectAndRunScraper(tabId) {
    try {
      // Inject the scraper script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content/scraper.js']
      });

      // Send message to start scraping
      const result = await chrome.tabs.sendMessage(tabId, {
        action: 'START_BATCH_SCRAPE',
        config: {
          mode: 'batch',
          timeout: 20000,
          maxItems: 1000
        }
      });

      return result || { completed: false };
    } catch (error) {
      console.warn('Failed to inject scraper:', error);
      return { completed: false, error: error.message };
    }
  }

  handleTabLoadComplete(tabId, _tab) {
    // Find which batch this tab belongs to
    for (const batch of this.activeBatches.values()) {
      const tabInfo = batch.tabs.get(tabId);
      if (tabInfo) {
        tabInfo.status = 'loaded';
        tabInfo.loadTime = Date.now();
        break;
      }
    }
  }

  handleTabRemoved(tabId) {
    // Clean up tab references from active batches
    for (const batch of this.activeBatches.values()) {
      if (batch.tabs.has(tabId)) {
        batch.tabs.delete(tabId);
        break;
      }
    }
  }

  async validateAndPrepareUrls(urls) {
    const validUrls = [];
    
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          validUrls.push(url);
        } else {
          console.warn('Invalid URL protocol:', url);
        }
      } catch (error) {
        console.warn('Invalid URL:', url, error);
      }
    }
    
    return validUrls;
  }

  generateBatchReport(batch) {
    if (!this.options.enableBatchReports) {
      return;
    }

    const report = {
      batchId: batch.id,
      summary: {
        totalUrls: batch.progress.total,
        successful: batch.progress.completed,
        failed: batch.progress.failed,
        processingTime: batch.endTime - batch.startTime,
        averageTimePerUrl: (batch.endTime - batch.startTime) / batch.progress.total
      },
      results: batch.results,
      errors: batch.errors,
      timestamp: new Date().toISOString()
    };

    // Store report
    this.storeBatchReport(report);
    
    return report;
  }

  async storeBatchReport(report) {
    try {
      // Store in chrome.storage for later retrieval
      const key = `batch_report_${report.batchId}`;
      await chrome.storage.local.set({ [key]: report });
      
      console.log('📊 Batch report stored:', report.batchId);
    } catch (error) {
      console.error('Failed to store batch report:', error);
    }
  }

  notifyBatchComplete(batch) {
    if (typeof window !== 'undefined' && window.notificationSystem) {
      const message = `Batch operation completed: ${batch.progress.completed}/${batch.progress.total} successful`;
      window.notificationSystem.show('success', message, {
        onClick: () => this.openBatchReport(batch.id)
      });
    }
  }

  notifyBatchError(batch, error) {
    if (typeof window !== 'undefined' && window.notificationSystem) {
      window.notificationSystem.show('error', `Batch operation failed: ${error.message}`, {
        onClick: () => this.openBatchReport(batch.id)
      });
    }
  }

  async openBatchReport(batchId) {
    // Open dashboard with batch report
    const dashboardUrl = chrome.runtime.getURL(`ui/windowed-dashboard.html?batch=${batchId}`);
    await chrome.tabs.create({
      url: dashboardUrl,
      active: true
    });
  }

  // Cancel an active batch operation
  async cancelBatch(batchId) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {return false;}

    batch.status = 'cancelled';
    
    // Close all associated tabs
    for (const tabId of batch.tabs.keys()) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (error) {
        console.warn('Failed to close tab during cancellation:', error);
      }
    }
    
    batch.endTime = Date.now();
    this.notifyBatchCancelled(batch);
    
    return true;
  }

  notifyBatchCancelled(batch) {
    if (typeof window !== 'undefined' && window.notificationSystem) {
      window.notificationSystem.show('warning', `Batch operation cancelled: ${batch.id}`);
    }
  }

  // Get status of all active batches
  getActiveBatches() {
    const batches = {};
    for (const [id, batch] of this.activeBatches) {
      batches[id] = {
        id: batch.id,
        status: batch.status,
        progress: batch.progress,
        startTime: batch.startTime,
        config: batch.config
      };
    }
    return batches;
  }

  // Get batch history
  getBatchHistory(limit = 10) {
    return this.batchHistory.slice(-limit);
  }

  // Utility methods
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Tab manager for batch operations
class BatchTabManager {
  constructor() {
    this.managedTabs = new Set();
  }

  trackTab(tabId) {
    this.managedTabs.add(tabId);
  }

  untrackTab(tabId) {
    this.managedTabs.delete(tabId);
  }

  async cleanupAllTabs() {
    for (const tabId of this.managedTabs) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (error) {
        console.warn('Failed to cleanup tab:', error);
      }
    }
    this.managedTabs.clear();
  }
}

// Export for use in service worker (importScripts compatible)
if (typeof self !== 'undefined') {
  self.BatchOperationsManager = BatchOperationsManager;
} else if (typeof window !== 'undefined') {
  window.BatchOperationsManager = BatchOperationsManager;
}