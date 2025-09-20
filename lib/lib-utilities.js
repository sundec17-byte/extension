// lib-utilities.js - Consolidated library utilities for STEPTWO V2
// Combines css-path.js, secure-dom.js, and worker-manager.js to reduce file count

// =============================================================================
// COMMON UTILITIES (from common-utils.js - shared across extension)
// =============================================================================

class StepTwoCommonUtils {
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
    const w = parseInt(width) || 0;
    const h = parseInt(height) || 0;
    return w >= minWidth && h >= minHeight;
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
      
      if (part1 < part2) {
        return -1;
      }
      if (part1 > part2) {
        return 1;
      }
    }
    
    return 0;
  }

  // Storage utilities
  static async getStorageData(keys) {
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      console.error('Failed to get storage data:', error);
      return {};
    }
  }

  static async setStorageData(data) {
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Failed to set storage data:', error);
      return false;
    }
  }

  // Time utilities
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

  static formatFileSize(bytes) {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Async utilities
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

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// CSS PATH UTILITIES (from css-path.js)
// =============================================================================

function getCssPath(el) {
  if (!(el instanceof Element)) {return '';}
  const parts = [];
  while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
      parts.unshift(selector);
      break;
    } else {
      // add nth-child for uniqueness among siblings
      let sib = el, nth = 1;
      while ((sib = sib.previousElementSibling)) {nth++;}
      selector += `:nth-child(${nth})`;
    }
    parts.unshift(selector);
    el = el.parentElement;
  }
  return parts.join(' > ');
}

// =============================================================================
// SECURE DOM UTILITIES (from secure-dom.js)
// =============================================================================

/**
 * Securely sets text content without HTML parsing
 * @param {HTMLElement} element - Target element
 * @param {string} content - Text content to set
 */
function setTextContent(element, content) {
  element.textContent = content;
}

/**
 * Securely creates HTML structure from simple templates
 * @param {string} tagName - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {string|HTMLElement|Array} content - Content to append
 * @returns {HTMLElement} Created element
 */
function createElement(tagName, attributes = {}, content = null) {
  const element = document.createElement(tagName);
  
  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  // Add content
  if (content !== null) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof HTMLElement) {
      element.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (typeof item === 'string') {
          element.appendChild(document.createTextNode(item));
        } else if (item instanceof HTMLElement) {
          element.appendChild(item);
        }
      });
    }
  }
  
  return element;
}

/**
 * Replaces element content in a secure way
 * @param {HTMLElement} element - Target element
 * @param {string|HTMLElement|Array} content - New content
 */
function replaceContent(element, content) {
  // Clear existing content
  element.innerHTML = '';
  
  if (typeof content === 'string') {
    element.textContent = content;
  } else if (content instanceof HTMLElement) {
    element.appendChild(content);
  } else if (Array.isArray(content)) {
    content.forEach(item => {
      if (typeof item === 'string') {
        element.appendChild(document.createTextNode(item));
      } else if (item instanceof HTMLElement) {
        element.appendChild(item);
      }
    });
  }
}

/**
 * Creates a button with secure event handling
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @param {Object} options - Additional options
 * @returns {HTMLElement} Button element
 */
function createButton(text, onClick, options = {}) {
  const button = createElement('button', {
    textContent: text,
    className: options.className || '',
    style: options.style || {}
  });
  
  if (onClick) {
    button.addEventListener('click', onClick);
  }
  
  return button;
}

/**
 * Creates an input element with secure defaults
 * @param {string} type - Input type
 * @param {Object} options - Input options
 * @returns {HTMLElement} Input element
 */
/**
 * Creates a status indicator element
 * @param {string} message - Status message to display
 * @param {string} type - Status type ('success', 'error', 'warning', 'info')
 * @returns {HTMLElement} Status indicator element
 */
function createStatusIndicator(message, type = 'info') {
  const indicator = createElement('div', {
    textContent: message,
    className: `steptwo-status-indicator steptwo-status-${type}`,
    style: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '6px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      zIndex: '10000',
      maxWidth: '300px',
      wordWrap: 'break-word',
      transition: 'all 0.3s ease'
    }
  });

  // Set background color based on type
  const colors = {
    success: '#10b981',
    error: '#ef4444', 
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  indicator.style.backgroundColor = colors[type] || colors.info;
  
  return indicator;
}

function createInput(type, options = {}) {
  const input = createElement('input', {
    type: type,
    placeholder: options.placeholder || '',
    value: options.value || '',
    className: options.className || '',
    style: options.style || {}
  });
  
  if (options.onChange) {
    input.addEventListener('input', options.onChange);
  }
  
  return input;
}

// =============================================================================
// WORKER MANAGER (from worker-manager.js)
// =============================================================================

