// service-worker-modern.js - STEPTWO V2 Unified Service Worker
// Modern Manifest V3 architecture with modular importScripts approach

// Import dependencies using importScripts (Chrome extension service workers don't support ES modules yet)
// All imported files now support both ES modules and importScripts for future compatibility
importScripts('../lib/lib-utilities.js'); // Consolidated library utilities
importScripts('./background-utilities.js'); // Consolidated utilities file includes context menu manager
importScripts('./download-queue.js');
importScripts('./advanced-export-system.js');
importScripts('./batch-operations-manager.js');
importScripts('./site-profile-manager.js');

// Initialize enhanced notification system
class ChromeNotificationSystem {
  constructor() {
    this.activeNotifications = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    chrome.notifications.onClicked.addListener((notificationId) => {
      const notification = this.activeNotifications.get(notificationId);
      if (notification?.onClick) {
        notification.onClick();
      }
      this.clear(notificationId);
    });

    chrome.notifications.onClosed.addListener((notificationId) => {
      this.activeNotifications.delete(notificationId);
    });
  }

  async show(type, message, options = {}) {
    const notificationId = `steptwo_${  Date.now()}`;
    const notificationOptions = {
      type: 'basic',
      iconUrl: 'icons/48.png',
      title: this.getTitleForType(type),
      message: message,
      priority: type === 'error' ? 2 : 1,
      ...options
    };

    try {
      await chrome.notifications.create(notificationId, notificationOptions);
      if (options.onClick) {
        this.activeNotifications.set(notificationId, { onClick: options.onClick });
      }
      return notificationId;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  getTitleForType(type) {
    switch (type) {
      case 'success': return '✅ StepTwo';
      case 'error': return '❌ StepTwo Error';
      case 'warning': return '⚠️ StepTwo Warning';
      case 'info': return 'ℹ️ StepTwo';
      default: return 'StepTwo';
    }
  }

  async clear(notificationId) {
    try {
      await chrome.notifications.clear(notificationId);
      this.activeNotifications.delete(notificationId);
    } catch (error) {
      console.warn('Failed to clear notification:', error);
    }
  }
}

const notificationSystem = new ChromeNotificationSystem();

// Embedded JSON data (replaces file loading for service worker compatibility)
const EMBEDDED_PROFILES_DATA = {
  "example.com": {
    "selector": "img.gallery-item",
    "description": "Example gallery site",
    "pagination": "a.next",
    "waitTime": 2000
  },
  "pinterest.com": {
    "selector": "[data-test-id='pin-image']",
    "description": "Pinterest pins",
    "pagination": "[data-test-id='load-more']",
    "waitTime": 3000
  },
  "unsplash.com": {
    "selector": "img[data-test='photo-grid-image']",
    "description": "Unsplash photos",
    "pagination": "[data-test='load-more-button']",
    "waitTime": 2000
  },
  "gettyimages.com": {
    "selector": "img[data-testid='gallery-asset-image'], img.gallery-mosaic-asset__image",
    "description": "Getty Images professional stock photos",
    "pagination": "a[data-testid='pagination-next-button'], .next-page",
    "waitTime": 4000,
    "scrollDelay": 1500,
    "infiniteScroll": true,
    "enhanced": true,
    "lastUpdated": "2025-09-07T20:41:25.333Z"
  },
  "gettyimages.co.uk": {
    "selector": "img[data-testid='gallery-asset-image'], img.gallery-mosaic-asset__image",
    "description": "Getty Images UK",
    "pagination": "a[data-testid='pagination-next-button'], .next-page",
    "waitTime": 4000,
    "scrollDelay": 1500,
    "infiniteScroll": true,
    "enhanced": true,
    "lastUpdated": "2025-09-07T20:41:25.333Z"
  },
  "shutterstock.com": {
    "selector": "img[data-automation='mosaic-grid-cell-image']",
    "description": "Shutterstock stock photos and videos",
    "pagination": "a[data-automation='pagination-next-button']",
    "waitTime": 3000,
    "scrollDelay": 800,
    "infiniteScroll": true
  },
  "mirrorpix.com": {
    "selector": "img.medium-thumbnail, img[id^='medium__'], img[src*='thumb.php'], .offer-image img, .gallery-item img, .image-container img, .thumbnail-container img, [class*='thumb'] img, [class*='image'] img, img[src*=\"offer\"], img[src*=\"id/\"]",
    "description": "Mirrorpix historical newspaper archive (Enhanced: Dynamic sessions, product pages, complex pagination)",
    "pagination": ".pagination .next, .pagination-next, [href*='page='], .nav-next, .next-page, [aria-label*='next' i], [href*=\"PAGING_SCOPE_1=\"]",
    "waitTime": 6000,
    "scrollDelay": 2500,
    "requiresAuth": true,
    "offerPages": true,
    "dynamicSessions": true,
    "productPages": true
  },
  "actionpress.de": {
    "selector": ".search-result img, .gallery-item img",
    "description": "ActionPress German photo agency",
    "pagination": ".pagination-next, a[rel='next']",
    "waitTime": 4000,
    "scrollDelay": 1200,
    "requiresAuth": true,
    "enhanced": true,
    "lastUpdated": "2025-09-07T20:41:25.333Z"
  },
  "news-images.smartframe.io": {
    "selector": ".sf-grid-item img, .image-container img",
    "description": "SmartFrame news images",
    "pagination": ".load-more, .pagination-next",
    "waitTime": 6000,
    "scrollDelay": 1500,
    "specialHandling": "smartframe"
  },
  "archive.newsimages.co.uk": {
    "selector": ".sf-grid-item img, .archive-image img",
    "description": "News Images Archive",
    "pagination": ".load-more, .pagination-next",
    "waitTime": 6000,
    "scrollDelay": 1500,
    "specialHandling": "smartframe"
  },
  "imago-images.com": {
    "selector": ".search-result img, .media-item img",
    "description": "Imago Images international photo agency",
    "pagination": ".pagination-next, [data-page-next]",
    "waitTime": 4000,
    "scrollDelay": 1000,
    "requiresAuth": true,
    "enhanced": true,
    "lastUpdated": "2025-09-07T20:41:25.333Z"
  },
  "adobe.com": {
    "selector": "[data-testid='asset-image'], .search-result-card img",
    "description": "Adobe Stock images and assets",
    "pagination": "[data-testid='next-page'], .search-pagination-next",
    "waitTime": 3000,
    "scrollDelay": 1000,
    "infiniteScroll": true
  },
  "flickr.com": {
    "selector": ".photo-list-photo-view img, .search-photos-results img",
    "description": "Flickr photo sharing platform",
    "pagination": ".pagination-next, .infinite-scroll-trigger",
    "waitTime": 2500,
    "scrollDelay": 800,
    "infiniteScroll": true
  },
  "500px.com": {
    "selector": ".photo img, .gallery-item img",
    "description": "500px photography community",
    "pagination": ".load-more, .pagination-next",
    "waitTime": 3000,
    "scrollDelay": 1000,
    "infiniteScroll": true
  },
  "pexels.com": {
    "selector": ".photo-item img, [data-testid='photo']",
    "description": "Pexels free stock photos",
    "pagination": ".load-more-button, [data-testid='load-more']",
    "waitTime": 2000,
    "scrollDelay": 800,
    "infiniteScroll": true
  },
  "pixabay.com": {
    "selector": ".item img, .image--overlay img",
    "description": "Pixabay free images and videos",
    "pagination": ".load-more, .pagination-next",
    "waitTime": 2500,
    "scrollDelay": 1000,
    "infiniteScroll": true
  }
};

const EMBEDDED_CHANGELOG_DATA = {
  "version": "0.2.0",
  "changes": [
    {
      "version": "0.2.0",
      "date": "2024-01-15",
      "type": "release",
      "description": "Professional Web Scraper with bulk download capabilities",
      "features": [
        "Enhanced service worker architecture",
        "Improved site profile management",
        "Advanced gallery detection",
        "Memory-optimized processing",
        "Batch operations support"
      ]
    },
    {
      "version": "0.1.0",
      "date": "2024-01-01",
      "type": "initial",
      "description": "Initial release of StepTwo Gallery Scraper",
      "features": [
        "Basic gallery scraping functionality",
        "Chrome extension manifest v3 support",
        "Site profile system"
      ]
    }
  ]
};

// Load JSON data (now using embedded data for service worker compatibility)
let profilesData = EMBEDDED_PROFILES_DATA;
let changelogData = EMBEDDED_CHANGELOG_DATA;

// Simplified JSON data loading function (no longer needs async fetch)
function loadJSONData() {
  try {
    // Data is already embedded, just assign it
    profilesData = EMBEDDED_PROFILES_DATA;
    changelogData = EMBEDDED_CHANGELOG_DATA;
    
    console.log('📊 JSON data loaded successfully from embedded data');
    // Update profiles reference after data is loaded
    profiles = profilesData;
    return true;
  } catch (error) {
    console.error('❌ Failed to load JSON data:', error);
    profilesData = {};
    changelogData = {};
    return false;
  }
}

let profiles = {}; // Will be updated when JSON loads
let autoDetect = true;

// Initialize queue and export system with enhanced error handling
const queue = new DownloadQueue({
  concurrency: 5, 
  retryLimit: 3, 
  hostLimit: 3, 
  maxConcurrency: 10, 
  maxHostLimit: 10
});

const exportSystem = new AdvancedExportSystem({
  enableCompression: true,
  includeMetadata: true
});

// Declare global instances (will be initialized in chrome.runtime.onStartup)
let contextMenuManager;
let keyboardShortcuts;
let batchOperationsManager;
let siteProfileManager;

// Initialize managers after service worker startup
function initializeManagers() {
  try {
    contextMenuManager = new self.ContextMenuManager();
    keyboardShortcuts = new self.KeyboardShortcuts();
    batchOperationsManager = new self.BatchOperationsManager();
    siteProfileManager = new self.SiteProfileManager();
    
    // Setup queue listeners and callbacks
    queue.attachListeners();
    queue.setProgressCallback(progress => {
      // Update badge based on queue progress
      if (progress.stats) {
        const activeDownloads = progress.stats.activeDownloads || 0;
        const totalItems = progress.stats.totalItems || 0;
        const isActive = activeDownloads > 0 || totalItems > 0;
        
        badgeManager.setActive(isActive);
        badgeManager.setActiveJobs(activeDownloads);
        
        // Update queue state for UI
        queueState.running = activeDownloads > 0;
        queueState.active = totalItems > 0;
        
        // Broadcast progress to all tabs for dashboard updates
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'QUEUE_PROGRESS_UPDATE',
              data: progress
            }).catch(() => {}); // Ignore errors for tabs without content scripts
          });
        });
      }
      
      // Show error badge on failures
      if (progress.state && progress.state.includes('error')) {
        badgeManager.showError();
      }
      
      chrome.runtime.sendMessage({type:'QUEUE_PROGRESS', progress}).catch(() => {});
    });
    
    console.log('STEPTWO V2 managers initialized successfully');
  } catch (error) {
    console.error('Failed to initialize STEPTWO V2 managers:', error);
  }
}

