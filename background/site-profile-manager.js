// site-profile-manager.js - Advanced site profile management system
// Built-in profiles for common photo agencies and custom profile management

class SiteProfileManager {
  constructor(options = {}) {
    this.options = {
      enableRemoteUpdates: options.enableRemoteUpdates !== false,
      updateInterval: options.updateInterval || 86400000, // 24 hours
      enableCustomProfiles: options.enableCustomProfiles !== false,
      enableProfileImport: options.enableProfileImport !== false,
      enableProfileExport: options.enableProfileExport !== false,
      maxCustomProfiles: options.maxCustomProfiles || 100,
      ...options
    };

    this.builtInProfiles = new Map();
    this.customProfiles = new Map();
    this.remoteProfiles = new Map();
    this.activeProfile = null;
    this.lastUpdateCheck = 0;

    this.initializeBuiltInProfiles();
    this.loadCustomProfiles();
  }

  initializeBuiltInProfiles() {
    // Getty Images profile
    this.builtInProfiles.set('getty', {
      id: 'getty',
      name: 'Getty Images',
      domains: ['gettyimages.com', 'gettyimages.co.uk', 'gettyimages.ca'],
      selectors: {
        gallery: '.MosaicAsset-module__container, .gallery-mosaic-asset',
        thumbnail: '.MosaicAsset-module__thumb img, .gallery-asset__thumb img',
        fullSize: 'meta[property="og:image"]',
        title: '.AssetTitle-module__title, .asset-title',
        link: '.MosaicAsset-module__container a, .gallery-mosaic-asset a',
        pagination: '.PaginationRow-module__button--next, .pagination__next'
      },
      patterns: {
        thumbnailUrl: /\/\d+x\d+\//,
        fullSizeUrl: /\/comp\//,
        idExtraction: /id=(\d+)/
      },
      settings: {
        waitTime: 2000,
        maxScrollAttempts: 10,
        useInfiniteScroll: true,
        respectRobots: true
      },
      transformations: {
        thumbnailToFull: (url) => url.replace(/\/\d+x\d+\//, '/comp/'),
        extractId: (url) => {
          const match = url.match(/id=(\d+)/);
          return match ? match[1] : null;
        }
      }
    });

    // Shutterstock profile
    this.builtInProfiles.set('shutterstock', {
      id: 'shutterstock',
      name: 'Shutterstock',
      domains: ['shutterstock.com'],
      selectors: {
        gallery: '[data-automation="AssetGrid-container"] > div',
        thumbnail: 'img[data-automation="asset-thumb"]',
        fullSize: 'meta[property="og:image"]',
        title: '[data-automation="asset-title"]',
        link: 'a[data-automation="asset-link"]',
        pagination: '[data-automation="pagination-next"]'
      },
      patterns: {
        thumbnailUrl: /_thumb_/,
        fullSizeUrl: /_450nothumb_/,
        idExtraction: /image-(\d+)/
      },
      settings: {
        waitTime: 1500,
        maxScrollAttempts: 15,
        useInfiniteScroll: true,
        respectRobots: true
      },
      transformations: {
        thumbnailToFull: (url) => url.replace(/_thumb_/, '_450nothumb_'),
        extractId: (url) => {
          const match = url.match(/image-(\d+)/);
          return match ? match[1] : null;
        }
      }
    });

    // Adobe Stock profile
    this.builtInProfiles.set('adobe-stock', {
      id: 'adobe-stock',
      name: 'Adobe Stock',
      domains: ['stock.adobe.com'],
      selectors: {
        gallery: '[data-testid="SearchResultsGrid"] > div',
        thumbnail: 'img[data-testid="search-result-image"]',
        fullSize: 'meta[property="og:image"]',
        title: '[data-testid="search-result-title"]',
        link: 'a[data-testid="search-result-asset-link"]',
        pagination: '[data-testid="pagination-next-button"]'
      },
      patterns: {
        thumbnailUrl: /_thumb_/,
        fullSizeUrl: /_500_F_/,
        idExtraction: /id\/(\d+)/
      },
      settings: {
        waitTime: 2000,
        maxScrollAttempts: 8,
        useInfiniteScroll: false,
        respectRobots: true
      },
      transformations: {
        thumbnailToFull: (url) => url.replace(/_thumb_/, '_500_F_'),
        extractId: (url) => {
          const match = url.match(/id\/(\d+)/);
          return match ? match[1] : null;
        }
      }
    });

    // Unsplash profile
    this.builtInProfiles.set('unsplash', {
      id: 'unsplash',
      name: 'Unsplash',
      domains: ['unsplash.com'],
      selectors: {
        gallery: '[data-testid="photos-route"] figure',
        thumbnail: 'img[srcset]',
        fullSize: 'img[srcset]',
        title: 'img[alt]',
        link: 'a[title]',
        pagination: 'button[data-testid="load-more-button"]'
      },
      patterns: {
        thumbnailUrl: /w=\d+/,
        fullSizeUrl: /w=1080/,
        idExtraction: /photos\/([^?]+)/
      },
      settings: {
        waitTime: 1000,
        maxScrollAttempts: 20,
        useInfiniteScroll: true,
        respectRobots: false // Public domain
      },
      transformations: {
        thumbnailToFull: (url) => url.replace(/w=\d+/, 'w=1080'),
        extractId: (url) => {
          const match = url.match(/photos\/([^?]+)/);
          return match ? match[1] : null;
        }
      }
    });

    // Pexels profile
    this.builtInProfiles.set('pexels', {
      id: 'pexels',
      name: 'Pexels',
      domains: ['pexels.com'],
      selectors: {
        gallery: '[data-testid="photo"] article',
        thumbnail: 'img[srcset]',
        fullSize: 'img[srcset]',
        title: 'img[alt]',
        link: 'a[data-testid="photo-link"]',
        pagination: '[data-testid="load-more-button"]'
      },
      patterns: {
        thumbnailUrl: /w=\d+&h=\d+/,
        fullSizeUrl: /original/,
        idExtraction: /photo-(\d+)/
      },
      settings: {
        waitTime: 1000,
        maxScrollAttempts: 15,
        useInfiniteScroll: true,
        respectRobots: false // Free to use
      },
      transformations: {
        thumbnailToFull: (url) => {
          // Extract photo ID and build original URL
          const match = url.match(/photo-(\d+)/);
          if (match) {
            return `https://images.pexels.com/photos/${match[1]}/pexels-photo-${match[1]}.jpeg`;
          }
          return url;
        },
        extractId: (url) => {
          const match = url.match(/photo-(\d+)/);
          return match ? match[1] : null;
        }
      }
    });

    // Pixabay profile
    this.builtInProfiles.set('pixabay', {
      id: 'pixabay',
      name: 'Pixabay',
      domains: ['pixabay.com'],
      selectors: {
        gallery: '.item',
        thumbnail: '.item img',
        fullSize: '.item img',
        title: '.item img[alt]',
        link: '.item a',
        pagination: '.pagination a[rel="next"]'
      },
      patterns: {
        thumbnailUrl: /_150\./,
        fullSizeUrl: /_640\./,
        idExtraction: /-(\d+)_/
      },
      settings: {
        waitTime: 1500,
        maxScrollAttempts: 12,
        useInfiniteScroll: false,
        respectRobots: false // Free to use
      },
      transformations: {
        thumbnailToFull: (url) => url.replace(/_150\./, '_640.'),
        extractId: (url) => {
          const match = url.match(/-(\d+)_/);
          return match ? match[1] : null;
        }
      }
    });

    console.log(`📁 Initialized ${this.builtInProfiles.size} built-in site profiles`);
  }

  async loadCustomProfiles() {
    try {
      const stored = await chrome.storage.local.get('customSiteProfiles');
      if (stored.customSiteProfiles) {
        for (const [id, profile] of Object.entries(stored.customSiteProfiles)) {
          this.customProfiles.set(id, profile);
        }
        console.log(`📁 Loaded ${this.customProfiles.size} custom site profiles`);
      }
    } catch (error) {
      console.error('Failed to load custom profiles:', error);
    }
  }

  async saveCustomProfiles() {
    try {
      const profilesObj = {};
      for (const [id, profile] of this.customProfiles) {
        profilesObj[id] = profile;
      }
      await chrome.storage.local.set({ customSiteProfiles: profilesObj });
      console.log('💾 Custom profiles saved');
    } catch (error) {
      console.error('Failed to save custom profiles:', error);
      throw error;
    }
  }

  detectSiteProfile(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // Check built-in profiles first
      for (const profile of this.builtInProfiles.values()) {
        if (profile.domains.some(d => domain.includes(d))) {
          console.log(`🔍 Detected site profile: ${profile.name} for ${domain}`);
          return profile;
        }
      }

      // Check custom profiles
      for (const profile of this.customProfiles.values()) {
        if (profile.domains?.some(d => domain.includes(d))) {
          console.log(`🔍 Detected custom profile: ${profile.name} for ${domain}`);
          return profile;
        }
      }

      // Check remote profiles
      for (const profile of this.remoteProfiles.values()) {
        if (profile.domains?.some(d => domain.includes(d))) {
          console.log(`🔍 Detected remote profile: ${profile.name} for ${domain}`);
          return profile;
        }
      }

      console.log(`❓ No site profile found for ${domain}`);
      return null;
    } catch (error) {
      console.warn('Error detecting site profile:', error);
      return null;
    }
  }