class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.currentTasks = new Map();
    this.taskIdCounter = 0;
    this.maxWorkers = Math.min(navigator.hardwareConcurrency || 2, 4);
    this.isInitialized = false;
  }
  
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Create initial worker pool
      for (let i = 0; i < this.maxWorkers; i++) {
        await this.createWorker(`worker-${i}`);
      }
      
      this.isInitialized = true;
      console.log(`✅ Worker pool initialized with ${this.workers.size} workers`);
    } catch (error) {
      console.error('❌ Failed to initialize worker pool:', error);
      throw error;
    }
  }
  
  async createWorker(id) {
    try {
      const workerUrl = chrome.runtime.getURL('workers/heavy-operations-worker.js');
      const worker = new Worker(workerUrl);
      
      worker.onmessage = (event) => this.handleWorkerMessage(id, event);
      worker.onerror = (error) => this.handleWorkerError(id, error);
      
      this.workers.set(id, {
        worker,
        busy: false,
        tasks: new Set()
      });
      
      // Wait for worker to be ready
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 5000);
        
        const tempHandler = (event) => {
          if (event.data && event.data.type === 'ready') {
            clearTimeout(timeout);
            worker.removeEventListener('message', tempHandler);
            resolve();
          }
        };
        
        worker.addEventListener('message', tempHandler);
        worker.postMessage({ type: 'init' });
      });
    } catch (error) {
      console.error(`❌ Failed to create worker ${id}:`, error);
      throw error;
    }
  }
  
  async executeTask(operation, data = {}, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const taskId = ++this.taskIdCounter;
    const task = {
      id: taskId,
      operation,
      data,
      options,
      resolve: null,
      reject: null,
      startTime: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
      
      const worker = this.getAvailableWorker();
      if (worker) {
        this.assignTaskToWorker(worker, task);
      } else {
        this.taskQueue.push(task);
      }
      
      // Set timeout if specified
      if (options.timeout) {
        setTimeout(() => {
          if (this.currentTasks.has(taskId)) {
            this.cancelTask(taskId);
            reject(new Error('Task timeout'));
          }
        }, options.timeout);
      }
    });
  }
  
  getAvailableWorker() {
    for (const [id, workerInfo] of this.workers) {
      if (!workerInfo.busy) {
        return { id, ...workerInfo };
      }
    }
    return null;
  }
  
  assignTaskToWorker(workerData, task) {
    const { id, worker } = workerData;
    const workerInfo = this.workers.get(id);
    
    workerInfo.busy = true;
    workerInfo.tasks.add(task.id);
    this.currentTasks.set(task.id, { workerId: id, task });
    
    worker.postMessage({
      type: 'task',
      taskId: task.id,
      operation: task.operation,
      data: task.data
    });
  }
  
  handleWorkerMessage(workerId, event) {
    const { type, taskId, result, error } = event.data;
    
    if (type === 'task-complete' || type === 'task-error') {
      const taskData = this.currentTasks.get(taskId);
      if (!taskData) {return;}
      
      const { task } = taskData;
      const workerInfo = this.workers.get(workerId);
      
      // Mark worker as available
      workerInfo.busy = false;
      workerInfo.tasks.delete(taskId);
      this.currentTasks.delete(taskId);
      
      // Resolve or reject the task
      if (type === 'task-complete') {
        task.resolve(result);
      } else {
        task.reject(new Error(error || 'Task failed'));
      }
      
      // Process next queued task
      this.processQueue();
    }
  }
  
  handleWorkerError(workerId, error) {
    console.error(`Worker ${workerId} error:`, error);
    
    // Restart failed worker
    this.restartWorker(workerId);
  }
  
  async restartWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      // Terminate old worker
      workerInfo.worker.terminate();
      
      // Fail current tasks
      for (const taskId of workerInfo.tasks) {
        const taskData = this.currentTasks.get(taskId);
        if (taskData) {
          taskData.task.reject(new Error('Worker failed'));
          this.currentTasks.delete(taskId);
        }
      }
      
      // Create new worker
      try {
        await this.createWorker(workerId);
        this.processQueue();
      } catch (error) {
        console.error(`Failed to restart worker ${workerId}:`, error);
      }
    }
  }
  
  processQueue() {
    while (this.taskQueue.length > 0) {
      const worker = this.getAvailableWorker();
      if (!worker) {break;}
      
      const task = this.taskQueue.shift();
      this.assignTaskToWorker(worker, task);
    }
  }
  
  cancelTask(taskId) {
    const taskData = this.currentTasks.get(taskId);
    if (taskData) {
      taskData.task.reject(new Error('Task cancelled'));
      this.currentTasks.delete(taskId);
      
      const workerInfo = this.workers.get(taskData.workerId);
      if (workerInfo) {
        workerInfo.tasks.delete(taskId);
        if (workerInfo.tasks.size === 0) {
          workerInfo.busy = false;
        }
      }
    }
  }
  
  getStats() {
    return {
      workers: this.workers.size,
      busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.currentTasks.size
    };
  }
  
  terminate() {
    for (const workerInfo of this.workers.values()) {
      workerInfo.worker.terminate();
    }
    this.workers.clear();
    this.currentTasks.clear();
    this.taskQueue.length = 0;
    this.isInitialized = false;
  }
}

