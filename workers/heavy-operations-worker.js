// heavy-operations-worker.js - Web worker for CPU-intensive tasks
// Handles hashing, compression, and image processing to keep UI responsive

const workerTasks = {
  // Image hash computation for duplicate detection
  async computeImageHash(imageData, options = {}) {
    const { algorithm = 'difference', precision = 8 } = options;
    
    try {
      // Simple difference hash algorithm
      if (algorithm === 'difference') {
        return computeDifferenceHash(imageData, precision);
      }
      
      // Average hash algorithm
      if (algorithm === 'average') {
        return computeAverageHash(imageData, precision);
      }
      
      throw new Error(`Unknown hash algorithm: ${algorithm}`);
    } catch (error) {
      throw new Error(`Hash computation failed: ${error.message}`);
    }
  },
  
  // Compress text data (JSON, CSV, etc.)
  async compressData(data, options = {}) {
    const { format = 'gzip', level = 6 } = options;
    
    try {
      // Simple compression using built-in APIs
      const encoder = new TextEncoder();
      const inputBytes = encoder.encode(data);
      
      // Use CompressionStream if available (modern browsers)
      if (typeof CompressionStream !== 'undefined') {
        const compressionStream = new CompressionStream(format);
        const writer = compressionStream.writable.getWriter();
        const reader = compressionStream.readable.getReader();
        
        await writer.write(inputBytes);
        await writer.close();
        
        const chunks = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }
        
        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        return result;
      }
      
      // Fallback: return original data
      return inputBytes;
    } catch (error) {
      throw new Error(`Compression failed: ${error.message}`);
    }
  },
  
  // Process batch of images for quality analysis
  async processBatchImages(imageUrls, options = {}) {
    const { maxConcurrency = 3, timeout = 10000 } = options;
    const results = [];
    
    try {
      // Process images in batches to avoid overwhelming the worker
      for (let i = 0; i < imageUrls.length; i += maxConcurrency) {
        const batch = imageUrls.slice(i, i + maxConcurrency);
        
        const batchPromises = batch.map(async (url) => {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Processing timeout')), timeout)
          );
          
          const processPromise = processImageUrl(url);
          
          try {
            return await Promise.race([processPromise, timeoutPromise]);
          } catch (error) {
            return { url, error: error.message };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Yield control between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return results;
    } catch (error) {
      throw new Error(`Batch processing failed: ${error.message}`);
    }
  }
};

// Hash computation functions
function computeDifferenceHash(imageData, precision) {
  const size = precision + 1;
  const resized = resizeImageData(imageData, size, precision);
  const gray = convertToGrayscale(resized);
  
  let hash = '';
  for (let y = 0; y < precision; y++) {
    for (let x = 0; x < precision; x++) {
      const left = gray[y * size + x];
      const right = gray[y * size + (x + 1)];
      hash += left > right ? '1' : '0';
    }
  }
  
  return hash;
}

function computeAverageHash(imageData, precision) {
  const resized = resizeImageData(imageData, precision, precision);
  const gray = convertToGrayscale(resized);
  
  // Calculate average
  const total = gray.reduce((sum, val) => sum + val, 0);
  const average = total / gray.length;
  
  // Generate hash
  let hash = '';
  for (const pixel of gray) {
    hash += pixel > average ? '1' : '0';
  }
  
  return hash;
}

function resizeImageData(imageData, width, height) {
  // Simple nearest-neighbor resizing
  const { data, width: originalWidth, height: originalHeight } = imageData;
  const resized = new Uint8ClampedArray(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor((x / width) * originalWidth);
      const srcY = Math.floor((y / height) * originalHeight);
      const srcIndex = (srcY * originalWidth + srcX) * 4;
      const destIndex = (y * width + x) * 4;
      
      resized[destIndex] = data[srcIndex];       // R
      resized[destIndex + 1] = data[srcIndex + 1]; // G
      resized[destIndex + 2] = data[srcIndex + 2]; // B
      resized[destIndex + 3] = data[srcIndex + 3]; // A
    }
  }
  
  return { data: resized, width, height };
}

function convertToGrayscale(imageData) {
  const { data, width, height } = imageData;
  const gray = new Array(width * height);
  
  for (let i = 0; i < gray.length; i++) {
    const pixelIndex = i * 4;
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    
    // Standard grayscale conversion
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  
  return gray;
}

async function processImageUrl(url) {
  // Placeholder for image processing
  // In a real implementation, this would load and analyze the image
  return {
    url,
    processed: true,
    timestamp: Date.now(),
    size: Math.random() * 1000000, // Mock size
    format: url.split('.').pop() || 'unknown'
  };
}

// Worker message handler
self.onmessage = async function(event) {
  const { id, task, data, options = {} } = event.data;
  
  try {
    if (!workerTasks[task]) {
      throw new Error(`Unknown task: ${task}`);
    }
    
    const result = await workerTasks[task](data, options);
    
    self.postMessage({
      id,
      success: true,
      result
    });
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};

// Worker initialization
self.postMessage({ type: 'ready' });