// Initialize on startup and installation
chrome.runtime.onStartup.addListener(() => {
  initializeManagers();
});

chrome.runtime.onInstalled.addListener(() => {
  initializeManagers();
});

// Also initialize immediately if service worker is already running
if (chrome.runtime.getManifest) {
  initializeManagers();
}

// State management
let lastItems = [];
let dashboardStats = {
  totalItems: 0,
  completed: 0,
  failed: 0,
  duplicates: 0,
  sessionStartTime: Date.now()
};
let queueState = {
  running: false,
  active: false,
  canStart: false
};

// Extension badge management for status indication
class BadgeManager {
  constructor() {
    this.isActive = false;
    this.activeJobs = 0;
    this.lastBadgeUpdate = 0;
    this.updateThrottle = 500; // Throttle updates to avoid excessive badge changes
  }

  updateBadge() {
    const now = Date.now();
    if (now - this.lastBadgeUpdate < this.updateThrottle) {
      return; // Throttle updates
    }
    this.lastBadgeUpdate = now;

    try {
      if (this.isActive && this.activeJobs > 0) {
        // Show active job count
        const badgeText = this.activeJobs > 99 ? '99+' : this.activeJobs.toString();
        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
        chrome.action.setTitle({ title: `STEPTWO V2 - ${this.activeJobs} active downloads` });
      } else if (this.isActive) {
        // Show "ON" status when active but no jobs
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: '#27ae60' });
        chrome.action.setTitle({ title: 'STEPTWO V2 - Ready and active' });
      } else {
        // Clear badge when inactive
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ title: 'STEPTWO V2 - Professional Gallery Scraper' });
      }
    } catch (error) {
      console.warn('Failed to update extension badge:', error);
    }
  }

  setActive(active) {
    if (this.isActive !== active) {
      this.isActive = active;
      this.updateBadge();
    }
  }

  setActiveJobs(count) {
    if (this.activeJobs !== count) {
      this.activeJobs = Math.max(0, count);
      this.updateBadge();
    }
  }

  showError() {
    try {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
      chrome.action.setTitle({ title: 'STEPTWO V2 - Error occurred, click to open' });
      
      // Clear error badge after 10 seconds
      setTimeout(() => {
        this.updateBadge();
      }, 10000);
    } catch (error) {
      console.warn('Failed to show error badge:', error);
    }
  }
}

