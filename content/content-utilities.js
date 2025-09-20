// content-utilities.js - Consolidated content script utilities
// Combines hashWorker.js functionality and provides shared utilities

// =============================================================================
// HASH WORKER FUNCTIONALITY (from hashWorker.js)
// =============================================================================

// Enhanced hash worker functionality using simplified approach
class ContentHashWorker {
  static async generateSimpleHash(url) {
    try {
      const img = await this._loadImage(url);
      return this._averageHash(img);
    } catch (error) {
      console.error('Hash generation error:', error);
      throw error;
    }
  }

  static _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  static _averageHash(img) {
    const size = 8;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    
    let total = 0;
    const gray = [];
    for (let i = 0; i < data.length; i += 4) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray.push(g);
      total += g;
    }
    
    const avg = total / 64;
    let hash = 0n;
    gray.forEach((val, idx) => {
      if (val > avg) {
        hash |= (1n << BigInt(idx));
      }
    });
    
    return hash.toString(16);
  }
}

// =============================================================================
// SELECTION UTILITIES 
// =============================================================================

class SelectionUtilities {
  static createElement(tag, attributes = {}, text = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else {
        element.setAttribute(key, value);
      }
    });
    
    if (text) {
      element.textContent = text;
    }
    
    return element;
  }

  static setTextContent(element, text) {
    if (element && typeof text === 'string') {
      element.textContent = text;
    }
  }

  static replaceContent(element, newContent) {
    if (element) {
      element.innerHTML = '';
      if (typeof newContent === 'string') {
        element.textContent = newContent;
      } else if (newContent instanceof Node) {
        element.appendChild(newContent);
      }
    }
  }

  static getCssPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        parts.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = current.className.trim().split(/\s+/).join('.');
        if (classes) {
          selector += `.${classes}`;
        }
      }
      
      // Add nth-child if needed for specificity
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        const index = siblings.indexOf(current);
        if (siblings.length > 1) {
          selector += `:nth-child(${index + 1})`;
        }
      }
      
      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  static isValidImageElement(element) {
    if (!element) {return false;}
    
    if (element.tagName === 'IMG') {
      return element.src && element.complete && element.naturalWidth > 0;
    }
    
    if (element.tagName === 'DIV' || element.tagName === 'SPAN') {
      const style = window.getComputedStyle(element);
      return style.backgroundImage && style.backgroundImage !== 'none';
    }
    
    return false;
  }

  static getElementDimensions(element) {
    if (!element) {return { width: 0, height: 0 };}
    
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left
    };
  }

  static isElementVisible(element) {
    if (!element) {return false;}
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  static getImageUrlFromElement(element) {
    if (!element) {return null;}
    
    if (element.tagName === 'IMG') {
      return element.src || element.getAttribute('data-src') || element.getAttribute('data-lazy-src');
    }
    
    const style = window.getComputedStyle(element);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      const match = style.backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
      return match ? match[1] : null;
    }
    
    return null;
  }

  static sanitizeFilename(filename) {
    if (!filename) {return 'untitled';}
    
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.$/, '_')
      .slice(0, 255);
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

// =============================================================================
// CROP SELECTOR FUNCTIONALITY
// =============================================================================

class CropSelector {
  constructor() {
    this.overlay = null;
    this.startPos = null;
    this.endPos = null;
    this.isSelecting = false;
    this.selectionBox = null;
    this.onSelection = null;
  }

  start(onSelection = null) {
    if (this.overlay) {return;}
    
    this.onSelection = onSelection;
    this.createOverlay();
    this.attachEventListeners();
    this.showInstructions();
  }

  stop() {
    if (this.overlay) {
      this.cleanup();
    }
  }

  createOverlay() {
    this.overlay = SelectionUtilities.createElement('div', {
      style: {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '2147483647',
        background: 'rgba(0, 0, 0, 0.3)',
        cursor: 'crosshair',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }
    });

    const instructions = SelectionUtilities.createElement('div', {
      style: {
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        textAlign: 'center'
      }
    }, 'Drag to select region • ESC to cancel');

    this.overlay.appendChild(instructions);
    document.body.appendChild(this.overlay);
  }

