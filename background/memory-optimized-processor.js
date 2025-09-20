// memory-optimized-processor.js - Handle large galleries efficiently
// Inspired by research findings on handling 100k+ items with IndexedDB spillover

class MemoryOptimizedProcessor {
  constructor(options = {}) {
    this.options = {
      maxMemoryItems: options.maxMemoryItems || 1000,
      spillBatchSize: options.spillBatchSize || 500,
      processingBatchSize: options.processingBatchSize || 100,
      dbName: options.dbName || 'StepTwoProcessor',
      dbVersion: options.dbVersion || 1,
      enableCompression: options.enableCompression !== false,
      maxTotalItems: options.maxTotalItems || 100000,
      ...options
    };

    this.memoryQueue = [];
    this.dbQueue = null;
    this.isProcessing = false;
    this.totalItems = 0;
    this.processedItems = 0;
    this.spilledItems = 0;
    
    this.stats = {
      memoryUsage: 0,
      dbUsage: 0,
      totalProcessed: 0,
      spillOperations: 0,
      compressionRatio: 0
    };

    this.observers = {
      progress: [],
      memory: [],
      error: []
    };

    this.worker = null;
    this.initializeWorker();
  }

  // Initialize Web Worker for CPU-intensive tasks with enhanced binary processing
  initializeWorker() {
    try {
      const workerCode = `
        // Enhanced Worker for binary storage and advanced compression
        class ProcessorWorker {
          constructor() {
            this.compressionCache = new Map();
            this.binaryCache = new Map();
          }
          
          // Convert data to efficient binary format using ArrayBuffers
          toBinaryFormat(data) {
            try {
              const jsonString = JSON.stringify(data);
              const encoder = new TextEncoder();
              const binaryData = encoder.encode(jsonString);
              
              // Create metadata header for efficient parsing
              const metadata = {
                originalLength: jsonString.length,
                binaryLength: binaryData.length,
                itemCount: Array.isArray(data) ? data.length : 1,
                compression: 'none'
              };
              
              return {
                binary: binaryData,
                metadata: metadata,
                size: binaryData.length
              };
            } catch (error) {
              console.error('Binary conversion failed:', error);
              return null;
            }
          }
          
          // Enhanced compression with dictionary-based LZ77-style algorithm
          compressData(data) {
            try {
              const jsonString = JSON.stringify(data);
              
              // Use binary format for large datasets
              if (jsonString.length > 10000) {
                const binary = this.toBinaryFormat(data);
                const compressed = this.compressBinary(binary.binary);
                
                return {
                  compressed: compressed,
                  originalSize: jsonString.length,
                  compressedSize: compressed.length,
                  ratio: compressed.length / jsonString.length,
                  format: 'binary',
                  metadata: binary.metadata
                };
              }
              
              // Dictionary-based compression for smaller datasets
              const compressed = this.dictionaryCompress(jsonString);
              
              return {
                compressed: compressed,
                originalSize: jsonString.length,
                compressedSize: compressed.length,
                ratio: compressed.length / jsonString.length,
                format: 'dictionary'
              };
            } catch (error) {
              return {
                compressed: JSON.stringify(data),
                originalSize: JSON.stringify(data).length,
                compressedSize: JSON.stringify(data).length,
                ratio: 1,
                error: error.message,
                format: 'fallback'
              };
            }
          }
          
          // Binary compression using simple LZ77-style algorithm
          compressBinary(binaryData) {
            const result = [];
            const windowSize = 4096;
            const maxMatchLength = 258;
            
            for (let i = 0; i < binaryData.length; i++) {
              let matchLength = 0;
              let matchDistance = 0;
              
              // Look for matches in the sliding window
              const windowStart = Math.max(0, i - windowSize);
              for (let j = windowStart; j < i; j++) {
                let currentMatchLength = 0;
                while (
                  currentMatchLength < maxMatchLength &&
                  i + currentMatchLength < binaryData.length &&
                  binaryData[j + currentMatchLength] === binaryData[i + currentMatchLength]
                ) {
                  currentMatchLength++;
                }
                
                if (currentMatchLength > matchLength) {
                  matchLength = currentMatchLength;
                  matchDistance = i - j;
                }
              }
              
              if (matchLength >= 3) {
                // Encode as (distance, length)
                result.push(255); // Escape marker
                result.push(matchDistance & 0xFF);
                result.push((matchDistance >> 8) & 0xFF);
                result.push(matchLength);
                i += matchLength - 1;
              } else {
                // Literal byte
                result.push(binaryData[i]);
              }
            }
            
            return new Uint8Array(result);
          }
          
          // Dictionary-based compression for text data
          dictionaryCompress(str) {
            // Build frequency dictionary
            const dict = new Map();
            const words = str.match(/\\w+|[.,;:"'\\[\\]{}()]/g) || [];
            
            words.forEach(word => {
              dict.set(word, (dict.get(word) || 0) + 1);
            });
            
            // Create lookup table for most frequent words (threshold: appears more than once)
            const lookupTable = [];
            const wordToIndex = new Map();
            
            for (const [word, count] of dict.entries()) {
              if (count > 1 && word.length > 2) {
                wordToIndex.set(word, lookupTable.length);
                lookupTable.push(word);
              }
            }
            
            // Compress using dictionary
            let compressed = '';
            let i = 0;
            while (i < str.length) {
              let matched = false;
              
              // Try to match dictionary entries
              for (const [word, index] of wordToIndex.entries()) {
                if (str.substr(i, word.length) === word) {
                  compressed += String.fromCharCode(256 + index); // Use high Unicode for markers
                  i += word.length;
                  matched = true;
                  break;
                }
              }
              
              if (!matched) {
                compressed += str[i];
                i++;
              }
            }
            
            // Store dictionary with compressed data
            return JSON.stringify({
              data: compressed,
              dictionary: lookupTable
            });
          }
          
          decompressData(compressedData, format = 'dictionary') {
            try {
              if (format === 'binary') {
                const decompressed = this.decompressBinary(compressedData);
                const decoder = new TextDecoder();
                const jsonString = decoder.decode(decompressed);
                return JSON.parse(jsonString);
              } else if (format === 'dictionary') {
                const compressed = JSON.parse(compressedData);
                const decompressed = this.dictionaryDecompress(compressed.data, compressed.dictionary);
                return JSON.parse(decompressed);
              } else {
                // Fallback for legacy simple compression
                const decompressed = this.simpleDecompress(compressedData);
                return JSON.parse(decompressed);
              }
            } catch (error) {
              console.error('Decompression failed:', error);
              return null;
            }
          }
          
          dictionaryDecompress(compressed, dictionary) {
            let result = '';
            for (let i = 0; i < compressed.length; i++) {
              const char = compressed[i];
              const code = char.charCodeAt(0);
              
              if (code >= 256) {
                const dictIndex = code - 256;
                if (dictIndex < dictionary.length) {
                  result += dictionary[dictIndex];
                } else {
                  result += char; // Fallback
                }
              } else {
                result += char;
              }
            }
            return result;
          }
          
          // Batch processing for IndexedDB operations
          processBatch(items, operation) {
            const batchSize = 100;
            const results = [];
            
            for (let i = 0; i < items.length; i += batchSize) {
              const batch = items.slice(i, i + batchSize);
              const batchResult = batch.map(item => {
                switch (operation) {
                  case 'compress':
                    return this.compressData(item);
                  case 'toBinary':
                    return this.toBinaryFormat(item);
                  default:
                    return item;
                }
              });
              results.push(...batchResult);
              
              // Yield control every batch
              if (i % (batchSize * 10) === 0) {
                self.postMessage({
                  type: 'progress',
                  processed: i,
                  total: items.length
                });
              }
            }
            
            return results;
          }
          
          simpleCompress(str) {
            // Basic run-length encoding for repeated patterns (fallback)
            let compressed = '';
            let current = str[0];
            let count = 1;
            
            for (let i = 1; i < str.length; i++) {
              if (str[i] === current && count < 255) {
                count++;
              } else {
                if (count > 3) {
                  compressed += '§' + String.fromCharCode(count) + current;
                } else {
                  compressed += current.repeat(count);
                }
                current = str[i];
                count = 1;
              }
            }
            
            if (count > 3) {
              compressed += '§' + String.fromCharCode(count) + current;
            } else {
              compressed += current.repeat(count);
            }
            
            return compressed;
          }
          
          simpleDecompress(str) {
            let decompressed = '';
            let i = 0;
            
            while (i < str.length) {
              if (str[i] === '§' && i + 2 < str.length) {
                const count = str.charCodeAt(i + 1);
                const char = str[i + 2];
                decompressed += char.repeat(count);
                i += 3;
              } else {
                decompressed += str[i];
                i++;
              }
            }
            
            return decompressed;
          }
          
          processItems(items, options) {
            // Process items in batches to avoid blocking
            const processed = [];
            
            for (const item of items) {
              try {
                const processedItem = this.processItem(item, options);
                processed.push(processedItem);
              } catch (error) {
                processed.push({
                  ...item,
                  processingError: error.message
                });
              }
            }
            
            return processed;
          }
          
          processItem(item, options) {
            // Add computed fields
            const processed = {
              ...item,
              processed: true,
              processedAt: Date.now()
            };
            
            // Add URL analysis
            if (item.image) {
              processed.imageAnalysis = this.analyzeUrl(item.image);
            }
            
            // Add text analysis
            if (item.text) {
              processed.textAnalysis = this.analyzeText(item.text);
            }
            
            return processed;
          }
          
          analyzeUrl(url) {
            try {
              const urlObj = new URL(url);
              return {
                domain: urlObj.hostname,
                path: urlObj.pathname,
                extension: this.getExtension(urlObj.pathname),
                hasQuery: urlObj.search.length > 0,
                protocol: urlObj.protocol
              };
            } catch {
              return {
                domain: 'unknown',
                path: url,
                extension: this.getExtension(url),
                hasQuery: false,
                protocol: 'unknown'
              };
            }
          }
          
          analyzeText(text) {
            return {
              length: text.length,
              wordCount: text.split(/\\s+/).length,
              hasNumbers: /\\d/.test(text),
              hasSpecialChars: /[^a-zA-Z0-9\\s]/.test(text)
            };
          }
          
          getExtension(path) {
            const match = path.match(/\\.([a-z0-9]+)$/i);
            return match ? match[1].toLowerCase() : '';
          }
        }
        
        const worker = new ProcessorWorker();
        
        self.onmessage = function(e) {
          const {type, data, id} = e.data;
          
          try {
            let result;
            
            switch (type) {
              case 'compress':
                result = worker.compressData(data);
                break;
              case 'decompress':
                result = worker.decompressData(data);
                break;
              case 'process':
                result = worker.processItems(data.items, data.options);
                break;
              default:
                throw new Error('Unknown worker command: ' + type);
            }
            
            self.postMessage({
              type: 'success',
              id: id,
              result: result
            });
          } catch (error) {
            self.postMessage({
              type: 'error',
              id: id,
              error: error.message
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      
      this.worker.onmessage = (e) => {
        const {type, id, result, error} = e.data;
        
        if (type === 'error') {
          console.error('Worker error:', error);
        }
        
        // Handle worker responses
        const callback = this.workerCallbacks.get(id);
        if (callback) {
          this.workerCallbacks.delete(id);
          if (type === 'success') {
            callback.resolve(result);
          } else {
            callback.reject(new Error(error));
          }
        }
      };

      this.workerCallbacks = new Map();
    } catch (error) {
      console.warn('Worker initialization failed:', error);
      this.worker = null;
    }
  }

  // Initialize IndexedDB for spillover storage
  async initializeDatabase() {
    if (this.dbQueue) {return this.dbQueue;}

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.dbName, this.options.dbVersion);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        this.dbQueue = new IndexedDBQueue(db);
        resolve(this.dbQueue);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          itemStore.createIndex('processed', 'processed', { unique: false });
          itemStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { 
            keyPath: 'batchId', 
            autoIncrement: true 
          });
        }
      };
    });
  }

  // Add item to processor
  async addItem(item) {
    if (this.totalItems >= this.options.maxTotalItems) {
      throw new Error(`Maximum items limit reached: ${this.options.maxTotalItems}`);
    }

    // Add metadata
    const enhancedItem = {
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      memoryId: this.memoryQueue.length
    };

    // Check memory limit
    if (this.memoryQueue.length >= this.options.maxMemoryItems) {
      await this.spillToDatabase();
    }

    this.memoryQueue.push(enhancedItem);
    this.totalItems++;
    
    // Update memory usage estimate
    this.updateMemoryStats();

    return enhancedItem.id;
  }

  // Performance: Add multiple items efficiently
  async addItems(items) {
    if (this.totalItems + items.length > this.options.maxTotalItems) {
      throw new Error(`Adding ${items.length} items would exceed maximum limit: ${this.options.maxTotalItems}`);
    }

    const enhancedItems = items.map((item, index) => ({
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      memoryId: this.memoryQueue.length + index
    }));

    // Check if we need to spill to database
    if (this.memoryQueue.length + enhancedItems.length > this.options.maxMemoryItems) {
      await this.spillToDatabase();
    }

    this.memoryQueue.push(...enhancedItems);
    this.totalItems += enhancedItems.length;
    
    // Update memory usage estimate
    this.updateMemoryStats();

    return enhancedItems.map(item => item.id);
  }

  // Add multiple items in batch
  async addBatch(items) {
    const results = [];
    
    for (const item of items) {
      try {
        const id = await this.addItem(item);
        results.push({ success: true, id });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }

  // Spill memory items to database
  async spillToDatabase() {
    if (this.memoryQueue.length === 0) {return;}

    try {
      // Initialize database if needed
      if (!this.dbQueue) {
        await this.initializeDatabase();
      }

      // Prepare items for spillover
      const itemsToSpill = this.memoryQueue.splice(0, this.options.spillBatchSize);
      
      // Compress if enabled
      let dataToStore = itemsToSpill;
      if (this.options.enableCompression && this.worker) {
        try {
          const compressed = await this.callWorker('compress', itemsToSpill);
          dataToStore = {
            compressed: true,
            data: compressed.compressed,
            originalSize: compressed.originalSize,
            compressedSize: compressed.compressedSize
          };
          
          this.stats.compressionRatio = compressed.ratio;
        } catch (error) {
          console.warn('Compression failed, storing uncompressed:', error);
        }
      }

      // Store in database
      await this.dbQueue.addBatch(dataToStore);
      
      this.spilledItems += itemsToSpill.length;
      this.stats.spillOperations++;
      this.stats.dbUsage = this.spilledItems;
      
      // Update memory stats
      this.updateMemoryStats();
      
      // Notify observers
      this.notifyObservers('memory', {
        spilledCount: itemsToSpill.length,
        totalSpilled: this.spilledItems,
        memoryFreed: this.estimateItemsSize(itemsToSpill)
      });

    } catch (error) {
      console.error('Database spillover failed:', error);
      this.notifyObservers('error', error);
      throw error;
    }
  }

  // Process items in batches
  async processItems(processingFunction, options = {}) {
    if (this.isProcessing) {
      throw new Error('Processing already in progress');
    }

    this.isProcessing = true;
    const results = [];
    
    try {
      // Process memory items first
      const memoryResults = await this.processMemoryItems(processingFunction, options);
      results.push(...memoryResults);
      
      // Process database items
      if (this.dbQueue && this.spilledItems > 0) {
        const dbResults = await this.processDatabaseItems(processingFunction, options);
        results.push(...dbResults);
      }
      
      this.processedItems = results.length;
      return results;
      
    } finally {
      this.isProcessing = false;
    }
  }

  // Process items in memory
  async processMemoryItems(processingFunction, options) {
    const results = [];
    const batchSize = this.options.processingBatchSize;
    
    for (let i = 0; i < this.memoryQueue.length; i += batchSize) {
      const batch = this.memoryQueue.slice(i, i + batchSize);
      
      try {
        // Use worker for processing if available
        let processedBatch;
        if (this.worker && options.useWorker !== false) {
          processedBatch = await this.callWorker('process', {
            items: batch,
            options: options
          });
        } else {
          processedBatch = await this.processBatch(batch, processingFunction, options);
        }
        
        results.push(...processedBatch);
        
        // Update progress
        this.notifyObservers('progress', {
          processed: results.length,
          total: this.totalItems,
          phase: 'memory'
        });
        
        // Allow UI updates
        await this.yield();
        
      } catch (error) {
        console.error('Batch processing failed:', error);
        // Continue with next batch
      }
    }
    
    return results;
  }

  // Process items from database
  async processDatabaseItems(processingFunction, options) {
    const results = [];
    
    try {
      const batches = await this.dbQueue.getAllBatches();
      
      for (const batch of batches) {
        // Decompress if needed
        let items = batch.data;
        if (batch.compressed && this.worker) {
          try {
            items = await this.callWorker('decompress', batch.data);
          } catch (error) {
            console.warn('Decompression failed:', error);
            continue;
          }
        }
        
        // Process batch
        const processedBatch = await this.processBatch(items, processingFunction, options);
        results.push(...processedBatch);
        
        // Update progress
        this.notifyObservers('progress', {
          processed: results.length,
          total: this.spilledItems,
          phase: 'database'
        });
        
        await this.yield();
      }
      
    } catch (error) {
      console.error('Database processing failed:', error);
      this.notifyObservers('error', error);
    }
    
    return results;
  }

  // Process a single batch
  async processBatch(items, processingFunction, options) {
    const results = [];
    
    for (const item of items) {
      try {
        const result = await processingFunction(item, options);
        results.push(result);
      } catch (error) {
        console.warn('Item processing failed:', error);
        results.push({
          ...item,
          processingError: error.message
        });
      }
    }
    
    return results;
  }

  // Worker communication
  async callWorker(type, data) {
    if (!this.worker) {
      throw new Error('Worker not available');
    }

    return new Promise((resolve, reject) => {
      const id = this.generateId();
      
      this.workerCallbacks.set(id, { resolve, reject });
      
      this.worker.postMessage({
        type: type,
        data: data,
        id: id
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.workerCallbacks.has(id)) {
          this.workerCallbacks.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, 30000);
    });
  }

  // Memory management
  updateMemoryStats() {
    this.stats.memoryUsage = this.estimateItemsSize(this.memoryQueue);
  }

  estimateItemsSize(items) {
    // Rough estimate of memory usage
    const sampleSize = Math.min(items.length, 10);
    let totalSize = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      totalSize += JSON.stringify(items[i]).length * 2; // UTF-16 characters
    }
    
    return (totalSize / sampleSize) * items.length;
  }

  // Utility methods
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async yield() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  // Observer pattern for progress/memory/error notifications
  subscribe(event, callback) {
    if (this.observers[event]) {
      this.observers[event].push(callback);
    }
  }

  unsubscribe(event, callback) {
    if (this.observers[event]) {
      const index = this.observers[event].indexOf(callback);
      if (index > -1) {
        this.observers[event].splice(index, 1);
      }
    }
  }

  notifyObservers(event, data) {
    if (this.observers[event]) {
      this.observers[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Observer callback failed:', error);
        }
      });
    }
  }

  // Get current statistics
  getStats() {
    return {
      ...this.stats,
      totalItems: this.totalItems,
      memoryItems: this.memoryQueue.length,
      spilledItems: this.spilledItems,
      processedItems: this.processedItems,
      isProcessing: this.isProcessing,
      memoryUsageEstimate: this.stats.memoryUsage,
      dbUsageEstimate: this.stats.dbUsage
    };
  }

  // Clear all data
  async clear() {
    this.memoryQueue = [];
    this.totalItems = 0;
    this.processedItems = 0;
    this.spilledItems = 0;
    
    if (this.dbQueue) {
      await this.dbQueue.clear();
    }
    
    this.updateMemoryStats();
  }

  // Cleanup
  async destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    if (this.dbQueue) {
      await this.dbQueue.close();
    }
    
    this.observers = { progress: [], memory: [], error: [] };
  }
}

// Enhanced IndexedDB wrapper with batch operations and transaction optimization
class IndexedDBQueue {
  constructor(db) {
    this.db = db;
    this.transactionPool = [];
    this.batchQueue = [];
    this.batchTimeout = null;
    this.batchSize = 100; // Process up to 100 items per transaction
    this.batchDelay = 50; // Wait 50ms before flushing batch
  }

  // Enhanced batch add with transaction pooling
  async addBatch(items) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ items, resolve, reject });
      
      // Clear existing timeout and set new one
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      
      // Process batch immediately if it's full, otherwise wait for timeout
      if (this.batchQueue.length >= this.batchSize) {
        this.processBatchQueue();
      } else {
        this.batchTimeout = setTimeout(() => this.processBatchQueue(), this.batchDelay);
      }
    });
  }

  // Process accumulated batch operations in a single transaction
  async processBatchQueue() {
    if (this.batchQueue.length === 0) {return;}
    
    const batchesToProcess = this.batchQueue.splice(0, this.batchSize);
    
    try {
      const transaction = this.db.transaction(['batches'], 'readwrite');
      const store = transaction.objectStore('batches');
      
      const results = [];
      let completedOperations = 0;
      
      // Add all batches in a single transaction
      batchesToProcess.forEach(({ items, _resolve, reject }, index) => {
        const batchData = {
          data: items,
          timestamp: Date.now(),
          count: Array.isArray(items) ? items.length : 1,
          batchIndex: index
        };
        
        const request = store.add(batchData);
        
        request.onsuccess = () => {
          results[index] = request.result;
          completedOperations++;
          
          if (completedOperations === batchesToProcess.length) {
            // All operations completed successfully
            batchesToProcess.forEach(({ resolve }, i) => resolve(results[i]));
          }
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
      
      transaction.onerror = () => {
        batchesToProcess.forEach(({ reject }) => reject(transaction.error));
      };
      
    } catch (error) {
      batchesToProcess.forEach(({ reject }) => reject(error));
    }
    
    // Continue processing if there are more items
    if (this.batchQueue.length > 0) {
      setTimeout(() => this.processBatchQueue(), 10);
    }
  }

  // Enhanced batch retrieval with cursor-based streaming
  async getAllBatches(options = {}) {
    const { limit, startAfter, includeData = true } = options;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['batches'], 'readonly');
      const store = transaction.objectStore('batches');
      const results = [];
      
      let request;
      if (limit || startAfter) {
        // Use cursor for pagination
        const keyRange = startAfter ? 
          IDBKeyRange.lowerBound(startAfter, true) : 
          undefined;
        request = store.openCursor(keyRange);
      } else {
        // Get all at once for smaller datasets
        request = store.getAll();
      }
      
      if (request.openCursor) {
        // Cursor-based retrieval
        let count = 0;
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && (!limit || count < limit)) {
            const batch = cursor.value;
            if (!includeData) {
              // Strip data for metadata-only queries
              batch.data = null;
              batch.dataSize = batch.count;
            }
            results.push(batch);
            count++;
            cursor.continue();
          } else {
            resolve(results);
          }
        };
      } else {
        // Direct retrieval
        request.onsuccess = () => {
          const batches = request.result;
          if (!includeData) {
            batches.forEach(batch => {
              batch.dataSize = batch.count;
              batch.data = null;
            });
          }
          resolve(batches);
        };
      }
      
      request.onerror = () => reject(request.error);
    });
  }

  // Efficient batch deletion with range operations
  async deleteBatchesOlderThan(timestamp) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['batches'], 'readwrite');
      const store = transaction.objectStore('batches');
      const index = store.index('timestamp');
      
      const keyRange = IDBKeyRange.upperBound(timestamp);
      const request = index.openCursor(keyRange);
      
      let deletedCount = 0;
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Get storage usage statistics
  async getStorageStats() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['batches', 'items'], 'readonly');
      const batchStore = transaction.objectStore('batches');
      const itemStore = transaction.objectStore('items');
      
      const stats = {
        batchCount: 0,
        itemCount: 0,
        totalDataSize: 0,
        oldestBatch: null,
        newestBatch: null
      };
      
      let pendingOperations = 2;
      
      // Count batches
      batchStore.count().onsuccess = (event) => {
        stats.batchCount = event.target.result;
        pendingOperations--;
        if (pendingOperations === 0) {resolve(stats);}
      };
      
      // Count items
      itemStore.count().onsuccess = (event) => {
        stats.itemCount = event.target.result;
        pendingOperations--;
        if (pendingOperations === 0) {resolve(stats);}
      };
      
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clear() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['batches', 'items'], 'readwrite');
      
      const _clearBatches = transaction.objectStore('batches').clear();
      const _clearItems = transaction.objectStore('items').clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  close() {
    // Clear any pending batch operations
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.processBatchQueue(); // Flush remaining items
    }
    
    if (this.db) {
      this.db.close();
    }
  }
}

// Export for use in other modules
window.MemoryOptimizedProcessor = MemoryOptimizedProcessor;

// Usage example:
// const processor = new MemoryOptimizedProcessor({
//   maxMemoryItems: 1000,
//   enableCompression: true
// });
//
// // Add items
// for (const item of scrapedItems) {
//   await processor.addItem(item);
// }
//
// // Process all items
// const results = await processor.processItems(async (item) => {
//   // Process individual item
//   return await downloadItem(item);
// });