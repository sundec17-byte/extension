// popup.js - StepTwo Gallery Scraper Popup Interface
// Enhanced popup with modern UI patterns and quick access functionality

class StepTwoPopup {
  constructor() {
    this.currentTab = null;
    this.galleryData = {
      itemCount: 0,
      pageStatus: 'ready',
      lastScan: null,
      isScanning: false
    };
        
    this.settings = {
      autoDetect: true,
      downloadImages: true,
      smartFilter: true
    };

    this.init();
  }

  async init() {
    try {
      // Get current tab information
      await this.getCurrentTab();
            
      // Initialize UI
      this.initializeUI();
            
      // Load settings
      await this.loadSettings();
            
      // Check page status
      await this.checkPageStatus();
            
      // Set up event listeners
      this.setupEventListeners();
            
      // Start periodic updates
      this.startStatusUpdates();
            
    } catch (error) {
      console.error('Popup initialization error:', error);
      this.handleError(error, 'popup-init');
    }
  }

  handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    // Fallback error handling for popup context
    const pageStatus = document.getElementById('pageStatus');
    if (pageStatus) {
      pageStatus.textContent = 'Error occurred';
    }
  }

  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0];
            
      // Update page info in UI
      this.updatePageInfo();
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  updatePageInfo() {
    if (!this.currentTab) {return;}

    const pageTitle = document.getElementById('pageTitle');
    const pageUrl = document.getElementById('pageUrl');
        
    if (pageTitle) {pageTitle.textContent = this.currentTab.title || 'Unknown Page';}
    if (pageUrl) {pageUrl.textContent = this.currentTab.url || '';}
  }

  initializeUI() {
    // Set initial status
    this.updateStatusPanel();
        
    // Initialize toggle switches
    this.updateToggleSwitches();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get([
        'autoDetectGalleries',
        'downloadImages', 
        'smartFiltering'
      ]);
            
      this.settings.autoDetect = result.autoDetectGalleries !== false;
      this.settings.downloadImages = result.downloadImages !== false;
      this.settings.smartFilter = result.smartFiltering !== false;
            
      this.updateToggleSwitches();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({
        autoDetectGalleries: this.settings.autoDetect,
        downloadImages: this.settings.downloadImages,
        smartFiltering: this.settings.smartFilter
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  updateToggleSwitches() {
    const toggles = {
      autoDetectToggle: this.settings.autoDetect,
      downloadToggle: this.settings.downloadImages,
      smartFilterToggle: this.settings.smartFilter
    };

    Object.entries(toggles).forEach(([id, active]) => {
      const toggle = document.getElementById(id);
      if (toggle) {
        toggle.classList.toggle('active', active);
      }
    });
  }

  updateStatusPanel() {
    const itemCount = document.getElementById('itemCount');
    const pageStatus = document.getElementById('pageStatus');
    const lastScan = document.getElementById('lastScan');
        
    if (itemCount) {itemCount.textContent = this.galleryData.itemCount;}
    if (pageStatus) {pageStatus.textContent = this.galleryData.pageStatus;}
    if (lastScan) {
      lastScan.textContent = this.galleryData.lastScan 
        ? new Date(this.galleryData.lastScan).toLocaleTimeString()
        : 'Never';
    }
  }

  async checkPageStatus() {
    if (!this.currentTab) {return;}

    try {
      // Send message to content script to check page status
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getPageStatus'
      });

      if (response) {
        this.galleryData.itemCount = response.itemCount || 0;
        this.galleryData.pageStatus = response.pageStatus || 'ready';
        this.updateStatusPanel();
      }
    } catch (error) {
      // Content script might not be injected yet
      this.galleryData.pageStatus = 'Ready to scan';
      this.updateStatusPanel();
    }
  }

  setupEventListeners() {
    // Quick scan button
    const quickScanBtn = document.getElementById('quickScanBtn');
    if (quickScanBtn) {
      quickScanBtn.addEventListener('click', () => this.performQuickScan());
    }

    // Dashboard button
    const dashboardBtn = document.getElementById('openDashboardBtn');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => this.openDashboard());
    }

    // Selector mode button
    const selectorBtn = document.getElementById('enableSelectorBtn');
    if (selectorBtn) {
      selectorBtn.addEventListener('click', () => this.enableSelectorMode());
    }

    // Toggle switches
    const toggles = ['autoDetectToggle', 'downloadToggle', 'smartFilterToggle'];
    toggles.forEach(toggleId => {
      const toggle = document.getElementById(toggleId);
      if (toggle) {
        toggle.addEventListener('click', () => this.handleToggleClick(toggleId));
      }
    });

    // Footer links
    const optionsLink = document.getElementById('optionsLink');
    if (optionsLink) {
      optionsLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openOptions();
      });
    }

    const helpLink = document.getElementById('helpLink');
    if (helpLink) {
      helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openHelp();
      });
    }

    const aboutLink = document.getElementById('aboutLink');
    if (aboutLink) {
      aboutLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showAbout();
      });
    }
  }

  async performQuickScan() {
    if (!this.currentTab || this.galleryData.isScanning) {return;}

    try {
      this.galleryData.isScanning = true;
      this.galleryData.pageStatus = 'Scanning...';
      this.updateStatusPanel();
      this.showProgress(true);

      // Update button state
      const quickScanBtn = document.getElementById('quickScanBtn');
      if (quickScanBtn) {
        // Clear existing content safely
        quickScanBtn.textContent = '';
        // Create icon span
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon';
        iconSpan.textContent = '🔍';
        // Append icon and text
        quickScanBtn.appendChild(iconSpan);
        quickScanBtn.appendChild(document.createTextNode('Scanning...'));
        quickScanBtn.disabled = true;
      }

      // Check if content script is available
      let response;
      try {
        response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'quickScan',
          settings: this.settings
        });
      } catch (error) {
        // Inject content script if not available
        try {
          await chrome.scripting.executeScript({
            target: { tabId: this.currentTab.id },
            files: ['content/injector.js']
          });
                    
          // Wait a bit for injection
          await new Promise(resolve => setTimeout(resolve, 1000));
                    
          response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'quickScan',
            settings: this.settings
          });
        } catch (injectionError) {
          throw new Error('Could not inject content script');
        }
      }

      if (response && response.success) {
        this.galleryData.itemCount = response.itemCount || 0;
        this.galleryData.pageStatus = `Found ${response.itemCount || 0} items`;
        this.galleryData.lastScan = Date.now();
      } else {
        this.galleryData.pageStatus = 'Scan completed';
        this.galleryData.itemCount = response?.itemCount || 0;
        this.galleryData.lastScan = Date.now();
      }

    } catch (error) {
      console.error('Quick scan failed:', error);
      this.galleryData.pageStatus = 'Scan failed';
      this.handleError(error, 'popup-quick-scan');
    } finally {
      this.galleryData.isScanning = false;
      this.updateStatusPanel();
      this.showProgress(false);

      // Reset button
      const quickScanBtn = document.getElementById('quickScanBtn');
      if (quickScanBtn) {
        // Clear existing content safely
        quickScanBtn.textContent = '';
        // Create icon span
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon';
        iconSpan.textContent = '🔍';
        // Append icon and text
        quickScanBtn.appendChild(iconSpan);
        quickScanBtn.appendChild(document.createTextNode('Quick Scan Current Page'));
        quickScanBtn.disabled = false;
      }
    }
  }

  async openDashboard() {
    try {
      // Check if dashboard is already open
      const existingWindows = await chrome.windows.getAll({ populate: true });
      const dashboardWindow = existingWindows.find(window => 
        window.tabs.some(tab => tab.url && tab.url.includes('windowed-dashboard.html'))
      );

      if (dashboardWindow) {
        // Focus existing dashboard and update it with current tab info
        await chrome.windows.update(dashboardWindow.id, { focused: true });
        
        // Send tab information to existing dashboard via runtime messaging
        if (this.currentTab) {
          try {
            await chrome.runtime.sendMessage({
              action: 'updateSourceTab',
              tabInfo: {
                id: this.currentTab.id,
                url: this.currentTab.url,
                title: this.currentTab.title
              }
            });
          } catch (msgError) {
            console.warn('Could not send message to existing dashboard:', msgError);
          }
        }
      } else {
        // Prepare dashboard URL with source tab information
        let dashboardUrl = 'ui/windowed-dashboard.html';
        
        if (this.currentTab) {
          // Add source tab information as URL parameters
          const params = new URLSearchParams({
            sourceTabId: this.currentTab.id.toString(),
            sourceTabUrl: this.currentTab.url,
            sourceTabTitle: this.currentTab.title || 'Unknown Page'
          });
          dashboardUrl += '?' + params.toString();
        }

        // Open new dashboard with source tab information
        await chrome.windows.create({
          url: dashboardUrl,
          type: 'popup',
          width: 1200,
          height: 800,
          focused: true
        });
      }

      // Close popup after opening dashboard
      window.close();
    } catch (error) {
      console.error('Failed to open dashboard:', error);
      this.handleError(error, 'popup-open-dashboard');
    }
  }

  async enableSelectorMode() {
    if (!this.currentTab) {return;}

    try {
      // First ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: this.currentTab.id },
          files: ['content/injector.js']
        });
        
        // Wait for injection to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectionError) {
        console.warn('Content script may already be injected:', injectionError);
      }

      // Send message to enable selector mode
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'enableSelectorMode'
      });
      
      if (response && response.success) {
        console.log('✅ Selector mode enabled successfully');
      }
      // Close popup to allow selector interaction
      window.close();
    } catch (error) {
      console.error('Failed to enable selector mode:', error);
      this.handleError(error, 'popup-selector-mode');
    }
  }

  handleToggleClick(toggleId) {
    const toggle = document.getElementById(toggleId);
    if (!toggle) {return;}

    const isActive = toggle.classList.contains('active');
    toggle.classList.toggle('active', !isActive);

    // Update settings
    switch (toggleId) {
      case 'autoDetectToggle':
        this.settings.autoDetect = !isActive;
        break;
      case 'downloadToggle':
        this.settings.downloadImages = !isActive;
        break;
      case 'smartFilterToggle':
        this.settings.smartFilter = !isActive;
        break;
    }

    // Save settings
    this.saveSettings();
  }

  showProgress(show) {
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
      progressContainer.style.display = show ? 'block' : 'none';
    }

    if (show) {
      // Animate progress bar
      const progressFill = document.getElementById('progressFill');
      if (progressFill) {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 10;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
          }
          progressFill.style.width = `${progress}%`;
        }, 100);
      }
    }
  }

  async openOptions() {
    try {
      await chrome.runtime.openOptionsPage();
      window.close();
    } catch (error) {
      console.error('Failed to open options:', error);
      // Fallback: open dashboard
      this.openDashboard();
    }
  }

  openHelp() {
    chrome.tabs.create({
      url: 'https://github.com/johnsonskyrme-sys/steptwo#readme'
    });
  }

  showAbout() {
    // Simple about alert for now
    alert(`StepTwo Gallery Scraper v2.0

Professional Web Scraper with bulk download capabilities

Features:
• Smart gallery detection
• Pattern recognition
• Bulk downloads
• Professional export formats
• Memory optimization

© 2024 StepTwo Team`);
  }

  startStatusUpdates() {
    // Update status every 10 seconds
    setInterval(() => {
      if (!this.galleryData.isScanning) {
        this.checkPageStatus();
      }
    }, 10000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StepTwoPopup();
});