  attachEventListeners() {
    this.overlay.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.overlay.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.overlay.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  handleMouseDown(e) {
    this.isSelecting = true;
    this.startPos = { x: e.clientX, y: e.clientY };
    
    this.selectionBox = SelectionUtilities.createElement('div', {
      style: {
        position: 'fixed',
        border: '2px solid #007acc',
        background: 'rgba(0, 122, 204, 0.1)',
        pointerEvents: 'none',
        zIndex: '2147483648'
      }
    });
    
    document.body.appendChild(this.selectionBox);
  }

  handleMouseMove(e) {
    if (!this.isSelecting || !this.selectionBox) {return;}
    
    const current = { x: e.clientX, y: e.clientY };
    const left = Math.min(this.startPos.x, current.x);
    const top = Math.min(this.startPos.y, current.y);
    const width = Math.abs(current.x - this.startPos.x);
    const height = Math.abs(current.y - this.startPos.y);
    
    Object.assign(this.selectionBox.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    });
  }

  handleMouseUp(e) {
    if (!this.isSelecting) {return;}
    
    this.isSelecting = false;
    this.endPos = { x: e.clientX, y: e.clientY };
    
    const selection = {
      left: Math.min(this.startPos.x, this.endPos.x),
      top: Math.min(this.startPos.y, this.endPos.y),
      right: Math.max(this.startPos.x, this.endPos.x),
      bottom: Math.max(this.startPos.y, this.endPos.y)
    };
    
    if (this.onSelection) {
      this.onSelection(selection);
    }
    
    this.cleanup();
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.cleanup();
    }
  }

  showInstructions() {
    // Instructions are already shown in createOverlay
  }

  cleanup() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
    
    this.isSelecting = false;
    this.startPos = null;
    this.endPos = null;
    
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}

// =============================================================================
// CSS BACKGROUND EXTRACTOR (from css-background-extractor.js)
// =============================================================================

class CSSBackgroundExtractor {
  constructor(options = {}) {
    this.options = {
      // CSS properties to analyze
      backgroundProperties: options.backgroundProperties || [
        'background-image',
        'background',
        '--background-image', // CSS custom properties
        '--bg-image',
        '--hero-bg'
      ],
      
      // URL extraction patterns
      urlPatterns: options.urlPatterns || [
        /url\(['"]?([^'"()]+)['"]?\)/gi,
        /url\(([^)]+)\)/gi
      ],
      
      // Selectors to analyze
      targetSelectors: options.targetSelectors || [
        '*' // All elements initially, filtered later
      ],
      
      // Element filters (to avoid processing irrelevant elements)
      skipSelectors: options.skipSelectors || [
        'script', 'style', 'meta', 'link', 'title', 'head'
      ],
      
      // Minimum dimensions for meaningful backgrounds
      minWidth: options.minWidth || 50,
      minHeight: options.minHeight || 50,
      
      // Image validation
      imageExtensions: options.imageExtensions || [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'
      ],
      
      // Performance limits
      maxElementsToProcess: options.maxElementsToProcess || 5000,
      
      ...options
    };
    
