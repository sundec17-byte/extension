// background-utilities.js - Consolidated utility functions for STEPTWO V2 background scripts
// Combines utils.js, filename-mask.js, and keyboard-shortcuts.js to reduce file count

// =============================================================================
// COMMON UTILITIES (from utils.js)
// =============================================================================

class StepTwoUtils {
  // URL validation and parsing
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  static getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }
  
  static getFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.split('.').pop().toLowerCase();
      return ext && ext.length <= 4 ? ext : '';
    } catch {
      return '';
    }
  }
  
  // Image validation
  static isImageUrl(url) {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
    const ext = this.getFileExtension(url);
    return imageExts.includes(ext);
  }
  
  static isValidImageSize(width, height, minWidth = 0, minHeight = 0) {
    return width >= minWidth && height >= minHeight;
  }
  
  // Filter utilities
  static createDefaultFilters() {
    return {
      minWidth: 0,
      minHeight: 0,
      maxSize: 0, // 0 means no limit
      allowedTypes: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
      skipDuplicates: false,
      maxResults: 1000
    };
  }
  
  // Version comparison utility
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) {return -1;}
      if (part1 > part2) {return 1;}
    }
    
    return 0;
  }
}

// =============================================================================
// FILENAME MASK UTILITIES (from filename-mask.js)
// =============================================================================

let globalCounter = 0;
let siteCounters = {};
let sessionCounters = {};

function sanitizeFilename(name) {
  // Remove or replace invalid characters for file names
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.$/, '_')  // Remove trailing dot
    .slice(0, 255);       // Limit length
}

function extractDomain(host) {
  if (!host) {return '';}
  return host.split('.').slice(-2).join('.');
}

function parseSubdirs(url) {
  try {
    const pathname = new URL(url).pathname;
    const dirs = pathname.split('/').filter(Boolean);
    return dirs.slice(0, -1).join('_'); // Exclude filename
  } catch {
    return '';
  }
}

function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      path: urlObj.pathname,
      query: urlObj.search.slice(1), // Remove '?'
      hash: urlObj.hash.slice(1)     // Remove '#'
    };
  } catch {
    return { path: '', query: '', hash: '' };
  }
}

function applyMask(mask, ctx) {
  if (!mask) {return ctx.name + (ctx.ext ? `.${ctx.ext}` : '');}
  
  const now = new Date();
  const dateStr = now.toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  const timeStr = now.toTimeString().slice(0,8).replace(/:/g,''); // HHMMSS
  const timestamp = now.getTime().toString();
  
  // Get appropriate counter
  const siteKey = ctx.host || 'global';
  if (!siteCounters[siteKey]) {siteCounters[siteKey] = 0;}
  if (!sessionCounters[siteKey]) {sessionCounters[siteKey] = 0;}
  
  const counter = ctx.num || ++siteCounters[siteKey];
  const sessionCounter = ++sessionCounters[siteKey];
  globalCounter = Math.max(globalCounter, counter);
  
  let out = mask;
  const replace = (token, value) => { 
    out = out.replace(new RegExp(`\\*${token}\\*`,'gi'), sanitizeFilename(String(value || '')));
  };
  
  // Core tokens
  replace('name', ctx.name || 'untitled');
  replace('num', String(counter).padStart(3,'0'));
  replace('ext', ctx.ext || '');
  replace('date', dateStr);
  replace('time', timeStr);
  replace('timestamp', timestamp);
  replace('host', ctx.host || '');
  replace('domain', extractDomain(ctx.host || ctx.url || ''));
  replace('subdirs', parseSubdirs(ctx.subdirs || ctx.url || ''));
  
  // Enhanced URL parsing tokens
  if (ctx.url) {
    const urlParts = parseUrl(ctx.url);
    replace('url', ctx.url);
    replace('path', urlParts.path);
    replace('query', urlParts.query);
    replace('hash', urlParts.hash);
  } else {
    replace('url', '');
    replace('path', '');
    replace('query', '');
    replace('hash', '');
  }
  
  // Additional context tokens
  replace('caption', ctx.caption || '');
  replace('id', ctx.id || '');
  replace('resolution', ctx.resolution || '');
  replace('size', ctx.size || '');
  replace('type', ctx.type || '');
  replace('index', ctx.index || counter);
  replace('session', sessionCounter);
  replace('global', globalCounter);
  
  return out;
}

