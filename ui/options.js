// options.js - StepTwo Gallery Scraper Options Page
// Enhanced options interface with preset management and advanced settings

class StepTwoOptions {
  constructor() {
    this.settings = {
      // General settings
      autoDetectGalleries: true,
      downloadImages: true,
      smartFiltering: true,
            
      // Performance settings
      pageWait: 2000,
      scrollDelay: 1000,
      maxDownloads: 5,
            
      // Download settings
      downloadFolder: 'StepTwo',
      filenameMask: '*name*.*ext*',
      retryAttempts: 3,
            
      // Advanced settings
      memoryOptimization: true,
      performanceMonitoring: true,
      debugLogging: false
    };

    this.presets = {
      balanced: {
        pageWait: 2000,
        scrollDelay: 1000,
        maxDownloads: 5,
        retryAttempts: 3,
        smartFiltering: true,
        memoryOptimization: true
      },
      fast: {
        pageWait: 500,
        scrollDelay: 500,
        maxDownloads: 8,
        retryAttempts: 1,
        smartFiltering: false,
        memoryOptimization: false
      },
      thorough: {
        pageWait: 5000,
        scrollDelay: 2000,
        maxDownloads: 2,
        retryAttempts: 5,
        smartFiltering: true,
        memoryOptimization: true
      },
      compatible: {
        pageWait: 10000,
        scrollDelay: 3000,
        maxDownloads: 1,
        retryAttempts: 10,
        smartFiltering: true,
        memoryOptimization: true
      }
    };

    this.init();
  }

