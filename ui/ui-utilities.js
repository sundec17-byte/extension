// ui-utilities.js - Shared UI utilities for popup, options, and dashboard
// Consolidates common UI functionality to reduce code duplication

// =============================================================================
// COMMON UI UTILITIES
// =============================================================================

class UIUtilities {
  // Create elements with secure content handling
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key === 'className') {
        element.className = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    if (content) {
      element.textContent = content;
    }
    
    return element;
  }

  // Show notification message
  static showNotification(message, type = 'info', duration = 3000) {
    const notification = this.createElement('div', {
      className: `notification notification-${type}`,
      style: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 16px',
        borderRadius: '6px',
        color: 'white',
        zIndex: '10000',
        fontSize: '14px',
        maxWidth: '300px',
        backgroundColor: type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'
      }
    }, message);

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);

    return notification;
  }

  // Create loading spinner
  static createSpinner(size = '20px') {
    return this.createElement('div', {
      className: 'spinner',
      style: {
        width: size,
        height: size,
        border: '2px solid #f3f3f3',
        borderTop: '2px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        display: 'inline-block'
      }
    });
  }

  // Create progress bar
  static createProgressBar(progress = 0) {
    const container = this.createElement('div', {
      className: 'progress-container',
      style: {
        width: '100%',
        height: '20px',
        backgroundColor: '#f0f0f0',
        borderRadius: '10px',
        overflow: 'hidden'
      }
    });

    const bar = this.createElement('div', {
      className: 'progress-bar',
      style: {
        width: `${progress}%`,
        height: '100%',
        backgroundColor: '#3498db',
        borderRadius: '10px',
        transition: 'width 0.3s ease'
      }
    });

    container.appendChild(bar);
    return { container, bar };
  }

  // Update progress bar
  static updateProgress(progressBar, value) {
    if (progressBar && progressBar.bar) {
      progressBar.bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }
  }

  // Create button with consistent styling
  static createButton(text, onClick, options = {}) {
    const button = this.createElement('button', {
      className: `btn ${options.className || 'btn-primary'}`,
      style: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        backgroundColor: options.backgroundColor || '#3498db',
        color: options.color || 'white',
        ...options.style
      }
    }, text);

    if (onClick) {
      button.addEventListener('click', onClick);
    }

    // Add hover effect
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '0.9';
    });

    button.addEventListener('mouseleave', () => {
      button.style.opacity = '1';
    });

    return button;
  }

  // Create input with validation
  static createInput(type, options = {}) {
    const input = this.createElement('input', {
      type: type,
      placeholder: options.placeholder || '',
      value: options.value || '',
      className: options.className || 'form-input',
      style: {
        padding: '8px 12px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
        width: '100%',
        ...options.style
      }
    });

    if (options.onChange) {
      input.addEventListener('input', options.onChange);
    }

    if (options.validation) {
      input.addEventListener('blur', () => {
        const isValid = options.validation(input.value);
        input.style.borderColor = isValid ? '#ddd' : '#e74c3c';
      });
    }

    return input;
  }

  // Create modal dialog
  static createModal(title, content, options = {}) {
    const overlay = this.createElement('div', {
      className: 'modal-overlay',
      style: {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    });

    const modal = this.createElement('div', {
      className: 'modal',
      style: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'auto',
        position: 'relative',
        ...options.style
      }
    });

    const header = this.createElement('div', {
      className: 'modal-header',
      style: {
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: '1px solid #eee'
      }
    });

    const titleEl = this.createElement('h3', {
      style: { margin: '0', fontSize: '18px', fontWeight: '600' }
    }, title);

    const closeBtn = this.createElement('button', {
      className: 'modal-close',
      style: {
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'none',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        color: '#999'
      }
    }, '×');

    const body = this.createElement('div', {
      className: 'modal-body'
    });

    if (typeof content === 'string') {
      body.textContent = content;
    } else if (content instanceof Node) {
      body.appendChild(content);
    }

    header.appendChild(titleEl);
    modal.appendChild(header);
    modal.appendChild(closeBtn);
    modal.appendChild(body);
    overlay.appendChild(modal);

    // Close handlers
    const close = () => {
      overlay.remove();
    };

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {close();}
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {close();}
    }, { once: true });

    document.body.appendChild(overlay);

    return { overlay, modal, close };
  }

  // Format file size
  static formatFileSize(bytes) {
    if (bytes === 0) {return '0 B';}
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  // Format duration
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Debounce function calls
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function calls
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Copy text to clipboard
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('Copied to clipboard!', 'success', 2000);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showNotification('Failed to copy to clipboard', 'error', 3000);
      return false;
    }
  }

  // Download data as file
  static downloadAsFile(data, filename, type = 'text/plain') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Validate URL
  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  // Get extension settings with defaults
  static async getSettings(defaults = {}) {
    try {
      const result = await chrome.storage.sync.get(Object.keys(defaults));
      return { ...defaults, ...result };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return defaults;
    }
  }

  // Save extension settings
  static async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      this.showNotification('Settings saved!', 'success', 2000);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showNotification('Failed to save settings', 'error', 3000);
      return false;
    }
  }

  // Send message to background script
  static async sendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Add CSS styles to page
  static addStyles(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }

  // Initialize common CSS animations
  static initializeAnimations() {
    this.addStyles(`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .notification {
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
      }
      
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .form-input:focus {
        outline: none;
        border-color: #3498db;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
      }
    `);
  }
}

// =============================================================================
// SETTINGS MANAGER
// =============================================================================

class SettingsManager {
  constructor(defaults = {}) {
    this.defaults = defaults;
    this.cache = new Map();
  }