const badgeManager = new BadgeManager();

// Service Worker Load Balancer - optimized for Manifest V3
class ServiceWorkerLoadBalancer {
  constructor() {
    this.taskQueue = [];
    this.isProcessing = false;
    this.maxContinuousTime = 50; // Max 50ms continuous processing
    this.yieldTime = 10; // Yield for 10ms
    this.processedTasks = 0;
    this.maxTasksPerSlice = 10; // Process max 10 tasks per time slice
  }

  enqueueTask(task, priority = 'normal') {
    const taskWrapper = {
      task,
      priority,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    if (priority === 'high') {
      this.taskQueue.unshift(taskWrapper);
    } else {
      this.taskQueue.push(taskWrapper);
    }
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) {return;}
    
    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      while (
        this.taskQueue.length > 0 && 
        (Date.now() - startTime) < this.maxContinuousTime &&
        this.processedTasks < this.maxTasksPerSlice
      ) {
        const taskWrapper = this.taskQueue.shift();
        
        try {
          await taskWrapper.task(); // eslint-disable-line no-await-in-loop
          this.processedTasks++;
        } catch (error) {
          console.error('Task processing error:', error);
        }
      }
      
      // Yield control if we have more tasks or have processed many tasks
      if (this.taskQueue.length > 0 || this.processedTasks >= this.maxTasksPerSlice) {
        this.processedTasks = 0;
        setTimeout(() => {
          this.isProcessing = false;
          this.processQueue();
        }, this.yieldTime);
      } else {
        this.isProcessing = false;
      }
      
    } catch (error) {
      console.error('Queue processing error:', error);
      this.isProcessing = false;
    }
  }

  getStats() {
    return {
      queueLength: this.taskQueue.length,
      isProcessing: this.isProcessing,
      processedTasks: this.processedTasks
    };
  }
}

