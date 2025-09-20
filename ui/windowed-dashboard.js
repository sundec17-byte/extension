// windowed-dashboard.js - Enhanced dashboard with unified workflow
// Fixed: Consolidated UI flow and improved smart selector integration

class StepTwoDashboard {
  constructor() {
    this.currentTab = 'dashboard';
    this.sourceTab = null;
    this.isConnected = false;
    this.smartSelectorActive = false;
    this.scrapingActive = false;
    
    // Dashboard state
    this.stats = {
      totalItems: 0,
      completedItems: 0,
      duplicates: 0,
      progressPercent: 0,
      downloadRate: 0,
      queueSize: 0,
      errorCount: 0,
      estimatedTime: '--'
    };
    
    this.activityLog = [];
    this.queueItems = [];
    this.settings = {
      concurrency: 3,
      retryAttempts: 2,
      downloadDelay: 100,
      minWidth: 100,
      minHeight: 100,
      skipDuplicates: true,
      formats: { jpeg: true, png: true, webp: true, gif: true },
      downloadFolder: '',
      filenameMask: '*name* - *num*.*ext*',
      autoSiteProfiles: true
    };

    this.init();
  }

  async init() {
    try {
      // Get source tab information from URL parameters
      this.parseUrlParameters();
      
      // Initialize UI
      this.initializeUI();
      
      // Load settings
      await this.loadSettings();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Check connection status
      await this.checkConnection();
      
      // Start periodic updates
      this.startPeriodicUpdates();
      
      this.logActivity('Dashboard initialized successfully');
      
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      this.logActivity(`Error: ${error.message}`, 'error');
    }
  }

  parseUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('sourceTabId')) {
      this.sourceTab = {
        id: parseInt(urlParams.get('sourceTabId')),
        url: urlParams.get('sourceTabUrl'),
        title: urlParams.get('sourceTabTitle')
      };
      
      console.log('📋 Source tab information loaded:', this.sourceTab);
      this.updateActiveTabInfo();
    }
  }

  updateActiveTabInfo() {
    const activeTabInfo = document.getElementById('activeTabInfo');
    if (activeTabInfo && this.sourceTab) {
      activeTabInfo.textContent = `Connected to: ${this.sourceTab.title || 'Unknown Page'}`;
    }
  }

  initializeUI() {
    // Initialize tab switching
    this.setupTabSwitching();
    
    // Initialize smart selector panel
    this.initializeSmartSelectorPanel();
    
    // Update initial stats
    this.updateStatsDisplay();
    
    // Check for self-scraping warning
    this.checkSelfScrapingWarning();
  }

  setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        
        // Update active tab
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update active content
        tabContents.forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(targetTab);
        if (targetContent) {
          targetContent.classList.add('active');
        }
        
        this.currentTab = targetTab;
        this.logActivity(`Switched to ${targetTab} tab`);
      });
    });
  }

  initializeSmartSelectorPanel() {
    const startButton = document.getElementById('startSmartPicker');
    const stopButton = document.getElementById('stopSmartPicker');
    const statusDiv = document.getElementById('smartSelectionStatus');
    const resultsDiv = document.getElementById('smartSelectionResults');

    if (startButton) {
      startButton.addEventListener('click', () => this.startSmartSelector());
    }
    
    if (stopButton) {
      stopButton.addEventListener('click', () => this.stopSmartSelector());
    }

    // Listen for selector picked messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SELECTOR_PICKED' && message.data) {
        this.handleSelectorPicked(message.data);
        sendResponse({ received: true });
      }
    });
  }

  async startSmartSelector() {
    if (!this.sourceTab) {
      this.logActivity('Error: No source tab connected', 'error');
      return;
    }

    try {
      this.smartSelectorActive = true;
      this.updateSmartSelectorUI('active');
      
      // Send message to content script to start picker
      await chrome.tabs.sendMessage(this.sourceTab.id, {
        action: 'enableSelectorMode'
      });
      
      this.logActivity('Smart selector mode activated - click any gallery item');
      
    } catch (error) {
      console.error('Failed to start smart selector:', error);
      this.logActivity(`Smart selector error: ${error.message}`, 'error');
      this.smartSelectorActive = false;
      this.updateSmartSelectorUI('inactive');
    }
  }

  async stopSmartSelector() {
    if (!this.sourceTab) return;

    try {
      await chrome.tabs.sendMessage(this.sourceTab.id, {
        action: 'disableSelectorMode'
      });
      
      this.smartSelectorActive = false;
      this.updateSmartSelectorUI('inactive');
      this.logActivity('Smart selector mode deactivated');
      
    } catch (error) {
      console.error('Failed to stop smart selector:', error);
    }
  }

  updateSmartSelectorUI(state) {
    const startButton = document.getElementById('startSmartPicker');
    const stopButton = document.getElementById('stopSmartPicker');
    const statusDiv = document.getElementById('smartSelectionStatus');
    const resultsDiv = document.getElementById('smartSelectionResults');

    if (state === 'active') {
      if (startButton) startButton.disabled = true;
      if (stopButton) stopButton.disabled = false;
      if (statusDiv) statusDiv.style.display = 'block';
      if (resultsDiv) resultsDiv.style.display = 'none';
    } else {
      if (startButton) startButton.disabled = false;
      if (stopButton) stopButton.disabled = true;
      if (statusDiv) statusDiv.style.display = 'none';
    }
  }

  handleSelectorPicked(data) {
    console.log('🎯 Selector picked:', data);
    
    this.smartSelectorActive = false;
    this.updateSmartSelectorUI('inactive');
    
    // Update results UI
    const resultsDiv = document.getElementById('smartSelectionResults');
    const elementCount = document.getElementById('smartElementCount');
    const generatedSelector = document.getElementById('smartGeneratedSelector');
    const selectorInfo = document.getElementById('smartSelectorInfo');
    const useButton = document.getElementById('useSmartSelector');

    if (resultsDiv) resultsDiv.style.display = 'block';
    if (elementCount) elementCount.textContent = `${data.elementCount} elements found`;
    if (generatedSelector) generatedSelector.value = data.selector || '';
    if (selectorInfo) selectorInfo.textContent = `Found ${data.elementCount} similar elements`;
    
    // Also update manual selector field
    const containerSelector = document.getElementById('containerSelector');
    if (containerSelector) {
      containerSelector.value = data.selector || '';
    }

    if (useButton) {
      useButton.onclick = () => this.useSmartSelector(data.selector);
    }

    this.logActivity(`Smart selector found: ${data.elementCount} elements with "${data.selector}"`);
  }

  async useSmartSelector(selector) {
    if (!selector || !this.sourceTab) return;

    try {
      this.scrapingActive = true;
      this.logActivity(`Starting scrape with selector: ${selector}`);
      
      // Send scraping command to content script
      await chrome.tabs.sendMessage(this.sourceTab.id, {
        type: 'START_SCRAPING',
        selector: selector,
        options: {
          handlePagination: true,
          skipDuplicates: this.settings.skipDuplicates,
          allowedFormats: Object.keys(this.settings.formats).filter(f => this.settings.formats[f])
        }
      });
      
      // Update UI
      this.updateScrapingUI(true);
      
    } catch (error) {
      console.error('Failed to use smart selector:', error);
      this.logActivity(`Scraping error: ${error.message}`, 'error');
      this.scrapingActive = false;
      this.updateScrapingUI(false);
    }
  }

  updateScrapingUI(active) {
    const quickStart = document.getElementById('quickStart');
    const smartDetection = document.getElementById('smartDetection');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (active) {
      if (quickStart) quickStart.disabled = true;
      if (smartDetection) smartDetection.disabled = true;
      if (pauseBtn) pauseBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = false;
    } else {
      if (quickStart) quickStart.disabled = false;
      if (smartDetection) smartDetection.disabled = false;
      if (pauseBtn) pauseBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = true;
    }
  }

  checkSelfScrapingWarning() {
    const currentUrl = window.location.href;
    const isExtensionPage = currentUrl.startsWith('chrome-extension://') || 
                           currentUrl.includes('windowed-dashboard.html');
    
    const warning = document.getElementById('selfScrapingWarning');
    if (warning) {
      warning.classList.toggle('show', isExtensionPage && !this.sourceTab);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(Object.keys(this.settings));
      this.settings = { ...this.settings, ...result };
      this.updateSettingsUI();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set(this.settings);
      this.logActivity('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.logActivity(`Settings save error: ${error.message}`, 'error');
    }
  }

  updateSettingsUI() {
    // Update form fields with current settings
    const fields = {
      concurrencyLimit: this.settings.concurrency,
      retryAttempts: this.settings.retryAttempts,
      downloadDelay: this.settings.downloadDelay,
      minWidth: this.settings.minWidth,
      minHeight: this.settings.minHeight,
      downloadFolder: this.settings.downloadFolder,
      filenameMask: this.settings.filenameMask
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = value;
      }
    });

    // Update checkboxes
    const checkboxes = {
      skipDuplicates: this.settings.skipDuplicates,
      autoSiteProfiles: this.settings.autoSiteProfiles,
      formatJpeg: this.settings.formats.jpeg,
      formatPng: this.settings.formats.png,
      formatWebp: this.settings.formats.webp,
      formatGif: this.settings.formats.gif
    };

    Object.entries(checkboxes).forEach(([id, checked]) => {
      const element = document.getElementById(id);
      if (element) {
        element.checked = checked;
      }
    });
  }

  setupEventListeners() {
    // Quick action buttons
    const quickStart = document.getElementById('quickStart');
    if (quickStart) {
      quickStart.addEventListener('click', () => this.startQuickSelection());
    }

    const smartDetection = document.getElementById('smartDetection');
    if (smartDetection) {
      smartDetection.addEventListener('click', () => this.startSmartDetection());
    }

    // Control buttons
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseDownloads());
    }

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopAll());
    }

    // Settings form handlers
    this.setupSettingsHandlers();
    
    // Export handlers
    this.setupExportHandlers();
  }

  setupSettingsHandlers() {
    // Input field handlers
    const inputFields = ['concurrencyLimit', 'retryAttempts', 'downloadDelay', 'minWidth', 'minHeight', 'downloadFolder', 'filenameMask'];
    
    inputFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('change', () => {
          const value = field.type === 'number' ? parseInt(field.value) : field.value;
          this.settings[fieldId.replace(/([A-Z])/g, '_$1').toLowerCase()] = value;
        });
      }
    });

    // Checkbox handlers
    const checkboxFields = ['skipDuplicates', 'autoSiteProfiles', 'formatJpeg', 'formatPng', 'formatWebp', 'formatGif'];
    
    checkboxFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('change', () => {
          if (fieldId.startsWith('format')) {
            const format = fieldId.replace('format', '').toLowerCase();
            this.settings.formats[format] = field.checked;
          } else {
            const settingKey = fieldId.replace(/([A-Z])/g, '_$1').toLowerCase();
            this.settings[settingKey] = field.checked;
          }
        });
      }
    });

    // Save settings button
    const saveSettings = document.getElementById('saveSettings');
    if (saveSettings) {
      saveSettings.addEventListener('click', () => this.saveSettings());
    }

    // Reset settings button
    const resetSettings = document.getElementById('resetSettings');
    if (resetSettings) {
      resetSettings.addEventListener('click', () => this.resetSettings());
    }
  }

  setupExportHandlers() {
    const exportMode = document.getElementById('exportMode');
    const formatSelection = document.getElementById('formatSelection');
    const exportButton = document.getElementById('exportButton');
    const exportButtonIcon = document.getElementById('exportButtonIcon');
    const exportButtonText = document.getElementById('exportButtonText');

    if (exportMode) {
      exportMode.addEventListener('change', () => {
        const isDataMode = exportMode.value === 'data';
        
        if (formatSelection) {
          formatSelection.style.display = isDataMode ? 'block' : 'none';
        }
        
        if (exportButtonIcon && exportButtonText) {
          if (isDataMode) {
            exportButtonIcon.textContent = '📊';
            exportButtonText.textContent = 'Export Data';
          } else {
            exportButtonIcon.textContent = '📸';
            exportButtonText.textContent = 'Start Scraping';
          }
        }
      });
    }

    if (exportButton) {
      exportButton.addEventListener('click', () => this.handleExport());
    }
  }

  async startQuickSelection() {
    if (!this.sourceTab) {
      this.logActivity('Error: No source tab connected', 'error');
      return;
    }

    await this.startSmartSelector();
  }

  async startSmartDetection() {
    if (!this.sourceTab) {
      this.logActivity('Error: No source tab connected', 'error');
      return;
    }

    try {
      this.logActivity('Starting smart detection...');
      
      // Send smart guess message to content script
      await chrome.tabs.sendMessage(this.sourceTab.id, {
        type: 'SMART_GUESS',
        options: {
          autoStart: true,
          useEnhancedDetection: true
        }
      });
      
      this.scrapingActive = true;
      this.updateScrapingUI(true);
      
    } catch (error) {
      console.error('Smart detection failed:', error);
      this.logActivity(`Smart detection error: ${error.message}`, 'error');
    }
  }

  async handleExport() {
    const exportMode = document.getElementById('exportMode');
    const exportFormat = document.getElementById('exportFormat');
    
    if (!exportMode) return;

    if (exportMode.value === 'download') {
      // Start scraping mode
      await this.startSmartDetection();
    } else {
      // Export data mode
      const format = exportFormat ? exportFormat.value : 'csv';
      await this.exportData(format);
    }
  }

  async exportData(format) {
    try {
      this.logActivity(`Exporting data in ${format.toUpperCase()} format...`);
      
      // Get current items (this would be populated from scraping results)
      const exportData = {
        items: this.queueItems,
        stats: this.stats,
        timestamp: new Date().toISOString(),
        sourceUrl: this.sourceTab?.url || 'unknown'
      };

      // Create export content based on format
      let content, filename, mimeType;
      
      switch (format) {
        case 'csv':
          content = this.generateCSV(exportData);
          filename = `steptwo-export-${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;
        case 'xlsx':
          // Would use XLSX library if available
          content = this.generateCSV(exportData); // Fallback to CSV
          filename = `steptwo-export-${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;
        default:
          content = JSON.stringify(exportData, null, 2);
          filename = `steptwo-export-${Date.now()}.json`;
          mimeType = 'application/json';
      }

      // Download file
      this.downloadFile(content, filename, mimeType);
      this.logActivity(`Export completed: ${filename}`);
      
    } catch (error) {
      console.error('Export failed:', error);
      this.logActivity(`Export error: ${error.message}`, 'error');
    }
  }

  generateCSV(data) {
    const headers = ['Image URL', 'Thumbnail URL', 'Link', 'Text', 'Index', 'Source URL'];
    const rows = [headers];
    
    data.items.forEach(item => {
      rows.push([
        item.image || '',
        item.thumbnail || '',
        item.link || '',
        item.text || '',
        item.index || '',
        item.sourceUrl || ''
      ]);
    });
    
    return rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async checkConnection() {
    try {
      if (this.sourceTab) {
        // Test connection to source tab
        await chrome.tabs.sendMessage(this.sourceTab.id, {
          action: 'ping'
        });
        this.isConnected = true;
      } else {
        // Get current active tab as fallback
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && !tabs[0].url.startsWith('chrome-extension://')) {
          this.sourceTab = tabs[0];
          this.isConnected = true;
          this.updateActiveTabInfo();
        }
      }
    } catch (error) {
      this.isConnected = false;
      console.warn('Connection check failed:', error);
    }

    this.updateConnectionStatus();
  }

  updateConnectionStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (statusDot) {
      statusDot.classList.toggle('disconnected', !this.isConnected);
    }
    
    if (statusText) {
      statusText.textContent = this.isConnected ? 'Connected' : 'Disconnected';
    }
  }

  updateStatsDisplay() {
    const statElements = {
      totalItems: document.getElementById('totalItems'),
      completedItems: document.getElementById('completedItems'),
      duplicates: document.getElementById('duplicates'),
      progressPercent: document.getElementById('progressPercent'),
      downloadRate: document.getElementById('downloadRate'),
      queueSize: document.getElementById('queueSize'),
      errorCount: document.getElementById('errorCount'),
      estimatedTime: document.getElementById('estimatedTime')
    };

    Object.entries(statElements).forEach(([key, element]) => {
      if (element && this.stats[key] !== undefined) {
        element.textContent = key === 'progressPercent' ? 
          `${this.stats[key]}%` : 
          this.stats[key];
      }
    });

    // Update badges
    const dashboardBadge = document.getElementById('dashboardBadge');
    if (dashboardBadge) {
      dashboardBadge.textContent = this.stats.totalItems;
    }
  }

  logActivity(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type
    };

    this.activityLog.unshift(logEntry);
    
    // Keep only recent entries
    if (this.activityLog.length > 50) {
      this.activityLog = this.activityLog.slice(0, 50);
    }

    this.updateActivityDisplay();
    console.log(`[Dashboard] ${message}`);
  }

  updateActivityDisplay() {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;

    // Clear existing content
    activityLog.innerHTML = '';

    if (this.activityLog.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'progress-item';
      emptyMessage.textContent = 'No activity yet - start by clicking "Start Selection"';
      activityLog.appendChild(emptyMessage);
      return;
    }

    // Add recent activity items
    this.activityLog.slice(0, 10).forEach(entry => {
      const item = document.createElement('div');
      item.className = 'progress-item';
      
      const icon = entry.type === 'error' ? '❌' : 
                  entry.type === 'warning' ? '⚠️' : 
                  entry.type === 'success' ? '✅' : 'ℹ️';
      
      item.textContent = `${icon} ${entry.timestamp} - ${entry.message}`;
      activityLog.appendChild(item);
    });
  }

  startPeriodicUpdates() {
    // Update stats every 5 seconds
    setInterval(() => {
      this.updateStatsDisplay();
      this.checkConnection();
    }, 5000);
  }

  async pauseDownloads() {
    try {
      await chrome.runtime.sendMessage({
        type: 'QUEUE_PAUSE'
      });
      this.logActivity('Downloads paused');
    } catch (error) {
      console.error('Failed to pause downloads:', error);
    }
  }

  async stopAll() {
    try {
      await chrome.runtime.sendMessage({
        type: 'QUEUE_CLEAR'
      });
      
      this.scrapingActive = false;
      this.updateScrapingUI(false);
      this.logActivity('All operations stopped');
      
    } catch (error) {
      console.error('Failed to stop operations:', error);
    }
  }

  async resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
      this.settings = {
        concurrency: 3,
        retryAttempts: 2,
        downloadDelay: 100,
        minWidth: 100,
        minHeight: 100,
        skipDuplicates: true,
        formats: { jpeg: true, png: true, webp: true, gif: true },
        downloadFolder: '',
        filenameMask: '*name* - *num*.*ext*',
        autoSiteProfiles: true
      };
      
      this.updateSettingsUI();
      await this.saveSettings();
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StepTwoDashboard();
});