function resetCounters() {
  globalCounter = 0;
  siteCounters = {};
  sessionCounters = {};
}

function getCounterStats() {
  return {
    global: globalCounter,
    sites: Object.keys(siteCounters).length,
    session: Object.keys(sessionCounters).length
  };
}

// =============================================================================
// KEYBOARD SHORTCUTS (from keyboard-shortcuts.js)
// =============================================================================

class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.setupShortcuts();
  }

  setupShortcuts() {
    // Register available commands
    this.shortcuts.set('start-scraper', {
      action: 'startScraper',
      description: 'Start gallery scraper'
    });
    
    this.shortcuts.set('toggle-selector', {
      action: 'toggleSelector',
      description: 'Toggle selector mode'
    });
    
    this.shortcuts.set('open-dashboard', {
      action: 'openDashboard',
      description: 'Open dashboard'
    });

    console.log('Keyboard shortcuts initialized:', Array.from(this.shortcuts.keys()));
  }

  async handleCommand(command, tab) {
    try {
      console.log('Keyboard shortcut triggered:', command);

      const shortcut = this.shortcuts.get(command);
      if (!shortcut) {
        console.warn('Unknown keyboard shortcut:', command);
        return;
      }

      switch (shortcut.action) {
        case 'startScraper':
          await this.handleStartScraper(tab);
          break;
          
        case 'toggleSelector':
          await this.handleToggleSelector(tab);
          break;
          
        case 'openDashboard':
          await this.handleOpenDashboard(tab);
          break;
          
        default:
          console.warn('Unhandled shortcut action:', shortcut.action);
      }
    } catch (error) {
      console.error('Error handling keyboard shortcut:', error);
    }
  }

  async handleStartScraper(_tab) {
    try {
      // Inject scraper and start scraping
      await chrome.tabs.sendMessage(_tab.id, {
        action: 'startScraping',
        source: 'keyboard_shortcut'
      });
      
      // Show notification
      chrome.notifications.create('scraper-started', {
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'STEPTWO V2',
        message: 'Scraper started via keyboard shortcut'
      });
    } catch (error) {
      console.error('Error starting scraper via shortcut:', error);
    }
  }

  async handleToggleSelector(tab) {
    try {
      // Toggle element selector mode
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleSelector',
        source: 'keyboard_shortcut'
      });
    } catch (error) {
      console.error('Error toggling selector via shortcut:', error);
    }
  }

  async handleOpenDashboard(tab) {
    try {
      // Open dashboard in new tab
      await chrome.tabs.create({
        url: chrome.runtime.getURL('ui/windowed-dashboard.html'),
        active: true
      });
    } catch (error) {
      console.error('Error opening dashboard via shortcut:', error);
    }
  }

  // Get all registered shortcuts
  getShortcuts() {
    return Array.from(this.shortcuts.entries()).map(([command, data]) => ({
      command,
      action: data.action,
      description: data.description
    }));
  }
}

// =============================================================================
// CONTEXT MENU MANAGER (from context-menu-manager.js)
// =============================================================================

class ContextMenuManager {
  constructor() {
    this.menuItems = new Map();
    this.isInitialized = false;
    this.setupContextMenus();
  }