// =============================================================================
// INTERNATIONALIZATION (from i18n.js)
// =============================================================================

class I18nManager {
  constructor() {
    // Cache not needed for English-only extension
  }

  getMessage(key, substitutions = null, fallback = '') {
    // For English-only extension, just return fallback or key
    return fallback || key;
  }

  getMessages(keys) {
    const messages = {};
    keys.forEach(key => {
      messages[key] = this.getMessage(key);
    });
    return messages;
  }

  clearCache() {
    // No cache to clear in English-only version
  }
}

// =============================================================================
// ERROR BOUNDARY (from error-boundary.js)
// =============================================================================

class ErrorBoundary {
  constructor(options = {}) {
    this.options = {
      enableReporting: options.enableReporting ?? true,
      enableRecovery: options.enableRecovery ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      ...options
    };
    
    this.errorCount = 0;
    this.lastError = null;
    this.retryAttempts = new Map();
    
    this.initialize();
  }
  
  initialize() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        type: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: 'promise',
        promise: event.promise
      });
    });
    
    // Chrome extension specific error handler
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onConnect.addListener((port) => {
        port.onDisconnect.addListener(() => {
          if (chrome.runtime.lastError) {
            this.handleError(new Error(chrome.runtime.lastError.message), {
              type: 'chrome-runtime',
              port: port.name
            });
          }
        });
      });
    }
  }
  
  handleError(error, context = {}) {
    this.errorCount++;
    this.lastError = { error, context, timestamp: Date.now() };
    
    console.error('ErrorBoundary caught error:', error, context);
    
    if (this.options.enableReporting) {
      this.reportError(error, context);
    }
    
    if (this.options.enableRecovery) {
      this.attemptRecovery(error, context);
    }
  }
  
  reportError(error, context) {
    // Send error report to background script
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'errorReport',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context,
        timestamp: Date.now()
      }).catch(() => {
        // Ignore errors when sending error reports
      });
    }
  }
  
  attemptRecovery(error, context) {
    const errorKey = `${error.name}:${error.message}`;
    const attempts = this.retryAttempts.get(errorKey) || 0;
    
    if (attempts < this.options.maxRetries) {
      this.retryAttempts.set(errorKey, attempts + 1);
      
      setTimeout(() => {
        console.log(`Attempting recovery for error (attempt ${attempts + 1}):`, error.message);
        // Custom recovery logic can be added here
      }, this.options.retryDelay * (attempts + 1));
    } else {
      console.error(`Max retry attempts reached for error: ${error.message}`);
    }
  }
  
  wrapFunction(fn, context = {}) {
    return (...args) => {
      try {
        const result = fn.apply(this, args);
        if (result && typeof result.catch === 'function') {
          return result.catch(error => this.handleError(error, context));
        }
        return result;
      } catch (error) {
        this.handleError(error, context);
        throw error;
      }
    };
  }
  
  getStats() {
    return {
      errorCount: this.errorCount,
      lastError: this.lastError,
      retryAttempts: Object.fromEntries(this.retryAttempts)
    };
  }
}

// =============================================================================
// PERFORMANCE MONITOR (from performance-monitor.js)
// =============================================================================

