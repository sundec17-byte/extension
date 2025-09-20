// advanced-filter-system.js - Enhanced filtering capabilities
// Provides regex, MIME type, dimension, and custom filtering rules

class AdvancedFilterSystem {
  constructor(options = {}) {
    this.options = {
      enableRegexFilters: options.enableRegexFilters !== false,
      enableMimeFilters: options.enableMimeFilters !== false,
      enableDimensionFilters: options.enableDimensionFilters !== false,
      enableSizeFilters: options.enableSizeFilters !== false,
      enableCustomFilters: options.enableCustomFilters !== false,
      cacheResults: options.cacheResults !== false,
      maxCacheSize: options.maxCacheSize || 1000,
      ...options
    };

    this.filterCache = new Map();
    this.customFilters = new Map();
    this.filterStats = {
      totalFiltered: 0,
      passedFilters: 0,
      failedFilters: 0,
      filterBreakdown: {}
    };

    this.setupDefaultFilters();
  }

  setupDefaultFilters() {
    // Common MIME type filters
    this.mimeTypeFilters = {
      images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'],
      videos: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
      documents: ['application/pdf', 'text/plain', 'application/msword'],
      archives: ['application/zip', 'application/x-rar', 'application/x-7z-compressed']
    };

    // Common extension filters
    this.extensionFilters = {
      images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
      videos: ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv'],
      documents: ['.pdf', '.txt', '.doc', '.docx'],
      archives: ['.zip', '.rar', '.7z', '.tar']
    };

    // Dimension presets
    this.dimensionPresets = {
      thumbnail: { minWidth: 0, maxWidth: 300, minHeight: 0, maxHeight: 300 },
      small: { minWidth: 300, maxWidth: 800, minHeight: 300, maxHeight: 600 },
      medium: { minWidth: 800, maxWidth: 1920, minHeight: 600, maxHeight: 1080 },
      large: { minWidth: 1920, maxWidth: 4096, minHeight: 1080, maxHeight: 2160 },
      wallpaper: { minWidth: 1920, minHeight: 1080 }
    };
  }

