// advanced-extractor.js - Enhanced DOM extraction with comprehensive fallback systems
// Inspired by research from EasyScraper, DownThemAll, and 25+ extension analysis

// Prevent duplicate declarations
if (window.AdvancedExtractor) {
  console.log('AdvancedExtractor already loaded, skipping...');
} else {

  class AdvancedExtractor {
    constructor() {
      this.selectors = this.initializeSelectors();
      this.extractionStats = {
        attempted: 0,
        successful: 0,
        fallbacksUsed: 0,
        methodsUsed: new Set()
      };
    }

    initializeSelectors() {
      return {
      // Modern framework patterns (React, Vue, Angular)
        modern: {
          images: [
            '[data-testid*="image"], [data-testid*="photo"], [data-testid*="gallery"]',
            '[data-cy*="image"], [data-cy*="photo"]',
            '[aria-label*="image"], [aria-label*="photo"], [role="img"]',
            '[data-component*="image"], [data-component*="photo"]'
          ],
          containers: [
            '[data-testid*="gallery"], [data-testid*="grid"], [data-testid*="masonry"]',
            '[data-component*="gallery"], [data-component*="grid"]',
            '[class*="Gallery"], [class*="ImageGrid"], [class*="PhotoGrid"]'
          ]
        },

        // E-commerce and product patterns
        ecommerce: {
          images: [
            '.product-image img, .product-photo img, .item-image img',
            '.thumbnail img, .preview img, .product-thumbnail img',
            '[data-role="product-image"], [data-type="product-image"]',
            '.zoom-image img, .gallery-image img'
          ],
          containers: [
            '.product-item, .product-card, .item-card',
            '.product-grid .item, .products .product',
            '.catalog-item, .listing-item'
          ]
        },

        // Gallery and media patterns
        gallery: {
          images: [
            '.gallery-item img, .photo-item img, .image-card img',
            '.media-item img, .photo-card img, .image-tile img',
            '.masonry-item img, .grid-item img, .tile img',
            '.lightbox-trigger img, .popup-trigger img'
          ],
          containers: [
            '.gallery, .photo-gallery, .image-gallery, .media-gallery',
            '.grid, .masonry, .tiles, .cards, .items',
            '.photoset, .album, .collection'
          ]
        },

        // Social media patterns
        social: {
          images: [
            '[data-testid*="tweet-photo"], [data-testid*="post-image"]',
            '.post-image img, .feed-image img, .story-image img',
            '[aria-label*="photo"], [aria-label*="image"]',
            '.media img, .attachment img, .photo img'
          ],
          containers: [
            '.post, .tweet, .story, .feed-item',
            '.timeline-item, .activity-item, .update'
          ]
        },

        // Background image patterns
        background: {
          elements: [
            '[style*="background-image"], .bg-image, .hero-image',
            '.cover-image, .banner-image, .header-image',
            '[data-bg], [data-background], [data-src]'
          ]
        },

        // Lazy loading patterns
        lazy: {
          images: [
            'img[data-src], img[data-lazy], img[data-original]',
            'img[loading="lazy"], img[data-srcset]',
            'img[data-echo], img[data-unveil]',
            '.lazy img, .lazyload img'
          ]
        },

        // Fallback patterns
        fallback: {
          images: [
            'img[src*="thumb"], img[src*="photo"], img[src*="image"]',
            'img[alt*="image"], img[alt*="photo"], img[alt*="picture"]',
            'img[title*="image"], img[title*="photo"]',
            'img' // Ultimate fallback
          ],
          containers: [
            '[class*="gallery" i], [class*="photo" i], [class*="image" i]',
            '[id*="gallery" i], [id*="photo" i], [id*="image" i]',
            'div, section, article' // Ultimate fallback
          ]
        }
      };
    }

    // Main extraction method with progressive fallback
    async extractElements(options = {}) {
      this.extractionStats.attempted++;
    
      try {
      // Try modern framework patterns first
        let result = await this.tryExtractionMethod('modern', options);
        if (result.success) {return this.finalizeResult(result, 'modern');}

        // Try specific site type patterns
        const siteType = this.detectSiteType();
        if (siteType && siteType !== 'modern') {
          result = await this.tryExtractionMethod(siteType, options);
          if (result.success) {return this.finalizeResult(result, siteType);}
        }

        // Try lazy loading patterns
        await this.triggerLazyLoading();
        result = await this.tryExtractionMethod('lazy', options);
        if (result.success) {return this.finalizeResult(result, 'lazy');}

        // Try background image extraction
        result = await this.extractBackgroundImages(options);
        if (result.success) {return this.finalizeResult(result, 'background');}

        // Final fallback
        result = await this.tryExtractionMethod('fallback', options);
        return this.finalizeResult(result, 'fallback');

      } catch (_error) {
        console.error('Advanced extraction failed:', error);
        return {
          success: false,
          items: [],
          error: error.message,
          stats: this.extractionStats
        };
      }
    }

    // Try extraction using specific selector group
    async tryExtractionMethod(method, options) {
      const selectors = this.selectors[method];
      if (!selectors) {return {success: false, items: []};}

      const _allItems = [];
    
      // Try container-based extraction first (more reliable)
      if (selectors.containers) {
        const containerItems = await this.extractFromContainers(selectors.containers, options);
        if (containerItems.length > 0) {
          return {success: true, items: containerItems, method: 'container'};
        }
      }

      // Try direct image extraction
      if (selectors.images) {
        const imageItems = await this.extractDirectImages(selectors.images, options);
        if (imageItems.length > 0) {
          return {success: true, items: imageItems, method: 'direct'};
        }
      }

      return {success: false, items: []};
    }

    // Extract from container elements
    async extractFromContainers(containerSelectors, options) {
      const items = [];
    
      for (const selector of containerSelectors) {
        try {
          const containers = document.querySelectorAll(selector);
        
          for (const container of containers) {
            const item = await this.extractFromContainer(container, options);
            if (item) {items.push(item);}
          }
        
          if (items.length > 0) {break;} // Found good containers, stop trying selectors
        } catch (_error) {
          console.warn(`Container selector failed: ${selector}`, error);
          continue;
        }
      }
    
      return items;
    }

    // Extract from a single container
    async extractFromContainer(container, options) {
      try {
      // Find primary image
        const img = container.querySelector('img') || 
                  this.extractBackgroundImageFromElement(container);
      
        if (!img) {return null;}

        // Extract metadata
        const item = {
          image: this.getImageUrl(img),
          thumbnail: this.getThumbnailUrl(img),
          link: this.getAssociatedLink(container),
          text: this.extractText(container),
          metadata: this.extractMetadata(container),
          container: container,
          extractionMethod: 'container'
        };

        // Apply filters
        if (await this.passesFilters(item, options)) {
          return item;
        }
      } catch (_error) {
        console.warn('Container extraction failed:', error);
      }
    
      return null;
    }

    // Extract direct images
    async extractDirectImages(imageSelectors, options) {
      const items = [];
    
      for (const selector of imageSelectors) {
        try {
          const images = document.querySelectorAll(selector);
        
          for (const img of images) {
            const item = await this.extractFromImage(img, options);
            if (item) {items.push(item);}
          }
        
          if (items.length > 0) {break;}
        } catch (_error) {
          console.warn(`Image selector failed: ${selector}`, error);
          continue;
        }
      }
    
      return items;
    }

    // Extract from a single image
    async extractFromImage(img, options) {
      try {
        const item = {
          image: this.getImageUrl(img),
          thumbnail: this.getThumbnailUrl(img),
          link: this.getAssociatedLink(img.closest('a') || img.parentElement),
          text: img.alt || img.title || '',
          metadata: this.extractImageMetadata(img),
          container: img.closest('[class*="item"], [class*="card"], [class*="tile"]') || img.parentElement,
          extractionMethod: 'direct'
        };

        if (await this.passesFilters(item, options)) {
          return item;
        }
      } catch (_error) {
        console.warn('Image extraction failed:', error);
      }
    
      return null;
    }

    // Extract background images
    async extractBackgroundImages(options) {
      const items = [];
      const selectors = this.selectors.background.elements;
    
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
        
          for (const element of elements) {
            const bgImage = this.extractBackgroundImageFromElement(element);
            if (bgImage) {
              const item = {
                image: bgImage,
                thumbnail: bgImage,
                link: this.getAssociatedLink(element),
                text: element.textContent?.trim() || '',
                metadata: this.extractMetadata(element),
                container: element,
                extractionMethod: 'background'
              };
            
              if (await this.passesFilters(item, options)) {
                items.push(item);
              }
            }
          }
        
          if (items.length > 0) {break;}
        } catch (_error) {
          console.warn(`Background selector failed: ${selector}`, error);
          continue;
        }
      }
    
      return {success: items.length > 0, items};
    }

    // Utility methods
    getImageUrl(img) {
      if (typeof img === 'string') {return img;}
      return img.src || img.dataset.src || img.dataset.original || img.dataset.lazy || '';
    }

    getThumbnailUrl(img) {
      if (typeof img === 'string') {return img;}
      return img.src || img.dataset.thumb || img.dataset.thumbnail || this.getImageUrl(img);
    }

    getAssociatedLink(element) {
      if (!element) {return '';}
    
      // Direct link
      if (element.tagName === 'A') {return element.href;}
    
      // Parent link
      const parentLink = element.closest('a');
      if (parentLink) {return parentLink.href;}
    
      // Data attributes
      return element.dataset.href || element.dataset.url || element.dataset.link || '';
    }

    extractText(container) {
      const textElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, .title, .caption, .description, [class*="title"], [class*="caption"]');
      return Array.from(textElements)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0)
        .join(' | ');
    }

    extractMetadata(element) {
      return {
        id: element.id || '',
        classes: Array.from(element.classList),
        dataAttributes: this.getDataAttributes(element),
        dimensions: this.getElementDimensions(element)
      };
    }

    extractImageMetadata(img) {
      return {
        alt: img.alt || '',
        title: img.title || '',
        dimensions: {
          natural: {width: img.naturalWidth, height: img.naturalHeight},
          display: {width: img.width, height: img.height}
        },
        loading: img.loading || '',
        srcset: img.srcset || ''
      };
    }

    extractBackgroundImageFromElement(element) {
      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;
    
      if (bgImage && bgImage !== 'none') {
        const match = bgImage.match(/url\(['"]?([^'"]*?)['"]?\)/);
        return match ? match[1] : null;
      }
    
      return null;
    }

    getDataAttributes(element) {
      const data = {};
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
          data[attr.name] = attr.value;
        }
      }
      return data;
    }

    getElementDimensions(element) {
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      };
    }

    // Site type detection
    detectSiteType() {
      const url = window.location.hostname.toLowerCase();
      const title = document.title.toLowerCase();
    
      // E-commerce indicators
      if (url.includes('shop') || url.includes('store') || 
        title.includes('shop') || title.includes('store') ||
        document.querySelector('.product, .item-price, .add-to-cart')) {
        return 'ecommerce';
      }
    
      // Social media indicators
      if (url.includes('twitter') || url.includes('instagram') || 
        url.includes('facebook') || url.includes('social') ||
        document.querySelector('.post, .tweet, .story, .feed')) {
        return 'social';
      }
    
      // Gallery indicators
      if (url.includes('gallery') || url.includes('photo') || 
        title.includes('gallery') || title.includes('photo') ||
        document.querySelector('.gallery, .photo-gallery, .masonry')) {
        return 'gallery';
      }
    
      return 'modern'; // Default to modern framework patterns
    }

    // Trigger lazy loading
    async triggerLazyLoading() {
    // Scroll to trigger lazy loading
      const scrollHeight = document.documentElement.scrollHeight;
      window.scrollTo(0, scrollHeight);
    
      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      // Try intersection observer trigger
      const lazyImages = document.querySelectorAll('img[data-src], img[loading="lazy"]');
      for (const img of lazyImages) {
      // Trigger IntersectionObserver by scrolling element into view
        img.scrollIntoView({behavior: 'instant', block: 'center'});
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    
      // Scroll back to top
      window.scrollTo(0, 0);
    }

    // Filter validation
    async passesFilters(item, options) {
      if (!item.image) {return false;}
    
      // Size filters
      if (options.minWidth || options.minHeight) {
        const dimensions = await this.getImageDimensions(item.image);
        if (options.minWidth && dimensions.width < options.minWidth) {return false;}
        if (options.minHeight && dimensions.height < options.minHeight) {return false;}
      }
    
      // Format filters
      if (options.formats) {
        const extension = this.getImageExtension(item.image);
        if (!options.formats[extension]) {return false;}
      }
    
      return true;
    }

    async getImageDimensions(url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({width: img.width, height: img.height});
        img.onerror = () => resolve({width: 0, height: 0});
        img.src = url;
      });
    }

    getImageExtension(url) {
      const extension = url.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg'].includes(extension)) {return 'jpeg';}
      if (['png'].includes(extension)) {return 'png';}
      if (['webp'].includes(extension)) {return 'webp';}
      if (['gif'].includes(extension)) {return 'gif';}
      return 'unknown';
    }

    // Finalize extraction result
    finalizeResult(result, method) {
      this.extractionStats.successful++;
      this.extractionStats.methodsUsed.add(method);
    
      if (method !== 'modern') {
        this.extractionStats.fallbacksUsed++;
      }
    
      return {
        ...result,
        extractionMethod: method,
        stats: this.extractionStats
      };
    }

    // Get extraction statistics
    getStats() {
      return {
        ...this.extractionStats,
        successRate: this.extractionStats.attempted > 0 ? 
          this.extractionStats.successful / this.extractionStats.attempted : 0,
        methodsUsed: Array.from(this.extractionStats.methodsUsed)
      };
    }
  }

  // Export to window for use in other modules
  window.AdvancedExtractor = AdvancedExtractor;

// Usage example:
// const extractor = new AdvancedExtractor();
// const result = await extractor.extractElements({
//   minWidth: 200,
//   minHeight: 200,
//   formats: {jpeg: true, png: true, webp: true, gif: false}
// });
}