  async createCustomProfile(profileData) {
    try {
      const profile = {
        id: profileData.id || this.generateProfileId(),
        name: profileData.name,
        domains: profileData.domains || [],
        selectors: profileData.selectors || {},
        patterns: profileData.patterns || {},
        settings: {
          waitTime: 2000,
          maxScrollAttempts: 10,
          useInfiniteScroll: false,
          respectRobots: true,
          ...profileData.settings
        },
        transformations: profileData.transformations || {},
        custom: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Validate profile
      this.validateProfile(profile);

      this.customProfiles.set(profile.id, profile);
      await this.saveCustomProfiles();

      console.log(`✅ Created custom profile: ${profile.name}`);
      return profile;
    } catch (error) {
      console.error('Failed to create custom profile:', error);
      throw error;
    }
  }

  async updateCustomProfile(profileId, updates) {
    try {
      const profile = this.customProfiles.get(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const updatedProfile = {
        ...profile,
        ...updates,
        id: profileId, // Prevent ID changes
        custom: true,
        updatedAt: Date.now()
      };

      this.validateProfile(updatedProfile);

      this.customProfiles.set(profileId, updatedProfile);
      await this.saveCustomProfiles();

      console.log(`✅ Updated custom profile: ${updatedProfile.name}`);
      return updatedProfile;
    } catch (error) {
      console.error('Failed to update custom profile:', error);
      throw error;
    }
  }

  async deleteCustomProfile(profileId) {
    try {
      const profile = this.customProfiles.get(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      this.customProfiles.delete(profileId);
      await this.saveCustomProfiles();

      console.log(`🗑️ Deleted custom profile: ${profile.name}`);
      return true;
    } catch (error) {
      console.error('Failed to delete custom profile:', error);
      throw error;
    }
  }

  validateProfile(profile) {
    if (!profile.name || typeof profile.name !== 'string') {
      throw new Error('Profile name is required');
    }
    
    if (!profile.domains || !Array.isArray(profile.domains) || profile.domains.length === 0) {
      throw new Error('At least one domain is required');
    }

    if (!profile.selectors || typeof profile.selectors !== 'object') {
      throw new Error('Selectors object is required');
    }

    // Validate required selectors
    const requiredSelectors = ['gallery', 'thumbnail'];
    for (const selector of requiredSelectors) {
      if (!profile.selectors[selector]) {
        throw new Error(`Required selector '${selector}' is missing`);
      }
    }

    // Validate domains
    for (const domain of profile.domains) {
      if (typeof domain !== 'string' || domain.trim().length === 0) {
        throw new Error('Invalid domain format');
      }
    }
  }

  async testProfile(profileId, testUrl) {
    try {
      const profile = this.getProfile(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Create a test tab
      const tab = await chrome.tabs.create({
        url: testUrl,
        active: false
      });

      // Wait for page load
      await this.waitForTabLoad(tab.id);

      // Inject test script
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.testProfileSelectors,
        args: [profile]
      });

      // Close test tab
      await chrome.tabs.remove(tab.id);

      return result[0]?.result || { success: false };
    } catch (error) {
      console.error('Profile test failed:', error);
      return { success: false, error: error.message };
    }
  }

  testProfileSelectors(profile) {
    const results = {
      success: false,
      selectors: {},
      itemCount: 0,
      errors: []
    };

    try {
      // Test gallery selector
      const galleryElements = document.querySelectorAll(profile.selectors.gallery);
      results.selectors.gallery = {
        found: galleryElements.length > 0,
        count: galleryElements.length
      };

      if (galleryElements.length === 0) {
        results.errors.push('No gallery elements found');
      }

      // Test thumbnail selector within gallery
      let thumbnailCount = 0;
      galleryElements.forEach(gallery => {
        const thumbnails = gallery.querySelectorAll(profile.selectors.thumbnail);
        thumbnailCount += thumbnails.length;
      });

      results.selectors.thumbnail = {
        found: thumbnailCount > 0,
        count: thumbnailCount
      };

      if (thumbnailCount === 0) {
        results.errors.push('No thumbnail elements found');
      }

      results.itemCount = thumbnailCount;
      results.success = galleryElements.length > 0 && thumbnailCount > 0;

      // Test other selectors if they exist
      if (profile.selectors.title) {
        const titleElements = document.querySelectorAll(profile.selectors.title);
        results.selectors.title = {
          found: titleElements.length > 0,
          count: titleElements.length
        };
      }

      if (profile.selectors.link) {
        const linkElements = document.querySelectorAll(profile.selectors.link);
        results.selectors.link = {
          found: linkElements.length > 0,
          count: linkElements.length
        };
      }

    } catch (error) {
      results.errors.push(error.message);
    }

    return results;
  }

  async waitForTabLoad(tabId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTab = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Tab load timeout'));
          return;
        }

        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (tab.status === 'complete') {
            resolve(tab);
          } else {
            setTimeout(checkTab, 500);
          }
        });
      };

      checkTab();
    });
  }

  getProfile(profileId) {
    return this.builtInProfiles.get(profileId) || 
           this.customProfiles.get(profileId) || 
           this.remoteProfiles.get(profileId);
  }

  getAllProfiles() {
    const profiles = [];
    
    // Add built-in profiles
    for (const profile of this.builtInProfiles.values()) {
      profiles.push({ ...profile, type: 'built-in' });
    }
    
    // Add custom profiles
    for (const profile of this.customProfiles.values()) {
      profiles.push({ ...profile, type: 'custom' });
    }
    
    // Add remote profiles
    for (const profile of this.remoteProfiles.values()) {
      profiles.push({ ...profile, type: 'remote' });
    }
    
    return profiles;
  }

  async exportProfiles(profileIds = null) {
    try {
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        profiles: []
      };

      const idsToExport = profileIds || Array.from(this.customProfiles.keys());
      
      for (const id of idsToExport) {
        const profile = this.customProfiles.get(id);
        if (profile) {
          exportData.profiles.push(profile);
        }
      }

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export profiles:', error);
      throw error;
    }
  }

  async importProfiles(jsonData, options = {}) {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.profiles || !Array.isArray(importData.profiles)) {
        throw new Error('Invalid import format');
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: []
      };

      for (const profileData of importData.profiles) {
        try {
          // Generate new ID if conflict
          let profileId = profileData.id;
          if (this.customProfiles.has(profileId) && !options.overwrite) {
            profileId = this.generateProfileId();
          }

          await this.createCustomProfile({
            ...profileData,
            id: profileId
          });

          results.imported++;
        } catch (error) {
          results.errors.push(`Failed to import ${profileData.name}: ${error.message}`);
          results.skipped++;
        }
      }

      console.log(`📥 Import completed: ${results.imported} imported, ${results.skipped} skipped`);
      return results;
    } catch (error) {
      console.error('Failed to import profiles:', error);
      throw error;
    }
  }

  generateProfileId() {
    return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get profile statistics
  getStats() {
    return {
      builtIn: this.builtInProfiles.size,
      custom: this.customProfiles.size,
      remote: this.remoteProfiles.size,
      total: this.builtInProfiles.size + this.customProfiles.size + this.remoteProfiles.size,
      lastUpdate: this.lastUpdateCheck
    };
  }
}

// Export for use in service worker (importScripts compatible)
if (typeof self !== 'undefined') {
  self.SiteProfileManager = SiteProfileManager;
} else if (typeof window !== 'undefined') {
  window.SiteProfileManager = SiteProfileManager;
}