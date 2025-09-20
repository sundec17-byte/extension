// content-analysis.js - Consolidated content analysis utilities
// Combines network-interceptor.js and smartGuess.js for intelligent content discovery

// =============================================================================
// NETWORK INTERCEPTOR (from network-interceptor.js)
// =============================================================================

// Prevent duplicate declarations
if (!window.NetworkInterceptor) {

  class NetworkInterceptor {
    constructor(options = {}) {
      this.options = {
        // API endpoint patterns to monitor
        apiPatterns: options.apiPatterns || [
          /\/api\/.*\/images?/i,
          /\/api\/.*\/products?/i,
          /\/api\/.*\/gallery/i,
          /\/api\/.*\/media/i,
          /graphql/i,
          /\/rest\/.*\/images?/i
        ],
        
        // Image-related response patterns
        imageResponsePatterns: options.imageResponsePatterns || [
          /<img[^>]+src=["']([^"']+)["']/gi,
          /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
          /"url":\s*"([^"]+\.(?:jpg|jpeg|png|gif|webp|avif|svg))"/gi,
          /"image":\s*"([^"]+)"/gi,
          /"src":\s*"([^"]+)"/gi,
          /"thumb":\s*"([^"]+)"/gi,
          /"thumbnail":\s*"([^"]+)"/gi
        ],
        
        // Response size limits (to avoid processing large files)
        maxResponseSize: options.maxResponseSize || 1024 * 1024, // 1MB
        
        // Timing configuration
        interceptTimeout: options.interceptTimeout || 5000,
        
        ...options
      };
      
      this.interceptedRequests = new Map();
      this.imageUrls = new Set();
      this.callbacks = new Map();
      this.isActive = false;
      
      this.stats = {
        totalRequests: 0,
        apiRequests: 0,
        imageResponsesDetected: 0,
        urlsExtracted: 0
      };
    }
    
    start() {
      if (this.isActive) {return;}
      
      this.isActive = true;
      this.patchXHR();
      this.patchFetch();
      
      console.log('🔍 Network interceptor started');
    }
    
    stop() {
      this.isActive = false;
      this.restoreXHR();
      this.restoreFetch();
      
      console.log('⏹️ Network interceptor stopped');
    }
    
    patchXHR() {
      const self = this;
      const originalXHR = window.XMLHttpRequest;
      const originalOpen = originalXHR.prototype.open;
      const originalSend = originalXHR.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._interceptorData = { method, url, startTime: Date.now() };
        return originalOpen.call(this, method, url, async, user, password);
      };
      
      XMLHttpRequest.prototype.send = function(data) {
        if (this._interceptorData && self.isActive) {
          self.handleXHRRequest(this);
        }
        return originalSend.call(this, data);
      };
      
      this.originalXHR = { originalXHR, originalOpen, originalSend };
    }
    
    patchFetch() {
      const self = this;
      const originalFetch = window.fetch;
      
      window.fetch = function(resource, options = {}) {
        if (self.isActive) {
          const url = typeof resource === 'string' ? resource : resource.url;
          self.handleFetchRequest(url, options);
        }
        return originalFetch.call(this, resource, options);
      };
      
      this.originalFetch = originalFetch;
    }
    
    handleXHRRequest(xhr) {
      const { url } = xhr._interceptorData;
      
      if (this.shouldMonitorRequest(url)) {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            this.analyzeResponse(url, xhr.responseText, xhr.getResponseHeader('content-type'));
          }
        });
      }
      
      this.stats.totalRequests++;
      if (this.isApiRequest(url)) {
        this.stats.apiRequests++;
      }
    }
    
    handleFetchRequest(url, _options) {
      if (this.shouldMonitorRequest(url)) {
        // We can't easily intercept fetch responses, so we just log
        console.log('📡 Fetch request detected:', url);
      }
      
      this.stats.totalRequests++;
      if (this.isApiRequest(url)) {
        this.stats.apiRequests++;
      }
    }
    
    shouldMonitorRequest(url) {
      return this.isApiRequest(url) || url.includes('image') || url.includes('photo');
    }
    
    isApiRequest(url) {
      return this.options.apiPatterns.some(pattern => pattern.test(url));
    }
    
    analyzeResponse(url, responseText, contentType) {
      if (!responseText || responseText.length > this.options.maxResponseSize) {
        return;
      }
      
      // Look for JSON responses that might contain image URLs
      if (contentType && contentType.includes('json')) {
        this.extractImageUrlsFromJSON(responseText, url);
      } else if (contentType && contentType.includes('html')) {
        this.extractImageUrlsFromHTML(responseText, url);
      }
    }
    
    extractImageUrlsFromJSON(jsonText, sourceUrl) {
      try {
        const data = JSON.parse(jsonText);
        const urls = this.findImageUrlsInObject(data);
        
        urls.forEach(url => {
          this.imageUrls.add(this.resolveUrl(url, sourceUrl));
        });
        
        if (urls.length > 0) {
          this.stats.imageResponsesDetected++;
          this.stats.urlsExtracted += urls.length;
          this.notifyCallbacks('imagesFound', { urls, source: sourceUrl });
        }
      } catch (error) {
        console.warn('Failed to parse JSON response:', error);
      }
    }
    
    extractImageUrlsFromHTML(html, sourceUrl) {
      const urls = [];
      
      this.options.imageResponsePatterns.forEach(pattern => {
        let match;
        pattern.lastIndex = 0; // Reset regex state
        while ((match = pattern.exec(html)) !== null) {
          urls.push(match[1]);
        }
      });
      
      if (urls.length > 0) {
        urls.forEach(url => {
          this.imageUrls.add(this.resolveUrl(url, sourceUrl));
        });
        
        this.stats.imageResponsesDetected++;
        this.stats.urlsExtracted += urls.length;
        this.notifyCallbacks('imagesFound', { urls, source: sourceUrl });
      }
    }
    
    findImageUrlsInObject(obj, urls = []) {
      if (typeof obj !== 'object' || obj === null) {
        return urls;
      }
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && this.looksLikeImageUrl(value)) {
          urls.push(value);
        } else if (typeof value === 'object') {
          this.findImageUrlsInObject(value, urls);
        }
      }
      
      return urls;
    }
    
    looksLikeImageUrl(url) {
      return typeof url === 'string' && 
             url.length > 5 && 
             /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|tiff)($|\?)/i.test(url);
    }
    
    resolveUrl(url, baseUrl) {
      try {
        return new URL(url, baseUrl).href;
      } catch {
        return url;
      }
    }
    
    onImagesFound(callback) {
      this.callbacks.set('imagesFound', callback);
    }
    
    notifyCallbacks(event, data) {
      const callback = this.callbacks.get(event);
      if (callback) {
        callback(data);
      }
    }
    
    getDiscoveredUrls() {
      return Array.from(this.imageUrls);
    }
    
    getStats() {
      return { ...this.stats };
    }
    
    restoreXHR() {
      if (this.originalXHR) {
        const { originalXHR, originalOpen, originalSend } = this.originalXHR;
        window.XMLHttpRequest = originalXHR;
        XMLHttpRequest.prototype.open = originalOpen;
        XMLHttpRequest.prototype.send = originalSend;
      }
    }
    
    restoreFetch() {
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
      }
    }
  }
  
  window.NetworkInterceptor = NetworkInterceptor;
}

