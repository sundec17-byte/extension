// scraper.js - Core scraping functionality with proper ES module exports
// Fixed: Export runScrape function for dynamic imports

// Prevent duplicate initialization
if (window.StepTwoScraper) {
  console.log('StepTwo scraper already loaded, skipping...');
} else {
  window.StepTwoScraper = true;

  // Enhanced scraping with comprehensive error handling and MV3 compliance
  async function runScrape(selector, options = {}) {
    console.log('🚀 Starting STEPTWO scraping with selector:', selector);
    
    try {
      // Initialize scraping session
      const session = {
        startTime: Date.now(),
        selector: selector,
        options: options,
        items: [],
        stats: {
          pagesScanned: 0,
          itemsFound: 0,
          duplicatesSkipped: 0,
          errors: []
        }
      };

      // Apply site profile if available
      if (options.siteProfile) {
        console.log(`🎯 Using site profile: ${options.siteProfile.name}`);
        session.siteProfile = options.siteProfile;
      }

      // Extract images from current page
      const pageItems = await extractImagesFromPage(selector, options);
      session.items.push(...pageItems);
      session.stats.itemsFound = session.items.length;
      session.stats.pagesScanned = 1;

      console.log(`📊 Initial extraction: ${pageItems.length} items found`);

      // Handle pagination if enabled
      if (options.handlePagination !== false && session.items.length > 0) {
        const paginationItems = await handlePagination(selector, options, session);
        session.items.push(...paginationItems);
        session.stats.itemsFound = session.items.length;
      }

      // Apply filters
      const filteredItems = applyFilters(session.items, options);
      session.stats.duplicatesSkipped = session.items.length - filteredItems.length;

      // Send results to background
      const results = {
        success: true,
        items: filteredItems,
        stats: session.stats,
        sourceUrl: window.location.href,
        timestamp: Date.now(),
        duration: Date.now() - session.startTime
      };

      console.log(`✅ Scraping completed: ${filteredItems.length} items (${session.stats.pagesScanned} pages)`);

      // Send to background script
      chrome.runtime.sendMessage({
        type: 'SCRAPE_DONE',
        data: results
      });

      return results;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      
      // Send error to background
      chrome.runtime.sendMessage({
        type: 'SCRAPE_ERROR',
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  // Extract images from current page
  async function extractImagesFromPage(selector, options = {}) {
    const items = [];
    
    try {
      // Use provided selector or fallback to smart detection
      let elements = [];
      
      if (selector) {
        elements = document.querySelectorAll(selector);
        console.log(`🔍 Found ${elements.length} elements with selector: ${selector}`);
      }
      
      // Fallback to smart detection if no elements found
      if (elements.length === 0) {
        console.log('🧠 No elements found, trying smart detection...');
        elements = await smartDetectImages();
      }

      // Extract data from each element
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const item = await extractItemFromElement(element, i, options);
        
        if (item) {
          items.push(item);
        }
      }

      return items;
    } catch (error) {
      console.error('❌ Page extraction failed:', error);
      return [];
    }
  }

  // Smart image detection fallback
  async function smartDetectImages() {
    const strategies = [
      // Strategy 1: Look for gallery containers
      () => document.querySelectorAll('.gallery img, .photos img, .images img'),
      // Strategy 2: Look for product grids
      () => document.querySelectorAll('.product img, .item img, .card img'),
      // Strategy 3: Look for data attributes
      () => document.querySelectorAll('[data-testid*="image"] img, [data-gallery] img'),
      // Strategy 4: All visible images
      () => Array.from(document.querySelectorAll('img')).filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 50 && rect.height > 50;
      })
    ];

    for (const strategy of strategies) {
      try {
        const elements = strategy();
        if (elements.length > 0) {
          console.log(`🎯 Smart detection found ${elements.length} elements`);
          return elements;
        }
      } catch (error) {
        console.warn('Smart detection strategy failed:', error);
      }
    }

    return [];
  }

  // Extract item data from element
  async function extractItemFromElement(element, index, options = {}) {
    try {
      let imageUrl = null;
      let thumbnailUrl = null;

      // Extract image URL
      if (element.tagName === 'IMG') {
        imageUrl = element.src || element.getAttribute('data-src') || element.getAttribute('data-original');
        thumbnailUrl = imageUrl;
      } else {
        // Look for nested images
        const img = element.querySelector('img');
        if (img) {
          imageUrl = img.src || img.getAttribute('data-src');
          thumbnailUrl = imageUrl;
        } else {
          // Check for background images
          const style = window.getComputedStyle(element);
          if (style.backgroundImage && style.backgroundImage !== 'none') {
            const match = style.backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
            if (match) {
              imageUrl = match[1];
              thumbnailUrl = imageUrl;
            }
          }
        }
      }

      if (!imageUrl) {
        return null;
      }

      // Resolve relative URLs
      try {
        imageUrl = new URL(imageUrl, window.location.href).href;
        thumbnailUrl = new URL(thumbnailUrl, window.location.href).href;
      } catch (error) {
        console.warn('Invalid image URL:', imageUrl);
        return null;
      }

      // Extract metadata
      const item = {
        image: imageUrl,
        thumbnail: thumbnailUrl,
        link: findParentLink(element),
        text: extractText(element),
        alt: element.alt || element.getAttribute('title') || '',
        index: index,
        selector: selector,
        extractedAt: Date.now(),
        sourceUrl: window.location.href
      };

      return item;
    } catch (error) {
      console.warn('Failed to extract item:', error);
      return null;
    }
  }

  // Find parent link
  function findParentLink(element) {
    let current = element;
    while (current && current.parentElement) {
      current = current.parentElement;
      if (current.tagName === 'A' && current.href) {
        return current.href;
      }
    }
    return null;
  }

  // Extract text content
  function extractText(element) {
    const textSources = [
      element.alt,
      element.getAttribute('title'),
      element.parentElement?.querySelector('.caption, .title, figcaption')?.textContent,
      element.parentElement?.textContent?.trim()
    ];

    return textSources.find(text => text && text.length > 0 && text.length < 200) || '';
  }

  // Enhanced pagination with infinite scroll support
  async function handlePagination(selector, options, session) {
    const additionalItems = [];
    let pageCount = 1;
    const maxPages = options.maxPages || 15;
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 3;
    let totalItemsBeforePage = session.items.length;

    try {
      // Enhanced pagination selectors with better reliability
      const paginationSelectors = [
        // Common aria-label patterns
        'a[aria-label*="next" i]', 'button[aria-label*="next" i]',
        'a[aria-label*="more" i]', 'button[aria-label*="more" i]',
        
        // Standard pagination classes
        '.pagination .next', '.pagination-next', '.next-page', '.page-next',
        '.pager-next', '[class*="next"]', '[class*="more"]',
        
        // Load more patterns
        '.load-more', '.show-more', '.see-more', '.view-more',
        '[data-load-more]', '[data-show-more]', 
        
        // URL-based pagination
        'a[href*="page="]', 'a[href*="p="]', 'a[href*="offset="]',
        
        // Modern SPA patterns
        '[data-testid*="next"]', '[data-testid*="more"]', '[data-test*="next"]',
        
        // Site-specific from profiles
        ...(options.siteProfile?.pagination ? [options.siteProfile.pagination] : [])
      ];

      // Check for infinite scroll first
      if (options.siteProfile?.infiniteScroll || await detectInfiniteScroll()) {
        console.log('🔄 Infinite scroll detected, using scroll-based pagination');
        return await handleInfiniteScroll(selector, options, session);
      }

      while (pageCount < maxPages && consecutiveEmptyPages < maxEmptyPages) {
        let nextElement = null;
        let elementText = '';

        // Enhanced element finding with visibility and clickability checks
        for (const paginationSelector of paginationSelectors) {
          const elements = document.querySelectorAll(paginationSelector);
          for (const element of elements) {
            if (isElementVisible(element) && isElementClickable(element)) {
              // Additional check for disabled elements
              if (element.disabled || element.classList.contains('disabled') || 
                  element.getAttribute('aria-disabled') === 'true') {
                continue;
              }
              
              // Prefer elements with next-related text
              const text = (element.textContent || element.title || element.alt || '').toLowerCase();
              if (text.includes('next') || text.includes('more') || text.includes('>')  || 
                  text.includes('continue') || text.includes('load')) {
                nextElement = element;
                elementText = text;
                break;
              } else if (!nextElement) {
                nextElement = element; // Fallback
                elementText = text;
              }
            }
          }
          if (nextElement) break;
        }

        if (!nextElement) {
          console.log('📄 No more pagination elements found');
          break;
        }

        console.log(`📄 Navigating to page ${pageCount + 1} using "${elementText.trim()}"...`);

        // Save current URL to detect navigation
        const currentUrl = window.location.href;
        
        // Click next page with error handling
        try {
          await clickElement(nextElement);
        } catch (clickError) {
          console.error('❌ Failed to click pagination element:', clickError);
          break;
        }
        
        // Wait for navigation or content change
        await waitForPageLoad(options.pageWait || 3000);
        
        // Check if URL changed (for SPA detection)
        const urlChanged = window.location.href !== currentUrl;
        if (urlChanged) {
          console.log('📄 URL changed, waiting for new content...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Extract items from new page
        const pageItems = await extractImagesFromPage(selector, options);
        
        if (pageItems.length === 0) {
          consecutiveEmptyPages++;
          console.log(`📄 No new items found (attempt ${consecutiveEmptyPages}/${maxEmptyPages})`);
          
          if (consecutiveEmptyPages >= maxEmptyPages) {
            console.log('📄 Too many empty pages, stopping pagination');
            break;
          }
          
          // Wait a bit longer and try again
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        // Check for duplicate items (indicates we've hit the end or looped)
        const newUniqueItems = pageItems.filter(newItem => 
          !session.items.some(existingItem => existingItem.image === newItem.image)
        );

        if (newUniqueItems.length === 0) {
          console.log('📄 All items are duplicates, stopping pagination');
          break;
        }

        consecutiveEmptyPages = 0; // Reset counter
        additionalItems.push(...newUniqueItems);
        pageCount++;
        session.stats.pagesScanned = pageCount;

        console.log(`📄 Page ${pageCount}: ${newUniqueItems.length} new items (${pageItems.length} total on page)`);

        // Adaptive delay based on page load time
        const delayTime = Math.min(options.scrollDelay || 1500, 3000);
        await new Promise(resolve => setTimeout(resolve, delayTime));
        
        // Memory optimization - if we have too many items, consider stopping
        if (additionalItems.length > 1000) {
          console.log('📄 Large gallery detected, stopping pagination to prevent memory issues');
          break;
        }
      }

    } catch (error) {
      console.error('❌ Pagination failed:', error);
      session.stats.errors.push(`Pagination error: ${error.message}`);
    }

    console.log(`📄 Pagination completed: ${additionalItems.length} additional items from ${pageCount - 1} pages`);
    return additionalItems;
  }

  // Enhanced infinite scroll handler
  async function handleInfiniteScroll(selector, options, session) {
    const additionalItems = [];
    let scrollAttempts = 0;
    const maxScrollAttempts = options.maxScrollAttempts || 20;
    let lastScrollHeight = document.body.scrollHeight;
    let consecutiveFailedScrolls = 0;
    const maxFailedScrolls = 5;

    console.log('🔄 Starting infinite scroll detection...');

    try {
      while (scrollAttempts < maxScrollAttempts && consecutiveFailedScrolls < maxFailedScrolls) {
        // Scroll to bottom
        const beforeScrollTop = window.pageYOffset;
        window.scrollTo(0, document.body.scrollHeight);
        
        // Wait for content to load
        const scrollDelay = options.scrollDelay || 2000;
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        // Check if new content was loaded
        const newScrollHeight = document.body.scrollHeight;
        const scrolledDistance = window.pageYOffset - beforeScrollTop;
        
        if (newScrollHeight <= lastScrollHeight && scrolledDistance < 100) {
          consecutiveFailedScrolls++;
          console.log(`🔄 No new content after scroll (attempt ${consecutiveFailedScrolls}/${maxFailedScrolls})`);
          
          // Try triggering load more buttons if scroll doesn't work
          const loadMoreButtons = document.querySelectorAll('.load-more, .show-more, [data-load-more]');
          let buttonClicked = false;
          
          for (const button of loadMoreButtons) {
            if (isElementVisible(button) && isElementClickable(button)) {
              console.log('🔄 Clicking load more button...');
              await clickElement(button);
              await new Promise(resolve => setTimeout(resolve, 2000));
              buttonClicked = true;
              break;
            }
          }
          
          if (!buttonClicked && consecutiveFailedScrolls >= maxFailedScrolls) {
            console.log('🔄 Reached end of infinite scroll');
            break;
          }
        } else {
          consecutiveFailedScrolls = 0; // Reset failed counter
          lastScrollHeight = newScrollHeight;
          
          // Extract new items
          const allCurrentItems = await extractImagesFromPage(selector, options);
          const newItems = allCurrentItems.filter(newItem => 
            !session.items.some(existingItem => existingItem.image === newItem.image) &&
            !additionalItems.some(existingItem => existingItem.image === newItem.image)
          );
          
          if (newItems.length > 0) {
            additionalItems.push(...newItems);
            console.log(`🔄 Infinite scroll: ${newItems.length} new items (total: ${additionalItems.length})`);
          }
        }
        
        scrollAttempts++;
        
        // Memory optimization
        if (additionalItems.length > 2000) {
          console.log('🔄 Large gallery detected, stopping infinite scroll to prevent memory issues');
          break;
        }
      }

    } catch (error) {
      console.error('❌ Infinite scroll failed:', error);
      session.stats.errors.push(`Infinite scroll error: ${error.message}`);
    }

    console.log(`🔄 Infinite scroll completed: ${additionalItems.length} additional items`);
    return additionalItems;
  }

  // Detect if page uses infinite scroll
  async function detectInfiniteScroll() {
    const infiniteScrollIndicators = [
      '.infinite-scroll', '[data-infinite]', '.lazy-load',
      '.scroll-trigger', '[data-scroll]', '.auto-load'
    ];

    return infiniteScrollIndicators.some(selector => 
      document.querySelector(selector) !== null
    );
  }

  // Apply filters to items
  function applyFilters(items, options = {}) {
    let filtered = [...items];

    // Remove duplicates by URL
    if (options.skipDuplicates !== false) {
      const seen = new Set();
      filtered = filtered.filter(item => {
        if (seen.has(item.image)) {
          return false;
        }
        seen.add(item.image);
        return true;
      });
    }

    // Size filters (if available)
    if (options.minWidth || options.minHeight) {
      // Note: Size filtering would require loading images, which is expensive
      // For now, we'll skip this in the content script
    }

    // Format filters
    if (options.allowedFormats) {
      filtered = filtered.filter(item => {
        const extension = getFileExtension(item.image);
        return options.allowedFormats.includes(extension);
      });
    }

    return filtered;
  }

  // Utility functions
  function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top <= window.innerHeight;
  }

  function isElementClickable(element) {
    const style = window.getComputedStyle(element);
    return style.pointerEvents !== 'none' && !element.disabled;
  }

  async function clickElement(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
    element.click();
  }

  async function waitForPageLoad(timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkLoad = () => {
        if (document.readyState === 'complete' || Date.now() - startTime > timeout) {
          resolve();
        } else {
          setTimeout(checkLoad, 100);
        }
      };
      
      checkLoad();
    });
  }

  function getFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const extension = pathname.split('.').pop().toLowerCase();
      return extension && extension.length <= 4 ? extension : 'jpg';
    } catch {
      return 'jpg';
    }
  }

  // Export functions for ES module compatibility
  window.runScrape = runScrape;
  window.extractImagesFromPage = extractImagesFromPage;
  window.handlePagination = handlePagination;

  console.log('✅ STEPTWO scraper loaded with ES module exports');
}

// ES Module exports for dynamic imports
export { runScrape, extractImagesFromPage, handlePagination };

// Legacy global exports for backward compatibility
if (typeof window !== 'undefined') {
  window.enhancedStartScraping = runScrape;
}