  async filterItems(items, filterRules = {}) {
    try {
      const startTime = Date.now();
      const filteredItems = [];
      
      console.log(`🔍 Filtering ${items.length} items with rules:`, filterRules);

      for (const item of items) {
        const filterResult = await this.evaluateFilters(item, filterRules);
        
        if (filterResult.passed) {
          filteredItems.push({
            ...item,
            filterMetadata: filterResult.metadata
          });
          this.filterStats.passedFilters++;
        } else {
          this.filterStats.failedFilters++;
          
          // Track which filters failed
          filterResult.failedFilters.forEach(filter => {
            this.filterStats.filterBreakdown[filter] = 
              (this.filterStats.filterBreakdown[filter] || 0) + 1;
          });
        }
        
        this.filterStats.totalFiltered++;
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Filtering completed: ${filteredItems.length}/${items.length} items passed (${processingTime}ms)`);

      return {
        items: filteredItems,
        stats: {
          totalInput: items.length,
          totalOutput: filteredItems.length,
          processingTime,
          filterBreakdown: this.filterStats.filterBreakdown
        }
      };
    } catch (error) {
      console.error('❌ Filter error:', error);
      throw error;
    }
  }

  async evaluateFilters(item, filterRules) {
    const cacheKey = this.getCacheKey(item, filterRules);
    
    if (this.options.cacheResults && this.filterCache.has(cacheKey)) {
      return this.filterCache.get(cacheKey);
    }

    const result = {
      passed: true,
      failedFilters: [],
      metadata: {}
    };

    // URL pattern filters
    if (filterRules.urlPatterns && filterRules.urlPatterns.length > 0) {
      const urlPassed = this.evaluateUrlPatterns(item.url, filterRules.urlPatterns);
      if (!urlPassed) {
        result.passed = false;
        result.failedFilters.push('urlPatterns');
      }
    }

    // Extension filters
    if (filterRules.extensions && filterRules.extensions.length > 0) {
      const extPassed = this.evaluateExtensions(item.url, filterRules.extensions);
      if (!extPassed) {
        result.passed = false;
        result.failedFilters.push('extensions');
      }
    }

    // MIME type filters
    if (filterRules.mimeTypes && filterRules.mimeTypes.length > 0) {
      const mimePassed = await this.evaluateMimeTypes(item, filterRules.mimeTypes);
      if (!mimePassed) {
        result.passed = false;
        result.failedFilters.push('mimeTypes');
      }
    }

    // Size filters
    if (filterRules.fileSize) {
      const sizePassed = await this.evaluateFileSize(item, filterRules.fileSize);
      if (!sizePassed) {
        result.passed = false;
        result.failedFilters.push('fileSize');
      }
    }

    // Dimension filters (for images)
    if (filterRules.dimensions) {
      const dimensionPassed = await this.evaluateDimensions(item, filterRules.dimensions);
      if (!dimensionPassed) {
        result.passed = false;
        result.failedFilters.push('dimensions');
      }
    }

    // Custom regex filters
    if (filterRules.customRegex && filterRules.customRegex.length > 0) {
      const regexPassed = this.evaluateCustomRegex(item, filterRules.customRegex);
      if (!regexPassed) {
        result.passed = false;
        result.failedFilters.push('customRegex');
      }
    }

    // Domain filters
    if (filterRules.domains) {
      const domainPassed = this.evaluateDomains(item.url, filterRules.domains);
      if (!domainPassed) {
        result.passed = false;
        result.failedFilters.push('domains');
      }
    }

    // Custom function filters
    if (filterRules.customFunction) {
      try {
        const customPassed = await filterRules.customFunction(item);
        if (!customPassed) {
          result.passed = false;
          result.failedFilters.push('customFunction');
        }
      } catch (error) {
        console.warn('Custom filter function error:', error);
        result.passed = false;
        result.failedFilters.push('customFunction');
      }
    }

    // Cache result
    if (this.options.cacheResults) {
      this.filterCache.set(cacheKey, result);
      
      // Manage cache size
      if (this.filterCache.size > this.options.maxCacheSize) {
        const firstKey = this.filterCache.keys().next().value;
        this.filterCache.delete(firstKey);
      }
    }

    return result;
  }

  evaluateUrlPatterns(url, patterns) {
    if (!patterns || patterns.length === 0) {return true;}

    for (const pattern of patterns) {
      try {
        if (pattern.type === 'regex') {
          const regex = new RegExp(pattern.value, pattern.flags || 'i');
          if (pattern.include) {
            if (regex.test(url)) {return true;}
          } else {
            if (regex.test(url)) {return false;}
          }
        } else if (pattern.type === 'wildcard') {
          const regexPattern = pattern.value
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          const regex = new RegExp(regexPattern, 'i');
          if (pattern.include) {
            if (regex.test(url)) {return true;}
          } else {
            if (regex.test(url)) {return false;}
          }
        } else if (pattern.type === 'exact') {
          if (pattern.include) {
            if (url.includes(pattern.value)) {return true;}
          } else {
            if (url.includes(pattern.value)) {return false;}
          }
        }
      } catch (error) {
        console.warn('Invalid URL pattern:', pattern, error);
      }
    }

    // If we have include patterns but none matched, fail
    const hasIncludePatterns = patterns.some(p => p.include);
    return !hasIncludePatterns;
  }

  evaluateExtensions(url, extensions) {
    if (!extensions || extensions.length === 0) {return true;}

    const urlLower = url.toLowerCase();
    const urlExtension = this.getFileExtension(urlLower);

    for (const ext of extensions) {
      if (ext.include) {
        if (urlLower.endsWith(ext.value.toLowerCase())) {return true;}
      } else {
        if (urlLower.endsWith(ext.value.toLowerCase())) {return false;}
      }
    }

    // If we have include extensions but none matched, fail
    const hasIncludeExtensions = extensions.some(e => e.include);
    return !hasIncludeExtensions;
  }

  async evaluateMimeTypes(item, mimeTypes) {
    if (!mimeTypes || mimeTypes.length === 0) {return true;}

    // Try to get MIME type from item or detect from URL
    let itemMimeType = item.mimeType;
    
    if (!itemMimeType) {
      itemMimeType = this.detectMimeTypeFromUrl(item.url);
    }

    if (!itemMimeType) {
      // Try to fetch head to get actual MIME type
      try {
        itemMimeType = await this.fetchMimeType(item.url);
      } catch (error) {
        console.warn('Failed to fetch MIME type for:', item.url);
        return true; // Don't filter if we can't determine MIME type
      }
    }

    for (const mimeFilter of mimeTypes) {
      if (mimeFilter.include) {
        if (itemMimeType && itemMimeType.startsWith(mimeFilter.value)) {return true;}
      } else {
        if (itemMimeType && itemMimeType.startsWith(mimeFilter.value)) {return false;}
      }
    }

    // If we have include MIME types but none matched, fail
    const hasIncludeMimeTypes = mimeTypes.some(m => m.include);
    return !hasIncludeMimeTypes;
  }

  async evaluateFileSize(item, sizeFilter) {
    if (!sizeFilter) {return true;}

    let fileSize = item.fileSize;
    
    if (fileSize === undefined) {
      try {
        fileSize = await this.fetchFileSize(item.url);
      } catch (error) {
        console.warn('Failed to fetch file size for:', item.url);
        return true; // Don't filter if we can't determine size
      }
    }

    if (fileSize === undefined) {return true;}

    if (sizeFilter.min !== undefined && fileSize < sizeFilter.min) {return false;}
    if (sizeFilter.max !== undefined && fileSize > sizeFilter.max) {return false;}

    return true;
  }

  async evaluateDimensions(item, dimensionFilter) {
    if (!dimensionFilter) {return true;}

    let dimensions = item.dimensions;
    
    if (!dimensions) {
      try {
        dimensions = await this.fetchImageDimensions(item.url);
      } catch (error) {
        console.warn('Failed to fetch dimensions for:', item.url);
        return true; // Don't filter if we can't determine dimensions
      }
    }

    if (!dimensions) {return true;}

    const { width, height } = dimensions;

    if (dimensionFilter.minWidth !== undefined && width < dimensionFilter.minWidth) {return false;}
    if (dimensionFilter.maxWidth !== undefined && width > dimensionFilter.maxWidth) {return false;}
    if (dimensionFilter.minHeight !== undefined && height < dimensionFilter.minHeight) {return false;}
    if (dimensionFilter.maxHeight !== undefined && height > dimensionFilter.maxHeight) {return false;}

    return true;
  }

  evaluateCustomRegex(item, regexFilters) {
    if (!regexFilters || regexFilters.length === 0) {return true;}

    for (const regexFilter of regexFilters) {
      try {
        const regex = new RegExp(regexFilter.pattern, regexFilter.flags || 'i');
        const testValue = regexFilter.field === 'url' ? item.url : 
          regexFilter.field === 'title' ? (item.title || '') :
            regexFilter.field === 'alt' ? (item.alt || '') :
              item.url; // default to URL

        if (regexFilter.include) {
          if (regex.test(testValue)) {return true;}
        } else {
          if (regex.test(testValue)) {return false;}
        }
      } catch (error) {
        console.warn('Invalid regex filter:', regexFilter, error);
      }
    }

    // If we have include patterns but none matched, fail
    const hasIncludePatterns = regexFilters.some(r => r.include);
    return !hasIncludePatterns;
  }

  evaluateDomains(url, domainFilters) {
    if (!domainFilters || domainFilters.length === 0) {return true;}

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      for (const domainFilter of domainFilters) {
        if (domainFilter.include) {
          if (domain.includes(domainFilter.value)) {return true;}
        } else {
          if (domain.includes(domainFilter.value)) {return false;}
        }
      }

      // If we have include domains but none matched, fail
      const hasIncludeDomains = domainFilters.some(d => d.include);
      return !hasIncludeDomains;
    } catch (error) {
      console.warn('Invalid URL for domain filtering:', url);
      return true;
    }
  }

  // Utility methods
  getFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const lastDot = pathname.lastIndexOf('.');
      return lastDot > 0 ? pathname.slice(lastDot) : '';
    } catch (error) {
      return '';
    }
  }

  detectMimeTypeFromUrl(url) {
    const extension = this.getFileExtension(url).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf'
    };
    return mimeMap[extension] || null;
  }

  async fetchMimeType(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.headers.get('content-type');
    } catch (error) {
      throw new Error('Failed to fetch MIME type');
    }
  }

  async fetchFileSize(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : undefined;
    } catch (error) {
      throw new Error('Failed to fetch file size');
    }
  }

  async fetchImageDimensions(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  getCacheKey(item, filterRules) {
    return `${item.url}_${JSON.stringify(filterRules)}`;
  }

  // Get filter statistics
  getStats() {
    return { ...this.filterStats };
  }

  // Reset statistics
  resetStats() {
    this.filterStats = {
      totalFiltered: 0,
      passedFilters: 0,
      failedFilters: 0,
      filterBreakdown: {}
    };
  }

  // Clear cache
  clearCache() {
    this.filterCache.clear();
  }
}

// Export for use in content scripts and service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedFilterSystem;
} else if (typeof window !== 'undefined') {
  window.AdvancedFilterSystem = AdvancedFilterSystem;
}