  async get(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    try {
      const result = await chrome.storage.sync.get([key]);
      const value = result[key] !== undefined ? result[key] : this.defaults[key];
      this.cache.set(key, value);
      return value;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return this.defaults[key];
    }
  }

  async set(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
      this.cache.set(key, value);
      return true;
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      return false;
    }
  }

  async getAll() {
    try {
      const result = await chrome.storage.sync.get(Object.keys(this.defaults));
      const settings = { ...this.defaults, ...result };
      
      // Update cache
      Object.entries(settings).forEach(([key, value]) => {
        this.cache.set(key, value);
      });
      
      return settings;
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return this.defaults;
    }
  }

  async setAll(settings) {
    try {
      await chrome.storage.sync.set(settings);
      
      // Update cache
      Object.entries(settings).forEach(([key, value]) => {
        this.cache.set(key, value);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to set all settings:', error);
      return false;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

// =============================================================================
// ENHANCED NOTIFICATION SYSTEM (from notification-system.js)
// =============================================================================

class NotificationSystem {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.nextId = 1;
    
    this.init();
  }

  init() {
    this.createContainer();
    this.addStyles();
  }

  createContainer() {
    if (this.container) {
      return;
    }

    this.container = UIUtilities.createElement('div', {
      id: 'steptwo-notifications',
      className: 'steptwo-notification-container',
      style: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '10000',
        maxWidth: '350px'
      }
    });

    document.body.appendChild(this.container);
  }

  addStyles() {
    if (document.getElementById('steptwo-notification-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'steptwo-notification-styles';
    style.textContent = `
      .steptwo-notification {
        background: #333;
        color: white;
        padding: 12px 16px;
        margin-bottom: 8px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        animation: slideInRight 0.3s ease-out;
        max-width: 350px;
        word-wrap: break-word;
      }
      
      .steptwo-notification.success {
        background: #27ae60;
      }
      
      .steptwo-notification.error {
        background: #e74c3c;
      }
      
      .steptwo-notification.warning {
        background: #f39c12;
      }
      
      .steptwo-notification.info {
        background: #3498db;
      }
      
      .steptwo-notification-content {
        flex: 1;
        margin-right: 10px;
      }
      
      .steptwo-notification-close {
        background: none;
        border: none;
        color: inherit;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .steptwo-notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 0 0 6px 6px;
        transition: width 0.1s ease;
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutRight {
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;

    document.head.appendChild(style);
  }

  show(message, type = 'info', options = {}) {
    const id = this.nextId++;
    const duration = options.duration || 5000;
    const showProgress = options.showProgress !== false;
    const closable = options.closable !== false;

    const notification = UIUtilities.createElement('div', {
      className: `steptwo-notification ${type}`
    });

    const content = UIUtilities.createElement('div', {
      className: 'steptwo-notification-content'
    }, message);

    notification.appendChild(content);

    if (closable) {
      const closeBtn = UIUtilities.createElement('button', {
        className: 'steptwo-notification-close'
      }, '×');

      closeBtn.addEventListener('click', () => {
        this.close(id);
      });

      notification.appendChild(closeBtn);
    }

    if (showProgress && duration > 0) {
      const progress = UIUtilities.createElement('div', {
        className: 'steptwo-notification-progress',
        style: { width: '100%' }
      });
      notification.appendChild(progress);

      // Animate progress bar
      setTimeout(() => {
        progress.style.width = '0%';
        progress.style.transition = `width ${duration}ms linear`;
      }, 10);
    }

    this.container.appendChild(notification);
    this.notifications.set(id, {
      element: notification,
      timeout: duration > 0 ? setTimeout(() => this.close(id), duration) : null
    });

    return id;
  }

  close(id) {
    const notification = this.notifications.get(id);
    if (!notification) {
      return;
    }

    if (notification.timeout) {
      clearTimeout(notification.timeout);
    }

    notification.element.style.animation = 'slideOutRight 0.3s ease-in';
    
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.remove();
      }
      this.notifications.delete(id);
    }, 300);
  }

  closeAll() {
    for (const id of this.notifications.keys()) {
      this.close(id);
    }
  }

  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', { duration: 8000, ...options });
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  progress(message, onUpdate = null) {
    const id = this.show(message, 'info', { 
      duration: 0, 
      showProgress: false,
      closable: false 
    });

    return {
      id,
      update: (newMessage, progress = null) => {
        const notification = this.notifications.get(id);
        if (notification) {
          const content = notification.element.querySelector('.steptwo-notification-content');
          if (content) {
            content.textContent = newMessage;
          }
          
          if (progress !== null && progress >= 0 && progress <= 100) {
            let progressBar = notification.element.querySelector('.steptwo-notification-progress');
            if (!progressBar) {
              progressBar = UIUtilities.createElement('div', {
                className: 'steptwo-notification-progress',
                style: { width: '0%' }
              });
              notification.element.appendChild(progressBar);
            }
            progressBar.style.width = `${progress}%`;
          }
          
          if (onUpdate) {
            onUpdate(newMessage, progress);
          }
        }
      },
      close: () => this.close(id)
    };
  }
}

// =============================================================================
// UPDATED GLOBAL EXPORTS
// =============================================================================

// Make available globally
if (typeof window !== 'undefined') {
  window.UIUtilities = UIUtilities;
  window.SettingsManager = SettingsManager;
  window.NotificationSystem = NotificationSystem;
  
  // Initialize animations on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIUtilities.initializeAnimations());
  } else {
    UIUtilities.initializeAnimations();
  }
}

// For service worker/importScripts environment
if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
  self.UIUtilities = UIUtilities;
  self.SettingsManager = SettingsManager;
  self.NotificationSystem = NotificationSystem;
}

// ES modules export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIUtilities, SettingsManager, NotificationSystem };
}