  async init() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.updateUI();
    } catch (error) {
      console.error('Options initialization error:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(Object.keys(this.settings));
            
      // Merge with defaults
      this.settings = { ...this.settings, ...result };
    } catch (error) {
      console.error('Failed to load settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set(this.settings);
      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  setupEventListeners() {
    // Preset buttons
    document.querySelectorAll('.preset-button').forEach(button => {
      button.addEventListener('click', () => {
        const preset = button.dataset.preset;
        this.applyPreset(preset);
      });
    });

    // Toggle switches
    const toggles = {
      autoDetectToggle: 'autoDetectGalleries',
      downloadImagesToggle: 'downloadImages',
      smartFilterToggle: 'smartFiltering',
      memoryOptToggle: 'memoryOptimization',
      perfMonToggle: 'performanceMonitoring',
      debugToggle: 'debugLogging'
    };

    Object.entries(toggles).forEach(([elementId, settingKey]) => {
      const toggle = document.getElementById(elementId);
      if (toggle) {
        toggle.addEventListener('click', () => {
          this.settings[settingKey] = !this.settings[settingKey];
          this.updateToggle(elementId, this.settings[settingKey]);
        });
      }
    });

    // Input fields
    const inputs = {
      pageWaitInput: 'pageWait',
      scrollDelayInput: 'scrollDelay',
      downloadFolderInput: 'downloadFolder',
      filenameMaskInput: 'filenameMask'
    };

    Object.entries(inputs).forEach(([elementId, settingKey]) => {
      const input = document.getElementById(elementId);
      if (input) {
        input.addEventListener('change', () => {
          const value = input.type === 'number' ? parseInt(input.value) : input.value;
          this.settings[settingKey] = value;
        });
      }
    });

    // Select fields
    const selects = {
      maxDownloadsSelect: 'maxDownloads',
      retryAttemptsSelect: 'retryAttempts'
    };

    Object.entries(selects).forEach(([elementId, settingKey]) => {
      const select = document.getElementById(elementId);
      if (select) {
        select.addEventListener('change', () => {
          this.settings[settingKey] = parseInt(select.value);
        });
      }
    });

    // Advanced section toggle
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedContent = document.getElementById('advancedContent');
        
    if (advancedToggle && advancedContent) {
      advancedToggle.addEventListener('click', () => {
        const isExpanded = advancedContent.classList.contains('expanded');
        advancedToggle.classList.toggle('expanded', !isExpanded);
        advancedContent.classList.toggle('expanded', !isExpanded);
      });
    }

    // Action buttons
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.saveSettings());
    }

    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
      resetButton.addEventListener('click', () => this.resetSettings());
    }

    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
      exportButton.addEventListener('click', () => this.exportSettings());
    }

    const importButton = document.getElementById('importButton');
    if (importButton) {
      importButton.addEventListener('click', () => this.importSettings());
    }
  }

  updateUI() {
    // Update toggles
    this.updateToggle('autoDetectToggle', this.settings.autoDetectGalleries);
    this.updateToggle('downloadImagesToggle', this.settings.downloadImages);
    this.updateToggle('smartFilterToggle', this.settings.smartFiltering);
    this.updateToggle('memoryOptToggle', this.settings.memoryOptimization);
    this.updateToggle('perfMonToggle', this.settings.performanceMonitoring);
    this.updateToggle('debugToggle', this.settings.debugLogging);

    // Update input fields
    this.updateInput('pageWaitInput', this.settings.pageWait);
    this.updateInput('scrollDelayInput', this.settings.scrollDelay);
    this.updateInput('downloadFolderInput', this.settings.downloadFolder);
    this.updateInput('filenameMaskInput', this.settings.filenameMask);

    // Update select fields
    this.updateSelect('maxDownloadsSelect', this.settings.maxDownloads);
    this.updateSelect('retryAttemptsSelect', this.settings.retryAttempts);

    // Update preset buttons
    this.updatePresetButtons();
  }

  updateToggle(elementId, active) {
    const toggle = document.getElementById(elementId);
    if (toggle) {
      toggle.classList.toggle('active', active);
    }
  }

  updateInput(elementId, value) {
    const input = document.getElementById(elementId);
    if (input) {
      input.value = value;
    }
  }

  updateSelect(elementId, value) {
    const select = document.getElementById(elementId);
    if (select) {
      select.value = value;
    }
  }

  updatePresetButtons() {
    const buttons = document.querySelectorAll('.preset-button');
    buttons.forEach(button => {
      button.classList.remove('active');
    });

    // Check if current settings match any preset
    for (const [presetName, presetSettings] of Object.entries(this.presets)) {
      const matches = Object.entries(presetSettings).every(([key, value]) => {
        return this.settings[key] === value;
      });

      if (matches) {
        const button = document.querySelector(`[data-preset="${presetName}"]`);
        if (button) {
          button.classList.add('active');
        }
        break;
      }
    }
  }

  applyPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) {return;}

    // Apply preset settings
    Object.entries(preset).forEach(([key, value]) => {
      this.settings[key] = value;
    });

    // Update UI
    this.updateUI();
        
    // Show status
    this.showStatus(`Applied ${presetName} preset`, 'success');
  }

  async resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      try {
        // Clear stored settings
        await chrome.storage.local.clear();
                
        // Reset to defaults
        this.settings = {
          autoDetectGalleries: true,
          downloadImages: true,
          smartFiltering: true,
          pageWait: 2000,
          scrollDelay: 1000,
          maxDownloads: 5,
          downloadFolder: 'StepTwo',
          filenameMask: '*name*.*ext*',
          retryAttempts: 3,
          memoryOptimization: true,
          performanceMonitoring: true,
          debugLogging: false
        };

        // Update UI
        this.updateUI();
                
        this.showStatus('Settings reset to defaults', 'success');
      } catch (error) {
        console.error('Failed to reset settings:', error);
        this.showStatus('Failed to reset settings', 'error');
      }
    }
  }

  exportSettings() {
    try {
      const settingsData = {
        version: '2.0.0',
        timestamp: Date.now(),
        settings: this.settings
      };

      const dataStr = JSON.stringify(settingsData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `steptwo-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showStatus('Settings exported successfully', 'success');
    } catch (error) {
      console.error('Failed to export settings:', error);
      this.showStatus('Failed to export settings', 'error');
    }
  }

  importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
        
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) {return;}

      try {
        const text = await file.text();
        const data = JSON.parse(text);
                
        if (data.settings) {
          // Validate settings
          const validKeys = Object.keys(this.settings);
          const importedSettings = {};
                    
          Object.entries(data.settings).forEach(([key, value]) => {
            if (validKeys.includes(key)) {
              importedSettings[key] = value;
            }
          });

          // Apply imported settings
          this.settings = { ...this.settings, ...importedSettings };
                    
          // Save and update UI
          await this.saveSettings();
          this.updateUI();
                    
          this.showStatus('Settings imported successfully', 'success');
        } else {
          throw new Error('Invalid settings file format');
        }
      } catch (error) {
        console.error('Failed to import settings:', error);
        this.showStatus('Failed to import settings', 'error');
      }
    });

    input.click();
  }

  showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
      statusElement.style.display = 'block';

      // Hide after 3 seconds
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StepTwoOptions();
});