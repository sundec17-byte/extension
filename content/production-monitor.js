// production-monitor.js - Comprehensive monitoring, logging, and performance tracking
// Real-time metrics, error tracking, performance optimization, and health monitoring

if (!window.ProductionMonitor) {
  
  class ProductionMonitor {
    constructor(options = {}) {
      this.options = {
        // Logging configuration
        logLevel: options.logLevel || 'info', // error, warn, info, debug
        enableConsoleLogging: options.enableConsoleLogging !== false,
        enableRemoteLogging: options.enableRemoteLogging || false,
        logRetentionDays: options.logRetentionDays || 7,
        maxLogEntries: options.maxLogEntries || 10000,
        
        // Performance monitoring
        enablePerformanceTracking: options.enablePerformanceTracking !== false,
        performanceBufferSize: options.performanceBufferSize || 1000,
        performanceThresholds: {
          slowOperation: options.slowOperation || 2000, // ms
          memoryWarning: options.memoryWarning || 100 * 1024 * 1024, // 100MB
          errorRateWarning: options.errorRateWarning || 0.05 // 5%
        },
        
        // Health monitoring
        enableHealthChecks: options.enableHealthChecks !== false,
        healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
        
        // Error tracking
        enableErrorTracking: options.enableErrorTracking !== false,
        errorGroupingWindow: options.errorGroupingWindow || 300000, // 5 minutes
        maxErrorGroups: options.maxErrorGroups || 100,
        
        // Metrics collection
        enableMetricsCollection: options.enableMetricsCollection !== false,
        metricsInterval: options.metricsInterval || 10000, // 10 seconds
        
        ...options
      };
      
      // Storage systems
      this.logs = [];
      this.metrics = new Map();
      this.errorGroups = new Map();
      this.performanceEntries = [];
      this.healthStatus = { status: 'healthy', checks: new Map() };
      
      // Performance tracking
      this.performanceObserver = null;
      this.memoryMonitor = null;
      
      // Timers
      this.healthCheckTimer = null;
      this.metricsTimer = null;
      this.cleanupTimer = null;
      
      // Initialize systems
      this.initializeLogging();
      this.initializePerformanceMonitoring();
      this.initializeHealthMonitoring();
      this.initializeErrorTracking();
      this.startPeriodicTasks();
      
      console.log('✅ Production monitor initialized with comprehensive tracking');
    }
    
    // Initialize logging system
    initializeLogging() {
      // Create structured logging with different levels
      this.logLevels = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
      };
      
      // Create log formatters
      this.logFormatters = {
        console: (entry) => {
          const timestamp = new Date(entry.timestamp).toISOString();
          const level = entry.level.toUpperCase().padEnd(5);
          return `[${timestamp}] ${level} ${entry.message}`;
        },
        structured: (entry) => ({
          '@timestamp': entry.timestamp,
          '@level': entry.level,
          '@message': entry.message,
          '@context': entry.context,
          '@session': this.getSessionId(),
          '@url': window.location.href,
          '@userAgent': navigator.userAgent
        })
      };
      
      console.log('📝 Logging system initialized');
    }
    
    // Initialize performance monitoring
    initializePerformanceMonitoring() {
      if (!this.options.enablePerformanceTracking) return;
      
      // Monitor performance entries
      if ('PerformanceObserver' in window) {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => this.recordPerformanceEntry(entry));
        });
        
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
      }
      
      // Monitor memory usage
      this.startMemoryMonitoring();
      
      console.log('🔧 Performance monitoring initialized');
    }
    
    // Initialize health monitoring
    initializeHealthMonitoring() {
      if (!this.options.enableHealthChecks) return;
      
      // Register default health checks
      this.registerHealthCheck('dom', () => this.checkDOMHealth());
      this.registerHealthCheck('memory', () => this.checkMemoryHealth());
      this.registerHealthCheck('performance', () => this.checkPerformanceHealth());
      this.registerHealthCheck('errors', () => this.checkErrorHealth());
      
      console.log('💊 Health monitoring initialized');
    }
    
    // Initialize error tracking
    initializeErrorTracking() {
      if (!this.options.enableErrorTracking) return;
      
      // Global error handler
      window.addEventListener('error', (event) => {
        this.recordError('javascript', event.error || new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          source: 'global'
        });
      });
      
      // Unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        this.recordError('promise', event.reason, {
          source: 'unhandled_promise'
        });
      });
      
      console.log('🚨 Error tracking initialized');
    }
    
    // Start periodic monitoring tasks
    startPeriodicTasks() {
      // Health checks
      if (this.options.enableHealthChecks) {
        this.healthCheckTimer = setInterval(() => {
          this.runHealthChecks();
        }, this.options.healthCheckInterval);
      }
      
      // Metrics collection
      if (this.options.enableMetricsCollection) {
        this.metricsTimer = setInterval(() => {
          this.collectMetrics();
        }, this.options.metricsInterval);
      }
      
      // Cleanup old data
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, 3600000); // 1 hour
      
      console.log('⏰ Periodic monitoring tasks started');
    }
    
    // Structured logging methods
    log(level, message, context = {}) {
      const levelNum = this.logLevels[level];
      const configLevelNum = this.logLevels[this.options.logLevel];
      
      if (levelNum > configLevelNum) return;
      
      const entry = {
        timestamp: Date.now(),
        level,
        message,
        context,
        id: this.generateId()
      };
      
      // Store log entry
      this.logs.push(entry);
      if (this.logs.length > this.options.maxLogEntries) {
        this.logs.shift(); // Remove oldest
      }
      
      // Console output
      if (this.options.enableConsoleLogging) {
        const formattedMessage = this.logFormatters.console(entry);
        console[level === 'debug' ? 'log' : level](formattedMessage, context);
      }
      
      // Remote logging (if configured)
      if (this.options.enableRemoteLogging) {
        this.sendToRemoteLogger(this.logFormatters.structured(entry));
      }
      
      return entry.id;
    }
    
    // Convenience logging methods
    error(message, context) { return this.log('error', message, context); }
    warn(message, context) { return this.log('warn', message, context); }
    info(message, context) { return this.log('info', message, context); }
    debug(message, context) { return this.log('debug', message, context); }
    
    // Performance timing methods
    startTiming(name) {
      const id = `${name}-${Date.now()}-${Math.random()}`;
      performance.mark(`${id}-start`);
      return id;
    }
    
    endTiming(id) {
      const endMark = `${id}-end`;
      performance.mark(endMark);
      performance.measure(id, `${id}-start`, endMark);
      
      const entry = performance.getEntriesByName(id, 'measure')[0];
      if (entry) {
        this.recordPerformanceEntry(entry);
        return entry.duration;
      }
      return null;
    }
    
    // Record custom performance metrics
    recordMetric(name, value, tags = {}) {
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      
      this.metrics.get(name).push({
        timestamp: Date.now(),
        value,
        tags
      });
      
      // Keep only recent metrics
      const metrics = this.metrics.get(name);
      if (metrics.length > this.options.performanceBufferSize) {
        metrics.shift();
      }
    }
    
    // Record performance entry
    recordPerformanceEntry(entry) {
      this.performanceEntries.push({
        name: entry.name,
        type: entry.entryType,
        startTime: entry.startTime,
        duration: entry.duration,
        timestamp: Date.now()
      });
      
      // Check for slow operations
      if (entry.duration > this.options.performanceThresholds.slowOperation) {
        this.warn(`Slow operation detected: ${entry.name}`, {
          duration: entry.duration,
          type: entry.entryType
        });
      }
      
      // Keep buffer size manageable
      if (this.performanceEntries.length > this.options.performanceBufferSize) {
        this.performanceEntries.shift();
      }
    }
    
    // Error tracking methods
    recordError(type, error, context = {}) {
      const errorKey = this.getErrorGroupKey(error);
      const now = Date.now();
      
      if (!this.errorGroups.has(errorKey)) {
        this.errorGroups.set(errorKey, {
          type,
          message: error.message,
          stack: error.stack,
          firstSeen: now,
          lastSeen: now,
          count: 0,
          contexts: []
        });
      }
      
      const errorGroup = this.errorGroups.get(errorKey);
      errorGroup.lastSeen = now;
      errorGroup.count++;
      errorGroup.contexts.push({ ...context, timestamp: now });
      
      // Keep only recent contexts
      if (errorGroup.contexts.length > 10) {
        errorGroup.contexts = errorGroup.contexts.slice(-10);
      }
      
      // Log the error
      this.error(`${type} error: ${error.message}`, {
        stack: error.stack,
        context,
        groupKey: errorKey,
        occurrenceCount: errorGroup.count
      });
      
      // Cleanup old error groups
      if (this.errorGroups.size > this.options.maxErrorGroups) {
        this.cleanupOldErrorGroups();
      }
    }
    
    // Generate error group key for similar errors
    getErrorGroupKey(error) {
      // Create a hash based on error message and first few lines of stack trace
      const stackLines = (error.stack || '').split('\n').slice(0, 3).join('\n');
      const combined = `${error.name}:${error.message}:${stackLines}`;
      
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      
      return hash.toString(16);
    }
    
    // Health check registration and execution
    registerHealthCheck(name, checkFunction) {
      if (!this.healthChecks) {
        this.healthChecks = new Map();
      }
      this.healthChecks.set(name, checkFunction);
    }
    
    async runHealthChecks() {
      this.debug('Running health checks...');
      
      const results = new Map();
      
      for (const [name, checkFunction] of this.healthChecks) {
        try {
          const result = await checkFunction();
          results.set(name, {
            status: result.status || 'healthy',
            message: result.message || 'OK',
            timestamp: Date.now(),
            metrics: result.metrics || {}
          });
        } catch (error) {
          results.set(name, {
            status: 'unhealthy',
            message: error.message,
            timestamp: Date.now(),
            error: true
          });
          
          this.error(`Health check failed: ${name}`, { error: error.message });
        }
      }
      
      this.healthStatus = {
        status: this.determineOverallHealth(results),
        checks: results,
        timestamp: Date.now()
      };
      
      // Log health status changes
      if (this.healthStatus.status !== 'healthy') {
        this.warn(`Health status: ${this.healthStatus.status}`, {
          failedChecks: Array.from(results.entries())
            .filter(([, result]) => result.status !== 'healthy')
            .map(([name]) => name)
        });
      }
    }
    
    // Built-in health checks
    checkDOMHealth() {
      return {
        status: document.readyState === 'complete' ? 'healthy' : 'degraded',
        message: `DOM ready state: ${document.readyState}`,
        metrics: {
          domElements: document.querySelectorAll('*').length,
          bodyChildren: document.body ? document.body.children.length : 0
        }
      };
    }
    
    checkMemoryHealth() {
      if ('memory' in performance) {
        const memory = performance.memory;
        const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        return {
          status: usedPercent > 80 ? 'unhealthy' : usedPercent > 60 ? 'degraded' : 'healthy',
          message: `Memory usage: ${usedPercent.toFixed(1)}%`,
          metrics: {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usedPercent
          }
        };
      }
      
      return { status: 'healthy', message: 'Memory info not available' };
    }
    
    checkPerformanceHealth() {
      const recentEntries = this.performanceEntries.slice(-100);
      const slowOperations = recentEntries.filter(
        entry => entry.duration > this.options.performanceThresholds.slowOperation
      );
      
      const avgDuration = recentEntries.length > 0 ? 
        recentEntries.reduce((sum, entry) => sum + entry.duration, 0) / recentEntries.length : 0;
      
      return {
        status: slowOperations.length > recentEntries.length * 0.1 ? 'degraded' : 'healthy',
        message: `${slowOperations.length} slow operations in recent ${recentEntries.length} entries`,
        metrics: {
          slowOperations: slowOperations.length,
          totalOperations: recentEntries.length,
          averageDuration: avgDuration
        }
      };
    }
    
    checkErrorHealth() {
      const recentErrors = Array.from(this.errorGroups.values())
        .filter(error => Date.now() - error.lastSeen < 300000); // Last 5 minutes
      
      const totalRecentOccurrences = recentErrors.reduce((sum, error) => sum + error.count, 0);
      
      return {
        status: recentErrors.length > 5 ? 'unhealthy' : recentErrors.length > 2 ? 'degraded' : 'healthy',
        message: `${recentErrors.length} error groups, ${totalRecentOccurrences} total occurrences`,
        metrics: {
          errorGroups: recentErrors.length,
          totalOccurrences: totalRecentOccurrences,
          uniqueErrors: this.errorGroups.size
        }
      };
    }
    
    // Memory monitoring
    startMemoryMonitoring() {
      if ('memory' in performance) {
        setInterval(() => {
          const memory = performance.memory;
          this.recordMetric('memory.used', memory.usedJSHeapSize, { type: 'heap' });
          this.recordMetric('memory.total', memory.totalJSHeapSize, { type: 'heap' });
          
          if (memory.usedJSHeapSize > this.options.performanceThresholds.memoryWarning) {
            this.warn('High memory usage detected', {
              used: memory.usedJSHeapSize,
              total: memory.totalJSHeapSize,
              limit: memory.jsHeapSizeLimit
            });
          }
        }, 10000); // Check every 10 seconds
      }
    }
    
    // Metrics collection
    collectMetrics() {
      // Collect system metrics
      const now = Date.now();
      
      // Page performance
      if (performance.timing) {
        const timing = performance.timing;
        this.recordMetric('page.load_time', timing.loadEventEnd - timing.navigationStart);
        this.recordMetric('page.dom_ready', timing.domContentLoadedEventEnd - timing.navigationStart);
      }
      
      // Resource counts
      this.recordMetric('dom.elements', document.querySelectorAll('*').length);
      this.recordMetric('dom.images', document.querySelectorAll('img').length);
      this.recordMetric('dom.scripts', document.querySelectorAll('script').length);
      
      // Error metrics
      this.recordMetric('errors.groups', this.errorGroups.size);
      this.recordMetric('errors.recent', Array.from(this.errorGroups.values())
        .filter(error => now - error.lastSeen < 300000).length);
    }
    
    // Cleanup old data
    cleanup() {
      const cutoffTime = Date.now() - (this.options.logRetentionDays * 24 * 60 * 60 * 1000);
      
      // Clean old logs
      this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
      
      // Clean old performance entries
      this.performanceEntries = this.performanceEntries.filter(
        entry => entry.timestamp > cutoffTime
      );
      
      // Clean old error groups
      this.cleanupOldErrorGroups();
      
      this.debug('Cleanup completed', {
        logsRetained: this.logs.length,
        performanceEntriesRetained: this.performanceEntries.length,
        errorGroupsRetained: this.errorGroups.size
      });
    }
    
    cleanupOldErrorGroups() {
      const cutoffTime = Date.now() - this.options.errorGroupingWindow;
      const toRemove = [];
      
      for (const [key, errorGroup] of this.errorGroups) {
        if (errorGroup.lastSeen < cutoffTime) {
          toRemove.push(key);
        }
      }
      
      toRemove.forEach(key => this.errorGroups.delete(key));
    }
    
    // Determine overall health status
    determineOverallHealth(checkResults) {
      const statuses = Array.from(checkResults.values()).map(result => result.status);
      
      if (statuses.includes('unhealthy')) return 'unhealthy';
      if (statuses.includes('degraded')) return 'degraded';
      return 'healthy';
    }
    
    // Get comprehensive monitoring report
    getMonitoringReport() {
      return {
        health: this.healthStatus,
        logs: {
          total: this.logs.length,
          recent: this.logs.filter(log => Date.now() - log.timestamp < 3600000).length,
          byLevel: this.getLogCountByLevel()
        },
        errors: {
          totalGroups: this.errorGroups.size,
          recentGroups: Array.from(this.errorGroups.values())
            .filter(error => Date.now() - error.lastSeen < 300000).length,
          topErrors: this.getTopErrors()
        },
        performance: {
          entriesCollected: this.performanceEntries.length,
          slowOperations: this.performanceEntries.filter(
            entry => entry.duration > this.options.performanceThresholds.slowOperation
          ).length,
          averageOperationTime: this.getAverageOperationTime()
        },
        metrics: {
          totalMetrics: this.metrics.size,
          recentDataPoints: this.getRecentMetricCount()
        },
        system: {
          timestamp: Date.now(),
          uptime: Date.now() - this.startTime,
          sessionId: this.getSessionId()
        }
      };
    }
    
    // Helper methods for reporting
    getLogCountByLevel() {
      const counts = { error: 0, warn: 0, info: 0, debug: 0 };
      this.logs.forEach(log => {
        if (counts.hasOwnProperty(log.level)) {
          counts[log.level]++;
        }
      });
      return counts;
    }
    
    getTopErrors() {
      return Array.from(this.errorGroups.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(error => ({
          message: error.message,
          count: error.count,
          lastSeen: error.lastSeen
        }));
    }
    
    getAverageOperationTime() {
      if (this.performanceEntries.length === 0) return 0;
      const total = this.performanceEntries.reduce((sum, entry) => sum + entry.duration, 0);
      return total / this.performanceEntries.length;
    }
    
    getRecentMetricCount() {
      let count = 0;
      const oneHourAgo = Date.now() - 3600000;
      
      for (const metricData of this.metrics.values()) {
        count += metricData.filter(point => point.timestamp > oneHourAgo).length;
      }
      
      return count;
    }
    
    // Utility methods
    generateId() {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getSessionId() {
      if (!this.sessionId) {
        this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      return this.sessionId;
    }
    
    sendToRemoteLogger(logEntry) {
      // Placeholder for remote logging implementation
      // This would typically send to a logging service like LogRocket, Sentry, etc.
      console.debug('Remote log:', logEntry);
    }
    
    // Shutdown cleanup
    destroy() {
      if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
      if (this.metricsTimer) clearInterval(this.metricsTimer);
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      if (this.performanceObserver) this.performanceObserver.disconnect();
      
      this.info('Production monitor shutting down');
    }
  }
  
  // Initialize automatically
  window.ProductionMonitor = ProductionMonitor;
  
  // Create global instance
  if (!window.globalProductionMonitor) {
    window.globalProductionMonitor = new ProductionMonitor();
    window.globalProductionMonitor.startTime = Date.now();
  }
  
  console.log('✅ Production monitoring system loaded and active');
}