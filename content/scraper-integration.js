// scraper-integration.js - Integration layer for enhanced scraping components
// Coordinates enhanced modules with existing scraper.js functionality

// Prevent duplicate initialization
if (window.ScraperIntegration) {
  console.log('ScraperIntegration already loaded, skipping...');
} else {

  class ScraperIntegration {
    constructor(options = {}) {
      this.options = {
        enableEnhancedScraping: options.enableEnhancedScraping !== false,
        enableEnhancedPagination: options.enableEnhancedPagination !== false,
        enableMonitoring: options.enableMonitoring !== false,
        
        // Feature flags for gradual rollout
        useEnhancedRetryLogic: options.useEnhancedRetryLogic !== false,
        useEnhancedDuplicateDetection: options.useEnhancedDuplicateDetection !== false,
        useProductionMonitoring: options.useProductionMonitoring !== false,
        
        ...options
      };
      
      // Enhanced component instances
      this.enhancedScraperUtils = null;
      this.enhancedPaginationHandler = null;
      this.productionMonitor = null;
      
      // State management
      this.isInitialized = false;
      this.isActive = false;
      
      console.log('✅ Scraper integration layer initialized');
    }
    
    // Initialize all enhanced components
    async initialize() {
      if (this.isInitialized) return true;
      
      try {
        // Initialize production monitor first for logging
        if (this.options.enableMonitoring && window.ProductionMonitor) {
          if (!window.globalProductionMonitor) {
            this.productionMonitor = new window.ProductionMonitor({
              logLevel: 'info',
              enablePerformanceTracking: true,
              enableHealthChecks: true,
              enableErrorTracking: true
            });
          } else {
            this.productionMonitor = window.globalProductionMonitor;
          }
          this.log('info', 'Production monitoring initialized');
        }
        
        // Initialize enhanced scraper utils
        if (this.options.enableEnhancedScraping && window.EnhancedScraperUtils) {
          this.enhancedScraperUtils = new window.EnhancedScraperUtils({
            requestsPerSecond: 2,
            maxRetries: 3,
            enableDuplicateDetection: this.options.useEnhancedDuplicateDetection,
            enableMetrics: true
          });
          this.log('info', 'Enhanced scraper utils initialized');
        }
        
        // Initialize enhanced pagination handler
        if (this.options.enableEnhancedPagination && window.EnhancedPaginationHandler) {
          this.enhancedPaginationHandler = new window.EnhancedPaginationHandler({
            maxPages: 50,
            pageTimeout: 10000,
            interPageDelay: 1500
          });
          this.log('info', 'Enhanced pagination handler initialized');
        }
        
        this.isInitialized = true;
        this.log('info', 'Scraper integration fully initialized', {
          enhancedScraping: !!this.enhancedScraperUtils,
          enhancedPagination: !!this.enhancedPaginationHandler,
          monitoring: !!this.productionMonitor
        });
        
        return true;
        
      } catch (error) {
        this.log('error', 'Failed to initialize scraper integration', { error: error.message });
        return false;
      }
    }
    
    // Enhanced scraping with integrated error handling and monitoring
    async performEnhancedScraping(selector, options = {}) {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const timerId = this.startTiming('enhanced-scraping');
      this.isActive = true;
      
      try {
        this.log('info', 'Starting enhanced scraping', { selector, options });
        
        // Use enhanced pagination if available
        let paginationResult = null;
        if (this.enhancedPaginationHandler && options.handlePagination !== false) {
          this.log('info', 'Using enhanced pagination handler');
          
          // Create extraction callback for pagination
          const extractionCallback = async () => {
            return await this.extractItemsWithEnhancedUtils(selector, options);
          };
          
          paginationResult = await this.enhancedPaginationHandler.handlePagination(
            extractionCallback, 
            options
          );
          
          this.log('info', 'Enhanced pagination completed', {
            items: paginationResult.items.length,
            pages: paginationResult.pages,
            strategy: paginationResult.strategy
          });
          
          return paginationResult;
        } else {
          // Fallback to single-page extraction
          const items = await this.extractItemsWithEnhancedUtils(selector, options);
          
          return {
            success: true,
            items,
            pages: 1,
            strategy: 'single-page',
            stats: {
              extracted: items.length,
              processed: items.length,
              final: items.length,
              enhancedUtilsUsed: !!this.enhancedScraperUtils
            }
          };
        }
        
      } catch (error) {
        this.log('error', 'Enhanced scraping failed', { 
          error: error.message, 
          selector, 
          stack: error.stack 
        });
        
        // Fallback to original scraping method
        this.log('warn', 'Falling back to original scraping method');
        if (window.enhancedStartScraping) {
          return await window.enhancedStartScraping(selector, options);
        }
        
        throw error;
        
      } finally {
        this.isActive = false;
        if (timerId) {
          const duration = this.endTiming(timerId);
          this.log('info', 'Enhanced scraping completed', { duration });
        }
      }
    }
    
    // Extract items with enhanced utilities
    async extractItemsWithEnhancedUtils(selector, options = {}) {
      try {
        // Get all matching elements
        const elements = selector ? 
          document.querySelectorAll(selector) : 
          document.querySelectorAll('img, [style*="background-image"]');
        
        const items = [];
        
        for (const element of elements) {
          try {
            // Extract basic item data
            const item = await this.extractItemFromElement(element, options);
            if (!item) continue;
            
            // Enhanced duplicate detection
            if (this.enhancedScraperUtils && this.options.useEnhancedDuplicateDetection) {
              const isDuplicate = await this.enhancedScraperUtils.detectDuplicate(
                item.image, 
                item.text || item.alt
              );
              if (isDuplicate) {
                this.log('debug', 'Duplicate item skipped', { url: item.image });
                continue;
              }
            }
            
            // Enhanced request handling for image validation
            if (this.enhancedScraperUtils && this.options.validateImages && item.image) {
              try {
                const response = await this.enhancedScraperUtils.makeEnhancedRequest(
                  item.image, 
                  { method: 'HEAD' }
                );
                item.validated = true;
                item.imageSize = response.headers.get('content-length');
                item.imageType = response.headers.get('content-type');
              } catch (error) {
                this.log('warn', 'Image validation failed', { 
                  url: item.image, 
                  error: error.message 
                });
                item.validated = false;
              }
            }
            
            items.push(item);
            
          } catch (error) {
            this.log('warn', 'Failed to extract item', { 
              element: element.tagName, 
              error: error.message 
            });
          }
        }
        
        this.log('info', `Extracted ${items.length} items from ${elements.length} elements`);
        return items;
        
      } catch (error) {
        this.log('error', 'Item extraction failed', { error: error.message });
        throw error;
      }
    }
    
    // Extract item from individual element
    async extractItemFromElement(element, options = {}) {
      try {
        let imageUrl = null;
        
        // Get image URL from various sources
        if (element.tagName === 'IMG') {
          imageUrl = element.src || element.getAttribute('data-src') || 
                    element.getAttribute('data-original');
        } else if (element.style.backgroundImage) {
          const bgImage = element.style.backgroundImage;
          const urlMatch = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/);
          imageUrl = urlMatch ? urlMatch[1] : null;
        } else {
          // Look for nested images
          const nestedImg = element.querySelector('img');
          if (nestedImg) {
            imageUrl = nestedImg.src || nestedImg.getAttribute('data-src');
          }
        }
        
        if (!imageUrl) return null;
        
        // Clean and validate URL
        try {
          imageUrl = new URL(imageUrl, window.location.href).href;
        } catch (error) {
          this.log('warn', 'Invalid image URL', { url: imageUrl });
          return null;
        }
        
        // Extract metadata
        const item = {
          image: imageUrl,
          element: element,
          alt: element.alt || element.getAttribute('title') || '',
          link: this.findParentLink(element),
          text: this.extractElementText(element),
          metadata: this.extractElementMetadata(element),
          extractedAt: Date.now(),
          extractionMethod: 'enhanced'
        };
        
        return item;
        
      } catch (error) {
        this.log('warn', 'Element extraction failed', { error: error.message });
        return null;
      }
    }
    
    // Helper methods
    findParentLink(element) {
      let current = element;
      while (current && current.parentElement) {
        current = current.parentElement;
        if (current.tagName === 'A' && current.href) {
          return current.href;
        }
      }
      return null;
    }
    
    extractElementText(element) {
      // Try to find meaningful text near the image
      const textSources = [
        element.alt,
        element.getAttribute('title'),
        element.parentElement?.querySelector('.caption, .title, figcaption')?.textContent,
        element.parentElement?.textContent?.trim()
      ];
      
      return textSources.find(text => text && text.length > 0) || '';
    }
    
    extractElementMetadata(element) {
      const metadata = {};
      
      // Extract data attributes
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
          metadata[attr.name] = attr.value;
        }
      }
      
      // Extract size information if available
      if (element.naturalWidth) {
        metadata.width = element.naturalWidth;
        metadata.height = element.naturalHeight;
      }
      
      return metadata;
    }
    
    // Logging helpers
    log(level, message, context = {}) {
      if (this.productionMonitor) {
        this.productionMonitor.log(level, `[ScraperIntegration] ${message}`, context);
      } else {
        console[level](`[ScraperIntegration] ${message}`, context);
      }
    }
    
    startTiming(name) {
      return this.productionMonitor ? 
        this.productionMonitor.startTiming(name) : null;
    }
    
    endTiming(id) {
      return this.productionMonitor && id ? 
        this.productionMonitor.endTiming(id) : null;
    }
    
    // Get comprehensive status report
    getStatus() {
      return {
        isInitialized: this.isInitialized,
        isActive: this.isActive,
        components: {
          enhancedScraperUtils: !!this.enhancedScraperUtils,
          enhancedPaginationHandler: !!this.enhancedPaginationHandler,
          productionMonitor: !!this.productionMonitor
        },
        options: this.options,
        metrics: this.productionMonitor ? 
          this.productionMonitor.getMetricsReport() : null
      };
    }
    
    // Lifecycle management
    async shutdown() {
      this.log('info', 'Shutting down scraper integration');
      
      this.isActive = false;
      
      // Cleanup enhanced components
      if (this.enhancedScraperUtils && typeof this.enhancedScraperUtils.destroy === 'function') {
        this.enhancedScraperUtils.destroy();
      }
      
      if (this.enhancedPaginationHandler && typeof this.enhancedPaginationHandler.destroy === 'function') {
        this.enhancedPaginationHandler.destroy();
      }
      
      // Don't destroy global monitor, just stop using it
      this.productionMonitor = null;
      
      this.isInitialized = false;
      this.log('info', 'Scraper integration shutdown complete');
    }
  }
  
  // Export to global scope
  window.ScraperIntegration = ScraperIntegration;
  
  // Create global instance for easy access
  if (!window.globalScraperIntegration) {
    window.globalScraperIntegration = new ScraperIntegration();
  }
  
  console.log('✅ Scraper integration layer loaded');
}