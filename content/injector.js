// injector.js - Enhanced injector with smart loading and gallery detection

(async () => {
  // Check if we're running in a Chrome extension context
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
    console.log('🌐 STEPTWO: Not running in Chrome extension context, skipping content script initialization');
    return;
  }

  // Import utility functions dynamically
  const { createStatusIndicator, setTextContent } = await import(chrome.runtime.getURL('lib/lib-utilities.js'));
  
  let profiles = {};
  let autoDetect = true;
  const _currentSettings = {}; // Kept for future use
  let siteProfile = null;
  let enhancedModulesLoaded = false;
  let enhancedSelector = null;
  let macroSystem = null;
  let isGalleryPage = false;
  const _selectorCache = new Map(); // Kept for future use
  let galleryDetectionCache = null;
  
  // Smart gallery detection to avoid loading scripts on irrelevant pages
  function detectGalleryPage() {
    if (galleryDetectionCache !== null) {return galleryDetectionCache;}
    
    // Use performance monitoring if available
    const measureFunc = window.globalPerformanceMonitor?.measureSync || ((name, fn) => fn());
    
    return measureFunc('gallery-detection', () => {
      const galleryIndicators = [
        // Enhanced image count indicators with quality check
        () => {
          const images = document.querySelectorAll('img');
          const significantImages = Array.from(images).filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.width > 50 && rect.height > 50; // Filter small icons/avatars
          });
          return significantImages.length >= 8;
        },
        
        // Enhanced title/URL patterns with more keywords
        () => /gallery|portfolio|photos?|images?|album|collection|catalog|artwork|media|browse|search|stock|pic/i.test(document.title || ''),
        () => /gallery|portfolio|photos?|images?|album|collection|catalog|browse|search|media|pic/i.test(window.location.pathname),
        
        // Enhanced DOM structure patterns
        () => document.querySelector([
          '[class*="gallery"]', '[class*="portfolio"]', '[class*="photo"]', 
          '[class*="image-grid"]', '[class*="grid"]', '[class*="masonry"]',
          '[class*="thumbnail"]', '[class*="tile"]', '[class*="card-grid"]',
          '[class*="media-grid"]', '[class*="asset-grid"]'
        ].join(', ')) !== null,
        
        () => document.querySelector([
          '[data-gallery]', '[data-portfolio]', '[data-photos]', '[data-grid]',
          '[data-masonry]', '[data-lightbox]', '[data-fancybox]', '[data-photoswipe]'
        ].join(', ')) !== null,
        
        // E-commerce and marketplace patterns
        () => document.querySelector([
          '.product-grid', '.product-list', '.products', '[class*="product-item"]',
          '.listing-grid', '.search-results', '.browse-grid', '.category-grid'
        ].join(', ')) !== null,
        
        // Social media and content platforms
        () => document.querySelector([
          '[role="grid"] img', '.photo-grid', '.image-grid', '.content-grid',
          '.feed img', '.timeline img', '.posts img', '.cards img'
        ].join(', ')) !== null,
        
        // Advanced lazy loading and modern patterns
        () => document.querySelectorAll([
          '[data-src]', '[data-lazy]', '[loading="lazy"]', '[data-srcset]',
          'img[src*="placeholder"]', 'img[src*="loading"]'
        ].join(', ')).length >= 5,
        
        // Stock photo and professional sites patterns
        () => {
          const professionalIndicators = [
            'stock', 'premium', 'royalty', 'license', 'download', 'resolution',
            'watermark', 'preview', 'comp', 'editorial', 'commercial'
          ];
          const text = (document.title + ' ' + document.body.textContent).toLowerCase();
          return professionalIndicators.some(indicator => text.includes(indicator));
        },
        
        // Pagination indicators (suggests image browsing)
        () => document.querySelector([
          '.pagination', '.page-numbers', '[class*="pager"]', '.load-more',
          '[aria-label*="next"]', '[aria-label*="page"]', '.infinite-scroll'
        ].join(', ')) !== null,
        
        // Image container patterns
        () => {
          const containers = document.querySelectorAll([
            'figure', '.figure', '.image-container', '.photo-container',
            '.thumbnail-container', '.media-container'
          ].join(', '));
          return containers.length >= 6;
        }
      ];
    
      isGalleryPage = galleryIndicators.some(indicator => {
        try {
          return indicator();
        } catch (_error) {
          return false;
        }
      });
    
      galleryDetectionCache = isGalleryPage;
      console.log(`📊 Gallery detection result: ${isGalleryPage ? 'Gallery page detected' : 'Not a gallery page'}`);
      return isGalleryPage;
    }, { url: window.location.href });
  }
  
  // Cached selector system for performance
  class SelectorCache {
    constructor() {
      this.cache = new Map();
      this.sitePatterns = new Map();
      this.maxCacheSize = 100;
    }
    
    getCachedSelector(key) {
      const cached = this.cache.get(key);
      if (cached && cached.timestamp > Date.now() - 300000) { // 5 minute cache
        return cached.selectors;
      }
      return null;
    }
    
    setCachedSelector(key, selectors) {
      if (this.cache.size >= this.maxCacheSize) {
        // Remove oldest entries
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
      
      this.cache.set(key, {
        selectors,
        timestamp: Date.now()
      });
    }
    
    getSiteKey() {
      return `${window.location.hostname}_${window.location.pathname.split('/')[1] || 'root'}`;
    }
  }
  
  const selectorCacheInstance = new SelectorCache();
  
  // Load enhanced modules only when gallery is detected or explicitly requested
  async function loadEnhancedModules(force = false) {
    if (enhancedModulesLoaded) {return;}
    
    // Only load on gallery pages unless forced
    if (!force && !detectGalleryPage()) {
      console.log('⏭️ Skipping enhanced module loading - not a gallery page');
      return;
    }
    
    try {
      console.log('🚀 Loading enhanced modules for gallery page...');
      
      // Load modules with priority order (most critical first)
      const moduleLoaders = [
        // Phase 1 modules - Core enhanced functionality
        {
          name: 'Enhanced Selector System',
          url: 'content/enhanced-selector-system.js',
          init: initializeEnhancedSelectorSystem,
          priority: 1
        },
        {
          name: 'Advanced Extractor',
          url: 'content/advanced-extractor.js',
          init: null,
          priority: 1
        },
        {
          name: 'Dynamic Content Observer',
          url: 'content/dynamic-content-observer.js',
          init: null,
          priority: 1
        },
        {
          name: 'Adaptive Selector System',
          url: 'content/adaptive-selector-system.js',
          init: null,
          priority: 1
        },
        {
          name: 'Infinite Scroll Handler',
          url: 'content/infinite-scroll-handler.js',
          init: null,
          priority: 1
        },
        {
          name: 'Comprehensive Validation',
          url: 'content/comprehensive-validation.js',
          init: null,
          priority: 1
        },
        {
          name: 'Network Interceptor',
          url: 'content/network-interceptor.js',
          init: null,
          priority: 1
        },
        {
          name: 'CSS Background Extractor',
          url: 'content/css-background-extractor.js',
          init: null,
          priority: 1
        },
        {
          name: 'Enhanced Integration Manager',
          url: 'content/enhanced-integration-manager.js',
          init: null,
          priority: 1
        },
        
        {
          name: 'Production Monitor',
          url: 'content/production-monitor.js',
          init: initializeProductionMonitor,
          priority: 1
        },
        {
          name: 'Enhanced Scraper Utils',
          url: 'content/enhanced-scraper-utils.js',
          init: null,
          priority: 1
        },
        {
          name: 'Enhanced Pagination Handler',
          url: 'content/enhanced-pagination-handler.js',
          init: initializeEnhancedPaginationHandler,
          priority: 1
        },
        {
          name: 'Scraper Integration',
          url: 'content/scraper-integration.js',
          init: initializeScraperIntegration,
          priority: 1
        },
        
        // Phase 2 modules - Enterprise features
        {
          name: 'Cross-Platform Compatibility System',
          url: 'content/cross-platform-compatibility.js',
          init: initializeCrossPlatformCompatibility,
          priority: 1
        },
        {
          name: 'Enterprise Systems Core',
          url: 'content/enterprise-systems.js',
          init: initializeEnterpriseSystemsCore,
          priority: 2
        },
        {
          name: 'Advanced Export System',
          url: 'content/advanced-export-system.js',
          init: null,
          priority: 2
        },
        {
          name: 'Enterprise Integration Core (Phases 2-4)',
          url: 'content/enterprise-integration-core.js',
          init: initializeEnterpriseIntegration,
          priority: 2
        },
        
        // Phase 3 modules - Performance optimization
        {
          name: 'Performance Optimization Engine',
          url: 'content/performance-optimization-engine.js',
          init: null,
          priority: 2
        },
        {
          name: 'Intelligent Caching System',
          url: 'content/intelligent-caching-system.js',
          init: null,
          priority: 2
        },
        {
          name: 'Adaptive Resource Manager',
          url: 'content/adaptive-resource-manager.js',
          init: null,
          priority: 2
        },
        
        // Phase 4 modules - AI/ML and Enterprise Integration
        {
          name: 'AI/ML Core System',
          url: 'content/ai-ml-core.js',
          init: initializeAIMLCoreSystem,
          priority: 2
        },
        {
          name: 'Cloud Integration Platform',
          url: 'content/cloud-integration-platform.js',
          init: null,
          priority: 2
        },
        {
          name: 'Advanced Analytics Engine',
          url: 'content/advanced-analytics-engine.js',
          init: null,
          priority: 2
        },
        {
          name: 'API Integration Framework',
          url: 'content/api-integration-framework.js',
          init: null,
          priority: 2
        },
        {
          name: 'Advanced Automation Systems',
          url: 'content/advanced-automation-systems.js',
          init: null,
          priority: 2
        },
        
        // Phase 5-6 modules - Advanced AI/Future Integration
        {
          name: 'Advanced Computer Vision',
          url: 'content/advanced-computer-vision.js',
          init: initializeAdvancedComputerVision,
          priority: 1
        },
        {
          name: 'Future Integration Core (Phases 5-6)',
          url: 'content/future-integration-core.js',
          init: initializeFutureIntegration,
          priority: 1
        },
        
        // Phase 6 modules - Future-Ready Architecture
        {
          name: 'Real-Time Collaboration',
          url: 'content/realtime-collaboration.js',
          init: initializeRealtimeCollaboration,
          priority: 2
        },
        {
          name: 'Progressive Web App Core',
          url: 'content/progressive-web-app-core.js',
          init: initializePWACore,
          priority: 2
        },
        
        // Lower priority modules
        {
          name: 'Enhanced Error Handler',
          url: 'content/enhanced-error-handler.js',
          init: null,
          priority: 3
        },
        {
          name: 'Perceptual Duplicate Detector',
          url: 'content/perceptual-duplicate-detector.js',
          init: null,
          priority: 3
        },
        {
          name: 'Enhanced Macro System',
          url: 'content/enhanced-macro-system.js',
          init: initializeMacroSystem,
          priority: 3
        }
      ];
      
      // Sort by priority and load
      moduleLoaders.sort((a, b) => a.priority - b.priority);
      
      const loadPromises = moduleLoaders.map(module => 
        loadModuleScript(module.name, module.url, module.init)
      );
      
      await Promise.all(loadPromises);
      
      // Signal that enhanced modules are loaded
      enhancedModulesLoaded = true;
      console.log('✅ Enhanced scraper modules loaded successfully');
      
      // Dispatch event for other scripts
      window.dispatchEvent(new CustomEvent('StepTwoEnhancedReady', {
        detail: { 
          modulesLoaded: true,
          galleryDetected: isGalleryPage,
          selectorCache: selectorCacheInstance
        }
      }));
      
    } catch (_error) {
      console.error('❌ Failed to load enhanced modules:', error);
    }
  }
  
  // Helper function to load individual module scripts
  function loadModuleScript(name, url, initFunction) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(url);
      script.onload = () => {
        console.log(`✅ ${name} loaded`);
        if (initFunction) {
          setTimeout(initFunction, 10); // Small delay to ensure script is parsed
        }
        resolve();
      };
      script.onerror = () => {
        console.warn(`⚠️ Failed to load ${name}`);
        resolve(); // Don't reject to allow other modules to load
      };
      document.head.appendChild(script);
    });
  }
  
  // Initialize Enhanced Selector System
  function initializeEnhancedSelectorSystem() {
    if (window.EnhancedSelectorSystem) {
      enhancedSelector = new window.EnhancedSelectorSystem({
        prioritizeDataAttributes: true,
        includeTextContent: true,
        maxDepth: 10,
        minSimilarElements: 3
      });
      
      // Initialize the system
      enhancedSelector.initialize();
      
      // Make it globally available
      window.globalEnhancedSelectorSystem = enhancedSelector;
      
      // Load cached patterns for this site
      loadSiteSpecificPatterns();
      console.log('🎯 Enhanced Selector System initialized');
    }
  }
  
  // Load site-specific selector patterns from profiles
  function loadSiteSpecificPatterns() {
    if (!siteProfile) {return;}
    
    const siteKey = selectorCacheInstance.getSiteKey();
    const cachedPatterns = selectorCacheInstance.getCachedSelector(siteKey);
    
    if (cachedPatterns) {
      console.log(`📋 Using cached selectors for ${window.location.hostname}`);
      if (enhancedSelector) {
        enhancedSelector.addCachedPatterns(cachedPatterns);
      }
    } else if (siteProfile.selectors) {
      console.log(`🎯 Loading site-specific patterns for ${siteProfile.name}`);
      selectorCacheInstance.setCachedSelector(siteKey, siteProfile.selectors);
      if (enhancedSelector) {
        enhancedSelector.addCachedPatterns(siteProfile.selectors);
      }
    }
  }
  
  // Initialize macro system
  function initializeMacroSystem() {
    if (window.MacroSystem) {
      macroSystem = window.MacroSystem;
      console.log('🎬 Enhanced macro system initialized');
    }
  }
  
  // Initialize Production Monitor
  function initializeProductionMonitor() {
    if (window.ProductionMonitor) {
      const productionMonitor = new window.ProductionMonitor({
        enableLogging: true,
        enableMetrics: true,
        enableErrorTracking: true,
        logLevel: 'info'
      });
      
      // Initialize the monitor
      productionMonitor.initialize();
      
      // Make it globally available
      window.globalProductionMonitor = productionMonitor;
      console.log('📊 Production Monitor initialized');
    }
  }
  
  // Initialize Enhanced Pagination Handler
  function initializeEnhancedPaginationHandler() {
    if (window.EnhancedPaginationHandler) {
      const paginationHandler = new window.EnhancedPaginationHandler({
        enableAutoDetection: true,
        enableInfiniteScroll: true,
        enableButtonPagination: true,
        enableUrlPagination: true
      });
      
      // Make it globally available
      window.globalEnhancedPaginationHandler = paginationHandler;
      console.log('📄 Enhanced Pagination Handler initialized');
    }
  }
  
  // Initialize Scraper Integration
  function initializeScraperIntegration() {
    if (window.ScraperIntegration) {
      const scraperIntegration = new window.ScraperIntegration({
        enableEnhancedScraping: true,
        enableMonitoring: true,
        enableEnhancedPagination: true
      });
      
      // Initialize the integration
      scraperIntegration.initialize();
      
      // Make it globally available
      window.globalScraperIntegration = scraperIntegration;
      console.log('🔧 Scraper Integration initialized');
      
      // Dispatch scraper integration ready event
      window.dispatchEvent(new CustomEvent('StepTwoScraperIntegrationReady', {
        detail: { 
          scraperIntegration,
          components: ['production-monitor', 'enhanced-utils', 'pagination-handler']
        }
      }));
    }
  }
  
  // Initialize Phase 2 enterprise modules
  let enterpriseIntegration = null;
  let performanceMonitor = null;
  let compatibilityLayer = null;
  
  // Initialize Cross-Platform Compatibility System
  function initializeCrossPlatformCompatibility() {
    if (window.CrossPlatformCompatibility) {
      compatibilityLayer = new window.CrossPlatformCompatibility({
        browser: {
          chromeSupport: true,
          firefoxSupport: true,
          safariSupport: true,
          edgeSupport: true,
          featureDetection: true,
          polyfills: true,
          gracefulDegradation: true
        }
      });
      
      // Initialize the system
      compatibilityLayer.initialize();
      
      // Make it globally available
      window.globalCrossPlatformCompatibility = compatibilityLayer;
      console.log('🌐 Cross-Platform Compatibility System initialized');
    }
  }
  
  // Initialize Enterprise Systems Core
  function initializeEnterpriseSystemsCore() {
    if (window.EnterpriseSystemsCore) {
      const enterpriseSystemsCore = new window.EnterpriseSystemsCore({
        auth: {
          sessionManagement: true,
          authDetection: true,
          siteProfiles: true,
          security: true
        },
        validation: {
          enablePatternLearning: true,
          enableCrossSiteValidation: true,
          strictMode: false,
          auditLogging: true
        },
        performance: {
          monitoring: true,
          realTimeMonitoring: true,
          analytics: true,
          reporting: true
        }
      });
      
      // Make it globally available
      window.globalEnterpriseSystemsCore = enterpriseSystemsCore;
      console.log('🏢 Enterprise Systems Core initialized');
      
      // Dispatch enterprise systems ready event
      window.dispatchEvent(new CustomEvent('StepTwoEnterpriseSystemsReady', {
        detail: { 
          enterpriseSystemsCore,
          modules: ['auth', 'validation', 'performance']
        }
      }));
    }
  }

  // Initialize enterprise performance monitor (legacy compatibility)
  function initializePerformanceMonitor() {
    console.log('📊 Performance monitoring now handled by Enterprise Systems Core');
  }
  
  // Initialize Enterprise Integration Core (Phases 2-4)
  function initializeEnterpriseIntegration() {
    if (window.EnterpriseIntegrationCore) {
      enterpriseIntegration = new window.EnterpriseIntegrationCore({
        enterpriseValidation: true,
        enterpriseExport: true,
        enterpriseAuth: true,
        enterprisePerformance: true,
        crossBrowserCompatibility: true,
        integration: true,
        autoStart: true,
        qualityAssurance: true,
        analytics: true
      });
      
      // Make it globally available
      window.globalEnterpriseIntegration = enterpriseIntegration;
      console.log('🏢 Enterprise Integration Core (Phases 2-4) initialized');
      
      // Dispatch enterprise ready event
      window.dispatchEvent(new CustomEvent('StepTwoEnterpriseReady', {
        detail: { 
          enterpriseIntegration,
          phase: '2-4'
        }
      }));
    }
  }
  
  // Initialize AI/ML modules
  let aimlCoreSystem = null;
  let phase4Orchestrator = null;
  
  // Initialize AI/ML Core System
  function initializeAIMLCoreSystem() {
    if (window.AIMLCoreSystem) {
      aimlCoreSystem = new window.AIMLCoreSystem();
      
      // Initialize the system
      aimlCoreSystem.initialize();
      
      // Make it globally available
      window.globalAIMLCoreSystem = aimlCoreSystem;
      console.log('🤖 AI/ML Core System initialized');
      
      // Dispatch AI/ML ready event
      window.dispatchEvent(new CustomEvent('StepTwoAIMLReady', {
        detail: { 
          aimlCoreSystem,
          features: ['selector-assistant', 'content-classification', 'nlp']
        }
      }));
    }
  }
  
  // Legacy initialization functions for compatibility
  function initializeAIMLAssistant() {
    console.log('🤖 AI/ML Selector Assistant now handled by AI/ML Core System');
  }

  function initializeNaturalLanguageProcessing() {
    console.log('🗣️ Natural Language Processing now handled by AI/ML Core System');
  }
  
  // Initialize Future Integration Core (Phases 5-6)
  function initializeFutureIntegration() {
    if (window.FutureIntegrationCore) {
      const futureIntegration = new window.FutureIntegrationCore();
      
      // Make it globally available
      window.globalFutureIntegration = futureIntegration;
      console.log('🚀 Future Integration Core (Phases 5-6) initialized');
      
      // Dispatch future integration ready event
      window.dispatchEvent(new CustomEvent('StepTwoFutureIntegrationReady', {
        detail: { 
          futureIntegration,
          computerVision: window.globalComputerVision,
          nlp: window.globalNLP,
          phase: '5-6'
        }
      }));
    }
  }

  function initializePhase5Orchestrator() {
    // This function is now handled by initializeFutureIntegration
    console.log('Phase 5 orchestration now handled by Future Integration Core');
  }
  
  // Phase 6 initialization functions
  function initializeRealtimeCollaboration() {
    if (window.RealTimeCollaboration) {
      const realtimeCollaboration = new window.RealTimeCollaboration();
      window.globalRealtimeCollaboration = realtimeCollaboration;
      console.log('👥 Real-Time Collaboration initialized');
    }
  }
  
  function initializePWACore() {
    if (window.ProgressiveWebAppCore) {
      const pwaCore = new window.ProgressiveWebAppCore();
      window.globalPWACore = pwaCore;
      console.log('📱 Progressive Web App Core initialized');
    }
  }
  
  function initializePhase6Orchestrator() {
    // This function is now handled by initializeFutureIntegration
    console.log('Phase 6 orchestration now handled by Future Integration Core');
  }
  
  // Enhanced site profile checking with gallery awareness
  function checkSiteProfile() {
    if (!autoDetect || !profiles) {return;}
    
    const hostname = window.location.hostname;
    const url = window.location.href;
    
    // Look for site-specific profile
    for (const [key, profile] of Object.entries(profiles)) {
      if (profile.hosts && profile.hosts.some(host => hostname.includes(host))) {
        siteProfile = profile;
        console.log(`🎯 Site profile detected: ${profile.name}`);
        
        // Load enhanced modules if this is a known gallery site
        if (profile.type === 'gallery' || profile.type === 'ecommerce') {
          loadEnhancedModules(true); // Force load for known gallery sites
        }
        
        break;
      }
    }
    
    // If no specific profile but gallery detected, use smart loading
    if (!siteProfile && detectGalleryPage()) {
      loadEnhancedModules();
    }
  }
  
  // Load profiles and settings
  chrome.runtime.sendMessage({type:'GET_PROFILES'}, resp => {
    if(resp){
      profiles = resp.profiles||{}; 
      autoDetect = resp.autoDetect; 
      checkSiteProfile();
    }
  });

  // Smart loading: Load enhanced modules only when needed
  // Lazy loading trigger function
  async function ensureEnhancedModulesLoaded() {
    if (!enhancedModulesLoaded) {
      console.log('🚀 Lazy loading enhanced modules...');
      await loadEnhancedModules();
    }
  }

  // Message listener for dynamic module loading
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'ENSURE_MODULES_LOADED') {
      await ensureEnhancedModulesLoaded();
      sendResponse({ loaded: enhancedModulesLoaded });
    } else if (message.type === 'FORCE_LOAD_MODULES') {
      await loadEnhancedModules(true);
      sendResponse({ loaded: enhancedModulesLoaded });
    }
  });

  function showSiteProfileIndicator(siteName) {
    // Remove existing indicator
    const existing = document.querySelector('#steptwo-profile-indicator');
    if (existing) {existing.remove();}
    
    // Create new indicator using secure method
    const indicator = createStatusIndicator(`${siteName} Profile Active`, 'success');
    indicator.id = 'steptwo-profile-indicator';
    
    // Override default styles for profile indicator
    Object.assign(indicator.style, {
      top: '10px',
      right: '10px',
      background: '#667eea',
      cursor: 'pointer',
      animation: 'steptwo-fade-in 0.3s ease-in'
    });
    
    document.body.appendChild(indicator);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.opacity = '0.7';
        indicator.style.fontSize = '10px';
        indicator.style.padding = '4px 8px';
      }
    }, 3000);
    
    // Remove on click
    indicator.addEventListener('click', () => {
      indicator.remove();
    });
  }

  async function autoStartScraping() {
    if (!siteProfile || !autoDetect) {return;}
    
    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const response = await import(chrome.runtime.getURL('content/scraper.js'));
      response.runScrape(siteProfile.selectors?.imageContainer, {
        profile: siteProfile,
        autoDetected: true,
        waitSettings: siteProfile.waitSettings,
        scrollBehavior: siteProfile.scrollBehavior
      });
    } catch (_error) {
      console.error('[STEPTWO] Auto-scraping failed:', error);
    }
  }

  // Load current settings for filtering
  chrome.storage.sync.get(['minWidth', 'minHeight', 'skipDup', 'formats']).then(settings => {
    currentSettings = settings;
  });

  function maybeAuto(){
    if(!autoDetect) {return;}
    const host = location.hostname.replace(/^www\./,'');
    const profile = profiles[host];
    if(profile){
      console.log(`[STEPTWO] Auto-detected legacy profile for ${host}:`, profile);
      import(chrome.runtime.getURL('content/scraper.js')).then(mod => {
        mod.runScrape(profile.selector, {
          profile: profile,
          autoDetected: true
        });
      });
    }
  }

  // Enhanced message handling
  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    console.log('[STEPTWO] Received message:', msg.type);
    
    switch(msg.type) {
      case 'START_PICKER':
        try {
          // Load picker script if not already loaded
          if (!window.stepTwoPicker) {
            await loadModuleScript('Element Picker', 'content/picker.js');
          }
          
          if (window.startPicker) {
            window.startPicker({
              ...msg.options,
              siteProfile
            });
          } else {
            console.error('Picker not available');
          }
        } catch (error) {
          console.error('Failed to start picker:', error);
        }
        break;
        
      case 'STOP_PICKER':
        try {
          if (window.stopPicker) {
            window.stopPicker();
          }
        } catch (error) {
          console.error('Failed to stop picker:', error);
        }
        break;
        
      case 'START_ENHANCED_PICKER':
        // Lazy load enhanced modules if needed
        await ensureEnhancedModulesLoaded();
        if (enhancedSelector) {
          const pickerOverlay = new window.EnhancedPickerOverlay(enhancedSelector);
          pickerOverlay.start(msg.mode || 'single');
        } else {
          console.warn('[STEPTWO] Enhanced selector not available, falling back to regular picker');
          try {
            // Load picker script if not already loaded
            if (!window.stepTwoPicker) {
              await loadModuleScript('Element Picker', 'content/picker.js');
            }
            
            if (window.startPicker) {
              window.startPicker({ ...msg.options, siteProfile });
            }
          } catch (error) {
            console.error('Failed to load regular picker:', error);
          }
        }
        break;
        
      case 'TEST_SELECTOR':
        try {
          const containerSelector = msg.containerSelector;
          const imageSelector = msg.imageSelector || 'img';
          
          if (!containerSelector) {
            sendResponse({ success: false, error: 'Container selector is required' });
            break;
          }
          
          // Test the container selector
          const containers = document.querySelectorAll(containerSelector);
          let imageCount = 0;
          
          // Count images within containers
          containers.forEach(container => {
            const images = container.querySelectorAll(imageSelector);
            imageCount += images.length;
          });
          
          console.log(`🧪 Selector test: ${containers.length} containers, ${imageCount} images`);
          
          sendResponse({ 
            success: true, 
            containerCount: containers.length,
            imageCount: imageCount,
            elementCount: containers.length
          });
        } catch (error) {
          console.error('Selector test failed:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'START_MACRO_RECORDING':
        // Lazy load enhanced modules if needed
        await ensureEnhancedModulesLoaded();
        if (macroSystem) {
          try {
            const macro = macroSystem.startRecording(msg.name);
            sendResponse({ success: true, macro });
          } catch (_error) {
            sendResponse({ success: false, error: error.message });
          }
        } else {
          sendResponse({ success: false, error: 'Macro system not available' });
        }
        break;
        
      case 'STOP_MACRO_RECORDING':
        if (macroSystem) {
          try {
            const macro = macroSystem.stopRecording();
            sendResponse({ success: true, macro });
          } catch (_error) {
            sendResponse({ success: false, error: error.message });
          }
        } else {
          sendResponse({ success: false, error: 'Macro system not available' });
        }
        break;
        
      case 'START_CROP_SELECTION':
        import(chrome.runtime.getURL('content/crop-selector.js')).then(module => {
          module.startCropSelection();
          sendResponse({ success: true });
        }).catch(error => {
          console.error('[STEPTWO] Failed to load crop selector:', error);
          sendResponse({ success: false, error: error.message });
        });
        break;
        
      case 'STOP_CROP_SELECTION':
        import(chrome.runtime.getURL('content/crop-selector.js')).then(module => {
          module.stopCropSelection();
          sendResponse({ success: true });
        }).catch(error => {
          console.error('[STEPTWO] Failed to stop crop selector:', error);
          sendResponse({ success: false, error: error.message });
        });
        break;
        
      case 'PLAY_MACRO':
        if (macroSystem) {
          macroSystem.playMacro(msg.macro, msg.options)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // Keep message channel open for async response
        } else {
          sendResponse({ success: false, error: 'Macro system not available' });
        }
        break;
        
      case 'STOP_MACRO_PLAYBACK':
        if (macroSystem) {
          macroSystem.stopPlayback();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Macro system not available' });
        }
        break;
        
      case 'PICKER_DONE':
        console.log('[STEPTWO] Picker selected:', msg);
        try {
          const mod = await import(chrome.runtime.getURL('content/scraper.js'));
          await mod.runScrape(msg.selector, {
            siteProfile,
            userSelected: true,
            ...msg.options
          });
        } catch (error) {
          console.error('[STEPTWO] Failed to run scrape from picker:', error);
        }
        break;
        
      case 'START_SCRAPING':
        try {
          const mod = await import(chrome.runtime.getURL('content/scraper.js'));
          const selector = msg.selector || siteProfile?.selectors?.imageContainer;
          await mod.runScrape(selector, {
            siteProfile,
            waitSettings: siteProfile?.waitSettings,
            scrollBehavior: siteProfile?.scrollBehavior,
            ...msg.options
          });
        } catch (error) {
          console.error('[STEPTWO] Failed to start scraping:', error);
        }
        break;
        
      case 'SMART_GUESS':
        // Lazy load enhanced modules for smart guessing
        await ensureEnhancedModulesLoaded();
        import(chrome.runtime.getURL('content/smartGuess.js')).then(module => {
          module.smartGuess({
            siteProfile,
            universalFallback: true,
            enhancedSelector: enhancedSelector // Pass enhanced selector if available
          });
        });
        break;
        
      case 'START_REC':
        import(chrome.runtime.getURL('content/macro/recorder.js')).then(mod => {
          mod.startRecording();
        });
        break;
        
      case 'STOP_REC':
        import(chrome.runtime.getURL('content/macro/recorder.js')).then(mod => {
          mod.stopRecording();
        });
        break;
        
      case 'RELOAD_PROFILE':
        checkSiteProfile();
        break;
        
      // Popup interface message handlers
      case 'getPageStatus':
        const itemCount = document.querySelectorAll('img').length;
        const pageStatus = isGalleryPage ? `Gallery page (${itemCount} images)` : 'Regular page';
        sendResponse({
          success: true,
          itemCount: itemCount,
          pageStatus: pageStatus,
          isGalleryPage: isGalleryPage,
          siteProfile: siteProfile?.name || 'Generic'
        });
        break;
        
      case 'quickScan':
        try {
          await ensureEnhancedModulesLoaded();
          
          // Simple gallery scan for popup
          const images = document.querySelectorAll('img');
          const galleryItems = document.querySelectorAll([
            '[class*="gallery"]',
            '[class*="photo"]', 
            '[class*="image"]',
            '[class*="product"]',
            '[data-gallery]',
            '[data-photo]'
          ].join(', '));
          
          const itemCount = Math.max(images.length, galleryItems.length);
          
          // Update cache
          galleryDetectionCache = itemCount >= 5;
          isGalleryPage = galleryDetectionCache;
          
          sendResponse({
            success: true,
            itemCount: itemCount,
            pageStatus: `Found ${itemCount} potential items`,
            isGalleryPage: isGalleryPage,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('[STEPTWO] Quick scan error:', error);
          sendResponse({
            success: false,
            error: error.message,
            itemCount: 0
          });
        }
        break;
        
      case 'enableSelectorMode':
        try {
          await ensureEnhancedModulesLoaded();
          
          if (enhancedSelector) {
            // Start the enhanced picker overlay
            const pickerOverlay = new window.EnhancedPickerOverlay(enhancedSelector);
            pickerOverlay.start('single');
            sendResponse({ success: true, message: 'Selector mode enabled' });
          } else {
            // Fallback to regular picker
            try {
              // Load picker script if not already loaded
              if (!window.stepTwoPicker) {
                await loadModuleScript('Element Picker', 'content/picker.js');
              }
              
              if (window.startPicker) {
                window.startPicker({ siteProfile });
                sendResponse({ success: true, message: 'Basic selector mode enabled' });
              } else {
                throw new Error('Picker not available after loading');
              }
            } catch (error) {
              console.error('Failed to load regular picker:', error);
              sendResponse({ success: false, error: error.message });
            }
          }
        } catch (error) {
          console.error('[STEPTWO] Selector mode error:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      default:
        // Legacy handler for backward compatibility
        import(chrome.runtime.getURL('content/scraper.js')).then(mod => {
          mod.runScrape(msg.selector, {
            siteProfile,
            legacy: true
          });
        });
    }
  });

  // Additional message listener for popup interface (action-based messages)
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (!message.action) {return;} // Only handle action-based messages
    
    console.log('[STEPTWO] Popup message:', message.action);
    
    try {
      switch (message.action) {
        case 'getPageStatus':
          const itemCount = document.querySelectorAll('img').length;
          const pageStatus = isGalleryPage ? `Gallery page (${itemCount} images)` : 'Ready to scan';
          sendResponse({
            success: true,
            itemCount: itemCount,
            pageStatus: pageStatus,
            isGalleryPage: isGalleryPage,
            siteProfile: siteProfile?.name || 'Generic'
          });
          return true; // Keep message channel open
          
        case 'quickScan':
          // Quick gallery detection for popup
          const images = document.querySelectorAll('img');
          const galleryItems = document.querySelectorAll([
            '[class*="gallery"]',
            '[class*="photo"]', 
            '[class*="image"]',
            '[class*="product"]',
            '[data-gallery]',
            '[data-photo]'
          ].join(', '));
          
          const detectedItems = Math.max(images.length, galleryItems.length);
          
          // Update gallery detection cache
          galleryDetectionCache = detectedItems >= 5;
          isGalleryPage = galleryDetectionCache;
          
          sendResponse({
            success: true,
            itemCount: detectedItems,
            pageStatus: `Found ${detectedItems} potential items`,
            isGalleryPage: isGalleryPage,
            timestamp: Date.now()
          });
          return true;
          
        case 'enableSelectorMode':
          await ensureEnhancedModulesLoaded();
          
          if (enhancedSelector) {
            // Start enhanced picker overlay  
            const pickerOverlay = new window.EnhancedPickerOverlay(enhancedSelector);
            pickerOverlay.start('single');
            sendResponse({ success: true, message: 'Enhanced selector mode enabled' });
          } else {
            // Fallback to regular picker
            try {
              // Load picker script if not already loaded
              if (!window.stepTwoPicker) {
                await loadModuleScript('Element Picker', 'content/picker.js');
              }
              
              if (window.startPicker) {
                window.startPicker({ siteProfile });
                sendResponse({ success: true, message: 'Basic selector mode enabled' });
              } else {
                throw new Error('Picker not available after loading');
              }
            } catch (error) {
              console.error('Failed to load regular picker:', error);
              sendResponse({ success: false, error: error.message });
            }
          }
          return true;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
          return true;
      }
    } catch (error) {
      console.error('[STEPTWO] Popup message error:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  });

  // Initialize legacy auto-detection as fallback
  maybeAuto();
})();