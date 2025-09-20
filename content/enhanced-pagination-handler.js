// enhanced-pagination-handler.js - Production-ready pagination detection and handling
// Enhanced detection patterns, adaptive strategies, and comprehensive pagination support

if (!window.EnhancedPaginationHandler) {
  
  class EnhancedPaginationHandler {
    constructor(options = {}) {
      this.options = {
        // Detection configuration
        maxPages: options.maxPages || 50,
        pageTimeout: options.pageTimeout || 10000,
        interPageDelay: options.interPageDelay || 1500,
        stagnationLimit: options.stagnationLimit || 3,
        
        // Element counting configuration
        minNewItems: options.minNewItems || 1,
        itemSelectors: options.itemSelectors || [
          'img', '.item', '.card', '.product', '.post', '.result',
          '[data-testid*="item"]', '.gallery-item', '.grid-item'
        ],
        
        // Advanced detection patterns
        paginationPatterns: {
          // Traditional pagination
          traditional: [
            '.pagination', '.pager', '.page-nav', '.page-navigation',
            '[class*="pagination"]', '[class*="pager"]', '[id*="pagination"]'
          ],
          
          // Next page buttons
          nextButtons: [
            'a[aria-label*="next"]', 'button[aria-label*="next"]',
            'a[title*="next"]', 'button[title*="next"]',
            '.next-page', '.btn-next', '.next-button',
            'a[href*="page="]', 'a[href*="p="]', 'a[href*="/page/"]',
            // Generic selectors for text-based filtering
            'a', 'button'
          ],
          
          // Load more buttons
          loadMore: [
            '.load-more', '.show-more', '.load-next', '.view-more',
            'button[data-action*="load"]', 'button[data-action*="more"]',
            'a[data-load]', 'button[data-load]',
            '[class*="LoadMore"]', '[class*="ShowMore"]',
            '[aria-label*="load more"]', '[aria-label*="show more"]'
          ],
          
          // Infinite scroll indicators
          infiniteScroll: [
            '.infinite-scroll', '.lazy-load', '.auto-load',
            '[data-infinite]', '[data-lazy]', '[data-auto-load]',
            '.scroll-trigger', '.load-trigger'
          ],
          
          // AJAX pagination
          ajax: [
            '[data-ajax*="page"]', '[data-url*="page"]',
            '[onclick*="page"]', '[onclick*="load"]',
            'form[action*="page"]', 'form[method="get"]'
          ],
          
          // Modern framework patterns
          frameworks: [
            '[data-testid*="pagination"]', '[data-cy*="pagination"]',
            '[data-qa*="pagination"]', '[data-automation*="pagination"]',
            // React/Vue specific
            '[data-reactid*="page"]', '[v-for*="page"]',
            // Angular specific
            '[ng-repeat*="page"]', '[*ngFor*="page"]'
          ]
        },
        
        ...options
      };
      
      this.state = {
        currentPage: 1,
        totalPages: 0,
        itemCount: 0,
        lastItemCount: 0,
        stagnationCount: 0,
        isActive: false,
        detectedPatterns: [],
        failedAttempts: 0
      };
      
      // Performance tracking
      this.metrics = {
        pagesProcessed: 0,
        itemsExtracted: 0,
        totalTimeSpent: 0,
        averagePageTime: 0,
        detectionMethods: new Map(),
        errorRate: 0,
        errors: []
      };
      
      // Advanced detection cache
      this.detectionCache = new Map();
      this.elementCache = new Map();
      
      console.log('✅ Enhanced pagination handler initialized');
    }
    
    // Main pagination handling method
    async handlePagination(extractionCallback, options = {}) {
      console.log('📄 Starting enhanced pagination handling...');
      
      this.state.isActive = true;
      this.state.currentPage = 1;
      const startTime = performance.now();
      const allItems = [];
      
      try {
        // Initial page extraction
        let initialItems = await extractionCallback();
        allItems.push(...initialItems);
        this.state.itemCount = initialItems.length;
        this.state.lastItemCount = this.state.itemCount;
        
        console.log(`📄 Initial page: ${initialItems.length} items`);
        
        // Detect pagination patterns
        const paginationStrategy = await this.detectPaginationStrategy();
        console.log(`🎯 Detected pagination strategy: ${paginationStrategy.type}`);
        
        if (paginationStrategy.type === 'none') {
          console.log('📄 No pagination detected, single page extraction complete');
          return {
            items: allItems,
            pages: 1,
            strategy: 'single-page',
            metrics: this.getMetrics()
          };
        }
        
        // Execute pagination based on detected strategy
        let additionalItems = [];
        switch (paginationStrategy.type) {
          case 'traditional':
            additionalItems = await this.handleTraditionalPagination(
              paginationStrategy, extractionCallback, options
            );
            break;
          case 'infinite-scroll':
            additionalItems = await this.handleInfiniteScroll(
              paginationStrategy, extractionCallback, options
            );
            break;
          case 'load-more':
            additionalItems = await this.handleLoadMore(
              paginationStrategy, extractionCallback, options
            );
            break;
          case 'ajax':
            additionalItems = await this.handleAjaxPagination(
              paginationStrategy, extractionCallback, options
            );
            break;
          default:
            console.log(`⚠️ Unknown pagination strategy: ${paginationStrategy.type}`);
        }
        
        allItems.push(...additionalItems);
        
        // Update metrics
        const totalTime = performance.now() - startTime;
        this.updateMetrics(totalTime);
        
        console.log(`📄 Pagination complete: ${allItems.length} total items from ${this.state.pagesProcessed} pages`);
        
        return {
          items: allItems,
          pages: this.state.pagesProcessed,
          strategy: paginationStrategy.type,
          metrics: this.getMetrics()
        };
        
      } catch (error) {
        console.error('❌ Pagination handling failed:', error);
        this.recordError(error);
        return {
          items: allItems,
          pages: this.state.pagesProcessed,
          strategy: 'failed',
          error: error.message,
          metrics: this.getMetrics()
        };
      } finally {
        this.state.isActive = false;
      }
    }
    
    // Detect optimal pagination strategy
    async detectPaginationStrategy() {
      console.log('🔍 Detecting pagination patterns...');
      
      const detectedPatterns = [];
      
      // Check each pattern type
      for (const [patternType, selectors] of Object.entries(this.options.paginationPatterns)) {
        const elements = await this.findElementsByPatterns(selectors, patternType);
        if (elements.length > 0) {
          detectedPatterns.push({
            type: patternType,
            elements,
            confidence: this.calculatePatternConfidence(patternType, elements)
          });
        }
      }
      
      // Sort by confidence and return best match
      detectedPatterns.sort((a, b) => b.confidence - a.confidence);
      
      if (detectedPatterns.length === 0) {
        return { type: 'none', confidence: 0 };
      }
      
      const bestPattern = detectedPatterns[0];
      console.log(`🎯 Best pattern: ${bestPattern.type} (confidence: ${bestPattern.confidence.toFixed(2)})`);
      
      // Convert pattern type to strategy
      return this.convertPatternToStrategy(bestPattern);
    }
    
    // Find elements using pattern selectors
    async findElementsByPatterns(selectors, patternType = null) {
      const foundElements = [];
      const uniqueElements = new Set();
      
      for (const selector of selectors) {
        try {
          // Handle pseudo-selectors like :contains()
          let elements;
          if (selector.includes(':contains(')) {
            elements = this.findElementsWithText(selector);
          } else {
            elements = document.querySelectorAll(selector);
          }
          
          Array.from(elements).forEach(element => {
            if (!uniqueElements.has(element)) {
              // Filter by text content for generic selectors
              if ((selector === 'a' || selector === 'button') && patternType === 'nextButtons') {
                const text = element.textContent.trim().toLowerCase();
                if (!['next', '→', '>', 'more'].some(keyword => text.includes(keyword))) {
                  return; // Skip if doesn't match expected text
                }
              }
              
              uniqueElements.add(element);
              foundElements.push({
                element,
                selector,
                visible: this.isElementVisible(element),
                clickable: this.isElementClickable(element)
              });
            }
          });
        } catch (error) {
          console.warn(`⚠️ Invalid selector: ${selector}`, error);
        }
      }
      
      // Filter to visible and potentially clickable elements
      return foundElements.filter(item => item.visible);
    }
    
    // Handle :contains() pseudo-selector manually
    findElementsWithText(selector) {
      const match = selector.match(/(.+):contains\("(.+)"\)/);
      if (!match) return [];
      
      const [, baseSelector, text] = match;
      try {
        const elements = document.querySelectorAll(baseSelector);
        return Array.from(elements).filter(element => 
          element.textContent.trim().toLowerCase().includes(text.toLowerCase())
        );
      } catch (error) {
        console.warn(`⚠️ Invalid base selector: ${baseSelector}`, error);
        return [];
      }
    }
    
    // Calculate confidence score for pattern type
    calculatePatternConfidence(patternType, elements) {
      let confidence = 0;
      
      // Base confidence by pattern type
      const baseConfidences = {
        traditional: 0.9,
        nextButtons: 0.8,
        loadMore: 0.7,
        infiniteScroll: 0.6,
        ajax: 0.5,
        frameworks: 0.8
      };
      
      confidence += baseConfidences[patternType] || 0.3;
      
      // Boost confidence for visible elements
      const visibleElements = elements.filter(item => item.visible);
      if (visibleElements.length > 0) {
        confidence += 0.1;
      }
      
      // Boost confidence for clickable elements
      const clickableElements = elements.filter(item => item.clickable);
      if (clickableElements.length > 0) {
        confidence += 0.1;
      }
      
      // Boost confidence for elements with appropriate text
      const appropriateText = elements.some(item => {
        const text = item.element.textContent.toLowerCase();
        return ['next', 'more', 'load', 'continue', '→', '>'].some(keyword => text.includes(keyword));
      });
      if (appropriateText) {
        confidence += 0.1;
      }
      
      return Math.min(confidence, 1.0);
    }
    
    // Convert detected pattern to actionable strategy
    convertPatternToStrategy(pattern) {
      const typeMapping = {
        traditional: 'traditional',
        nextButtons: 'traditional',
        loadMore: 'load-more',
        infiniteScroll: 'infinite-scroll',
        ajax: 'ajax',
        frameworks: 'traditional'
      };
      
      return {
        type: typeMapping[pattern.type] || 'traditional',
        elements: pattern.elements,
        confidence: pattern.confidence
      };
    }
    
    // Handle traditional next-page pagination
    async handleTraditionalPagination(strategy, extractionCallback, options) {
      console.log('📄 Handling traditional pagination...');
      const allItems = [];
      let pageNum = 2;
      
      while (pageNum <= this.options.maxPages && this.state.stagnationCount < this.options.stagnationLimit) {
        try {
          console.log(`📄 Processing page ${pageNum}...`);
          
          const nextElement = this.findBestNextElement(strategy.elements, pageNum);
          if (!nextElement) {
            console.log('📄 No more next page elements found');
            break;
          }
          
          // Navigate to next page
          const navigationSuccess = await this.navigateToNextPage(nextElement, pageNum);
          if (!navigationSuccess) {
            console.log('📄 Navigation failed');
            break;
          }
          
          // Wait for page load
          await this.waitForPageLoad();
          
          // Extract items from new page
          const pageItems = await extractionCallback();
          
          if (pageItems.length === 0) {
            this.state.stagnationCount++;
            console.log(`📄 No items found on page ${pageNum} (stagnation: ${this.state.stagnationCount})`);
          } else {
            console.log(`📄 Page ${pageNum}: ${pageItems.length} items`);
            allItems.push(...pageItems);
            this.state.stagnationCount = 0;
          }
          
          this.state.pagesProcessed = pageNum;
          pageNum++;
          
          // Inter-page delay
          await this.sleep(this.options.interPageDelay);
          
        } catch (error) {
          console.error(`❌ Error on page ${pageNum}:`, error);
          this.recordError(error);
          break;
        }
      }
      
      return allItems;
    }
    
    // Handle infinite scroll pagination
    async handleInfiniteScroll(strategy, extractionCallback, options) {
      console.log('📄 Handling infinite scroll pagination...');
      
      // Delegate to existing infinite scroll handler if available
      if (window.InfiniteScrollHandler) {
        try {
          const scrollHandler = new window.InfiniteScrollHandler({
            maxScrollAttempts: this.options.maxPages * 2,
            itemSelectors: this.options.itemSelectors
          });
          
          const result = await scrollHandler.startScrolling(
            (event) => console.log('📜 Scroll event:', event.type),
            this.options.maxPages * 50 // Target item count
          );
          
          if (result && result.success) {
            // Extract all items after scrolling complete
            const allItems = await extractionCallback();
            return allItems.slice(this.state.itemCount); // Return only new items
          }
        } catch (error) {
          console.warn('⚠️ Infinite scroll handler failed, using fallback');
        }
      }
      
      // Fallback: simple scroll-based pagination
      return await this.handleScrollBasedPagination(extractionCallback);
    }
    
    // Handle load more button pagination
    async handleLoadMore(strategy, extractionCallback, options) {
      console.log('📄 Handling load more pagination...');
      const allItems = [];
      let attempts = 0;
      
      while (attempts < this.options.maxPages && this.state.stagnationCount < this.options.stagnationLimit) {
        try {
          const loadMoreButton = this.findBestLoadMoreButton(strategy.elements);
          if (!loadMoreButton) {
            console.log('📄 No load more button found');
            break;
          }
          
          const initialItemCount = this.getCurrentItemCount();
          
          // Click load more button
          await this.clickElement(loadMoreButton);
          
          // Wait for content to load
          await this.waitForNewContent(initialItemCount);
          
          // Extract new items
          const newItems = await extractionCallback();
          const actualNewItems = newItems.slice(this.state.itemCount);
          
          if (actualNewItems.length === 0) {
            this.state.stagnationCount++;
            console.log(`📄 No new items loaded (stagnation: ${this.state.stagnationCount})`);
          } else {
            console.log(`📄 Load more: ${actualNewItems.length} new items`);
            allItems.push(...actualNewItems);
            this.state.itemCount = newItems.length;
            this.state.stagnationCount = 0;
          }
          
          attempts++;
          await this.sleep(this.options.interPageDelay);
          
        } catch (error) {
          console.error(`❌ Error in load more attempt ${attempts + 1}:`, error);
          this.recordError(error);
          break;
        }
      }
      
      return allItems;
    }
    
    // Simple scroll-based pagination fallback
    async handleScrollBasedPagination(extractionCallback) {
      const allItems = [];
      let scrollAttempts = 0;
      let lastHeight = 0;
      
      while (scrollAttempts < 10) {
        const currentHeight = document.body.scrollHeight;
        
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        await this.sleep(2000);
        
        // Check if new content loaded
        if (document.body.scrollHeight === lastHeight) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
          lastHeight = document.body.scrollHeight;
          
          // Extract new items
          const currentItems = await extractionCallback();
          const newItems = currentItems.slice(this.state.itemCount);
          if (newItems.length > 0) {
            allItems.push(...newItems);
            this.state.itemCount = currentItems.length;
          }
        }
      }
      
      return allItems;
    }
    
    // Handle AJAX-based pagination
    async handleAjaxPagination(strategy, extractionCallback, options) {
      console.log('📄 Handling AJAX pagination (simplified)...');
      
      // For now, treat AJAX pagination similar to traditional pagination
      // This could be enhanced to intercept AJAX requests and manipulate them
      return await this.handleTraditionalPagination(strategy, extractionCallback, options);
    }
    
    // Find the best next page element
    findBestNextElement(elements, pageNumber) {
      // Score elements based on various factors
      const scoredElements = elements
        .filter(item => item.visible && item.clickable)
        .map(item => ({
          ...item,
          score: this.scoreNextElement(item.element, pageNumber)
        }))
        .sort((a, b) => b.score - a.score);
      
      return scoredElements.length > 0 ? scoredElements[0].element : null;
    }
    
    // Score next page element for selection
    scoreNextElement(element, pageNumber) {
      let score = 0;
      const text = element.textContent.trim().toLowerCase();
      
      // Text-based scoring
      if (text.includes('next')) score += 10;
      if (text.includes(pageNumber.toString())) score += 8;
      if (text.includes('→') || text.includes('>')) score += 6;
      if (text.includes('more')) score += 4;
      
      // Attribute-based scoring
      if (element.getAttribute('aria-label')?.toLowerCase().includes('next')) score += 8;
      if (element.href && element.href.includes('page=')) score += 6;
      
      // Position-based scoring (next elements are usually on the right)
      const rect = element.getBoundingClientRect();
      if (rect.right > window.innerWidth * 0.7) score += 3;
      
      return score;
    }
    
    // Find the best load more button
    findBestLoadMoreButton(elements) {
      const visibleButtons = elements
        .filter(item => item.visible && item.clickable)
        .map(item => ({
          ...item,
          score: this.scoreLoadMoreButton(item.element)
        }))
        .sort((a, b) => b.score - a.score);
      
      return visibleButtons.length > 0 ? visibleButtons[0].element : null;
    }
    
    // Score load more button for selection
    scoreLoadMoreButton(element) {
      let score = 0;
      const text = element.textContent.trim().toLowerCase();
      
      // Text-based scoring
      if (text.includes('load more')) score += 10;
      if (text.includes('show more')) score += 9;
      if (text.includes('view more')) score += 8;
      if (text.includes('more')) score += 6;
      if (text.includes('load')) score += 5;
      
      // Position-based scoring (load more buttons are usually centered or at bottom)
      const rect = element.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.6) score += 3;
      
      return score;
    }
    
    // Navigate to next page
    async navigateToNextPage(element, pageNumber) {
      try {
        if (element.tagName === 'A' && element.href) {
          window.location.href = element.href;
          return true;
        } else {
          await this.clickElement(element);
          return true;
        }
      } catch (error) {
        console.error('Navigation failed:', error);
        return false;
      }
    }
    
    // Click element with various strategies
    async clickElement(element) {
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(500);
      
      // Try multiple click methods
      const clickMethods = [
        () => element.click(),
        () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
        () => element.dispatchEvent(new Event('click')),
        () => {
          const event = document.createEvent('MouseEvents');
          event.initEvent('click', true, true);
          element.dispatchEvent(event);
        }
      ];
      
      for (const method of clickMethods) {
        try {
          method();
          await this.sleep(100);
          return true;
        } catch (error) {
          console.warn('Click method failed:', error);
        }
      }
      
      throw new Error('All click methods failed');
    }
    
    // Wait for page to load
    async waitForPageLoad() {
      return new Promise((resolve) => {
        let timeoutId;
        let resolved = false;
        
        const resolveOnce = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve();
          }
        };
        
        // Set timeout
        timeoutId = setTimeout(resolveOnce, this.options.pageTimeout);
        
        // Wait for DOM ready
        if (document.readyState === 'complete') {
          resolveOnce();
        } else {
          document.addEventListener('DOMContentLoaded', resolveOnce, { once: true });
          window.addEventListener('load', resolveOnce, { once: true });
        }
      });
    }
    
    // Wait for new content to appear
    async waitForNewContent(initialItemCount, timeout = 5000) {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const currentCount = this.getCurrentItemCount();
        if (currentCount > initialItemCount) {
          return true;
        }
        await this.sleep(200);
      }
      
      return false;
    }
    
    // Get current item count
    getCurrentItemCount() {
      let totalCount = 0;
      for (const selector of this.options.itemSelectors) {
        totalCount += document.querySelectorAll(selector).length;
      }
      return totalCount;
    }
    
    // Check if element is visible
    isElementVisible(element) {
      if (!element) return false;
      
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && 
             rect.height > 0 && 
             rect.top >= 0 && 
             rect.top <= window.innerHeight;
    }
    
    // Check if element is clickable
    isElementClickable(element) {
      if (!element) return false;
      
      const tagName = element.tagName.toLowerCase();
      return tagName === 'a' || 
             tagName === 'button' || 
             element.hasAttribute('onclick') ||
             element.getAttribute('role') === 'button' ||
             element.style.cursor === 'pointer';
    }
    
    // Update performance metrics
    updateMetrics(totalTime) {
      this.metrics.totalTimeSpent = totalTime;
      this.metrics.averagePageTime = this.state.pagesProcessed > 0 ? 
        totalTime / this.state.pagesProcessed : 0;
      this.metrics.itemsExtracted = this.state.itemCount;
      
      if (this.metrics.errors.length > 0) {
        this.metrics.errorRate = this.metrics.errors.length / this.state.pagesProcessed;
      }
    }
    
    // Record error for analysis
    recordError(error) {
      this.metrics.errors.push({
        message: error.message,
        timestamp: Date.now(),
        page: this.state.currentPage
      });
    }
    
    // Get comprehensive metrics
    getMetrics() {
      return {
        ...this.metrics,
        pagesProcessed: this.state.pagesProcessed,
        totalItems: this.state.itemCount,
        efficiency: this.state.pagesProcessed > 0 ? 
          this.metrics.itemsExtracted / this.state.pagesProcessed : 0
      };
    }
    
    // Helper method
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }
  
  // Export to global scope
  window.EnhancedPaginationHandler = EnhancedPaginationHandler;
  console.log('✅ Enhanced pagination handler loaded');
}