// =============================================================================
// SMART GUESS SYSTEM (from smartGuess.js)
// =============================================================================

// Utility: check visible
function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && 
         getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
}

function getCssPath(el) {
  if (!(el instanceof Element)) {return '';}
  const parts = [];
  while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
      parts.unshift(selector);
      break;
    } else {
      // add nth-child for uniqueness among siblings
      let sib = el, nth = 1;
      while ((sib = sib.previousElementSibling)) {nth++;}
      selector += `:nth-child(${nth})`;
    }
    parts.unshift(selector);
    el = el.parentElement;
  }
  return parts.join(' > ');
}

// Advanced pattern recognition for galleries
function analyzeImagePatterns() {
  const images = Array.from(document.querySelectorAll('img')).filter(isVisible);
  const patterns = new Map();
  
  for (const img of images) {
    // Analyze parent containers
    let container = img.closest('[class*="gallery"], [class*="grid"], [class*="item"], [class*="card"], [class*="photo"]');
    if (!container) {
      container = img.closest('div, article, section, li');
    }
    if (!container) {
      continue;
    }
    
    // Create pattern signature
    const pattern = {
      tagName: container.tagName.toLowerCase(),
      classList: Array.from(container.classList).sort().join('.'),
      hasLink: !!container.querySelector('a'),
      imageCount: container.querySelectorAll('img').length,
      position: container.getBoundingClientRect()
    };
    
    const signature = `${pattern.tagName}|${pattern.classList}|${pattern.hasLink}|${pattern.imageCount}`;
    
    if (!patterns.has(signature)) {
      patterns.set(signature, {
        containers: [],
        score: 0,
        pattern
      });
    }
    
    const entry = patterns.get(signature);
    entry.containers.push(container);
    
    // Calculate pattern score
    entry.score = calculatePatternScore(entry.containers, pattern);
  }
  
  // Find best pattern
  let bestPattern = null;
  let maxScore = 0;
  
  for (const [signature, data] of patterns) {
    if (data.score > maxScore && data.containers.length >= 3) {
      maxScore = data.score;
      bestPattern = { signature, ...data };
    }
  }
  
  return bestPattern;
}