    this.extractedUrls = new Set();
    this.processedElements = new Set();
    this.stats = {
      elementsProcessed: 0,
      backgroundsFound: 0,
      validImages: 0,
      processingTime: 0
    };
  }

  async extractAll() {
    const startTime = performance.now();
    console.log('🖼️ Starting CSS background extraction...');
    
    try {
      // Get all elements to process
      const elements = this.getElementsToProcess();
      console.log(`Processing ${elements.length} elements for background images`);
      
      for (const element of elements) {
        if (this.stats.elementsProcessed >= this.options.maxElementsToProcess) {
          console.warn('Reached maximum element processing limit');
          break;
        }
        
        await this.processElement(element);
        this.stats.elementsProcessed++;
      }
      
      this.stats.processingTime = performance.now() - startTime;
      
      const results = {
        urls: Array.from(this.extractedUrls),
        stats: { ...this.stats },
        timestamp: Date.now()
      };
      
      console.log('✅ CSS background extraction completed:', results.stats);
      return results;
      
    } catch (error) {
      console.error('❌ CSS background extraction failed:', error);
      throw error;
    }
  }

  getElementsToProcess() {
    const elements = [];
    
    // Get all elements matching target selectors
    for (const selector of this.options.targetSelectors) {
      try {
        const matches = document.querySelectorAll(selector);
        elements.push(...matches);
      } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
      }
    }
    
    // Filter out elements we want to skip
    return elements.filter(element => {
      // Skip elements by tag name
      if (this.options.skipSelectors.includes(element.tagName.toLowerCase())) {
        return false;
      }
      
      // Skip if already processed
      if (this.processedElements.has(element)) {
        return false;
      }
      
      // Skip if element is not visible or too small
      const rect = element.getBoundingClientRect();
      if (rect.width < this.options.minWidth || rect.height < this.options.minHeight) {
        return false;
      }
      
      return true;
    });
  }

  async processElement(element) {
    if (this.processedElements.has(element)) {
      return;
    }
    
    this.processedElements.add(element);
    
    try {
      // Get computed styles
      const computedStyle = window.getComputedStyle(element);
      
      // Check each background property
      for (const property of this.options.backgroundProperties) {
        let value;
        
        // Handle CSS custom properties
        if (property.startsWith('--')) {
          value = computedStyle.getPropertyValue(property);
        } else {
          value = computedStyle[property] || computedStyle.getPropertyValue(property);
        }
        
        if (value && value !== 'none' && value !== 'initial') {
          await this.extractUrlsFromValue(value, element);
        }
      }
      
      // Also check inline styles
      if (element.style) {
        for (const property of this.options.backgroundProperties) {
          if (!property.startsWith('--')) { // Skip custom properties for inline styles
            const value = element.style[property];
            if (value && value !== 'none') {
              await this.extractUrlsFromValue(value, element);
            }
          }
        }
      }
      
    } catch (error) {
      console.warn('Error processing element for background images:', error);
    }
  }

  async extractUrlsFromValue(cssValue, element) {
    if (!cssValue || typeof cssValue !== 'string') {
      return;
    }
    
    // Extract URLs using patterns
    for (const pattern of this.options.urlPatterns) {
      pattern.lastIndex = 0; // Reset regex state
      let match;
      
      while ((match = pattern.exec(cssValue)) !== null) {
        const url = match[1]?.trim().replace(/['"]/g, '');
        
        if (url && this.isValidImageUrl(url)) {
          try {
            const absoluteUrl = this.resolveUrl(url);
            if (absoluteUrl) {
              this.extractedUrls.add(absoluteUrl);
              this.stats.backgroundsFound++;
              
              // Additional validation
              if (await this.validateImage(absoluteUrl)) {
                this.stats.validImages++;
              }
            }
          } catch (error) {
            console.warn('Failed to resolve background URL:', url, error);
          }
        }
      }
    }
  }

  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // Skip data URLs that are not images
    if (url.startsWith('data:') && !url.startsWith('data:image/')) {
      return false;
    }
    
    // Skip gradient functions
    if (url.includes('gradient(')) {
      return false;
    }
    
    // For data URLs that are images, accept them
    if (url.startsWith('data:image/')) {
      return true;
    }
    
    // Check file extension
    const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
    return this.options.imageExtensions.includes(extension);
  }

  resolveUrl(url) {
    try {
      // Handle absolute URLs
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
      }
      
      // Handle protocol-relative URLs
      if (url.startsWith('//')) {
        return window.location.protocol + url;
      }
      
      // Handle relative URLs
      return new URL(url, window.location.href).href;
    } catch (error) {
      console.warn('Failed to resolve URL:', url, error);
      return null;
    }
  }

  async validateImage(url) {
    // For now, just basic validation
    // Could be extended to actually load and check the image
    try {
      return this.isValidImageUrl(url) && !url.includes('1x1') && !url.includes('pixel');
    } catch {
      return false;
    }
  }

  getResults() {
    return {
      urls: Array.from(this.extractedUrls),
      stats: { ...this.stats }
    };
  }

  reset() {
    this.extractedUrls.clear();
    this.processedElements.clear();
    this.stats = {
      elementsProcessed: 0,
      backgroundsFound: 0,
      validImages: 0,
      processingTime: 0
    };
  }
}

// =============================================================================
// UPDATED GLOBAL EXPORTS
// =============================================================================

// Make utilities available globally for importScripts compatibility
if (typeof self !== 'undefined') {
  self.ContentHashWorker = ContentHashWorker;
  self.SelectionUtilities = SelectionUtilities;
  self.CropSelector = CropSelector;
  self.CSSBackgroundExtractor = CSSBackgroundExtractor;
}

// For web worker context (hashWorker compatibility)
if (typeof importScripts !== 'undefined') {
  self.onmessage = async (e) => {
    const { id, url, options = {} } = e.data;
    try {
      const hash = await ContentHashWorker.generateSimpleHash(url);
      self.postMessage({ id, hash });
    } catch (err) {
      console.error('Hash worker error:', err);
      self.postMessage({ id, error: true, message: err.message });
    }
  };
}

// ES modules export for modern usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ContentHashWorker, SelectionUtilities, CropSelector, CSSBackgroundExtractor };
}