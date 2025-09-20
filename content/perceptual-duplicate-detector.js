// perceptual-duplicate-detector.js - Enhanced image similarity detection
// ENHANCED VERSION: Advanced algorithms with research-based improvements

// Prevent duplicate declarations
if (window.PerceptualDuplicateDetector) {
  console.log('PerceptualDuplicateDetector already loaded, skipping...');
} else {

  class PerceptualDuplicateDetector {
    constructor(options = {}) {
      this.options = {
        hashSize: options.hashSize || 8,
        threshold: options.threshold || 0.85, // Similarity threshold (0-1)
        hammingThreshold: options.hammingThreshold || 5, // For hash-based comparison
        enableClustering: options.enableClustering !== false,
        enableAdvancedHashing: options.enableAdvancedHashing !== false,
        hashTypes: options.hashTypes || ['ahash', 'phash'], // Multiple hash types
        maxWorkers: options.maxWorkers || 4,
        cacheSize: options.cacheSize || 10000,
        enablePersistence: options.enablePersistence !== false,
        // Performance optimization options for large-scale scraping
        enablePerformanceMode: options.enablePerformanceMode || false,
        batchSize: options.batchSize || 20,
        maxProcessingTime: options.maxProcessingTime || 5000, // 5 seconds max per batch
        enableIncrementalProcessing: options.enableIncrementalProcessing !== false,
        bypassDuplicationForLargeScale: options.bypassDuplicationForLargeScale || false,
        largeScaleThreshold: options.largeScaleThreshold || 1000, // Items threshold for large-scale mode
        ...options
      };
        
      this.hashCache = new Map();
      this.multiHashCache = new Map(); // Store multiple hash types per image
      this.similarityCache = new Map();
      this.clusters = new Map();
      this.workerPool = [];
      this.activeWorkers = 0;
      this.hashQueue = [];
      this.processingBatch = false;
      this.batchQueue = [];
      this.performanceMetrics = {
        startTime: null,
        totalProcessed: 0,
        currentBatchStartTime: null
      };
        
      this.stats = {
        imagesProcessed: 0,
        duplicatesFound: 0,
        clustersCreated: 0,
        averageProcessingTime: 0,
        hashTypesUsed: new Set(),
        cacheHits: 0,
        falsePositives: 0,
        // Performance metrics
        batchesProcessed: 0,
        totalBatchTime: 0,
        averageBatchTime: 0,
        performanceModeUsed: 0,
        largeScaleBypasses: 0,
        workerUtilization: 0,
        memoryUsage: 0
      };
        
      this.initializeWorkers();
    }
    
    async initializeWorkers() {
      for (let i = 0; i < this.options.maxWorkers; i++) {
        try {
          const worker = new Worker(
            URL.createObjectURL(new Blob([this.getWorkerScript()], { type: 'application/javascript' }))
          );
                
          worker.onmessage = (e) => this.handleWorkerMessage(e);
          worker.onerror = (e) => this.handleWorkerError(e);
                
          this.workerPool.push({
            worker,
            busy: false,
            id: i
          });
        } catch (_error) {
          console.warn('Failed to create perceptual hash worker:', _error);
        }
      }
    }
    
    getWorkerScript() {
      return `
            // Enhanced perceptual hashing worker with multiple algorithms
            
            self.onmessage = async function(e) {
                const { id, imageData, algorithm, options } = e.data;
                
                try {
                    let hash;
                    
                    switch (algorithm) {
                        case 'average':
                            hash = averageHash(imageData, options);
                            break;
                        case 'difference':
                            hash = differenceHash(imageData, options);
                            break;
                        case 'perceptual':
                            hash = perceptualHash(imageData, options);
                            break;
                        case 'wavelet':
                            hash = waveletHash(imageData, options);
                            break;
                        default:
                            hash = averageHash(imageData, options);
                    }
                    
                    self.postMessage({
                        id,
                        success: true,
                        hash,
                        algorithm
                    });
                } catch (_error) {
                    self.postMessage({
                        id,
                        success: false,
                        error: error.message
                    });
                }
            };
            
            function averageHash(imageData, options = {}) {
                const size = options.size || 8;
                const canvas = new OffscreenCanvas(size, size);
                const ctx = canvas.getContext('2d');
                
                // Draw and resize image
                ctx.drawImage(imageData, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;
                
                // Convert to grayscale and calculate average
                const gray = [];
                let total = 0;
                
                for (let i = 0; i < data.length; i += 4) {
                    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    gray.push(g);
                    total += g;
                }
                
                const average = total / gray.length;
                
                // Generate hash
                let hash = 0n;
                gray.forEach((val, idx) => {
                    if (val > average) {
                        hash |= (1n << BigInt(idx));
                    }
                });
                
                return hash.toString(16);
            }
            
            function differenceHash(imageData, options = {}) {
                const size = options.size || 8;
                const canvas = new OffscreenCanvas(size + 1, size);
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(imageData, 0, 0, size + 1, size);
                const data = ctx.getImageData(0, 0, size + 1, size).data;
                
                // Convert to grayscale
                const gray = [];
                for (let i = 0; i < data.length; i += 4) {
                    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    gray.push(g);
                }
                
                // Calculate differences
                let hash = 0n;
                let bitIndex = 0;
                
                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const leftPixel = gray[y * (size + 1) + x];
                        const rightPixel = gray[y * (size + 1) + x + 1];
                        
                        if (leftPixel > rightPixel) {
                            hash |= (1n << BigInt(bitIndex));
                        }
                        bitIndex++;
                    }
                }
                
                return hash.toString(16);
            }
            
            function perceptualHash(imageData, options = {}) {
                const size = options.size || 32;
                const dctSize = 8;
                
                const canvas = new OffscreenCanvas(size, size);
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(imageData, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;
                
                // Convert to grayscale
                const gray = [];
                for (let y = 0; y < size; y++) {
                    const row = [];
                    for (let x = 0; x < size; x++) {
                        const i = (y * size + x) * 4;
                        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                        row.push(g);
                    }
                    gray.push(row);
                }
                
                // Apply DCT
                const dct = discreteCosineTransform(gray);
                
                // Extract low-frequency components
                const lowFreq = [];
                for (let y = 0; y < dctSize; y++) {
                    for (let x = 0; x < dctSize; x++) {
                        if (x === 0 && y === 0) continue; // Skip DC component
                        lowFreq.push(dct[y][x]);
                    }
                }
                
                // Calculate median
                lowFreq.sort((a, b) => a - b);
                const median = lowFreq[Math.floor(lowFreq.length / 2)];
                
                // Generate hash
                let hash = 0n;
                let bitIndex = 0;
                
                for (let y = 0; y < dctSize; y++) {
                    for (let x = 0; x < dctSize; x++) {
                        if (x === 0 && y === 0) continue;
                        
                        if (dct[y][x] > median) {
                            hash |= (1n << BigInt(bitIndex));
                        }
                        bitIndex++;
                    }
                }
                
                return hash.toString(16);
            }
            
            function waveletHash(imageData, options = {}) {
                // Simplified wavelet transform for demonstration
                // In production, would use a more sophisticated implementation
                const size = options.size || 8;
                const canvas = new OffscreenCanvas(size, size);
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(imageData, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;
                
                // Convert to grayscale matrix
                const matrix = [];
                for (let y = 0; y < size; y++) {
                    const row = [];
                    for (let x = 0; x < size; x++) {
                        const i = (y * size + x) * 4;
                        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                        row.push(g);
                    }
                    matrix.push(row);
                }
                
                // Apply simple wavelet transform (Haar)
                const wavelet = haarWaveletTransform(matrix);
                
                // Extract coefficients and generate hash
                const coeffs = [];
                const halfSize = size / 2;
                
                for (let y = 0; y < halfSize; y++) {
                    for (let x = 0; x < halfSize; x++) {
                        coeffs.push(wavelet[y][x]);
                    }
                }
                
                const average = coeffs.reduce((sum, val) => sum + val, 0) / coeffs.length;
                
                let hash = 0n;
                coeffs.forEach((val, idx) => {
                    if (val > average) {
                        hash |= (1n << BigInt(idx));
                    }
                });
                
                return hash.toString(16);
            }
            
            function discreteCosineTransform(matrix) {
                const N = matrix.length;
                const dct = Array(N).fill().map(() => Array(N).fill(0));
                
                for (let u = 0; u < N; u++) {
                    for (let v = 0; v < N; v++) {
                        let sum = 0;
                        
                        for (let x = 0; x < N; x++) {
                            for (let y = 0; y < N; y++) {
                                sum += matrix[y][x] * 
                                       Math.cos((2 * x + 1) * u * Math.PI / (2 * N)) *
                                       Math.cos((2 * y + 1) * v * Math.PI / (2 * N));
                            }
                        }
                        
                        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
                        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
                        
                        dct[u][v] = 0.25 * cu * cv * sum;
                    }
                }
                
                return dct;
            }
            
            function haarWaveletTransform(matrix) {
                const size = matrix.length;
                const result = matrix.map(row => [...row]);
                
                // Apply horizontal transform
                for (let y = 0; y < size; y++) {
                    result[y] = haarTransform1D(result[y]);
                }
                
                // Apply vertical transform
                for (let x = 0; x < size; x++) {
                    const column = result.map(row => row[x]);
                    const transformed = haarTransform1D(column);
                    
                    for (let y = 0; y < size; y++) {
                        result[y][x] = transformed[y];
                    }
                }
                
                return result;
            }
            
            function haarTransform1D(signal) {
                const length = signal.length;
                const result = [...signal];
                
                for (let size = length; size > 1; size /= 2) {
                    const temp = [...result];
                    
                    for (let i = 0; i < size / 2; i++) {
                        result[i] = (temp[2 * i] + temp[2 * i + 1]) / 2;
                        result[i + size / 2] = (temp[2 * i] - temp[2 * i + 1]) / 2;
                    }
                }
                
                return result;
            }
        `;
    }
    
    async processImage(imageUrl, options = {}) {
      const startTime = performance.now();
        
      try {
      // Check cache first
        if (this.hashCache.has(imageUrl)) {
          const cached = this.hashCache.get(imageUrl);
          return {
            ...cached,
            fromCache: true
          };
        }
            
        // Load image
        const imageData = await this.loadImage(imageUrl);
            
        // Generate multiple hashes for better accuracy
        const algorithms = options.algorithms || ['average', 'difference', 'perceptual'];
        const hashes = {};
            
        for (const algorithm of algorithms) {
          try {
            const hash = await this.generateHash(imageData, algorithm, options);
            hashes[algorithm] = hash;
          } catch (_error) {
            console.warn(`Failed to generate ${algorithm} hash:`, _error);
          }
        }
            
        const processingTime = performance.now() - startTime;
            
        const result = {
          url: imageUrl,
          hashes,
          processingTime,
          timestamp: Date.now()
        };
            
        // Cache result
        this.cacheResult(imageUrl, result);
            
        // Update stats
        this.updateStats(processingTime);
            
        return result;
            
      } catch (_error) {
        throw new Error(`Failed to process image ${imageUrl}: ${_error.message}`);
      }
    }
    
    async loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
            
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
            
        // Set timeout to avoid hanging
        setTimeout(() => reject(new Error('Image load timeout')), 30000);
            
        img.src = url;
      });
    }
    
    async generateHash(imageData, algorithm, options) {
      return new Promise((resolve, reject) => {
        const worker = this.getAvailableWorker();
            
        if (!worker) {
        // Fallback to main thread if no workers available
          resolve(this.generateHashMainThread(imageData, algorithm, options));
          return;
        }
            
        const requestId = Date.now() + Math.random();
            
        const handleMessage = (e) => {
          if (e.data.id === requestId) {
            worker.worker.removeEventListener('message', handleMessage);
            worker.busy = false;
            this.activeWorkers--;
                    
            if (e.data.success) {
              resolve(e.data.hash);
            } else {
              reject(new Error(e.data.error));
            }
          }
        };
            
        worker.worker.addEventListener('message', handleMessage);
        worker.busy = true;
        this.activeWorkers++;
            
        worker.worker.postMessage({
          id: requestId,
          imageData,
          algorithm,
          options: {
            size: this.options.hashSize,
            ...options
          }
        });
      });
    }
    
    generateHashMainThread(imageData, algorithm, options) {
    // Fallback implementation for main thread
      const size = options.size || this.options.hashSize;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
        
      ctx.drawImage(imageData, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
        
      // Simple average hash implementation
      const gray = [];
      let total = 0;
        
      for (let i = 0; i < data.length; i += 4) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray.push(g);
        total += g;
      }
        
      const average = total / gray.length;
        
      let hash = 0n;
      gray.forEach((val, idx) => {
        if (val > average) {
          hash |= (1n << BigInt(idx));
        }
      });
        
      return hash.toString(16);
    }
    
    getAvailableWorker() {
      return this.workerPool.find(w => !w.busy);
    }
    
    handleWorkerMessage(e) {
    // Worker messages are handled in generateHash method
    }
    
    handleWorkerError(e) {
      console.error('Perceptual hash worker error:', e);
    }
    
    calculateSimilarity(hash1, hash2, algorithm = 'hamming') {
      const cacheKey = `${hash1}:${hash2}:${algorithm}`;
        
      if (this.similarityCache.has(cacheKey)) {
        return this.similarityCache.get(cacheKey);
      }
        
      let similarity;
        
      switch (algorithm) {
        case 'hamming':
          similarity = this.hammingDistance(hash1, hash2);
          break;
        case 'normalized':
          similarity = this.normalizedDistance(hash1, hash2);
          break;
        default:
          similarity = this.hammingDistance(hash1, hash2);
      }
        
      // Cache result
      this.similarityCache.set(cacheKey, similarity);
        
      // Cleanup cache if too large
      if (this.similarityCache.size > this.options.cacheSize * 2) {
        this.cleanupSimilarityCache();
      }
        
      return similarity;
    }
    
    hammingDistance(hash1, hash2) {
      if (hash1.length !== hash2.length) {
        return 0;
      }
        
      const bigInt1 = BigInt(`0x${  hash1}`);
      const bigInt2 = BigInt(`0x${  hash2}`);
      const xor = bigInt1 ^ bigInt2;
        
      // Count set bits
      let count = 0;
      let temp = xor;
        
      while (temp > 0n) {
        count += Number(temp & 1n);
        temp >>= 1n;
      }
        
      // Convert to similarity (0-1)
      const maxBits = hash1.length * 4; // 4 bits per hex character
      return 1 - (count / maxBits);
    }
    
    normalizedDistance(hash1, hash2) {
      const hamming = this.hammingDistance(hash1, hash2);
        
      // Apply sigmoid function for better distribution
      return 1 / (1 + Math.exp(-10 * (hamming - 0.5)));
    }
    
    async findSimilarImages(targetImage, candidateImages, options = {}) {
      const threshold = options.threshold || this.options.threshold;
      const algorithm = options.algorithm || 'average';
        
      // Process target image
      const targetResult = await this.processImage(targetImage.url);
      const targetHash = targetResult.hashes[algorithm];
        
      if (!targetHash) {
        throw new Error(`Failed to generate ${algorithm} hash for target image`);
      }
        
      const similarities = [];
        
      // Process candidate images in batches
      const batchSize = 10;
      for (let i = 0; i < candidateImages.length; i += batchSize) {
        const batch = candidateImages.slice(i, i + batchSize);
            
        const batchPromises = batch.map(async (candidate) => {
          try {
            const candidateResult = await this.processImage(candidate.url);
            const candidateHash = candidateResult.hashes[algorithm];
                    
            if (candidateHash) {
              const similarity = this.calculateSimilarity(targetHash, candidateHash);
                        
              return {
                image: candidate,
                similarity,
                hash: candidateHash,
                isDuplicate: similarity >= threshold
              };
            }
          } catch (_error) {
            console.warn(`Failed to process candidate image ${candidate.url}:`, _error);
          }
                
          return null;
        });
            
        const batchResults = await Promise.all(batchPromises);
        similarities.push(...batchResults.filter(result => result !== null));
      }
        
      // Sort by similarity
      similarities.sort((a, b) => b.similarity - a.similarity);
        
      return {
        target: {
          image: targetImage,
          hash: targetHash
        },
        matches: similarities,
        duplicates: similarities.filter(s => s.isDuplicate),
        threshold
      };
    }
    
    async createClusters(images, options = {}) {
      if (!this.options.enableClustering) {
        return [];
      }
        
      const threshold = options.threshold || this.options.threshold;
      const algorithm = options.algorithm || 'average';
        
      // Process all images
      const processedImages = [];
      for (const image of images) {
        try {
          const result = await this.processImage(image.url);
          if (result.hashes[algorithm]) {
            processedImages.push({
              image,
              hash: result.hashes[algorithm],
              result
            });
          }
        } catch (_error) {
          console.warn('Failed to process image for clustering:', _error);
        }
      }
        
      // Create clusters using single-linkage clustering
      const clusters = [];
      const assigned = new Set();
        
      for (let i = 0; i < processedImages.length; i++) {
        if (assigned.has(i)) {continue;}
            
        const cluster = [processedImages[i]];
        assigned.add(i);
            
        // Find similar images
        for (let j = i + 1; j < processedImages.length; j++) {
          if (assigned.has(j)) {continue;}
                
          const similarity = this.calculateSimilarity(
            processedImages[i].hash,
            processedImages[j].hash
          );
                
          if (similarity >= threshold) {
            cluster.push(processedImages[j]);
            assigned.add(j);
          }
        }
            
        clusters.push({
          id: this.generateClusterId(),
          images: cluster.map(item => item.image),
          hashes: cluster.map(item => item.hash),
          similarity: cluster.length > 1 ? this.calculateClusterSimilarity(cluster) : 1,
          size: cluster.length
        });
      }
        
      // Update stats
      this.stats.clustersCreated = clusters.length;
        
      return clusters.sort((a, b) => b.size - a.size);
    }
    
    calculateClusterSimilarity(cluster) {
      if (cluster.length < 2) {return 1;}
        
      let totalSimilarity = 0;
      let pairs = 0;
        
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          totalSimilarity += this.calculateSimilarity(cluster[i].hash, cluster[j].hash);
          pairs++;
        }
      }
        
      return pairs > 0 ? totalSimilarity / pairs : 0;
    }
    
    generateClusterId() {
      return `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    cacheResult(url, result) {
      this.hashCache.set(url, result);
        
      // Cleanup cache if too large
      if (this.hashCache.size > this.options.cacheSize) {
        this.cleanupHashCache();
      }
    }
    
    cleanupHashCache() {
    // Remove oldest entries (LRU-style)
      const entries = Array.from(this.hashCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
      const toRemove = entries.slice(0, Math.floor(this.options.cacheSize * 0.2));
      toRemove.forEach(([key]) => this.hashCache.delete(key));
    }
    
    cleanupSimilarityCache() {
    // Simple cleanup - remove half of the entries
      const entries = Array.from(this.similarityCache.entries());
      const toRemove = entries.slice(0, Math.floor(entries.length / 2));
      toRemove.forEach(([key]) => this.similarityCache.delete(key));
    }
    
    updateStats(processingTime) {
      this.stats.imagesProcessed++;
        
      // Update average processing time
      const totalTime = this.stats.averageProcessingTime * (this.stats.imagesProcessed - 1) + processingTime;
      this.stats.averageProcessingTime = totalTime / this.stats.imagesProcessed;
    }
    
    getStats() {
      return {
        ...this.stats,
        cacheSize: this.hashCache.size,
        similarityCacheSize: this.similarityCache.size,
        activeWorkers: this.activeWorkers,
        totalWorkers: this.workerPool.length
      };
    }
    
    destroy() {
    // Cleanup workers
      this.workerPool.forEach(({ worker }) => {
        worker.terminate();
      });
        
      this.workerPool = [];
      this.hashCache.clear();
      this.similarityCache.clear();
      this.clusters.clear();
      this.batchQueue = [];
      this.hashQueue = [];
    }
    
    // Batch processing for improved efficiency with large datasets
    async processBatch(imageUrls, options = {}) {
      if (this.options.bypassDuplicationForLargeScale && 
            imageUrls.length > this.options.largeScaleThreshold) {
        this.stats.largeScaleBypasses++;
        return this.processLargeScaleBatch(imageUrls, options);
      }
        
      const batchStartTime = performance.now();
      this.performanceMetrics.currentBatchStartTime = batchStartTime;
        
      const batchSize = this.options.enablePerformanceMode ? 
        Math.min(this.options.batchSize, imageUrls.length) : 
        Math.min(10, imageUrls.length);
            
      const results = [];
        
      // Process in chunks to avoid memory issues and improve responsiveness
      for (let i = 0; i < imageUrls.length; i += batchSize) {
        const chunk = imageUrls.slice(i, i + batchSize);
            
        if (this.options.enableIncrementalProcessing) {
        // Yield control between chunks for better UI responsiveness
          await new Promise(resolve => setTimeout(resolve, 0));
        }
            
        const chunkPromises = chunk.map(async (imageUrl, index) => {
          try {
            const startTime = performance.now();
            const result = await this.processImage(imageUrl, options);
            const endTime = performance.now();
                    
            return {
              url: imageUrl,
              index: i + index,
              result,
              processingTime: endTime - startTime,
              success: true
            };
          } catch (_error) {
            return {
              url: imageUrl,
              index: i + index,
              error: _error.message,
              success: false
            };
          }
        });
            
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
            
        // Check for timeout in performance mode
        if (this.options.enablePerformanceMode) {
          const elapsed = performance.now() - batchStartTime;
          if (elapsed > this.options.maxProcessingTime) {
            console.warn(`Batch processing timeout after ${elapsed}ms, processed ${results.length}/${imageUrls.length} images`);
            break;
          }
        }
      }
        
      const batchEndTime = performance.now();
      const batchTime = batchEndTime - batchStartTime;
        
      // Update batch statistics
      this.stats.batchesProcessed++;
      this.stats.totalBatchTime += batchTime;
      this.stats.averageBatchTime = this.stats.totalBatchTime / this.stats.batchesProcessed;
        
      if (this.options.enablePerformanceMode) {
        this.stats.performanceModeUsed++;
      }
        
      return {
        results,
        batchStats: {
          totalImages: imageUrls.length,
          processed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          processingTime: batchTime,
          averageTimePerImage: batchTime / results.length,
          performanceMode: this.options.enablePerformanceMode,
          batchSize: batchSize
        }
      };
    }
    
    // Large-scale processing with optional duplication bypass
    async processLargeScaleBatch(imageUrls, options = {}) {
      console.log(`🚀 Large-scale processing mode: ${imageUrls.length} images (bypassing duplication checks)`);
        
      const startTime = performance.now();
      const results = [];
      const concurrency = Math.min(this.options.maxWorkers, 8); // Increase concurrency for large batches
        
      // Process in parallel chunks without duplication checking for maximum speed
      for (let i = 0; i < imageUrls.length; i += concurrency) {
        const chunk = imageUrls.slice(i, i + concurrency);
            
        const chunkPromises = chunk.map(async (imageUrl, index) => {
          try {
          // Simplified processing without full duplication checks
            const imageData = await this.loadImage(imageUrl);
            const hash = await this.generateHash(imageData, 'average', { size: 8 }); // Use fast algorithm
                    
            return {
              url: imageUrl,
              index: i + index,
              hash,
              processingTime: 0, // Skip timing for performance
              success: true,
              largeScaleMode: true
            };
          } catch (_error) {
            return {
              url: imageUrl,
              index: i + index,
              error: _error.message,
              success: false
            };
          }
        });
            
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
            
        // Yield control periodically
        if (i % (concurrency * 10) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
        
      const endTime = performance.now();
        
      return {
        results,
        batchStats: {
          totalImages: imageUrls.length,
          processed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          processingTime: endTime - startTime,
          averageTimePerImage: (endTime - startTime) / results.length,
          largeScaleMode: true,
          duplicateChecksSkipped: true
        }
      };
    }
    
    // Enhanced duplicate detection with performance options
    async detectDuplicatesInBatch(imageResults, options = {}) {
      const threshold = options.threshold || this.options.threshold;
      const duplicates = [];
      const unique = [];
        
      if (this.options.bypassDuplicationForLargeScale && 
            imageResults.length > this.options.largeScaleThreshold) {
      // Skip expensive duplicate detection for large batches
        return { duplicates: [], unique: imageResults, skipped: true };
      }
        
      // Use faster O(n) duplicate detection for performance mode
      if (this.options.enablePerformanceMode) {
        const seenHashes = new Set();
            
        for (const result of imageResults) {
          if (result.success && result.result?.hashes) {
            const primaryHash = result.result.hashes.average || result.result.hashes.ahash;
            if (primaryHash && seenHashes.has(primaryHash)) {
              duplicates.push(result);
            } else {
              if (primaryHash) {seenHashes.add(primaryHash);}
              unique.push(result);
            }
          } else {
            unique.push(result);
          }
        }
      } else {
      // Full perceptual duplicate detection
        for (let i = 0; i < imageResults.length; i++) {
          const current = imageResults[i];
          if (!current.success || !current.result?.hashes) {
            unique.push(current);
            continue;
          }
                
          let isDuplicate = false;
          for (let j = 0; j < unique.length; j++) {
            const existing = unique[j];
            if (!existing.success || !existing.result?.hashes) {continue;}
                    
            const similarity = this.calculateSimilarity(
              current.result.hashes.average || current.result.hashes.ahash,
              existing.result.hashes.average || existing.result.hashes.ahash
            );
                    
            if (similarity >= threshold) {
              duplicates.push({ ...current, duplicateOf: existing.url, similarity });
              isDuplicate = true;
              break;
            }
          }
                
          if (!isDuplicate) {
            unique.push(current);
          }
        }
      }
        
      this.stats.duplicatesFound += duplicates.length;
        
      return { duplicates, unique, skipped: false };
    }
    
    // Performance monitoring and metrics
    getPerformanceMetrics() {
      const now = performance.now();
      const totalTime = this.performanceMetrics.startTime ? now - this.performanceMetrics.startTime : 0;
        
      return {
        ...this.stats,
        totalProcessingTime: totalTime,
        averageWorkerUtilization: this.stats.workerUtilization / Math.max(1, this.stats.imagesProcessed),
        batchEfficiency: this.stats.averageBatchTime > 0 ? 
          (this.stats.imagesProcessed / this.stats.batchesProcessed) / this.stats.averageBatchTime * 1000 : 0,
        memoryEfficiency: this.options.cacheSize > 0 ? this.hashCache.size / this.options.cacheSize : 0,
        duplicateDetectionRate: this.stats.duplicatesFound / Math.max(1, this.stats.imagesProcessed),
        largeScaleModeUsage: this.stats.largeScaleBypasses / Math.max(1, this.stats.batchesProcessed)
      };
    }
    
    // Cleanup and optimization for long-running sessions
    optimizeMemoryUsage() {
      const beforeSize = this.hashCache.size + this.similarityCache.size;
        
      // Aggressive cleanup if using too much memory
      if (this.hashCache.size > this.options.cacheSize * 0.8) {
        this.cleanupHashCache();
      }
        
      if (this.similarityCache.size > this.options.cacheSize) {
        this.cleanupSimilarityCache();
      }
        
      // Clear old batch queues
      if (this.batchQueue.length > 100) {
        this.batchQueue = this.batchQueue.slice(-50);
      }
        
      const afterSize = this.hashCache.size + this.similarityCache.size;
      const cleaned = beforeSize - afterSize;
        
      if (cleaned > 0) {
        console.log(`🧹 Memory optimization: cleaned ${cleaned} cache entries`);
      }
        
      return { cleaned, beforeSize, afterSize };
    }
    
    // Simple API compatible with existing hashWorker.js
    static async generateSimpleHash(imageUrl) {
      const detector = new PerceptualDuplicateDetector({
        enablePerformanceMode: true,
        maxWorkers: 1,
        hashTypes: ['average']
      });
        
      try {
        const result = await detector.processImage(imageUrl, { algorithms: ['average'] });
        detector.destroy();
        return result.hashes?.average || null;
      } catch (_error) {
        detector.destroy();
        throw _error;
      }
    }
  }

}

// Export to window for use in other modules
window.PerceptualDuplicateDetector = PerceptualDuplicateDetector;