// Initialize load balancer
const loadBalancer = new ServiceWorkerLoadBalancer();

// Dashboard management
let dashboardTabId = null;

// Handle extension icon click to open windowed dashboard
chrome.action.onClicked.addListener(async (_tab) => {
  try {
    // Check if dashboard is already open
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('ui/windowed-dashboard.html') });
    
    if (tabs.length > 0) {
      // Focus existing dashboard
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Open new windowed dashboard
      await chrome.tabs.create({
        url: chrome.runtime.getURL('ui/windowed-dashboard.html'),
        active: true
      });
    }
  } catch (error) {
    console.error('Failed to open dashboard:', error);
  }
});

// Content script injection with enhanced error handling
async function injectContentScriptIfNeeded(tabId, url) {
  try {
    // Skip injection for extension pages, chrome://, and other special URLs
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      return false;
    }
    
    // Check if we have permission to access this URL
    const hasPermission = await chrome.permissions.contains({
      origins: [`${new URL(url).origin  }/*`]
    });
    
    if (!hasPermission) {
      console.log(`📋 No permission for ${url}, skipping content script injection`);
      return false;
    }
    
    // Check if content script is already injected
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => window.StepTwoInjected === true
      });
      
      if (results?.[0]?.result) {
        return true; // Already injected
      }
    } catch {
      // Tab might not be ready, continue with injection
    }
    
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/injector.js']
    });
    
    console.log(`📄 Content script injected into tab ${tabId}: ${url}`);
    return true;
    
  } catch (error) {
    console.warn(`Failed to inject content script into tab ${tabId}:`, error);
    return false;
  }
}

// Smart injection on tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const galleryPatterns = [
      /gallery|portfolio|photos|images|album|collection/i,
      /shop|store|products|catalog/i,
      /instagram|pinterest|flickr|unsplash|deviantart/i,
      /reddit\.com\/r\/[^\/]*pics/i,
      /behance|dribbble|artstation/i
    ];
    
    const isPotentialGallery = galleryPatterns.some(pattern => pattern.test(tab.url));
    
    if (isPotentialGallery) {
      console.log(`🎯 Potential gallery detected: ${tab.url}`);
      await injectContentScriptIfNeeded(tabId, tab.url);
    }
  }
});