class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      enableMemoryTracking: options.enableMemoryTracking ?? true,
      enableTimingTracking: options.enableTimingTracking ?? true,
      enableUserTiming: options.enableUserTiming ?? true,
      memoryWarningThreshold: options.memoryWarningThreshold ?? 100 * 1024 * 1024, // 100MB
      slowOperationThreshold: options.slowOperationThreshold ?? 5000, // 5 seconds
      maxHistoryEntries: options.maxHistoryEntries ?? 100,
      ...options
    };
    
    this.metrics = {
      memory: [],
      timing: new Map(),
      operations: [],
      warnings: []
    };
    
    this.activeOperations = new Map();
    this.initialize();
  }
  
  initialize() {
    // Start periodic memory monitoring
    if (this.options.enableMemoryTracking) {
      this.startMemoryMonitoring();
    }
    
    // Monitor long-running operations
    this.startOperationMonitoring();
  }
  
  startMemoryMonitoring() {
    const checkMemory = () => {
      if (performance.memory) {
        const memoryInfo = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          timestamp: Date.now()
        };
        
        this.metrics.memory.push(memoryInfo);
        
        // Keep only recent entries
        if (this.metrics.memory.length > this.options.maxHistoryEntries) {
          this.metrics.memory.shift();
        }
        
        // Check for memory warnings
        if (memoryInfo.used > this.options.memoryWarningThreshold) {
          this.addWarning('memory', `High memory usage: ${this.formatBytes(memoryInfo.used)}`);
        }
      }
    };
    
    // Check memory every 10 seconds
    checkMemory();
    setInterval(checkMemory, 10000);
  }
  
  startOperationMonitoring() {
    // Monitor for operations that take too long
    setInterval(() => {
      const now = Date.now();
      for (const [operationId, startTime] of this.activeOperations) {
        const duration = now - startTime;
        if (duration > this.options.slowOperationThreshold) {
          this.addWarning('performance', `Slow operation detected: ${operationId} (${duration}ms)`);
        }
      }
    }, 5000);
  }
  
  startOperation(operationId) {
    this.activeOperations.set(operationId, Date.now());
    
    if (this.options.enableUserTiming && performance.mark) {
      performance.mark(`${operationId}-start`);
    }
    
    return operationId;
  }
  
  endOperation(operationId) {
    const startTime = this.activeOperations.get(operationId);
    if (!startTime) {
      return null;
    }
    
    const duration = Date.now() - startTime;
    this.activeOperations.delete(operationId);
    
    const operation = {
      id: operationId,
      duration,
      timestamp: Date.now()
    };
    
    this.metrics.operations.push(operation);
    
    // Keep only recent entries
    if (this.metrics.operations.length > this.options.maxHistoryEntries) {
      this.metrics.operations.shift();
    }
    
    if (this.options.enableUserTiming && performance.mark && performance.measure) {
      performance.mark(`${operationId}-end`);
      performance.measure(operationId, `${operationId}-start`, `${operationId}-end`);
    }
    
    return operation;
  }
  
  addWarning(type, message) {
    const warning = {
      type,
      message,
      timestamp: Date.now()
    };
    
    this.metrics.warnings.push(warning);
    
    // Keep only recent warnings
    if (this.metrics.warnings.length > 50) {
      this.metrics.warnings.shift();
    }
    
    console.warn(`Performance warning (${type}): ${message}`);
  }
  
  formatBytes(bytes) {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  getMetrics() {
    return {
      memory: [...this.metrics.memory],
      operations: [...this.metrics.operations],
      warnings: [...this.metrics.warnings],
      activeOperations: this.activeOperations.size
    };
  }
  
  clearMetrics() {
    this.metrics.memory = [];
    this.metrics.operations = [];
    this.metrics.warnings = [];
    this.activeOperations.clear();
  }
}

// =============================================================================
// UPDATED GLOBAL EXPORTS
// =============================================================================

// Export functions for both ES modules and global use
const LibUtilities = {
  StepTwoCommonUtils,
  getCssPath,
  setTextContent,
  createElement,
  replaceContent,
  createButton,
  createStatusIndicator,
  createInput,
  WorkerManager,
  I18nManager,
  ErrorBoundary,
  PerformanceMonitor
};

// Make available globally
if (typeof window !== 'undefined') {
  window.StepTwoCommonUtils = StepTwoCommonUtils;
  window.getCssPath = getCssPath;
  window.setTextContent = setTextContent;
  window.createElement = createElement;
  window.replaceContent = replaceContent;
  window.createButton = createButton;
  window.createStatusIndicator = createStatusIndicator;
  window.createInput = createInput;
  window.WorkerManager = WorkerManager;
  window.I18nManager = I18nManager;
  window.ErrorBoundary = ErrorBoundary;
  window.PerformanceMonitor = PerformanceMonitor;
  window.LibUtilities = LibUtilities;
  
  // For backward compatibility
  window.StepTwoUtils = StepTwoCommonUtils;
}

// For service worker/importScripts environment
if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
  self.StepTwoCommonUtils = StepTwoCommonUtils;
  self.getCssPath = getCssPath;
  self.setTextContent = setTextContent;
  self.createElement = createElement;
  self.replaceContent = replaceContent;
  self.createButton = createButton;
  self.createStatusIndicator = createStatusIndicator;
  self.createInput = createInput;
  self.WorkerManager = WorkerManager;
  self.I18nManager = I18nManager;
  self.ErrorBoundary = ErrorBoundary;
  self.PerformanceMonitor = PerformanceMonitor;
  self.LibUtilities = LibUtilities;
  
  // For backward compatibility
  self.StepTwoUtils = StepTwoCommonUtils;
}

// ES modules export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibUtilities;
}