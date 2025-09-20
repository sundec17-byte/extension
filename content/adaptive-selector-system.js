// adaptive-selector-system.js - Robust CSS selector system with fallback strategies
// Addresses: Identification issues when websites update their layout

// Prevent duplicate declarations  
if (window.AdaptiveSelectorSystem) {
  console.log('AdaptiveSelectorSystem already loaded, skipping...');
} else {

  class AdaptiveSelectorSystem {
    constructor(options = {}) {
      this.options = {
        // Fallback strategy configuration
        maxFallbackAttempts: options.maxFallbackAttempts || 5,
        selectorTimeout: options.selectorTimeout || 2000,
        confidenceThreshold: options.confidenceThreshold || 0.7,
        
        // Selector generation priorities
        priorityWeights: {
          dataAttributes: 0.9,
          semanticClasses: 0.8,
          structuralPosition: 0.7,
          visualPattern: 0.6,
          domPath: 0.5,
          contentBased: 0.4
        },
        
        // Pattern recognition
        commonPatterns: {
          gallery: ['gallery', 'grid', 'masonry', 'photos', 'images'],
          product: ['product', 'item', 'card', 'listing'],
          media: ['media', 'photo', 'image', 'picture', 'thumb'],
          container: ['container', 'wrapper', 'section', 'content']
        },
        
        ...options
      };
      
      this.selectorHistory = new Map();
      this.fallbackStrategies = new Map();
      this.performanceMetrics = {
        successful: 0,
        failed: 0,
        fallbacksUsed: 0,
        averageAttempts: 0
      };
      
      this.initializeFallbackStrategies();
      this.initializeHeuristicEngine();
    }
    
    // Initialize heuristic-based element scoring engine
    initializeHeuristicEngine() {
      this.heuristicRules = [
        {
          name: 'hasMonetarySymbol',
          weight: 0.9,
          test: (element) => {
            const text = element.textContent || '';
            // Enhanced currency detection from example extensions
            const symbols = ['$', '€', '£', '¥', '₹', '₽', '₩', '₪', '₨', '₦', '₡', '₵', 
              'USD', 'EUR', 'GBP', 'JPY', 'INR', 'RUB', 'KRW', 'CNY'];
            // Also check for common price patterns
            const pricePatterns = [
              /\$\d+/i, /€\d+/i, /£\d+/i, /¥\d+/i, /₹\d+/i,
              /\d+\.\d{2}/i, /\d+,\d{3}/i, /price:\s*\d+/i,
              /cost:\s*\d+/i, /\d+\s*(dollar|euro|pound)/i
            ];
            return symbols.some(symbol => text.includes(symbol)) ||
                   pricePatterns.some(pattern => pattern.test(text));
          }
        },
        {
          name: 'hasImageChild',
          weight: 0.8,
          test: (element) => {
            // Check for img tags, picture elements, and CSS background images
            const hasImg = element.querySelector('img') !== null;
            const hasPicture = element.querySelector('picture') !== null;
            const hasSvg = element.querySelector('svg') !== null;
            // Check for elements with background-image style
            const hasBackgroundImage = element.style.backgroundImage && 
                                     element.style.backgroundImage !== 'none';
            return hasImg || hasPicture || hasSvg || hasBackgroundImage;
          }
        },
        {
          name: 'hasProductKeywords',
          weight: 0.7,
          test: (element) => {
            const text = element.textContent.toLowerCase();
            // Enhanced keywords from example extensions
            const keywords = ['buy', 'add to cart', 'purchase', 'sale', 'discount', 'price',
              'shop', 'order', 'product', 'item', 'deal', 'offer', 'special',
              'limited', 'save', 'off', 'free shipping', 'in stock', 'sold out'];
            return keywords.some(keyword => text.includes(keyword));
          }
        },
        {
          name: 'hasSemanticRole',
          weight: 0.8,
          test: (element) => {
            const role = element.getAttribute('role');
            const roles = ['article', 'listitem', 'gridcell', 'button', 'link', 'img'];
            const ariaLabel = element.getAttribute('aria-label');
            const ariaDescribedBy = element.getAttribute('aria-describedby');
            
            return roles.includes(role) || 
                   (ariaLabel && /product|item|image|photo/i.test(ariaLabel)) ||
                   (ariaDescribedBy && /product|item|image|photo/i.test(ariaDescribedBy));
          }
        },
        {
          name: 'hasDataAttributes',
          weight: 0.9,
          test: (element) => {
            const attributes = element.attributes;
            for (const attr of attributes) {
              if (attr.name.startsWith('data-') && 
                  ['product', 'item', 'price', 'image', 'gallery', 'src', 'url', 'thumb',
                    'photo', 'media', 'catalog', 'shop', 'cart', 'buy'].some(k => attr.name.includes(k))) {
                return true;
              }
            }
            return false;
          }
        },
        {
          name: 'hasSemanticClasses',
          weight: 0.7,
          test: (element) => {
            const className = element.className.toLowerCase();
            // Enhanced semantic terms from example extensions
            const semanticTerms = ['product', 'item', 'card', 'gallery', 'image', 'photo', 'media',
              'thumbnail', 'thumb', 'pic', 'picture', 'listing', 'tile', 'grid-item',
              'shop-item', 'catalog-item', 'product-card', 'image-card'];
            return semanticTerms.some(term => className.includes(term));
          }
        },
        {
          name: 'hasStructuralIndicators',
          weight: 0.6,
          test: (element) => {
            const parent = element.parentElement;
            if (!parent) {return false;}
            const parentClass = parent.className.toLowerCase();
            const structuralTerms = ['grid', 'list', 'container', 'wrapper', 'row', 'col',
              'gallery', 'masonry', 'flex', 'items', 'products', 'catalog'];
            return structuralTerms.some(term => parentClass.includes(term));
          }
        },
        {
          name: 'hasVisualIndicators',
          weight: 0.5,
          test: (element) => {
            // Check for visual indicators that suggest this is a product/image element
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            // Check for reasonable dimensions (not too small or too large)
            const hasReasonableSize = rect.width > 50 && rect.height > 50 && 
                                    rect.width < window.innerWidth && rect.height < window.innerHeight;
            
            // Check for common visual patterns
            const hasBorder = style.border !== 'none' || style.borderWidth !== '0px';
            const hasShadow = style.boxShadow !== 'none';
            const hasHover = element.matches(':hover');
            
            return hasReasonableSize && (hasBorder || hasShadow || hasHover);
          }
        }
      ];
      
      console.log('🧠 Enhanced heuristic engine initialized with', this.heuristicRules.length, 'rules');
      
      // Initialize enhanced scoring functions from example analysis
      this.enhancedScoringFunctions = {
        currencyScore: this.calculateCurrencyScore.bind(this),
        imageTypeScore: this.calculateImageTypeScore.bind(this),
        accessibilityScore: this.calculateAccessibilityScore.bind(this),
        dataAttributeScore: this.calculateDataAttributeScore.bind(this),
        visualIndicatorScore: this.calculateVisualIndicatorScore.bind(this),
        contextScore: this.calculateContextScore.bind(this)
      };
    }
    
    // Enhanced currency detection from example extensions
    calculateCurrencyScore(element) {
      const text = element.textContent || '';
      const enhancedCurrencies = ['$', '€', '£', '¥', '₹', '₽', '₩', '₪', '₺', '₵', '₡', '₦'];
      const pricePatterns = [
        /[\$€£¥₹₽₩₪₺₵₡₦][\d,]+\.?\d*/gi,
        /[\d,]+\.?\d*\s*[\$€£¥₹₽₩₪₺₵₡₦]/gi,
        /price:\s*[\d,]+\.?\d*/gi,
        /cost:\s*[\d,]+\.?\d*/gi,
        /from\s*[\$€£¥₹₽₩₪₺₵₡₦][\d,]+/gi
      ];
      
      let score = 0;
      enhancedCurrencies.forEach(currency => {
        if (text.includes(currency)) {score += 0.15;}
      });
      
      pricePatterns.forEach(pattern => {
        if (pattern.test(text)) {score += 0.25;}
      });
      
      return Math.min(score, 1.0);
    }
    
    // Enhanced image type scoring
    calculateImageTypeScore(element) {
      let score = 0;
      
      // Traditional img tags
      if (element.querySelector('img')) {score += 0.3;}
      
      // Picture elements
      if (element.querySelector('picture')) {score += 0.3;}
      
      // SVG elements
      if (element.querySelector('svg')) {score += 0.2;}
      
      // CSS background images (requires integration with CSS extractor)
      const style = window.getComputedStyle(element);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        score += 0.4;
      }
      
      // Lazy loading attributes
      const lazySelectors = ['[data-src]', '[data-lazy]', '[loading="lazy"]'];
      if (lazySelectors.some(sel => element.querySelector(sel))) {
        score += 0.2;
      }
      
      return Math.min(score, 1.0);
    }
    
    // Enhanced accessibility scoring
    calculateAccessibilityScore(element) {
      let score = 0;
      
      const ariaLabel = element.getAttribute('aria-label') || '';
      const ariaDescribedBy = element.getAttribute('aria-describedby') || '';
      const ariaLabelledBy = element.getAttribute('aria-labelledby') || '';
      const role = element.getAttribute('role') || '';
      const alt = element.getAttribute('alt') || '';
      
      const imageKeywords = ['image', 'photo', 'picture', 'gallery', 'thumbnail'];
      const productKeywords = ['product', 'item', 'buy', 'shop', 'purchase'];
      
      [ariaLabel, ariaDescribedBy, ariaLabelledBy, alt].forEach(attr => {
        if (imageKeywords.some(keyword => attr.toLowerCase().includes(keyword))) {
          score += 0.25;
        }
        if (productKeywords.some(keyword => attr.toLowerCase().includes(keyword))) {
          score += 0.15;
        }
      });
      
      const meaningfulRoles = ['img', 'button', 'link', 'article', 'listitem', 'gridcell'];
      if (meaningfulRoles.includes(role)) {score += 0.2;}
      
      return Math.min(score, 1.0);
    }
    
    // Enhanced data attribute scoring
    calculateDataAttributeScore(element) {
      let score = 0;
      const dataPatterns = [
        'data-testid', 'data-cy', 'data-component', 'data-role', 'data-type',
        'data-product', 'data-item', 'data-gallery', 'data-image', 'data-price',
        'data-action', 'data-track', 'data-analytics', 'data-src', 'data-lazy'
      ];
      
      dataPatterns.forEach(pattern => {
        if (element.hasAttribute(pattern)) {
          score += 0.1;
          const value = element.getAttribute(pattern) || '';
          if (['image', 'photo', 'gallery', 'product', 'item'].some(k => value.includes(k))) {
            score += 0.15;
          }
        }
      });
      
      return Math.min(score, 1.0);
    }
    
    // Visual indicator scoring
    calculateVisualIndicatorScore(element) {
      let score = 0;
      const rect = element.getBoundingClientRect();
      
      // Size scoring (meaningful elements are usually reasonably sized)
      if (rect.width >= 100 && rect.height >= 100) {score += 0.2;}
      if (rect.width >= 200 && rect.height >= 150) {score += 0.3;}
      
      // Position scoring (avoid tiny or edge elements)
      if (rect.top > 0 && rect.left > 0) {score += 0.1;}
      
      // Style indicators
      const style = window.getComputedStyle(element);
      if (style.border && style.border !== 'none') {score += 0.1;}
      if (style.boxShadow && style.boxShadow !== 'none') {score += 0.1;}
      if (style.cursor === 'pointer') {score += 0.15;}
      
      return Math.min(score, 1.0);
    }
    
    // Context scoring based on parent/sibling analysis
    calculateContextScore(element) {
      let score = 0;
      
      // Parent context
      const parent = element.parentElement;
      if (parent) {
        const parentClasses = parent.className || '';
        const contextKeywords = ['gallery', 'grid', 'products', 'items', 'catalog', 'shop'];
        if (contextKeywords.some(keyword => parentClasses.toLowerCase().includes(keyword))) {
          score += 0.3;
        }
      }
      
      // Sibling context
      const siblings = element.parentElement?.children || [];
      if (siblings.length >= 3) { // Part of a list/grid
        score += 0.2;
      }
      
      // Container indicators
      const containerSelectors = ['.product-grid', '.gallery', '.image-grid', '.items'];
      if (containerSelectors.some(sel => element.closest(sel))) {
        score += 0.4;
      }
      
      return Math.min(score, 1.0);
    }
    
    // Score elements using heuristic rules
    scoreElement(element) {
      let totalScore = 0;
      let applicableRules = 0;
      
      this.heuristicRules.forEach(rule => {
        try {
          if (rule.test(element)) {
            totalScore += rule.weight;
            applicableRules++;
          }
        } catch (error) {
          console.warn(`⚠️ Error in heuristic rule ${rule.name}:`, error);
        }
      });
      
      // Normalize score (0-1)
      const normalizedScore = applicableRules > 0 ? 
        Math.min(totalScore / this.heuristicRules.length, 1) : 0;
      
      return {
        score: normalizedScore,
        applicableRules,
        totalWeight: totalScore
      };
    }
    
    // Find elements using heuristic scoring
    findElementsByHeuristic(minScore = 0.5, context = document) {
      const allElements = context.querySelectorAll('*');
      const scoredElements = [];
      
      allElements.forEach(element => {
        const scoring = this.scoreElement(element);
        if (scoring.score >= minScore) {
          scoredElements.push({
            element,
            ...scoring
          });
        }
      });
      
      // Sort by score (highest first)
      scoredElements.sort((a, b) => b.score - a.score);
      
      console.log(`🎯 Found ${scoredElements.length} elements with score >= ${minScore}`);
      return scoredElements;
    }
    
    // Initialize different fallback strategies
    initializeFallbackStrategies() {
      this.fallbackStrategies.set('dataAttributes', this.generateDataAttributeSelectors.bind(this));
      this.fallbackStrategies.set('semanticClasses', this.generateSemanticSelectors.bind(this));
      this.fallbackStrategies.set('structuralPosition', this.generateStructuralSelectors.bind(this));
      this.fallbackStrategies.set('visualPattern', this.generateVisualPatternSelectors.bind(this));
      this.fallbackStrategies.set('domPath', this.generateDOMPathSelectors.bind(this));
      this.fallbackStrategies.set('contentBased', this.generateContentBasedSelectors.bind(this));
      
      console.log('🔧 Initialized fallback strategies:', Array.from(this.fallbackStrategies.keys()));
    }
    
    // Main method to find elements with adaptive fallback
    async findElements(initialSelector, context = document) {
      const startTime = performance.now();
      let attempts = 0;
      let elements = [];
      const usedStrategy = 'initial';
      
      console.log('🎯 Starting adaptive element search with:', initialSelector);
      
      try {
        // Try initial selector first
        elements = this.testSelector(initialSelector, context);
        attempts++;
        
        if (elements.length > 0) {
          this.recordSuccess(initialSelector, usedStrategy, attempts, performance.now() - startTime);
          return {
            elements,
            selector: initialSelector,
            strategy: usedStrategy,
            attempts,
            confidence: 1.0
          };
        }
        
        // If initial selector fails, try fallback strategies
        console.log('⚠️ Initial selector failed, trying fallback strategies...');
        
        const fallbackResult = await this.tryFallbackStrategies(initialSelector, context);
        
        if (fallbackResult.elements.length > 0) {
          this.recordSuccess(fallbackResult.selector, fallbackResult.strategy, 
            fallbackResult.attempts, performance.now() - startTime);
          return fallbackResult;
        }
        
        // If all strategies fail, try emergency recovery
        console.log('🚨 All strategies failed, attempting emergency recovery...');
        const emergencyResult = await this.emergencyRecovery(context);
        
        this.recordFailure(initialSelector, attempts + fallbackResult.attempts);
        return emergencyResult;
        
      } catch (error) {
        console.error('❌ Error in adaptive selector system:', error);
        this.recordFailure(initialSelector, attempts);
        return {
          elements: [],
          selector: null,
          strategy: 'failed',
          attempts,
          confidence: 0,
          error: error.message
        };
      }
    }
    
    // Test a selector and return matching elements
    testSelector(selector, context = document) {
      if (!selector || typeof selector !== 'string') {
        return [];
      }
      
      try {
        const elements = Array.from(context.querySelectorAll(selector));
        console.log(`🔍 Selector "${selector}" found ${elements.length} elements`);
        return elements;
      } catch (error) {
        console.warn(`⚠️ Invalid selector "${selector}":`, error.message);
        return [];
      }
    }
    
    // Try all fallback strategies in order of priority
    async tryFallbackStrategies(originalSelector, context) {
      const strategies = Array.from(this.fallbackStrategies.keys())
        .sort((a, b) => this.options.priorityWeights[b] - this.options.priorityWeights[a]);
      
      let bestResult = { elements: [], selector: null, strategy: null, attempts: 0, confidence: 0 };
      
      for (const strategyName of strategies) {
        if (bestResult.elements.length > 0 && bestResult.confidence >= this.options.confidenceThreshold) {
          break; // Already found good enough result
        }
        
        console.log(`🔄 Trying fallback strategy: ${strategyName}`);
        
        try {
          const strategy = this.fallbackStrategies.get(strategyName);
          const selectors = await strategy(originalSelector, context);
          
          for (const selector of selectors) {
            const elements = this.testSelector(selector, context);
            bestResult.attempts++;
            
            if (elements.length > 0) {
              const confidence = this.calculateConfidence(elements, strategyName);
              
              if (confidence > bestResult.confidence) {
                bestResult = {
                  elements,
                  selector,
                  strategy: strategyName,
                  attempts: bestResult.attempts,
                  confidence
                };
                
                console.log(`✅ Found ${elements.length} elements with strategy "${strategyName}" (confidence: ${confidence.toFixed(2)})`);
              }
            }
            
            // Stop if we've reached maximum attempts
            if (bestResult.attempts >= this.options.maxFallbackAttempts) {
              break;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error in strategy ${strategyName}:`, error);
          bestResult.attempts++;
        }
      }
      
      return bestResult;
    }
    
    // Generate data attribute-based selectors
    async generateDataAttributeSelectors(originalSelector, context) {
      const selectors = [];
      
      // Common data attributes for images and galleries
      const dataAttributes = [
        'data-testid', 'data-cy', 'data-test', 'data-automation',
        'data-component', 'data-module', 'data-widget',
        'data-role', 'data-type', 'data-kind'
      ];
      
      const patterns = [...this.options.commonPatterns.gallery, 
        ...this.options.commonPatterns.media,
        ...this.options.commonPatterns.product];
      
      // Generate combinations of data attributes and patterns
      dataAttributes.forEach(attr => {
        patterns.forEach(pattern => {
          selectors.push(`[${attr}*="${pattern}"]`);
          selectors.push(`[${attr}="${pattern}"]`);
          selectors.push(`[${attr}^="${pattern}"]`);
          selectors.push(`[${attr}$="${pattern}"]`);
        });
      });
      
      // Add role and aria attributes
      selectors.push('[role="img"]', '[role="button"]', '[aria-label*="image"]', '[aria-label*="photo"]');
      
      return selectors;
    }
    
    // Generate semantic class-based selectors
    async generateSemanticSelectors(originalSelector, context) {
      const selectors = [];
      
      // Extract meaningful class patterns from existing elements
      const allElements = context.querySelectorAll('*[class]');
      const classPatterns = new Set();
      
      Array.from(allElements).slice(0, 100).forEach(element => { // Limit for performance
        if (element.className && typeof element.className === 'string') {
          element.className.split(' ')
            .filter(cls => cls.length > 2)
            .forEach(cls => classPatterns.add(cls));
        }
      });
      
      // Generate selectors based on semantic patterns
      Object.values(this.options.commonPatterns).flat().forEach(pattern => {
        classPatterns.forEach(cls => {
          if (cls.toLowerCase().includes(pattern)) {
            selectors.push(`.${this.escapeCSS(cls)}`);
            selectors.push(`.${this.escapeCSS(cls)} img`);
            selectors.push(`.${this.escapeCSS(cls)} a`);
          }
        });
      });
      
      return selectors.slice(0, 20); // Limit number of generated selectors
    }
    
    // Generate structural position-based selectors
    async generateStructuralSelectors(originalSelector, context) {
      const selectors = [];
      
      // Common structural patterns
      const structures = [
        'main img', 'section img', 'article img', 'div img',
        'ul li img', 'ol li img', 'div > div img',
        'main a', 'section a', 'article a',
        '[class*="container"] img', '[class*="wrapper"] img',
        '[class*="content"] img', '[id*="content"] img'
      ];
      
      // Add nth-child patterns for grid layouts
      for (let i = 1; i <= 10; i++) {
        structures.push(`div:nth-child(${i}) img`);
        structures.push(`li:nth-child(${i}) img`);
        structures.push(`div:nth-child(${i}) a`);
      }
      
      return structures;
    }
    
    // Generate visual pattern-based selectors
    async generateVisualPatternSelectors(originalSelector, context) {
      const selectors = [];
      
      // Size-based patterns (common image sizes)
      const sizeSelectors = [
        'img[width]', 'img[height]',
        'img[style*="width"]', 'img[style*="height"]'
      ];
      
      // Position-based patterns
      const positionSelectors = [
        'img[style*="position"]', 'img[style*="float"]',
        'img[style*="display"]'
      ];
      
      // Background image patterns
      const backgroundSelectors = [
        '[style*="background-image"]', '[style*="background:"]',
        '.bg-image', '.background-image', '.hero-image'
      ];
      
      return [...sizeSelectors, ...positionSelectors, ...backgroundSelectors];
    }
    
    // Generate DOM path-based selectors
    async generateDOMPathSelectors(originalSelector, context) {
      const selectors = [];
      
      // Find all images and generate simplified paths
      const images = context.querySelectorAll('img');
      const imagePaths = new Set();
      
      Array.from(images).slice(0, 10).forEach(img => { // Limit for performance
        const path = this.generateSimplePath(img);
        if (path) {
          imagePaths.add(path);
        }
      });
      
      return Array.from(imagePaths);
    }
    
    // Generate content-based selectors
    async generateContentBasedSelectors(originalSelector, context) {
      const selectors = [];
      
      // Alt text patterns
      const altPatterns = ['photo', 'image', 'picture', 'gallery', 'thumbnail'];
      altPatterns.forEach(pattern => {
        selectors.push(`img[alt*="${pattern}"]`);
        selectors.push(`img[title*="${pattern}"]`);
      });
      
      // Source patterns
      const srcPatterns = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      srcPatterns.forEach(pattern => {
        selectors.push(`img[src*="${pattern}"]`);
        selectors.push(`img[data-src*="${pattern}"]`);
      });
      
      return selectors;
    }
    
    // Emergency recovery when all strategies fail
    async emergencyRecovery(context) {
      console.log('🆘 Emergency recovery activated');
      
      // Try most basic selectors
      const emergencySelectors = [
        'img', 'a[href*=".jpg"]', 'a[href*=".png"]', 
        'a[href*=".jpeg"]', 'a[href*=".webp"]',
        '[style*="background-image"]'
      ];
      
      for (const selector of emergencySelectors) {
        const elements = this.testSelector(selector, context);
        if (elements.length > 0) {
          console.log(`🔄 Emergency recovery found ${elements.length} elements with: ${selector}`);
          return {
            elements,
            selector,
            strategy: 'emergency',
            attempts: 1,
            confidence: 0.3
          };
        }
      }
      
      return {
        elements: [],
        selector: null,
        strategy: 'emergency-failed',
        attempts: emergencySelectors.length,
        confidence: 0
      };
    }
    
    // Calculate confidence score for found elements
    calculateConfidence(elements, strategy) {
      let baseConfidence = this.options.priorityWeights[strategy] || 0.5;
      
      // Adjust based on number of elements found
      if (elements.length === 0) {return 0;}
      if (elements.length === 1) {baseConfidence *= 0.8;} // Single element might be false positive
      if (elements.length > 100) {baseConfidence *= 0.9;} // Too many might be too broad
      
      // Adjust based on element types
      const imageCount = elements.filter(el => el.tagName === 'IMG').length;
      const linkCount = elements.filter(el => el.tagName === 'A').length;
      
      if (imageCount > 0) {baseConfidence += 0.1;}
      if (linkCount > 0) {baseConfidence += 0.05;}
      
      return Math.min(baseConfidence, 1.0);
    }
    
    // Generate simplified CSS path for an element
    generateSimplePath(element) {
      const path = [];
      let current = element;
      
      while (current && current !== document.body && path.length < 5) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
          selector += `#${this.escapeCSS(current.id)}`;
          path.unshift(selector);
          break; // ID is unique, stop here
        }
        
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/);
          if (classes.length > 0 && classes[0]) {
            selector += `.${this.escapeCSS(classes[0])}`;
          }
        }
        
        path.unshift(selector);
        current = current.parentElement;
      }
      
      return path.length > 0 ? path.join(' > ') : null;
    }
    
    // Escape CSS selector characters
    escapeCSS(str) {
      if (!str) {return '';}
      return str.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    }
    
    // Record successful selector usage
    recordSuccess(selector, strategy, attempts, duration) {
      this.performanceMetrics.successful++;
      this.performanceMetrics.averageAttempts = 
        (this.performanceMetrics.averageAttempts + attempts) / 2;
      
      if (strategy !== 'initial') {
        this.performanceMetrics.fallbacksUsed++;
      }
      
      // Store in history for learning
      const key = `${selector}:${strategy}`;
      this.selectorHistory.set(key, {
        selector,
        strategy,
        attempts,
        duration,
        timestamp: Date.now(),
        success: true
      });
      
      console.log(`✅ Selector success recorded: ${strategy} in ${attempts} attempts (${duration.toFixed(2)}ms)`);
    }
    
    // Record failed selector usage
    recordFailure(selector, attempts) {
      this.performanceMetrics.failed++;
      this.performanceMetrics.averageAttempts = 
        (this.performanceMetrics.averageAttempts + attempts) / 2;
      
      const key = `${selector}:failed`;
      this.selectorHistory.set(key, {
        selector,
        strategy: 'failed',
        attempts,
        timestamp: Date.now(),
        success: false
      });
      
      console.log(`❌ Selector failure recorded: ${attempts} attempts`);
    }
    
    // Get performance metrics
    getMetrics() {
      return {
        ...this.performanceMetrics,
        successRate: this.performanceMetrics.successful / 
                    (this.performanceMetrics.successful + this.performanceMetrics.failed),
        fallbackRate: this.performanceMetrics.fallbacksUsed / this.performanceMetrics.successful,
        historySize: this.selectorHistory.size
      };
    }
    
    // Learn from successful patterns
    learnFromHistory() {
      const successfulPatterns = Array.from(this.selectorHistory.values())
        .filter(record => record.success)
        .sort((a, b) => a.attempts - b.attempts); // Sort by efficiency
      
      if (successfulPatterns.length > 0) {
        console.log('📚 Most efficient patterns:', 
          successfulPatterns.slice(0, 3).map(p => `${p.strategy}(${p.attempts})`));
      }
      
      return successfulPatterns;
    }
  }
  
  // Export to global scope
  window.AdaptiveSelectorSystem = AdaptiveSelectorSystem;
  console.log('✅ AdaptiveSelectorSystem loaded successfully');
}