async function _openDashboard() {
  try {
    if (dashboardTabId) {
      try {
        const tab = await chrome.tabs.get(dashboardTabId);
        if (tab) {
          await chrome.tabs.update(dashboardTabId, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
          return;
        }
      } catch {
        dashboardTabId = null;
      }
    }
    
    const tab = await chrome.tabs.create({
      url: chrome.runtime.getURL('ui/windowed-dashboard.html'),
      active: true
    });
    
    dashboardTabId = tab.id;
  } catch (error) {
    console.error('Failed to open dashboard:', error);
  }
}

// Track when dashboard tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === dashboardTabId) {
    dashboardTabId = null;
  }
});

// Settings management
let savedConcurrency = 5;
let retryLimit = 3;
let hostLimit = 3;

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get([
      'concurrency', 'retryLimit', 'hostLimit'
    ]);
    
    if (settings.concurrency) { savedConcurrency = settings.concurrency; }
    if (settings.retryLimit !== undefined) { 
      retryLimit = settings.retryLimit; 
      queue.setRetryLimit(retryLimit);
    } 
    if (settings.hostLimit !== undefined) { 
      hostLimit = settings.hostLimit; 
      queue.setHostLimit(hostLimit);
    } 
    
    queue.setConcurrency(savedConcurrency);
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Storage change listener
chrome.storage.onChanged.addListener(changes => {
  if (changes.concurrency) {
    queue.setConcurrency(changes.concurrency.newValue);
  }
  if (changes.retryLimit) {
    retryLimit = changes.retryLimit.newValue;
    queue.setRetryLimit(retryLimit);
  }
  if (changes.hostLimit) { 
    hostLimit = changes.hostLimit.newValue; 
    queue.setHostLimit(hostLimit);
  } 
});