function calculatePatternScore(containers, pattern) {
  let score = 0;
  
  // More containers = higher score
  score += containers.length * 10;
  
  // Gallery-related classes boost score
  if (pattern.classList.includes('gallery') || pattern.classList.includes('grid')) {
    score += 50;
  }
  
  // Cards/items are good indicators
  if (pattern.classList.includes('item') || pattern.classList.includes('card')) {
    score += 30;
  }
  
  // Links within containers suggest clickable galleries
  if (pattern.hasLink) {
    score += 20;
  }
  
  // Multiple images per container might indicate thumbnails
  if (pattern.imageCount > 1) {
    score += 15;
  }
  
  // Check if containers are regularly positioned (grid-like)
  if (containers.length >= 3) {
    const positions = containers.map(c => c.getBoundingClientRect());
    const isGridLike = checkGridAlignment(positions);
    if (isGridLike) {
      score += 40;
    }
  }
  
  return score;
}

function checkGridAlignment(positions) {
  if (positions.length < 3) {return false;}
  
  // Check if items are aligned in rows or columns
  const tolerance = 20; // pixels
  let alignedRows = 0;
  let alignedCols = 0;
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      // Check row alignment (similar top positions)
      if (Math.abs(positions[i].top - positions[j].top) < tolerance) {
        alignedRows++;
      }
      
      // Check column alignment (similar left positions)
      if (Math.abs(positions[i].left - positions[j].left) < tolerance) {
        alignedCols++;
      }
    }
  }
  
  // If we have enough aligned items, it's probably a grid
  return alignedRows >= 2 || alignedCols >= 2;
}

// Smart guess functionality
function smartGuessImages() {
  const result = {
    images: [],
    confidence: 0,
    method: 'pattern-analysis',
    metadata: {}
  };
  
  try {
    // First, try pattern analysis
    const bestPattern = analyzeImagePatterns();
    
    if (bestPattern && bestPattern.score > 100) {
      // Extract images from the best pattern
      const images = bestPattern.containers.map(container => {
        const img = container.querySelector('img');
        const link = container.querySelector('a');
        
        return {
          src: img ? img.src : null,
          thumb: img ? img.src : null,
          fullsize: link ? link.href : null,
          alt: img ? img.alt : '',
          container: getCssPath(container),
          pattern: bestPattern.signature
        };
      }).filter(item => item.src);
      
      result.images = images;
      result.confidence = Math.min(bestPattern.score / 200, 1); // Normalize to 0-1
      result.metadata = {
        pattern: bestPattern.signature,
        containers: bestPattern.containers.length,
        score: bestPattern.score
      };
    } else {
      // Fallback: simple image collection
      const allImages = Array.from(document.querySelectorAll('img'))
        .filter(isVisible)
        .map(img => ({
          src: img.src,
          thumb: img.src,
          fullsize: img.closest('a') ? img.closest('a').href : img.src,
          alt: img.alt || '',
          container: getCssPath(img.parentElement),
          pattern: 'fallback'
        }));
      
      result.images = allImages;
      result.confidence = 0.3; // Low confidence for fallback
      result.method = 'fallback';
    }
  } catch (error) {
    console.error('Smart guess analysis failed:', error);
    result.confidence = 0;
  }
  
  return result;
}

// =============================================================================
// CONTENT ANALYSIS API
// =============================================================================

class ContentAnalysis {
  constructor() {
    this.networkInterceptor = new NetworkInterceptor();
    this.isActive = false;
  }
  
  start() {
    if (!this.isActive) {
      this.networkInterceptor.start();
      this.isActive = true;
      console.log('🔍 Content analysis started');
    }
  }
  
  stop() {
    if (this.isActive) {
      this.networkInterceptor.stop();
      this.isActive = false;
      console.log('⏹️ Content analysis stopped');
    }
  }
  
  analyzeImages() {
    const smartGuess = smartGuessImages();
    const networkUrls = this.networkInterceptor.getDiscoveredUrls();
    
    return {
      smartGuess,
      networkDiscovered: networkUrls,
      stats: this.networkInterceptor.getStats(),
      combined: this.combineResults(smartGuess.images, networkUrls)
    };
  }
  
  combineResults(smartGuessImages, networkUrls) {
    const combined = [...smartGuessImages];
    const existingSrcs = new Set(smartGuessImages.map(img => img.src));
    
    // Add network-discovered URLs that aren't already found
    networkUrls.forEach(url => {
      if (!existingSrcs.has(url)) {
        combined.push({
          src: url,
          thumb: url,
          fullsize: url,
          alt: '',
          container: 'network-discovered',
          pattern: 'network-interceptor'
        });
      }
    });
    
    return combined;
  }
  
  getStats() {
    return this.networkInterceptor.getStats();
  }
}

// =============================================================================
// GLOBAL EXPORTS
// =============================================================================

// Make available globally
if (typeof window !== 'undefined') {
  window.NetworkInterceptor = NetworkInterceptor;
  window.ContentAnalysis = ContentAnalysis;
  window.smartGuessImages = smartGuessImages;
  window.analyzeImagePatterns = analyzeImagePatterns;
}

// For service worker/importScripts environment
if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
  self.NetworkInterceptor = NetworkInterceptor;
  self.ContentAnalysis = ContentAnalysis;
  self.smartGuessImages = smartGuessImages;
}

// ES modules export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NetworkInterceptor, ContentAnalysis, smartGuessImages, analyzeImagePatterns };
}