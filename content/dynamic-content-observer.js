// dynamic-content-observer.js - Enhanced dynamic content detection and handling
// Addresses: Data Capture from dynamically loaded content

// Prevent duplicate declarations
if (window.DynamicContentObserver) {
  console.log('DynamicContentObserver already loaded, skipping...');
} else {

  class DynamicContentObserver {
    constructor(options = {}) {
      this.options = {
        // Observer configuration
        mutationDebounceMs: options.mutationDebounceMs || 300,
        intersectionThreshold: options.intersectionThreshold || 0.1,
        maxObservationTime: options.maxObservationTime || 30000,
        
        // Detection sensitivity
        minNewElements: options.minNewElements || 2,
        lazyLoadTriggerDistance: options.lazyLoadTriggerDistance || 500,
        
        // Selectors for dynamic content
        dynamicContentSelectors: options.dynamicContentSelectors || [
          '[data-src]', '[data-lazy]', '[data-original]',
          'img[loading="lazy"]', 'img[data-srcset]',
          '.lazy', '.lazyload', '.progressive',
          '[data-testid*="image"]', '[aria-label*="image"]'
        ],
        
        // Container selectors that might load content
        dynamicContainerSelectors: options.dynamicContainerSelectors || [
          '[data-testid*="gallery"]', '[data-testid*="grid"]',
          '.infinite-scroll', '.scroll-container',
          '.pagination-container', '.load-more'
        ],
        
        ...options
      };
      
      this.observers = new Map();
      this.detectedElements = new Set();
      this.callbacks = new Map();
      this.isActive = false;
      this.observationStartTime = null;
      this.mutationTimeout = null;
      
      // Statistics for reporting
      this.stats = {
        totalMutations: 0,
        elementsDetected: 0,
        lazyImagesLoaded: 0,
        networkRequestsDetected: 0,
        apiCallsIntercepted: 0,
        dynamicContainersFound: 0
      };
    }
    
    // Start observing for dynamic content
    async startObserving(callback) {
      if (this.isActive) {
        console.warn('DynamicContentObserver already active');
        return;
      }
      
      this.isActive = true;
      this.observationStartTime = Date.now();
      this.callbacks.set('main', callback);
      
      console.log('🔍 Starting dynamic content observation...');
      
      // Initialize all observers
      await this.initializeMutationObserver();
      await this.initializeIntersectionObserver();
      await this.initializeLazyLoadDetection();
      await this.initializeNetworkInterception();
      
      // Scan initial content
      await this.scanExistingContent();
      
      // Set maximum observation time
      setTimeout(() => {
        if (this.isActive) {
          console.log('⏱️ Maximum observation time reached, stopping...');
          this.stopObserving();
        }
      }, this.options.maxObservationTime);
      
      return this.stats;
    }
    
    // Stop all observation
    stopObserving() {
      if (!this.isActive) {return;}
      
      this.isActive = false;
      
      // Clean up all observers
      this.observers.forEach((observer, type) => {
        try {
          observer.disconnect();
          console.log(`✅ Disconnected ${type} observer`);
        } catch (error) {
          console.warn(`⚠️ Error disconnecting ${type} observer:`, error);
        }
      });
      
      this.observers.clear();
      
      // Restore network functions
      this.restoreNetworkFunctions();
      
      if (this.mutationTimeout) {
        clearTimeout(this.mutationTimeout);
        this.mutationTimeout = null;
      }
      
      console.log('🏁 Dynamic content observation stopped');
      console.log('📊 Final stats:', this.stats);
      
      return this.stats;
    }
    
    // Initialize mutation observer for DOM changes
    async initializeMutationObserver() {
      const mutationObserver = new MutationObserver((mutations) => {
        this.stats.totalMutations += mutations.length;
        
        // Debounce mutation handling
        if (this.mutationTimeout) {
          clearTimeout(this.mutationTimeout);
        }
        
        this.mutationTimeout = setTimeout(() => {
          this.handleMutations(mutations);
        }, this.options.mutationDebounceMs);
      });
      
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'data-src', 'data-lazy', 'data-original', 'srcset', 'data-srcset']
      });
      
      this.observers.set('mutation', mutationObserver);
      console.log('👁️ MutationObserver initialized');
    }
    
    // Initialize intersection observer for lazy loading
    async initializeIntersectionObserver() {
      const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.handleElementIntersection(entry.target);
          }
        });
      }, {
        threshold: this.options.intersectionThreshold,
        rootMargin: `${this.options.lazyLoadTriggerDistance}px`
      });
      
      this.observers.set('intersection', intersectionObserver);
      console.log('📐 IntersectionObserver initialized');
    }
    
    // Set up lazy loading detection
    async initializeLazyLoadDetection() {
      // Observe potential lazy load triggers
      const lazyElements = document.querySelectorAll(this.options.dynamicContentSelectors.join(', '));
      const intersectionObserver = this.observers.get('intersection');
      
      lazyElements.forEach(element => {
        if (intersectionObserver && element instanceof Element) {
          intersectionObserver.observe(element);
        }
      });
      
      console.log(`🔍 Observing ${lazyElements.length} potential lazy load elements`);
    }
    
    // Scan existing content for baseline
    async scanExistingContent() {
      const existingImages = document.querySelectorAll('img');
      const existingContainers = document.querySelectorAll(this.options.dynamicContainerSelectors.join(', '));
      
      existingImages.forEach(img => this.detectedElements.add(img));
      existingContainers.forEach(container => this.detectedElements.add(container));
      
      this.stats.elementsDetected = this.detectedElements.size;
      this.stats.dynamicContainersFound = existingContainers.length;
      
      console.log(`📊 Initial scan: ${existingImages.length} images, ${existingContainers.length} containers`);
    }
    
    // Handle DOM mutations
    handleMutations(mutations) {
      const newElements = new Set();
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNewElement(node, newElements);
            }
          });
        } else if (mutation.type === 'attributes') {
          // Handle attribute changes (e.g., src being set on lazy images)
          if (mutation.target && mutation.target instanceof Element) {
            this.processAttributeChange(mutation.target, mutation.attributeName);
          }
        }
      });
      
      if (newElements.size >= this.options.minNewElements) {
        console.log(`🆕 Detected ${newElements.size} new elements`);
        this.notifyCallback('mutation', Array.from(newElements));
      }
    }
    
    // Process newly added elements
    processNewElement(element, newElements) {
      // Check if element matches our selectors
      const matchesSelectors = this.options.dynamicContentSelectors.some(selector => {
        try {
          return element.matches(selector);
        } catch (error) {
          return false;
        }
      });
      
      if (matchesSelectors && !this.detectedElements.has(element)) {
        this.detectedElements.add(element);
        newElements.add(element);
        this.stats.elementsDetected++;
        
        // Start observing with intersection observer
        const intersectionObserver = this.observers.get('intersection');
        if (intersectionObserver && element instanceof Element) {
          intersectionObserver.observe(element);
        }
      }
      
      // Also check child elements
      if (element.querySelectorAll) {
        const childElements = element.querySelectorAll(this.options.dynamicContentSelectors.join(', '));
        childElements.forEach(child => {
          if (!this.detectedElements.has(child)) {
            this.detectedElements.add(child);
            newElements.add(child);
            this.stats.elementsDetected++;
            
            const intersectionObserver = this.observers.get('intersection');
            if (intersectionObserver && child instanceof Element) {
              intersectionObserver.observe(child);
            }
          }
        });
      }
    }
    
    // Handle attribute changes on elements
    processAttributeChange(element, attributeName) {
      if (['src', 'data-src', 'data-lazy', 'data-original'].includes(attributeName)) {
        console.log(`🔄 Attribute change detected: ${attributeName} on`, element);
        this.notifyCallback('attributeChange', [element]);
      }
    }
    
    // Handle element intersection (lazy loading trigger)
    handleElementIntersection(element) {
      console.log('👁️ Element intersected, potentially triggering lazy load:', element);
      
      // Try to trigger lazy loading
      this.triggerLazyLoad(element);
      
      this.stats.lazyImagesLoaded++;
      this.notifyCallback('intersection', [element]);
    }
    
    // Attempt to trigger lazy loading
    triggerLazyLoad(element) {
      try {
        // Common lazy loading attribute patterns
        const lazyAttributes = ['data-src', 'data-lazy', 'data-original'];
        
        lazyAttributes.forEach(attr => {
          const value = element.getAttribute(attr);
          if (value && !element.src) {
            element.src = value;
            console.log(`🚀 Triggered lazy load: ${attr} -> src`);
          }
        });
        
        // Trigger scroll event to activate lazy loading scripts
        element.dispatchEvent(new Event('load'));
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
      } catch (error) {
        console.warn('⚠️ Error triggering lazy load:', error);
      }
    }
    
    // Initialize network request interception
    async initializeNetworkInterception() {
      console.log('🌐 Setting up network request interception...');
      
      // Store original functions
      this.originalFetch = window.fetch;
      this.originalXHROpen = XMLHttpRequest.prototype.open;
      this.originalXHRSend = XMLHttpRequest.prototype.send;
      
      // Intercept fetch requests
      window.fetch = async (...args) => {
        this.stats.networkRequestsDetected++;
        
        try {
          const response = await this.originalFetch.apply(this, args);
          this.processNetworkResponse(response, 'fetch', args[0]);
          return response;
        } catch (error) {
          console.warn('⚠️ Error in intercepted fetch:', error);
          throw error;
        }
      };
      
      // Intercept XMLHttpRequest
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._method = method;
        this._url = url;
        return this.originalXHROpen.call(this, method, url, ...rest);
      };
      
      XMLHttpRequest.prototype.send = function(data) {
        const observer = window.dynamicContentObserver;
        if (observer) {
          observer.stats.networkRequestsDetected++;
          
          this.addEventListener('load', () => {
            observer.processNetworkResponse(this, 'xhr', this._url);
          });
        }
        
        return this.originalXHRSend.call(this, data);
      };
      
      console.log('✅ Network interception initialized');
    }
    
    // Process network responses to detect dynamic content
    processNetworkResponse(response, type, url) {
      try {
        // Enhanced suspicious pattern detection from example extensions
        const suspiciousPatterns = [
          /\/api\//i, /\/ajax\//i, /\/products\//i, /\/gallery\//i,
          /\/search\//i, /\/catalog\//i, /\/items\//i, /\/images\//i,
          /\.json$/i, /\/data\//i, /\/feed\//i, /\/list\//i,
          /\/more\//i, /\/load\//i, /\/page\//i, /\/filter\//i
        ];
        
        const urlString = url ? url.toString() : '';
        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(urlString));
        
        if (isSuspicious) {
          this.stats.apiCallsIntercepted++;
          console.log(`🕵️ Intercepted suspicious ${type} request:`, urlString);
          
          // Check response content for image-related data
          if (type === 'fetch' && response.text) {
            response.text().then(text => {
              if (text.includes('img') || text.includes('image') || text.includes('src=') || text.includes('url(')) {
                console.log('📸 Response contains image-related content');
                this.scanForNewContent('networkResponse');
              }
            }).catch(() => {});
          } else if (type === 'xhr' && response.responseText) {
            if (response.responseText.includes('img') || response.responseText.includes('image') || 
                response.responseText.includes('src=') || response.responseText.includes('url(')) {
              console.log('📸 XHR response contains image-related content');
              this.scanForNewContent('networkResponse');
            }
          }
          
          // Wait for DOM updates, then scan for new content
          setTimeout(() => {
            this.scanForNewContent('networkResponse');
          }, 500);
        }
      } catch (error) {
        console.warn('⚠️ Error processing network response:', error);
      }
    }

    // Enhanced CSS background image extraction from example extensions
    getCssBackgroundImages(doc = document) {
      const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/i;
      const backgroundImages = new Set();
      
      try {
        const elements = doc.querySelectorAll('*');
        for (const node of elements) {
          try {
            const computedStyle = window.getComputedStyle(node, null);
            const bgImage = computedStyle.getPropertyValue('background-image');
            const match = srcChecker.exec(bgImage);
            if (match && match[1] && match[1] !== 'none') {
              let url = match[1];
              // Clean up the URL
              if (url.startsWith('"') && url.endsWith('"')) {
                url = url.slice(1, -1);
              }
              if (url.startsWith("'") && url.endsWith("'")) {
                url = url.slice(1, -1);
              }
              // Convert relative URLs to absolute
              if (url.startsWith('//')) {
                url = window.location.protocol + url;
              } else if (url.startsWith('/')) {
                url = window.location.origin + url;
              } else if (!url.startsWith('http') && !url.startsWith('data:')) {
                url = new URL(url, window.location.href).href;
              }
              
              if (this.isValidImageUrl(url)) {
                backgroundImages.add(url);
              }
            }
          } catch (e) {
            // Skip elements that cause errors
            continue;
          }
        }
      } catch (e) {
        console.warn('Error extracting CSS background images:', e);
      }
      
      return Array.from(backgroundImages);
    }

    // Check if URL is a valid image URL
    isValidImageUrl(url) {
      if (!url || typeof url !== 'string') {return false;}
      
      // Skip data URLs that are too small (likely placeholders)
      if (url.startsWith('data:image/')) {
        return url.length > 100; // Arbitrary threshold for meaningful images
      }
      
      // Check for image file extensions
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)($|\?|#)/i;
      if (imageExtensions.test(url)) {return true;}
      
      // Check for common image hosting patterns
      const imageHostingPatterns = [
        /\/images?\//i,
        /\/img\//i,
        /\/pics?\//i,
        /\/photos?\//i,
        /\/media\//i,
        /\/uploads?\//i,
        /\/assets?\//i,
        /\/thumbnails?\//i,
        /\/gallery\//i
      ];
      
      return imageHostingPatterns.some(pattern => pattern.test(url));
    }
    
    // Scan for new content after network activity
    scanForNewContent(trigger) {
      const currentElements = document.querySelectorAll(
        this.options.dynamicContentSelectors.join(', ')
      );
      
      const newElements = [];
      currentElements.forEach(element => {
        if (!this.detectedElements.has(element)) {
          this.detectedElements.add(element);
          newElements.push(element);
        }
      });
      
      if (newElements.length > 0) {
        console.log(`🆕 Found ${newElements.length} new elements after ${trigger}`);
        this.notifyCallback('networkTriggered', newElements);
      }
    }
    
    // Cleanup network interception
    restoreNetworkFunctions() {
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
      }
      if (this.originalXHROpen) {
        XMLHttpRequest.prototype.open = this.originalXHROpen;
      }
      if (this.originalXHRSend) {
        XMLHttpRequest.prototype.send = this.originalXHRSend;
      }
      console.log('🔄 Network functions restored');
    }
    
    // Notify registered callbacks
    notifyCallback(type, elements) {
      this.callbacks.forEach((callback, name) => {
        try {
          callback({
            type,
            elements,
            stats: { ...this.stats },
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn(`⚠️ Error in callback ${name}:`, error);
        }
      });
    }
    
    // Get current statistics
    getStats() {
      return {
        ...this.stats,
        isActive: this.isActive,
        observationDuration: this.observationStartTime ? Date.now() - this.observationStartTime : 0,
        detectedElementsCount: this.detectedElements.size
      };
    }
    
    // Force a rescan of the page
    async forceScan() {
      console.log('🔄 Forcing content rescan...');
      
      const allImages = document.querySelectorAll('img');
      const allContainers = document.querySelectorAll(this.options.dynamicContainerSelectors.join(', '));
      const newElements = [];
      
      allImages.forEach(img => {
        if (!this.detectedElements.has(img)) {
          this.detectedElements.add(img);
          newElements.push(img);
        }
      });
      
      allContainers.forEach(container => {
        if (!this.detectedElements.has(container)) {
          this.detectedElements.add(container);
          newElements.push(container);
        }
      });
      
      if (newElements.length > 0) {
        console.log(`🆕 Force scan found ${newElements.length} new elements`);
        this.notifyCallback('forceScan', newElements);
      }
      
      return newElements;
    }
  }
  
  // Export to global scope
  window.DynamicContentObserver = DynamicContentObserver;
  console.log('✅ DynamicContentObserver loaded successfully');
}