// Enhanced message processing with load balancing
async function processMessage(message, priority = 'normal') {
  return new Promise((resolve, reject) => {
    loadBalancer.enqueueTask(async () => {
      try {
        const result = await handleMessage(message);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }, priority);
  });
}

// Main message handler
// Enhanced message handler with error boundaries
async function handleMessage(msg) {
  try {
    // Validate message structure
    if (!msg || typeof msg !== 'object') {
      return {ok: false, error: 'Invalid message format'};
    }

    // Handle version/update messages first (high priority)
    if (msg?.type === 'UPDATE_PROFILES') {
      return {ok: true, updated: false, message: 'Extension uses local profiles only'};
    }
    if (msg?.type === 'CHECK_UPDATE') {
      return {
        ok: true,
        currentVersion: chrome.runtime.getManifest().version,
        remoteVersionInfo: null,
        changelog: changelogData,
        message: 'Extension runs offline - no update checking'
      };
    }

    // Handle main functionality messages with error boundaries
    switch (msg?.type) {
      case 'GET_PROFILES':
        try {
          return {profiles: getProfiles(), autoDetect};
        } catch (error) {
          console.error('Failed to get profiles:', error);
          return {ok: false, error: 'Failed to retrieve profiles'};
        }
        
      case 'DETECT_SITE_PROFILE': {
        try {
          const profile = detectSiteProfile(msg.url);
          const merged = profile ? mergeWithUserSettings(profile, msg.userSettings) : null;
          return {
            profile: merged,
            siteName: profile?.name,
            detected: !!profile
          };
        } catch (error) {
          console.error('Failed to detect site profile:', error);
          return {ok: false, error: 'Failed to detect site profile'};
        }
      }
      
      case 'GET_SITE_PROFILE_LIST':
        return {profiles: getProfileList()};
      
      case 'GET_UNIVERSAL_SELECTORS':
        return {selectors: UNIVERSAL_SELECTORS};

      case 'PREVIEW_FILENAME_MASK':
        const preview = previewMask(msg.mask, msg.context);
        return {preview, tokens: getAvailableTokens()};
      
      case 'QUEUE_ADD_ITEMS': {
        try {
          const promises = (msg.items || []).map(async item => {
            const added = await queue.add(item);
            return {url: item.url, added};
          });
          const results = await Promise.all(promises);
          return {success: true, results};
        } catch (error) {
          console.error('Error adding items to queue:', error);
          return {success: false, error: error.message};
        }
      }
      
      case 'QUEUE_PAUSE':
        queue.pause();
        queueState.running = false;
        badgeManager.setActive(queueState.active);
        return {success: true, queueState};
      
      case 'QUEUE_RESUME':
        queue.resume();
        queueState.running = true;
        badgeManager.setActive(true);
        return {success: true, queueState};
      
      case 'QUEUE_CLEAR':
        queue.clear();
        lastItems = [];
        queueState = {running: false, active: false, canStart: false};
        badgeManager.setActive(false);
        badgeManager.setActiveJobs(0);
        return {success: true, queueState};
      
      case 'QUEUE_STATS':
        return {
          stats: queue.getStats(),
          dashboardStats,
          queueState,
          loadBalancer: loadBalancer.getStats()
        };
      
      case 'CLEAR_SESSION_STATS':
        clearSessionStats();
        return {success: true};
    
      case 'PERFORM_ENHANCED_EXPORT': {
        try {
          if (!lastItems.length) {
            return { success: false, error: 'No items to export' };
          }
        
          const exportData = {
            items: lastItems,
            stats: dashboardStats,
            exportType: msg.exportType || 'comprehensive'
          };
        
          const result = await exportSystem.exportData(exportData, msg.format, msg.filename, msg.options);
          return { success: true, result };
        
        } catch (error) {
          console.error('Enhanced export failed:', error);
          return { success: false, error: error.message };
        }
      }
    
      case 'INJECT_CONTENT_SCRIPT': {
        try {
          const success = await ensureContentScriptInjected(msg.tabId);
          return {success, injected: success};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }
    
      case 'START_SCRAPING': {
        try {
          if (msg.tabId) {
            const injected = await ensureContentScriptInjected(msg.tabId);
            if (!injected) {
              return {success: false, error: 'Failed to inject content script'};
            }
          }
        
          queueState.canStart = true;
          queueState.active = true;
          return {success: true, queueState};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      // Batch Operations
      case 'START_BATCH_OPERATION': {
        try {
          const batchId = await batchOperationsManager.startBatchOperation(msg.config);
          return {success: true, batchId: batchId};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'CANCEL_BATCH_OPERATION': {
        try {
          const success = await batchOperationsManager.cancelBatch(msg.batchId);
          return {success: success};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'GET_ACTIVE_BATCHES': {
        return {success: true, batches: batchOperationsManager.getActiveBatches()};
      }

      case 'GET_BATCH_HISTORY': {
        const history = batchOperationsManager.getBatchHistory(msg.limit || 10);
        return {success: true, history: history};
      }

      // Site Profile Management
      case 'DETECT_SITE_PROFILE_ENHANCED': {
        try {
          const profile = siteProfileManager.detectSiteProfile(msg.url);
          return {success: true, profile: profile};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'GET_ALL_SITE_PROFILES': {
        const profiles = siteProfileManager.getAllProfiles();
        return {success: true, profiles: profiles};
      }

      case 'CREATE_CUSTOM_PROFILE': {
        try {
          const profile = await siteProfileManager.createCustomProfile(msg.profileData);
          return {success: true, profile: profile};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'UPDATE_CUSTOM_PROFILE': {
        try {
          const profile = await siteProfileManager.updateCustomProfile(msg.profileId, msg.updates);
          return {success: true, profile: profile};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'DELETE_CUSTOM_PROFILE': {
        try {
          await siteProfileManager.deleteCustomProfile(msg.profileId);
          return {success: true};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'TEST_SITE_PROFILE': {
        try {
          const result = await siteProfileManager.testProfile(msg.profileId, msg.testUrl);
          return {success: true, result: result};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'EXPORT_SITE_PROFILES': {
        try {
          const exportData = await siteProfileManager.exportProfiles(msg.profileIds);
          return {success: true, exportData: exportData};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'IMPORT_SITE_PROFILES': {
        try {
          const result = await siteProfileManager.importProfiles(msg.jsonData, msg.options);
          return {success: true, result: result};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }

      case 'GET_SITE_PROFILE_STATS': {
        const stats = siteProfileManager.getStats();
        return {success: true, stats: stats};
      }

      case 'SELECTOR_PICKED': {
        try {
          // Forward the selector picked message to all dashboard windows
          console.log('🎯 Forwarding selector picked data:', msg.data);
          
          // Find all tabs with the dashboard open
          const tabs = await chrome.tabs.query({});
          const dashboardTabs = tabs.filter(tab => 
            tab.url && (
              tab.url.includes('windowed-dashboard.html') ||
              tab.url.includes('popup.html') ||
              tab.url.includes('options.html')
            )
          );
          
          // Send the message to all dashboard tabs
          const forwardPromises = dashboardTabs.map(tab => 
            chrome.tabs.sendMessage(tab.id, {
              type: 'SELECTOR_PICKED',
              data: msg.data
            }).catch(error => {
              console.warn(`Failed to forward to tab ${tab.id}:`, error);
            })
          );
          
          await Promise.allSettled(forwardPromises);
          
          return {success: true, forwardedTo: dashboardTabs.length};
        } catch (error) {
          console.error('Failed to forward selector picked message:', error);
          return {success: false, error: error.message};
        }
      }
    
      default:
        return {error: 'Unknown message type', type: msg?.type};
    }
  } catch (error) {
    console.error('Message handling error:', error);
    return {ok: false, error: 'Internal message processing error'};
  }
}

// Add context menu and keyboard shortcuts event listeners
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    await contextMenuManager.handleContextMenuClick(info, tab);
  } catch (error) {
    console.error('Context menu error:', error);
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  try {
    await keyboardShortcuts.handleCommand(command, tab);
  } catch (error) {
    console.error('Keyboard shortcut error:', error);
  }
});

// Enhanced message listener with load balancing
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const highPriorityTypes = ['CHECK_UPDATE', 'GET_VERSION_INFO', 'GET_CHANGELOG'];
  const priority = highPriorityTypes.includes(msg?.type) ? 'high' : 'normal';
  
  // Handle scraping results
  if (msg?.type === 'SCRAPE_DONE') {
    try {
      console.log('📊 Scraping completed:', msg.data);
      lastItems = msg.data.items || [];
      dashboardStats.totalItems = lastItems.length;
      dashboardStats.completed = lastItems.length;
      
      // Update badge
      badgeManager.setActiveJobs(0);
      badgeManager.setActive(false);
      
      sendResponse({ success: true, received: lastItems.length });
    } catch (error) {
      console.error('Error handling scrape results:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (msg?.type === 'SCRAPE_ERROR') {
    try {
      console.error('❌ Scraping error received:', msg.error);
      badgeManager.showError();
      sendResponse({ success: true, error: msg.error });
    } catch (error) {
      console.error('Error handling scrape error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  const syncMessageTypes = ['GET_PROFILES', 'GET_CHANGELOG', 'GET_VERSION_INFO', 'UPDATE_PROFILES', 'CHECK_UPDATE'];
  if (syncMessageTypes.includes(msg?.type)) {
    handleMessage(msg, sender).then(response => {
      sendResponse(response);
    }).catch(error => {
      sendResponse({error: error.message});
    });
    return true;
  }
  
  processMessage(msg, priority).then(response => {
    sendResponse(response);
  }).catch(error => {
    sendResponse({error: error.message});
  });
  
  return true;
});

// Helper functions
function getProfiles() {
  return profiles;
}

async function ensureContentScriptInjected(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return await injectContentScriptIfNeeded(tabId, tab.url);
  } catch (error) {
    console.error('Failed to ensure content script injection:', error);
    return false;
  }
}

function clearSessionStats() {
  console.log('🧹 Clearing session stats and resetting memory...');
  
  dashboardStats = {
    totalItems: 0,
    completed: 0,
    failed: 0,
    duplicates: 0,
    sessionStartTime: Date.now()
  };
  
  lastItems = [];
  console.log('✅ Session stats cleared and memory reset');
}

// Initialize extension
async function initializeExtension() {
  try {
    loadJSONData(); // Now synchronous, no await needed
    await loadSettings();
    
    const {autoDetectProfiles} = await chrome.storage.sync.get('autoDetectProfiles');
    if (typeof autoDetectProfiles === 'boolean') {
      autoDetect = autoDetectProfiles;
    }
    
    console.log('🚀 STEPTWO V2 Modern Service Worker loaded with ES modules');
  } catch (error) {
    console.error('❌ Failed to initialize extension:', error);
  }
}

// Start initialization
initializeExtension();

console.log('🚀 STEPTWO V2 Unified Service Worker loaded with proven compatibility');