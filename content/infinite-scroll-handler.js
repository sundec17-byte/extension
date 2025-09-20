// infinite-scroll-handler.js - Advanced infinite scroll detection and management  
// Addresses: Pagination handling for sites with infinite scrolling

// Prevent duplicate declarations
if (window.InfiniteScrollHandler) {
  console.log('InfiniteScrollHandler already loaded, skipping...');
} else {

  class InfiniteScrollHandler {
    constructor(options = {}) {
      this.options = {
        // Scroll behavior configuration
        scrollTimeout: options.scrollTimeout || 1000,
        maxScrollAttempts: options.maxScrollAttempts || 50,
        scrollStep: options.scrollStep || 500,
        stagnationThreshold: options.stagnationThreshold || 3,
        
        // Detection configuration
        itemCountThreshold: options.itemCountThreshold || 2,
        loadMoreDelay: options.loadMoreDelay || 2000,
        networkTimeout: options.networkTimeout || 10000,
        
        // Selectors for different infinite scroll patterns
        loadMoreSelectors: options.loadMoreSelectors || [
          '[data-testid*="load-more"]', '[data-testid*="show-more"]',
          '.load-more', '.show-more', '.load-next', '.more-button',
          'button[aria-label*="more"]', 'button[aria-label*="load"]',
          '.pagination .next', '.pagination .continue',
          '[class*="LoadMore"]', '[class*="ShowMore"]'
        ],
        
        // Container selectors to monitor for new content
        contentSelectors: options.contentSelectors || [
          '[data-testid*="gallery"]', '[data-testid*="grid"]', 
          '[data-testid*="list"]', '[data-testid*="feed"]',
          '.gallery', '.grid', '.masonry', '.feed', '.items',
          '.products', '.results', '.content-list',
          'main', '[role="main"]', '.main-content'
        ],
        
        // Element selectors to count for progress tracking
        itemSelectors: options.itemSelectors || [
          'img', '.item', '.card', '.product', '.post',
          '[data-testid*="item"]', '[data-testid*="card"]',
          '.gallery-item', '.grid-item', '.feed-item'
        ],
        
        ...options
      };
      
      this.state = {
        isActive: false,
        scrollAttempts: 0,
        lastItemCount: 0,
        stagnantChecks: 0,
        totalItemsFound: 0,
        isLoading: false,
        networkRequests: new Set()
      };
      
      this.observers = new Map();
      this.callbacks = new Map();
      this.itemHistory = [];
      this.scrollPattern = [];
      
      // Performance tracking
      this.metrics = {
        scrollsPerformed: 0,
        itemsLoaded: 0,
        loadMoreClicks: 0,
        networkRequestsDetected: 0,
        averageLoadTime: 0,
        patterns: new Map(),
        userInteractionTypes: new Map()
      };
      
      this.initializeAdvancedDetection();
    }
    
    // Initialize advanced detection patterns and user interaction strategies
    initializeAdvancedDetection() {
      // Enhanced load more button detection patterns - inspired by example extensions
      this.advancedLoadMorePatterns = [
        // Text-based detection with enhanced patterns
        {
          type: 'text',
          selectors: ['button', 'a', '[role="button"]', '.btn', 'span', 'div'],
          textPatterns: [
            /load\s*more/i, /show\s*more/i, /see\s*more/i, /view\s*more/i,
            /more\s*results/i, /continue/i, /next\s*page/i, /load\s*next/i,
            /show\s*all/i, /expand/i, /more\s*items/i, /load\s*additional/i,
            // Enhanced patterns from example extensions
            /więcej/i, /more$/i, /plus$/i, /\+\s*more/i, /show.*all/i,
            /load.*new/i, /fetch.*more/i, /get.*more/i, /view.*all/i,
            /explore.*more/i, /discover.*more/i, /browse.*more/i
          ]
        },
        // ARIA label detection with enhanced patterns
        {
          type: 'aria',
          selectors: ['[aria-label]', '[aria-describedby]', '[aria-labelledby]'],
          ariaPatterns: [
            /load.*more/i, /show.*more/i, /next.*page/i, /continue/i,
            /more.*content/i, /additional.*items/i, /expand.*list/i,
            /pagination.*next/i, /scroll.*more/i
          ]
        },
        // Data attribute detection (common in modern frameworks)
        {
          type: 'data',
          selectors: ['[data-*]'],
          dataPatterns: [
            /data-action.*load/i, /data-action.*more/i, /data-action.*next/i,
            /data-load.*more/i, /data-show.*more/i, /data-pagination/i,
            /data-infinite.*scroll/i, /data-lazy.*load/i
          ]
        },
        // Enhanced visual detection
        {
          type: 'visual',
          selectors: ['button', '.btn', '[role="button"]', 'a'],
          visualChecks: [
            'positioned at bottom of content',
            'contains loading spinner',
            'styled as call-to-action button',
            'has spinner icon',
            'has arrow or chevron icon',
            'appears on scroll'
          ]
        },
        // Class name detection patterns
        {
          type: 'className',
          selectors: ['*'],
          classPatterns: [
            /.*load.*more.*/i, /.*show.*more.*/i, /.*next.*page.*/i,
            /.*pagination.*next.*/i, /.*infinite.*scroll.*/i, /.*lazy.*load.*/i,
            /.*more.*btn.*/i, /.*load.*btn.*/i, /.*continue.*btn.*/i,
            /.*expand.*btn.*/i, /.*view.*more.*/i
          ]
        }
      ];
      
      // Enhanced user interaction simulation strategies
      this.interactionStrategies = [
        {
          name: 'smoothScroll',
          priority: 1,
          action: this.performSmoothScroll.bind(this)
        },
        {
          name: 'buttonClick',
          priority: 2,
          action: this.performButtonClick.bind(this)
        },
        {
          name: 'multipleClicks',
          priority: 3,
          action: this.performMultipleClicks.bind(this)
        },
        {
          name: 'keyboardNavigation',
          priority: 4,
          action: this.performKeyboardScroll.bind(this)
        },
        {
          name: 'touchEvents',
          priority: 5,
          action: this.performTouchEvents.bind(this)
        },
        {
          name: 'forceScroll',
          priority: 6,
          action: this.performForceScroll.bind(this)
        },
        {
          name: 'triggerEvent',
          priority: 7,
          action: this.performEventTrigger.bind(this)
        }
      ];
      
      console.log('🔧 Enhanced detection patterns initialized with', this.advancedLoadMorePatterns.length, 'pattern types');
    }
    
    // Enhanced load more button detection
    detectLoadMoreElements() {
      const candidates = [];
      
      this.advancedLoadMorePatterns.forEach(pattern => {
        pattern.selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          
          elements.forEach(element => {
            let score = 0;
            let reasons = [];
            
            // Check text patterns
            if (pattern.textPatterns) {
              const text = element.textContent.trim();
              const matches = pattern.textPatterns.some(regex => regex.test(text));
              if (matches) {
                score += 0.8;
                reasons.push(`text match: "${text}"`);
              }
            }
            
            // Check ARIA patterns
            if (pattern.ariaPatterns) {
              const ariaLabel = element.getAttribute('aria-label') || '';
              const ariaDesc = element.getAttribute('aria-describedby') || '';
              const ariaLabelledBy = element.getAttribute('aria-labelledby') || '';
              const ariaText = (ariaLabel + ' ' + ariaDesc + ' ' + ariaLabelledBy).trim();
              
              if (pattern.ariaPatterns.some(regex => regex.test(ariaText))) {
                score += 0.9;
                reasons.push(`aria match: "${ariaText}"`);
              }
            }
            
            // Check data attribute patterns (new from example extensions)
            if (pattern.dataPatterns) {
              const dataAttrs = Array.from(element.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => `${attr.name}=${attr.value}`)
                .join(' ');
              
              if (pattern.dataPatterns.some(regex => regex.test(dataAttrs))) {
                score += 0.85;
                reasons.push(`data attribute match: "${dataAttrs}"`);
              }
            }
            
            // Check class name patterns (new from example extensions)
            if (pattern.classPatterns) {
              const className = element.className;
              if (className && pattern.classPatterns.some(regex => regex.test(className))) {
                score += 0.7;
                reasons.push(`class match: "${className}"`);
              }
            }
            
            // Visual checks (enhanced)
            if (pattern.visualChecks && this.isElementAtBottom(element)) {
              score += 0.6;
              reasons.push('positioned at bottom');
              
              // Additional visual checks
              const hasSpinner = element.querySelector('.spinner, .loading, .loader');
              const hasIcon = element.querySelector('svg, .icon, .fa-');
              if (hasSpinner) {
                score += 0.2;
                reasons.push('has loading indicator');
              }
              if (hasIcon) {
                score += 0.1;
                reasons.push('has icon');
              }
            }
            
            // Visibility check
            if (this.isElementVisible(element)) {
              score += 0.3;
              reasons.push('visible');
            }
            
            // Enhanced scoring for clickable elements
            if (['button', 'a'].includes(element.tagName.toLowerCase()) || 
                element.getAttribute('role') === 'button') {
              score += 0.2;
              reasons.push('clickable element');
            }
            
            if (score > 0.5) {
              candidates.push({
                element,
                score,
                reasons,
                type: pattern.type
              });
            }
          });
        });
      });
      
      // Sort by score and remove duplicates
      const uniqueCandidates = [];
      const seenElements = new Set();
      
      candidates
        .sort((a, b) => b.score - a.score)
        .forEach(candidate => {
          if (!seenElements.has(candidate.element)) {
            seenElements.add(candidate.element);
            uniqueCandidates.push(candidate);
          }
        });
      
      console.log(`🎯 Found ${uniqueCandidates.length} unique load more candidates`);
      uniqueCandidates.slice(0, 3).forEach((candidate, i) => {
        console.log(`  ${i + 1}. Score: ${candidate.score.toFixed(2)}, Type: ${candidate.type}, Reasons: ${candidate.reasons.join(', ')}`);
      });
      
      return uniqueCandidates;
    }
    
    // Check if element is at bottom of page/container
    isElementAtBottom(element) {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Consider "bottom" as lower 30% of viewport
      return rect.top > viewportHeight * 0.7;
    }
    
    // Check if element is visible
    isElementVisible(element) {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && 
             rect.top >= 0 && rect.top <= window.innerHeight;
    }
    
    // Enhanced smooth scroll with multiple strategies
    async performSmoothScroll() {
      console.log('📜 Performing smooth scroll...');
      
      try {
        // Strategy 1: Scroll to bottom
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
        
        await this.waitForLoad(1000);
        
        // Strategy 2: Incremental scroll
        const currentScroll = window.pageYOffset;
        const targetScroll = currentScroll + this.options.scrollStep;
        
        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
        
        this.metrics.scrollsPerformed++;
        return true;
      } catch (error) {
        console.warn('⚠️ Error in smooth scroll:', error);
        return false;
      }
    }
    
    // Enhanced button click with candidate scoring
    async performButtonClick() {
      console.log('🖱️ Attempting load more button click...');
      
      const candidates = this.detectLoadMoreElements();
      
      for (const candidate of candidates.slice(0, 3)) { // Try top 3 candidates
        try {
          console.log(`Trying button: ${candidate.reasons.join(', ')}`);
          
          // Scroll into view first
          candidate.element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          await this.waitForLoad(500);
          
          // Try different click methods
          const clickMethods = [
            () => candidate.element.click(),
            () => candidate.element.dispatchEvent(new MouseEvent('click', { bubbles: true })),
            () => candidate.element.dispatchEvent(new Event('mousedown')),
            () => candidate.element.dispatchEvent(new Event('mouseup'))
          ];
          
          for (const clickMethod of clickMethods) {
            try {
              clickMethod();
              this.metrics.loadMoreClicks++;
              
              // Wait and check if content loaded
              await this.waitForLoad(this.options.loadMoreDelay);
              
              if (this.hasNewItemsLoaded()) {
                console.log('✅ Button click successful');
                return true;
              }
            } catch (clickError) {
              console.warn('⚠️ Click method failed:', clickError);
            }
          }
        } catch (error) {
          console.warn('⚠️ Error clicking candidate:', error);
        }
      }
      
      return false;
    }
    
    // Keyboard-based scroll simulation
    async performKeyboardScroll() {
      console.log('⌨️ Performing keyboard scroll...');
      
      try {
        // Focus on body or main content
        const focusTarget = document.querySelector('main') || document.body;
        focusTarget.focus();
        
        // Simulate page down key
        focusTarget.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'PageDown',
          code: 'PageDown',
          bubbles: true
        }));
        
        await this.waitForLoad(1000);
        
        // Alternative: Use End key to jump to bottom
        focusTarget.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'End',
          code: 'End',
          bubbles: true
        }));
        
        return true;
      } catch (error) {
        console.warn('⚠️ Error in keyboard scroll:', error);
        return false;
      }
    }
    
    // Force scroll for stubborn sites
    async performForceScroll() {
      console.log('💪 Performing force scroll...');
      
      try {
        // Direct DOM manipulation
        const currentHeight = document.body.scrollHeight;
        document.documentElement.scrollTop = currentHeight;
        
        await this.waitForLoad(1000);
        
        // Trigger scroll events manually
        window.dispatchEvent(new Event('scroll'));
        document.dispatchEvent(new Event('scroll'));
        
        return true;
      } catch (error) {
        console.warn('⚠️ Error in force scroll:', error);
        return false;
      }
    }
    
    // Custom event triggering
    async performEventTrigger() {
      console.log('⚡ Triggering custom events...');
      
      try {
        // Common events that trigger infinite scroll
        const events = ['scroll', 'resize', 'load', 'DOMContentLoaded'];
        
        events.forEach(eventType => {
          window.dispatchEvent(new Event(eventType));
          document.dispatchEvent(new Event(eventType));
        });
        
        // Trigger on scroll containers
        const scrollContainers = document.querySelectorAll(
          this.options.contentSelectors.join(', ')
        );
        
        scrollContainers.forEach(container => {
          container.dispatchEvent(new Event('scroll'));
        });
        
        return true;
      } catch (error) {
        console.warn('⚠️ Error triggering events:', error);
        return false;
      }
    }

    // Multiple clicks strategy - enhanced from example extensions
    async performMultipleClicks() {
      console.log('🖱️🖱️ Performing multiple clicks strategy...');
      
      try {
        const candidates = this.detectLoadMoreElements();
        if (candidates.length === 0) return false;
        
        const button = candidates[0].element;
        
        // Try multiple click sequences
        const clickSequences = [
          // Single click
          () => button.click(),
          // Double click
          () => {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            setTimeout(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })), 100);
          },
          // Mouse events sequence
          () => {
            button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        ];
        
        for (const sequence of clickSequences) {
          try {
            sequence();
            await this.waitForLoad(1000);
            if (this.hasNewItemsLoaded()) {
              console.log('✅ Multiple clicks strategy successful');
              return true;
            }
          } catch (error) {
            console.warn('⚠️ Click sequence failed:', error);
          }
        }
        
        return false;
      } catch (error) {
        console.warn('⚠️ Error in multiple clicks strategy:', error);
        return false;
      }
    }

    // Touch events simulation - for mobile-responsive sites
    async performTouchEvents() {
      console.log('👆 Performing touch events simulation...');
      
      try {
        // Simulate touch scroll to bottom
        const startY = window.innerHeight / 2;
        const endY = window.innerHeight - 100;
        
        // Touch start
        document.dispatchEvent(new TouchEvent('touchstart', {
          touches: [{
            clientX: window.innerWidth / 2,
            clientY: startY,
            pageX: window.innerWidth / 2,
            pageY: startY
          }],
          bubbles: true
        }));
        
        // Touch move (scroll down)
        document.dispatchEvent(new TouchEvent('touchmove', {
          touches: [{
            clientX: window.innerWidth / 2,
            clientY: endY,
            pageX: window.innerWidth / 2,
            pageY: endY
          }],
          bubbles: true
        }));
        
        // Touch end
        document.dispatchEvent(new TouchEvent('touchend', {
          changedTouches: [{
            clientX: window.innerWidth / 2,
            clientY: endY,
            pageX: window.innerWidth / 2,
            pageY: endY
          }],
          bubbles: true
        }));
        
        await this.waitForLoad(1000);
        
        // Check for touch-specific load more elements
        const touchElements = document.querySelectorAll('[data-touch]', '[ontouchstart]');
        for (const element of touchElements) {
          if (this.isElementVisible(element)) {
            element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
            element.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
          }
        }
        
        return true;
      } catch (error) {
        console.warn('⚠️ Error in touch events simulation:', error);
        return false;
      }
    }
    
    // Check if new items have loaded
    hasNewItemsLoaded() {
      const currentItemCount = this.getCurrentItemCount();
      const hasNew = currentItemCount > this.state.lastItemCount;
      
      if (hasNew) {
        console.log(`📈 Items increased from ${this.state.lastItemCount} to ${currentItemCount}`);
        this.state.lastItemCount = currentItemCount;
        this.metrics.itemsLoaded += (currentItemCount - this.state.lastItemCount);
      }
      
      return hasNew;
    }
    
    // Wait for content to load with timeout
    async waitForLoad(timeout = 2000) {
      return new Promise(resolve => {
        setTimeout(resolve, timeout);
      });
    }
    
    // Start infinite scroll handling
    async startScrolling(callback, targetItemCount = null) {
      if (this.state.isActive) {
        console.warn('InfiniteScrollHandler already active');
        return false;
      }
      
      this.state.isActive = true;
      this.state.scrollAttempts = 0;
      this.state.lastItemCount = this.getCurrentItemCount();
      this.callbacks.set('main', callback);
      
      console.log('🔄 Starting infinite scroll handling...');
      console.log(`📊 Initial item count: ${this.state.lastItemCount}`);
      
      // Initialize monitoring
      await this.initializeMonitoring();
      
      // Start the scroll loop
      const result = await this.performScrollLoop(targetItemCount);
      
      console.log('🏁 Infinite scroll completed:', result);
      return result;
    }
    
    // Stop scrolling and cleanup
    stopScrolling() {
      if (!this.state.isActive) return;
      
      this.state.isActive = false;
      
      // Disconnect all observers
      this.observers.forEach((observer, type) => {
        try {
          observer.disconnect();
          console.log(`✅ Disconnected ${type} observer`);
        } catch (error) {
          console.warn(`⚠️ Error disconnecting ${type} observer:`, error);
        }
      });
      
      this.observers.clear();
      
      console.log('🛑 Infinite scroll handler stopped');
      console.log('📊 Final metrics:', this.getMetrics());
    }
    
    // Initialize monitoring systems
    async initializeMonitoring() {
      // Network request monitoring
      this.initializeNetworkMonitoring();
      
      // DOM change monitoring
      this.initializeDOMMonitoring();
      
      // Scroll position monitoring
      this.initializeScrollMonitoring();
      
      // Load more button monitoring
      this.initializeLoadMoreMonitoring();
    }
    
    // Monitor network requests to detect loading
    initializeNetworkMonitoring() {
      const originalFetch = window.fetch;
      const originalXHROpen = XMLHttpRequest.prototype.open;
      
      // Monitor fetch requests
      window.fetch = async (...args) => {
        const requestId = Date.now() + Math.random();
        this.state.networkRequests.add(requestId);
        this.metrics.networkRequestsDetected++;
        
        console.log('🌐 Network request detected (fetch)');
        
        try {
          const response = await originalFetch(...args);
          this.state.networkRequests.delete(requestId);
          this.notifyCallback('networkRequest', { type: 'fetch', response });
          return response;
        } catch (error) {
          this.state.networkRequests.delete(requestId);
          throw error;
        }
      };
      
      // Monitor XHR requests
      XMLHttpRequest.prototype.open = function(...args) {
        const requestId = Date.now() + Math.random();
        this._requestId = requestId;
        
        this.addEventListener('loadstart', () => {
          this.state?.networkRequests?.add(requestId);
          this.metrics.networkRequestsDetected++;
          console.log('🌐 Network request detected (XHR)');
        });
        
        this.addEventListener('loadend', () => {
          this.state?.networkRequests?.delete(requestId);
          this.notifyCallback?.('networkRequest', { type: 'xhr', xhr: this });
        });
        
        return originalXHROpen.apply(this, args);
      };
    }
    
    // Monitor DOM changes for new content
    initializeDOMMonitoring() {
      const mutationObserver = new MutationObserver((mutations) => {
        let significantChange = false;
        
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if new content was added
            const hasNewItems = Array.from(mutation.addedNodes).some(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                return this.options.itemSelectors.some(selector => {
                  try {
                    return node.matches(selector) || node.querySelector(selector);
                  } catch (error) {
                    return false;
                  }
                });
              }
              return false;
            });
            
            if (hasNewItems) {
              significantChange = true;
            }
          }
        });
        
        if (significantChange) {
          console.log('🆕 New content detected via DOM mutation');
          this.handleContentChange();
        }
      });
      
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      this.observers.set('mutation', mutationObserver);
    }
    
    // Monitor scroll position
    initializeScrollMonitoring() {
      let scrollTimeout;
      
      const scrollHandler = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const scrollProgress = this.getScrollProgress();
          this.scrollPattern.push({
            timestamp: Date.now(),
            scrollTop: window.pageYOffset,
            progress: scrollProgress
          });
          
          // Keep only recent scroll history
          if (this.scrollPattern.length > 20) {
            this.scrollPattern.shift();
          }
          
          this.notifyCallback('scroll', { progress: scrollProgress });
        }, 100);
      };
      
      window.addEventListener('scroll', scrollHandler, { passive: true });
      
      // Store cleanup function
      this.observers.set('scroll', {
        disconnect: () => window.removeEventListener('scroll', scrollHandler)
      });
    }
    
    // Monitor for "load more" buttons
    initializeLoadMoreMonitoring() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            console.log('👁️ Load more button is visible:', entry.target);
            this.handleLoadMoreVisible(entry.target);
          }
        });
      }, {
        threshold: 0.5,
        rootMargin: '100px'
      });
      
      // Find and observe load more buttons
      this.findAndObserveLoadMoreButtons(observer);
      
      this.observers.set('loadMore', observer);
    }
    
    // Main scroll loop
    async performScrollLoop(targetItemCount) {
      const startTime = Date.now();
      let lastScrollTime = Date.now();
      
      while (this.state.isActive && this.state.scrollAttempts < this.options.maxScrollAttempts) {
        const currentItemCount = this.getCurrentItemCount();
        const scrollProgress = this.getScrollProgress();
        
        console.log(`🔄 Scroll attempt ${this.state.scrollAttempts + 1}/${this.options.maxScrollAttempts}`);
        console.log(`📊 Items: ${currentItemCount}, Progress: ${(scrollProgress * 100).toFixed(1)}%`);
        
        // Check if we've reached target
        if (targetItemCount && currentItemCount >= targetItemCount) {
          console.log(`🎯 Target item count reached: ${currentItemCount}/${targetItemCount}`);
          break;
        }
        
        // Check for stagnation
        if (currentItemCount === this.state.lastItemCount) {
          this.state.stagnantChecks++;
          console.log(`⏸️ No new items found (${this.state.stagnantChecks}/${this.options.stagnationThreshold})`);
          
          if (this.state.stagnantChecks >= this.options.stagnationThreshold) {
            console.log('🛑 Stagnation threshold reached, stopping');
            break;
          }
        } else {
          this.state.stagnantChecks = 0;
          this.metrics.itemsLoaded += (currentItemCount - this.state.lastItemCount);
          this.state.lastItemCount = currentItemCount;
        }
        
        // Try different scroll strategies
        const scrollSuccess = await this.attemptScroll();
        
        if (!scrollSuccess) {
          console.log('⚠️ Scroll attempt failed');
        }
        
        this.state.scrollAttempts++;
        this.metrics.scrollsPerformed++;
        
        // Wait for content to load
        await this.waitForContent();
        
        // Update metrics
        lastScrollTime = Date.now();
      }
      
      const totalTime = Date.now() - startTime;
      const finalItemCount = this.getCurrentItemCount();
      
      return {
        success: finalItemCount > this.state.lastItemCount,
        finalItemCount,
        scrollAttempts: this.state.scrollAttempts,
        duration: totalTime,
        reason: this.getStopReason(),
        metrics: this.getMetrics()
      };
    }
    
    // Attempt to scroll using various strategies
    async attemptScroll() {
      // Strategy 1: Try clicking load more button
      const loadMoreButton = this.findLoadMoreButton();
      if (loadMoreButton) {
        console.log('🖱️ Clicking load more button');
        try {
          await this.clickLoadMoreButton(loadMoreButton);
          this.metrics.loadMoreClicks++;
          return true;
        } catch (error) {
          console.warn('⚠️ Failed to click load more button:', error);
        }
      }
      
      // Strategy 2: Scroll to bottom
      console.log('⬇️ Scrolling to bottom');
      const beforeScroll = window.pageYOffset;
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
      
      // Wait for scroll to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const afterScroll = window.pageYOffset;
      const scrolled = Math.abs(afterScroll - beforeScroll) > 100;
      
      if (!scrolled) {
        // Strategy 3: Try keyboard navigation
        console.log('⌨️ Trying keyboard navigation');
        document.body.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return scrolled;
    }
    
    // Wait for content to load after scroll
    async waitForContent() {
      const maxWaitTime = this.options.loadMoreDelay;
      const startTime = Date.now();
      
      console.log('⏳ Waiting for content to load...');
      
      // Wait for network requests to complete
      while (this.state.networkRequests.size > 0 && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Additional wait for DOM to settle
      await new Promise(resolve => setTimeout(resolve, Math.min(1000, this.options.scrollTimeout)));
      
      console.log(`✅ Content wait completed (${Date.now() - startTime}ms)`);
    }
    
    // Find load more button
    findLoadMoreButton() {
      for (const selector of this.options.loadMoreSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (this.isElementVisible(element) && this.isClickable(element)) {
              return element;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error with selector "${selector}":`, error);
        }
      }
      return null;
    }
    
    // Click load more button with various strategies
    async clickLoadMoreButton(button) {
      console.log('🖱️ Attempting to click load more button:', button);
      
      // Scroll button into view first
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try different click methods
      const clickMethods = [
        () => button.click(),
        () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        () => {
          const event = new MouseEvent('mousedown', { bubbles: true });
          button.dispatchEvent(event);
          button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      ];
      
      for (const clickMethod of clickMethods) {
        try {
          clickMethod();
          console.log('✅ Load more button clicked successfully');
          return;
        } catch (error) {
          console.warn('⚠️ Click method failed:', error);
        }
      }
      
      throw new Error('All click methods failed');
    }
    
    // Find and observe load more buttons
    findAndObserveLoadMoreButtons(observer) {
      this.options.loadMoreSelectors.forEach(selector => {
        try {
          const buttons = document.querySelectorAll(selector);
          buttons.forEach(button => {
            if (this.isElementVisible(button)) {
              observer.observe(button);
              console.log(`👁️ Observing load more button: ${selector}`);
            }
          });
        } catch (error) {
          console.warn(`⚠️ Error observing selector "${selector}":`, error);
        }
      });
    }
    
    // Handle load more button becoming visible
    async handleLoadMoreVisible(button) {
      if (!this.state.isActive || this.state.isLoading) return;
      
      console.log('👁️ Load more button visible, attempting click');
      
      try {
        this.state.isLoading = true;
        await this.clickLoadMoreButton(button);
        await this.waitForContent();
      } catch (error) {
        console.warn('⚠️ Error handling visible load more button:', error);
      } finally {
        this.state.isLoading = false;
      }
    }
    
    // Handle content changes
    handleContentChange() {
      const currentItemCount = this.getCurrentItemCount();
      
      if (currentItemCount > this.state.lastItemCount) {
        console.log(`🆕 Content changed: ${this.state.lastItemCount} -> ${currentItemCount} items`);
        
        this.itemHistory.push({
          timestamp: Date.now(),
          itemCount: currentItemCount,
          scrollAttempt: this.state.scrollAttempts
        });
        
        this.notifyCallback('contentChange', {
          previousCount: this.state.lastItemCount,
          currentCount: currentItemCount,
          newItems: currentItemCount - this.state.lastItemCount
        });
      }
    }
    
    // Get current item count
    getCurrentItemCount() {
      let totalCount = 0;
      
      this.options.itemSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          totalCount += elements.length;
        } catch (error) {
          // Ignore invalid selectors
        }
      });
      
      return totalCount;
    }
    
    // Get scroll progress (0-1)
    getScrollProgress() {
      const scrollTop = window.pageYOffset;
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      
      if (documentHeight <= windowHeight) return 1;
      
      return scrollTop / (documentHeight - windowHeight);
    }
    
    // Check if element is visible
    isElementVisible(element) {
      if (!element) return false;
      
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return rect.width > 0 && 
             rect.height > 0 && 
             style.display !== 'none' && 
             style.visibility !== 'hidden' &&
             style.opacity !== '0';
    }
    
    // Check if element is clickable
    isClickable(element) {
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      return style.pointerEvents !== 'none' && 
             !element.disabled &&
             element.offsetParent !== null;
    }
    
    // Get reason for stopping
    getStopReason() {
      if (this.state.scrollAttempts >= this.options.maxScrollAttempts) {
        return 'maxAttemptsReached';
      }
      if (this.state.stagnantChecks >= this.options.stagnationThreshold) {
        return 'stagnationDetected';
      }
      if (!this.state.isActive) {
        return 'stoppedManually';
      }
      return 'completed';
    }
    
    // Notify callbacks
    notifyCallback(type, data) {
      this.callbacks.forEach((callback, name) => {
        try {
          callback({
            type,
            data,
            state: { ...this.state },
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn(`⚠️ Error in callback ${name}:`, error);
        }
      });
    }
    
    // Get performance metrics
    getMetrics() {
      return {
        ...this.metrics,
        scrollEfficiency: this.metrics.itemsLoaded / Math.max(this.metrics.scrollsPerformed, 1),
        networkEfficiency: this.metrics.itemsLoaded / Math.max(this.metrics.networkRequestsDetected, 1),
        loadMoreEfficiency: this.metrics.itemsLoaded / Math.max(this.metrics.loadMoreClicks, 1),
        averageItemsPerScroll: this.metrics.itemsLoaded / Math.max(this.metrics.scrollsPerformed, 1)
      };
    }
  }
  
  // Export to global scope
  window.InfiniteScrollHandler = InfiniteScrollHandler;
  console.log('✅ InfiniteScrollHandler loaded successfully');
}