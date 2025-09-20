// picker.js - Enhanced Element Picker with Click Prevention and Smart Gallery Detection
// Addresses: Image click issues, improper link following, and improved gallery detection

// Prevent duplicate declarations
if (window.StepTwoElementPicker) {
  console.log('StepTwoElementPicker already loaded, skipping...');
} else {

  class StepTwoElementPicker {
    constructor(options = {}) {
      this.options = {
        highlightColor: '#00ff00',
        overlayOpacity: 0.3,
        preventDefaultClicks: true,
        smartGalleryDetection: true,
        minimumSimilarElements: 2, // Reduced from 3 to 2 for better success rate
        maxDetectionAttempts: 5,
        relaxedValidation: true, // Add fallback validation mode
        ...options
      };
      
      this.isActive = false;
      this.hoveredElement = null;
      this.selectedElement = null;
      this.selectedSelector = null;
      this.overlay = null;
      this.similarElements = [];
      this.detectionAttempts = 0;
      
      // Bind methods to preserve context
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleScroll = this.handleScroll.bind(this);
      
      this.setupStyles();
    }
    
    setupStyles() {
      // Create or update picker styles
      const existingStyle = document.getElementById('steptwo-picker-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      const style = document.createElement('style');
      style.id = 'steptwo-picker-styles';
      style.textContent = `
        .steptwo-picker-highlight {
          outline: 3px solid ${this.options.highlightColor} !important;
          outline-offset: -1px !important;
          position: relative !important;
          z-index: 999999 !important;
          background-color: rgba(0, 255, 0, ${this.options.overlayOpacity}) !important;
          transition: all 0.2s ease !important;
          cursor: crosshair !important;
        }
        
        .steptwo-picker-selected {
          outline: 3px solid #ff6600 !important;
          outline-offset: -1px !important;
          background-color: rgba(255, 102, 0, 0.3) !important;
          box-shadow: 0 0 10px rgba(255, 102, 0, 0.8) !important;
        }
        
        .steptwo-picker-similar {
          outline: 2px dashed #ffff00 !important;
          outline-offset: -1px !important;
          background-color: rgba(255, 255, 0, 0.2) !important;
        }
        
        .steptwo-picker-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 999998 !important;
          pointer-events: none !important;
          background: rgba(0, 0, 0, 0.1) !important;
        }
        
        .steptwo-picker-instructions {
          position: fixed !important;
          top: 20px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          background: rgba(0, 0, 0, 0.9) !important;
          color: white !important;
          padding: 15px 25px !important;
          border-radius: 8px !important;
          font-family: Arial, sans-serif !important;
          font-size: 14px !important;
          font-weight: bold !important;
          z-index: 1000000 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          animation: steptwo-fade-in 0.3s ease !important;
        }
        
        @keyframes steptwo-fade-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        
        .steptwo-picker-counter {
          position: fixed !important;
          top: 80px !important;
          right: 20px !important;
          background: rgba(0, 150, 255, 0.95) !important;
          color: white !important;
          padding: 10px 15px !important;
          border-radius: 6px !important;
          font-family: Arial, sans-serif !important;
          font-size: 13px !important;
          font-weight: bold !important;
          z-index: 1000000 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        }
      `;
      
      document.head.appendChild(style);
    }
    
    start(siteProfile = null) {
      if (this.isActive) {
        console.log('🎯 Picker already active, stopping first...');
        this.stop();
      }
      
      console.log('🎯 Starting STEPTWO element picker...');
      this.isActive = true;
      this.siteProfile = siteProfile;
      this.detectionAttempts = 0;
      
      this.createOverlay();
      this.showInstructions();
      this.attachEventListeners();
      
      // Disable page scrolling during selection
      document.body.style.overflow = 'hidden';
      
      return true;
    }
    
    stop() {
      if (!this.isActive) return;
      
      console.log('🎯 Stopping STEPTWO element picker...');
      this.isActive = false;
      
      this.removeHighlights();
      this.removeOverlay();
      this.removeInstructions();
      this.detachEventListeners();
      
      // Re-enable page scrolling
      document.body.style.overflow = '';
      
      // Clear references
      this.hoveredElement = null;
      this.selectedElement = null;
      this.similarElements = [];
    }
    
    createOverlay() {
      this.overlay = document.createElement('div');
      this.overlay.className = 'steptwo-picker-overlay';
      this.overlay.setAttribute('data-steptwo-picker', 'true');
      document.body.appendChild(this.overlay);
    }
    
    removeOverlay() {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
    }
    
    showInstructions() {
      const instructions = document.createElement('div');
      instructions.className = 'steptwo-picker-instructions';
      instructions.id = 'steptwo-picker-instructions';
      instructions.innerHTML = `
        🎯 <strong>STEPTWO Gallery Picker</strong><br>
        Click on any gallery item to select all similar elements<br>
        <small>Press ESC to cancel • Images and links are safe to click</small>
      `;
      document.body.appendChild(instructions);
    }
    
    removeInstructions() {
      const instructions = document.getElementById('steptwo-picker-instructions');
      if (instructions && instructions.parentNode) {
        instructions.parentNode.removeChild(instructions);
      }
    }
    
    showCounter(count) {
      let counter = document.getElementById('steptwo-picker-counter');
      if (!counter) {
        counter = document.createElement('div');
        counter.className = 'steptwo-picker-counter';
        counter.id = 'steptwo-picker-counter';
        document.body.appendChild(counter);
      }
      
      counter.textContent = `${count} similar elements found`;
    }
    
    attachEventListeners() {
      // High priority event listeners to intercept clicks
      document.addEventListener('mousemove', this.handleMouseMove, true);
      document.addEventListener('click', this.handleClick, true);
      document.addEventListener('keydown', this.handleKeydown, true);
      document.addEventListener('scroll', this.handleScroll, true);
      
      // Prevent all navigation during picker mode
      if (this.options.preventDefaultClicks) {
        this.preventNavigation = this.preventNavigation.bind(this);
        document.addEventListener('mousedown', this.preventNavigation, true);
        document.addEventListener('mouseup', this.preventNavigation, true);
        document.addEventListener('contextmenu', this.preventNavigation, true);
        window.addEventListener('beforeunload', this.preventNavigation, true);
      }
    }
    
    detachEventListeners() {
      document.removeEventListener('mousemove', this.handleMouseMove, true);
      document.removeEventListener('click', this.handleClick, true);
      document.removeEventListener('keydown', this.handleKeydown, true);
      document.removeEventListener('scroll', this.handleScroll, true);
      
      if (this.options.preventDefaultClicks) {
        document.removeEventListener('mousedown', this.preventNavigation, true);
        document.removeEventListener('mouseup', this.preventNavigation, true);
        document.removeEventListener('contextmenu', this.preventNavigation, true);
        window.removeEventListener('beforeunload', this.preventNavigation, true);
      }
    }
    
    preventNavigation(event) {
      // Prevent all default browser behaviors during picker mode
      if (event.target && event.target.closest && event.target.closest('[data-steptwo-picker]')) {
        return;
      }
      
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
    
    handleMouseMove(event) {
      if (!this.isActive) return;
      
      const element = event.target;
      
      // Skip picker's own elements
      if (element.closest('[data-steptwo-picker]') || 
          element.closest('.steptwo-picker-instructions') ||
          element.closest('.steptwo-picker-counter')) {
        return;
      }
      
      // Remove previous highlight
      if (this.hoveredElement && this.hoveredElement !== this.selectedElement) {
        this.hoveredElement.classList.remove('steptwo-picker-highlight');
      }
      
      // Add highlight to current element
      this.hoveredElement = element;
      if (element !== this.selectedElement) {
        element.classList.add('steptwo-picker-highlight');
      }
    }
    
    handleClick(event) {
      if (!this.isActive) return;
      
      // Always prevent default click behavior during picking
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const element = event.target;
      
      // Skip picker's own elements
      if (element.closest('[data-steptwo-picker]') || 
          element.closest('.steptwo-picker-instructions') ||
          element.closest('.steptwo-picker-counter')) {
        return false;
      }
      
      console.log('🎯 Element clicked:', element);
      this.selectElement(element);
      
      return false;
    }
    
    handleKeydown(event) {
      if (!this.isActive) return;
      
      if (event.key === 'Escape') {
        event.preventDefault();
        this.stop();
        return;
      }
    }
    
    handleScroll(event) {
      if (!this.isActive) return;
      
      // Allow scrolling but prevent default behavior on picker elements
      if (event.target && event.target.closest && event.target.closest('[data-steptwo-picker]')) {
        event.preventDefault();
      }
    }
    
    selectElement(element) {
      console.log('🎯 Selecting element and finding similar elements...');
      
      // Clear previous selection
      this.removeHighlights();
      
      this.selectedElement = element;
      element.classList.add('steptwo-picker-selected');
      
      // Generate smart selector for this element
      const selector = this.generateSmartSelector(element);
      console.log('🔍 Generated selector:', selector);
      
      if (selector) {
        this.selectedSelector = selector;
        this.findAndHighlightSimilarElements(selector);
        this.notifySelection();
      } else {
        console.warn('⚠️ Could not generate selector for element');
        // Even if we can't generate a smart selector, we can still select the single element
        this.selectedSelector = null;
        this.similarElements = [element];
        this.showCounter(1);
        this.showWarningMessage('Could not find similar elements, but selected this one item.');
      }
    }
    
    generateSmartSelector(element) {
      // Multiple selector generation strategies with improved fallbacks
      const strategies = [
        () => this.generateBySiblingsPattern(element),
        () => this.generateByClassPattern(element),
        () => this.generateByStructuralPattern(element),
        () => this.generateByAttributePattern(element),
        () => this.generateByTagPattern(element),
        () => this.generateByParentPattern(element),
        () => this.generateByNthChildPattern(element), // New fallback strategy
        () => this.generateByTagNamePattern(element)    // New fallback strategy
      ];
      
      for (const strategy of strategies) {
        try {
          const selector = strategy();
          if (selector && this.validateSelector(selector, element)) {
            console.log('✅ Valid selector found:', selector);
            return selector;
          } else if (selector) {
            console.log('⚠️ Generated selector failed validation:', selector);
          }
        } catch (error) {
          console.warn('⚠️ Selector strategy failed:', error);
        }
      }
      
      // Final fallback: try to generate a very basic selector
      console.log('🔄 Trying final fallback strategies...');
      return this.generateFallbackSelector(element);
    }
    
    generateBySiblingsPattern(element) {
      // Look for patterns among siblings
      const parent = element.parentElement;
      if (!parent) return null;
      
      const siblings = Array.from(parent.children).filter(child => 
        child.nodeType === 1 && child !== element
      );
      
      // Check if siblings have similar structure (ignore picker classes)
      const elementClasses = Array.from(element.classList).filter(cls => 
        !cls.startsWith('steptwo-picker')
      );
      
      const similarSiblings = siblings.filter(sibling => {
        const siblingClasses = Array.from(sibling.classList).filter(cls => 
          !cls.startsWith('steptwo-picker')
        );
        const commonClasses = elementClasses.filter(cls => siblingClasses.includes(cls));
        return commonClasses.length > 0;
      });
      
      if (similarSiblings.length >= 1) { // Reduced from 2 to 1 for better matching
        // Find common class patterns (excluding picker classes)
        const commonClass = elementClasses.find(cls => 
          similarSiblings.every(sibling => sibling.classList.contains(cls))
        );
        
        if (commonClass) {
          console.log(`🎯 Found common class pattern: .${commonClass}`);
          return `.${commonClass}`;
        }
      }
      
      return null;
    }
    
    generateByClassPattern(element) {
      const classes = Array.from(element.classList).filter(cls => 
        !cls.startsWith('steptwo-picker') // Exclude picker classes
      );
      
      // Priority patterns for gallery items
      const galleryPatterns = [
        'item', 'card', 'tile', 'grid', 'cell', 'thumb', 'thumbnail',
        'photo', 'image', 'pic', 'picture', 'gallery', 'media',
        'product', 'listing', 'result', 'entry'
      ];
      
      // Find classes that match gallery patterns
      const galleryClasses = classes.filter(cls =>
        galleryPatterns.some(pattern => cls.toLowerCase().includes(pattern))
      );
      
      if (galleryClasses.length > 0) {
        console.log(`🎯 Found gallery pattern class: .${galleryClasses[0]}`);
        return `.${galleryClasses[0]}`;
      }
      
      // Try most specific class first
      if (classes.length > 0) {
        console.log(`🎯 Using first available class: .${classes[0]}`);
        return `.${classes[0]}`;
      }
      
      return null;
    }
    
    generateByStructuralPattern(element) {
      const tagName = element.tagName.toLowerCase();
      
      // Common gallery container patterns
      if (['div', 'li', 'article', 'section'].includes(tagName)) {
        const parent = element.parentElement;
        if (parent) {
          const parentTag = parent.tagName.toLowerCase();
          const parentClasses = Array.from(parent.classList);
          
          // Check if parent looks like a gallery container
          const galleryParentPatterns = ['grid', 'gallery', 'list', 'container', 'wrapper'];
          const hasGalleryParent = parentClasses.some(cls =>
            galleryParentPatterns.some(pattern => cls.toLowerCase().includes(pattern))
          );
          
          if (hasGalleryParent) {
            return `${parentTag} > ${tagName}`;
          }
        }
      }
      
      return null;
    }
    
    generateByAttributePattern(element) {
      // Check for data attributes commonly used in galleries
      const galleryAttributes = [
        'data-id', 'data-item', 'data-index', 'data-key',
        'data-product', 'data-photo', 'data-image'
      ];
      
      for (const attr of galleryAttributes) {
        if (element.hasAttribute(attr)) {
          return `[${attr}]`;
        }
      }
      
      return null;
    }
    
    generateByTagPattern(element) {
      // For specific tags like img, a, figure
      const tagName = element.tagName.toLowerCase();
      
      if (['img', 'figure', 'picture'].includes(tagName)) {
        return tagName;
      }
      
      return null;
    }
    
    generateByParentPattern(element) {
      // Generate selector based on parent context
      let current = element;
      const path = [];
      
      for (let i = 0; i < 3 && current && current.parentElement; i++) {
        const parent = current.parentElement;
        const tagName = current.tagName.toLowerCase();
        const classes = Array.from(current.classList);
        
        if (classes.length > 0) {
          path.unshift(`${tagName}.${classes[0]}`);
        } else {
          path.unshift(tagName);
        }
        
        current = parent;
      }
      
      return path.join(' > ');
    }
    
    generateByNthChildPattern(element) {
      // Generate selector based on nth-child position
      const parent = element.parentElement;
      if (!parent) return null;
      
      const siblings = Array.from(parent.children);
      const elementIndex = siblings.indexOf(element);
      
      if (elementIndex === -1) return null;
      
      const tagName = element.tagName.toLowerCase();
      
      // Try to find a pattern in sibling positions
      const sameTagSiblings = siblings.filter(sibling => 
        sibling.tagName.toLowerCase() === tagName
      );
      
      if (sameTagSiblings.length >= 2) {
        return `${tagName}:nth-child(n)`;
      }
      
      return null;
    }
    
    generateByTagNamePattern(element) {
      // Very basic tag-based selector as ultimate fallback
      const tagName = element.tagName.toLowerCase();
      
      // Only use for common gallery elements
      if (['img', 'figure', 'picture', 'article', 'div', 'li'].includes(tagName)) {
        return tagName;
      }
      
      return null;
    }
    
    generateFallbackSelector(element) {
      // Ultimate fallback - try to generate any working selector
      console.log('🚨 Using fallback selector generation');
      
      // Try simple strategies with lower validation requirements
      const originalMinimum = this.options.minimumSimilarElements;
      const originalRelaxed = this.options.relaxedValidation;
      
      // Temporarily relax validation
      this.options.minimumSimilarElements = 1;
      this.options.relaxedValidation = true;
      
      const fallbackStrategies = [
        // Try any class name
        () => {
          const classes = Array.from(element.classList);
          if (classes.length > 0) {
            return `.${classes[0]}`;
          }
          return null;
        },
        // Try tag name
        () => element.tagName.toLowerCase(),
        // Try parent + tag
        () => {
          const parent = element.parentElement;
          if (parent) {
            const parentTag = parent.tagName.toLowerCase();
            const elementTag = element.tagName.toLowerCase();
            return `${parentTag} ${elementTag}`;
          }
          return null;
        }
      ];
      
      for (const strategy of fallbackStrategies) {
        try {
          const selector = strategy();
          if (selector && this.validateSelector(selector, element)) {
            console.log('✅ Fallback selector worked:', selector);
            // Restore original settings
            this.options.minimumSimilarElements = originalMinimum;
            this.options.relaxedValidation = originalRelaxed;
            return selector;
          }
        } catch (error) {
          console.warn('⚠️ Fallback strategy failed:', error);
        }
      }
      
      // Restore original settings
      this.options.minimumSimilarElements = originalMinimum;
      this.options.relaxedValidation = originalRelaxed;
      
      console.warn('❌ All fallback strategies failed');
      return null;
    }
    
    validateSelector(selector, originalElement) {
      try {
        const elements = document.querySelectorAll(selector);
        
        // Selector must match the original element
        if (!Array.from(elements).includes(originalElement)) {
          console.log('⚠️ Selector does not match original element');
          return false;
        }
        
        // Should find at least minimum number of elements
        if (elements.length < this.options.minimumSimilarElements) {
          console.log(`⚠️ Found ${elements.length} elements, need at least ${this.options.minimumSimilarElements}`);
          return false;
        }
        
        // Elements should be visually similar (same approximate size/structure)
        if (this.options.smartGalleryDetection) {
          const similarityResult = this.areElementsSimilar(Array.from(elements));
          if (!similarityResult) {
            console.log('⚠️ Elements not visually similar');
            // If relaxed validation is enabled, accept selectors with reasonable element count
            if (this.options.relaxedValidation && elements.length >= 2) {
              console.log('✅ Accepting due to relaxed validation mode');
              return true;
            }
            return false;
          }
        }
        
        console.log(`✅ Selector validation passed: ${elements.length} elements found`);
        return true;
      } catch (error) {
        console.error('❌ Selector validation error:', error);
        return false;
      }
    }
    
    areElementsSimilar(elements) {
      if (elements.length < 2) return true;
      
      // Check if elements have similar dimensions
      const sampleElement = elements[0];
      const sampleRect = sampleElement.getBoundingClientRect();
      const sampleArea = sampleRect.width * sampleRect.height;
      
      // Skip similarity check if sample element has zero area (hidden/not rendered)
      if (sampleArea === 0) {
        console.log('⚠️ Sample element has zero area, skipping size similarity check');
        return true;
      }
      
      // Allow 80% variance in size (more lenient than previous 50%)
      const tolerance = 0.8;
      
      const similarElements = elements.filter(element => {
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        
        // Skip elements with zero area
        if (area === 0) return false;
        
        const ratio = area / sampleArea;
        return ratio >= (1 - tolerance) && ratio <= (1 + tolerance);
      });
      
      // At least 60% of elements should be similar in size (reduced from 70%)
      const similarityThreshold = 0.6;
      const similarityRatio = similarElements.length / elements.length;
      
      console.log(`📐 Size similarity: ${similarElements.length}/${elements.length} (${(similarityRatio * 100).toFixed(1)}%)`);
      
      return similarityRatio >= similarityThreshold;
    }
    
    findAndHighlightSimilarElements(selector) {
      try {
        const elements = document.querySelectorAll(selector);
        this.similarElements = Array.from(elements);
        
        console.log(`🔍 Found ${this.similarElements.length} similar elements`);
        
        // Highlight all similar elements
        this.similarElements.forEach(element => {
          if (element !== this.selectedElement) {
            element.classList.add('steptwo-picker-similar');
          }
        });
        
        this.showCounter(this.similarElements.length);
        
      } catch (error) {
        console.error('❌ Error finding similar elements:', error);
      }
    }
    
    removeHighlights() {
      // Remove all picker classes
      const highlightClasses = [
        'steptwo-picker-highlight',
        'steptwo-picker-selected', 
        'steptwo-picker-similar'
      ];
      
      highlightClasses.forEach(className => {
        const elements = document.querySelectorAll(`.${className}`);
        elements.forEach(element => element.classList.remove(className));
      });
      
      // Remove counter
      const counter = document.getElementById('steptwo-picker-counter');
      if (counter && counter.parentNode) {
        counter.parentNode.removeChild(counter);
      }
    }
    
    notifySelection() {
      // Send selection info back to dashboard
      if (window.chrome && chrome.runtime) {
        const selectionData = {
          selector: this.selectedSelector,
          elementCount: this.similarElements.length,
          sampleElement: {
            tagName: this.selectedElement.tagName,
            className: this.selectedElement.className,
            textContent: this.selectedElement.textContent?.substring(0, 100)
          }
        };
        
        console.log('📡 Sending selection to dashboard:', selectionData);
        
        chrome.runtime.sendMessage({
          action: 'SELECTOR_PICKED',
          data: selectionData
        });
        
        // Show appropriate message
        if (this.similarElements.length > 1) {
          this.showSuccessMessage(this.similarElements.length);
        } else {
          this.showWarningMessage('Single element selected. No similar elements found.');
        }
        
        // Auto-stop picker after selection
        setTimeout(() => this.stop(), 3000);
      }
    }
    
    showSuccessMessage(count) {
      const instructions = document.getElementById('steptwo-picker-instructions');
      if (instructions) {
        instructions.innerHTML = `
          ✅ <strong>Selection Complete!</strong><br>
          Found ${count} similar elements<br>
          <small>Selector sent to dashboard • Auto-closing...</small>
        `;
        instructions.style.background = 'rgba(0, 150, 0, 0.9)';
      }
    }
    
    showWarningMessage(message) {
      const instructions = document.getElementById('steptwo-picker-instructions');
      if (instructions) {
        instructions.innerHTML = `
          ⚠️ <strong>Partial Selection</strong><br>
          ${message}<br>
          <small>Press ESC to cancel • Click elsewhere to try again</small>
        `;
        instructions.style.background = 'rgba(255, 165, 0, 0.9)';
      }
    }
  }
  
  // Export for use
  window.StepTwoElementPicker = StepTwoElementPicker;
  
  // Legacy export functions for backward compatibility
  window.startPicker = function(options = {}) {
    if (!window.stepTwoPicker) {
      window.stepTwoPicker = new StepTwoElementPicker(options);
    }
    return window.stepTwoPicker.start(options.siteProfile);
  };
  
  window.stopPicker = function() {
    if (window.stepTwoPicker) {
      window.stepTwoPicker.stop();
    }
  };
  
  console.log('🎯 STEPTWO Element Picker loaded');
}