  async setupContextMenus() {
    try {
      // Remove existing menus first
      await chrome.contextMenus.removeAll();
      
      // Main menu items
      const menuItems = [
        {
          id: 'steptwo-scan-page',
          title: 'Scan page for images',
          contexts: ['page'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'steptwo-separator-1',
          type: 'separator',
          contexts: ['page']
        },
        {
          id: 'steptwo-add-image',
          title: 'Add to queue',
          contexts: ['image'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'steptwo-add-all-images',
          title: 'Add all images',
          contexts: ['page'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'steptwo-separator-2',
          type: 'separator',
          contexts: ['page', 'image']
        },
        {
          id: 'steptwo-open-dashboard',
          title: 'Open dashboard',
          contexts: ['page', 'image'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'steptwo-separator-3',
          type: 'separator',
          contexts: ['page', 'image']
        },
        {
          id: 'steptwo-options',
          title: 'Options',
          contexts: ['page', 'image'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        }
      ];

      // Create menu items
      for (const item of menuItems) {
        await this.createMenuItem(item);
      }

      // Set up click handler
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleMenuClick(info, tab);
      });

      this.isInitialized = true;
      console.log('✅ Context menus initialized');
    } catch (error) {
      console.error('❌ Failed to setup context menus:', error);
    }
  }

  async createMenuItem(item) {
    try {
      chrome.contextMenus.create(item);
      this.menuItems.set(item.id, item);
    } catch (error) {
      console.error(`Failed to create menu item ${item.id}:`, error);
    }
  }

  async handleMenuClick(info, tab) {
    try {
      console.log('Context menu clicked:', info.menuItemId, info);

      switch (info.menuItemId) {
        case 'steptwo-scan-page':
          await this.handleScanPage(tab);
          break;

        case 'steptwo-add-image':
          await this.handleAddImage(info, tab);
          break;

        case 'steptwo-add-all-images':
          await this.handleAddAllImages(tab);
          break;

        case 'steptwo-open-dashboard':
          await this.handleOpenDashboard();
          break;

        case 'steptwo-options':
          await this.handleOpenOptions();
          break;

        default:
          console.warn('Unknown context menu item:', info.menuItemId);
      }
    } catch (error) {
      console.error('Context menu action failed:', error);
    }
  }

  async handleScanPage(tab) {
    try {
      // Inject content script and start scanning
      await chrome.tabs.sendMessage(tab.id, {
        action: 'startScraping',
        source: 'context_menu'
      });

      // Show notification
      chrome.notifications.create('scan-started', {
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'STEPTWO V2',
        message: 'Page scanning started'
      });
    } catch (error) {
      console.error('Failed to scan page:', error);
    }
  }

  async handleAddImage(info, tab) {
    try {
      if (info.srcUrl) {
        // Add single image to queue
        await chrome.tabs.sendMessage(tab.id, {
          action: 'addImageToQueue',
          imageUrl: info.srcUrl,
          source: 'context_menu'
        });

        chrome.notifications.create('image-added', {
          type: 'basic',
          iconUrl: 'icons/48.png',
          title: 'STEPTWO V2',
          message: 'Image added to queue'
        });
      }
    } catch (error) {
      console.error('Failed to add image:', error);
    }
  }

  async handleAddAllImages(tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'addAllImages',
        source: 'context_menu'
      });

      chrome.notifications.create('all-images-added', {
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'STEPTWO V2',
        message: 'All images added to queue'
      });
    } catch (error) {
      console.error('Failed to add all images:', error);
    }
  }

  async handleOpenDashboard() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('ui/windowed-dashboard.html'),
        active: true
      });
    } catch (error) {
      console.error('Failed to open dashboard:', error);
    }
  }

  async handleOpenOptions() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('ui/options.html'),
        active: true
      });
    } catch (error) {
      console.error('Failed to open options:', error);
    }
  }

  getMenuItems() {
    return Array.from(this.menuItems.values());
  }

  isReady() {
    return this.isInitialized;
  }
}

// =============================================================================
// UPDATED EXPORTS FOR BOTH ES MODULES AND IMPORTSCRIPTS
// =============================================================================

// Support both ES modules and legacy importScripts
if (typeof self !== 'undefined') {
  // Service Worker/importScripts environment
  self.StepTwoUtils = StepTwoUtils;
  self.applyMask = applyMask;
  self.resetCounters = resetCounters;
  self.getCounterStats = getCounterStats;
  self.KeyboardShortcuts = KeyboardShortcuts;
  self.ContextMenuManager = ContextMenuManager;
}

// ES modules export (commented out for importScripts compatibility)
// export { StepTwoUtils, applyMask, resetCounters, getCounterStats, KeyboardShortcuts };