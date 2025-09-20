// advanced-export-system.js - Professional export formats with comprehensive reporting
// Based on research from multiple extensions and enterprise requirements

// Note: ES6 export commented out for importScripts compatibility  
// export class AdvancedExportSystem {
class AdvancedExportSystem {
  constructor(options = {}) {
    this.options = {
      enableCompression: options.enableCompression !== false,
      includeMetadata: options.includeMetadata !== false,
      includeThumbnails: options.includeThumbnails !== false,
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      tempStorage: options.tempStorage || 'memory', // 'memory' or 'indexeddb'
      ...options
    };

    this.exportStats = {
      totalExports: 0,
      formatCounts: {},
      averageExportTime: 0,
      totalDataExported: 0
    };

    this.tempData = new Map();
    this.exportHistory = [];
  }

  // Main export method supporting multiple formats
  async exportData(data, format, filename, options = {}) {
    const startTime = Date.now();
    
    try {
      const exportOptions = { ...this.options, ...options };
      
      // Validate data
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Invalid data format: expected object with items array');
      }

      let result;
      
      switch (format.toLowerCase()) {
        case 'xlsx':
        case 'excel':
          result = await this.exportToExcel(data, filename, exportOptions);
          break;
          
        case 'csv':
          result = await this.exportToCSV(data, filename, exportOptions);
          break;
          
        case 'json':
          result = await this.exportToJSON(data, filename, exportOptions);
          break;
          
        case 'html':
          result = await this.exportToHTML(data, filename, exportOptions);
          break;
          
        case 'xml':
          result = await this.exportToXML(data, filename, exportOptions);
          break;
          
        case 'zip':
          result = await this.exportToZip(data, filename, exportOptions);
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      // Update statistics
      const exportTime = Date.now() - startTime;
      this.updateStats(format, exportTime, result.size);
      
      // Add to history
      this.exportHistory.push({
        timestamp: Date.now(),
        format: format,
        filename: filename,
        itemCount: data.items.length,
        fileSize: result.size,
        exportTime: exportTime
      });
      
      return {
        success: true,
        data: result.data,
        filename: result.filename,
        size: result.size,
        mimeType: result.mimeType,
        exportTime: exportTime
      };
      
    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false,
        error: error.message,
        exportTime: Date.now() - startTime
      };
    }
  }

  // Excel export with multiple sheets and formatting
  async exportToExcel(data, filename, options) {
    try {
      // Import XLSX library (in service worker context, this should be loaded via importScripts)
      if (typeof XLSX === 'undefined') {
        throw new Error('XLSX library not available');
      }

      const workbook = XLSX.utils.book_new();
      
      // Main items sheet
      const itemsSheet = this.createItemsSheet(data.items, options);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
      
      // Summary sheet
      if (data.summary) {
        const summarySheet = this.createSummarySheet(data.summary, options);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      }
      
      // Statistics sheet
      const statsSheet = this.createStatsSheet(data, options);
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');
      
      // Error log sheet (if errors exist)
      if (data.errors && data.errors.length > 0) {
        const errorSheet = this.createErrorSheet(data.errors, options);
        XLSX.utils.book_append_sheet(workbook, errorSheet, 'Errors');
      }
      
      // Duplicate groups sheet (if available)
      if (data.duplicateGroups && data.duplicateGroups.length > 0) {
        const dupSheet = this.createDuplicateSheet(data.duplicateGroups, options);
        XLSX.utils.book_append_sheet(workbook, dupSheet, 'Duplicates');
      }
      
      // Generate file
      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        compression: options.enableCompression
      });
      
      const finalFilename = this.ensureExtension(filename || 'export', 'xlsx');
      
      return {
        data: excelBuffer,
        filename: finalFilename,
        size: excelBuffer.byteLength,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
      
    } catch (error) {
      throw new Error(`Excel export failed: ${error.message}`);
    }
  }

  // Enhanced CSV export with proper escaping and metadata
  async exportToCSV(data, filename, options) {
    try {
      const rows = [];
      
      // Headers
      const headers = this.generateCSVHeaders(data.items, options);
      rows.push(headers.join(','));
      
      // Data rows
      for (const item of data.items) {
        const row = this.itemToCSVRow(item, headers, options);
        rows.push(row.join(','));
      }
      
      // Add summary information at the end if requested
      if (options.includeSummary && data.summary) {
        rows.push(''); // Empty line
        rows.push('SUMMARY');
        
        Object.entries(data.summary).forEach(([key, value]) => {
          rows.push(`${this.escapeCSV(key)},${this.escapeCSV(value)}`);
        });
      }
      
      const csvContent = rows.join('\n');
      const csvBuffer = new TextEncoder().encode(csvContent);
      const finalFilename = this.ensureExtension(filename || 'export', 'csv');
      
      return {
        data: csvBuffer,
        filename: finalFilename,
        size: csvBuffer.byteLength,
        mimeType: 'text/csv'
      };
      
    } catch (error) {
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  // Enhanced JSON export with compression and formatting
  async exportToJSON(data, filename, options) {
    try {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: '2.0',
          format: 'StepTwo Gallery Scraper Export',
          url: data.sourceUrl || 'unknown',
          userAgent: navigator.userAgent
        },
        summary: data.summary || {},
        items: data.items || [],
        statistics: data.statistics || {},
        errors: data.errors || [],
        duplicateGroups: data.duplicateGroups || [],
        extractionMethods: data.extractionMethods || [],
        processingLog: data.processingLog || []
      };
      
      // Remove empty arrays if not needed
      if (!options.includeEmptyArrays) {
        Object.keys(exportData).forEach(key => {
          if (Array.isArray(exportData[key]) && exportData[key].length === 0) {
            delete exportData[key];
          }
        });
      }
      
      const jsonString = JSON.stringify(exportData, null, options.prettify ? 2 : 0);
      
      let finalData;
      if (options.enableCompression && jsonString.length > 10000) {
        // Use compression for large files
        finalData = await this.compressString(jsonString);
      } else {
        finalData = new TextEncoder().encode(jsonString);
      }
      
      const finalFilename = this.ensureExtension(filename || 'export', 'json');
      
      return {
        data: finalData,
        filename: finalFilename,
        size: finalData.byteLength,
        mimeType: 'application/json'
      };
      
    } catch (error) {
      throw new Error(`JSON export failed: ${error.message}`);
    }
  }

  // HTML export with embedded styling and interactivity
  async exportToHTML(data, filename, options) {
    try {
      const html = this.generateHTMLReport(data, options);
      const htmlBuffer = new TextEncoder().encode(html);
      const finalFilename = this.ensureExtension(filename || 'export', 'html');
      
      return {
        data: htmlBuffer,
        filename: finalFilename,
        size: htmlBuffer.byteLength,
        mimeType: 'text/html'
      };
      
    } catch (error) {
      throw new Error(`HTML export failed: ${error.message}`);
    }
  }

  // PDF export using HTML to PDF conversion
  async exportToPDF(data, filename, options) {
    try {
      // Generate HTML first
      const _html = this.generateHTMLReport(data, { ...options, pdfOptimized: true });
      
      // Convert to PDF (would need a PDF library like jsPDF or Puppeteer)
      // For now, we'll create a basic PDF structure
      const pdfContent = this.generateBasicPDF(data, options);
      
      const finalFilename = this.ensureExtension(filename || 'export', 'pdf');
      
      return {
        data: pdfContent,
        filename: finalFilename,
        size: pdfContent.byteLength,
        mimeType: 'application/pdf'
      };
      
    } catch (error) {
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  // XML export with proper structure
  async exportToXML(data, filename, options) {
    try {
      const xml = this.generateXMLContent(data, options);
      const xmlBuffer = new TextEncoder().encode(xml);
      const finalFilename = this.ensureExtension(filename || 'export', 'xml');
      
      return {
        data: xmlBuffer,
        filename: finalFilename,
        size: xmlBuffer.byteLength,
        mimeType: 'application/xml'
      };
      
    } catch (error) {
      throw new Error(`XML export failed: ${error.message}`);
    }
  }

  // ZIP export with multiple files
  async exportToZip(data, filename, options) {
    try {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not available');
      }

      const zip = new JSZip();
      
      // Add main data file
      const jsonData = await this.exportToJSON(data, 'data.json', options);
      zip.file('data.json', jsonData.data);
      
      // Add CSV for compatibility
      const csvData = await this.exportToCSV(data, 'items.csv', options);
      zip.file('items.csv', csvData.data);
      
      // Add HTML report
      const htmlData = await this.exportToHTML(data, 'report.html', options);
      zip.file('report.html', htmlData.data);
      
      // Add metadata file
      const metadata = {
        exportDate: new Date().toISOString(),
        totalItems: data.items?.length || 0,
        sourceUrl: data.sourceUrl || 'unknown',
        exportOptions: options
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      
      // Add thumbnails if requested and available
      if (options.includeThumbnails && data.items) {
        const thumbFolder = zip.folder('thumbnails');
        for (let i = 0; i < Math.min(data.items.length, 100); i++) {
          const item = data.items[i];
          if (item.thumbnail || item.image) {
            try {
              const imageData = await this.downloadImageAsBlob(item.thumbnail || item.image);
              const extension = this.getImageExtension(item.thumbnail || item.image);
              thumbFolder.file(`thumb_${i}.${extension}`, imageData);
            } catch (error) {
              console.warn('Failed to add thumbnail:', error);
            }
          }
        }
      }
      
      // Generate ZIP
      const zipBlob = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const finalFilename = this.ensureExtension(filename || 'export', 'zip');
      
      return {
        data: zipBlob,
        filename: finalFilename,
        size: zipBlob.byteLength,
        mimeType: 'application/zip'
      };
      
    } catch (error) {
      throw new Error(`ZIP export failed: ${error.message}`);
    }
  }

  // Helper methods for creating Excel sheets
  createItemsSheet(items, options) {
    const sheetData = [];
    
    // Generate headers based on selectedFields or default
    const headers = this.generateCSVHeaders(items, options);
    sheetData.push(headers);
    
    // Data rows
    items.forEach((item, index) => {
      const row = this.itemToCSVRow({...item, index: index + 1}, headers, options)
        .map(cell => typeof cell === 'string' && cell.startsWith('"') && cell.endsWith('"') ? 
          cell.slice(1, -1).replace(/""/g, '"') : cell); // Remove CSV escaping for Excel
      sheetData.push(row);
    });
    
    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  createSummarySheet(summary, options) {
    const sheetData = [
      ['Summary Report', ''],
      ['', ''],
      ['Total Items', summary.totalItems || 0],
      ['Successful Extractions', summary.successful || 0],
      ['Failed Extractions', summary.failed || 0],
      ['Duplicate Items', summary.duplicates || 0],
      ['Average Processing Time', summary.averageProcessingTime || 0],
      ['Total Processing Time', summary.totalProcessingTime || 0],
      ['Source URL', summary.sourceUrl || ''],
      ['Export Date', new Date().toISOString()]
    ];
    
    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  createStatsSheet(data, options) {
    const sheetData = [
      ['Statistics', ''],
      ['', ''],
      ['Extraction Methods Used', '']
    ];
    
    if (data.extractionMethods) {
      data.extractionMethods.forEach(method => {
        sheetData.push([method.name, method.count]);
      });
    }
    
    sheetData.push(['', '']);
    sheetData.push(['Error Types', '']);
    
    if (data.errorStats) {
      Object.entries(data.errorStats).forEach(([type, count]) => {
        sheetData.push([type, count]);
      });
    }
    
    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  // HTML report generation
  generateHTMLReport(data, options) {
    const items = data.items || [];
    const summary = data.summary || {};
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gallery Scraper Report</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f5; line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; margin: 0 0 30px 0; font-size: 2.5em; }
        h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 40px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; display: block; }
        .stat-label { opacity: 0.9; margin-top: 5px; }
        .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
        .item-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; transition: transform 0.2s; }
        .item-card:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .item-image { width: 100%; height: 200px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .item-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .item-info { padding: 15px; }
        .item-title { font-weight: 600; margin: 0 0 10px 0; color: #1f2937; }
        .item-url { font-size: 0.9em; color: #6b7280; word-break: break-all; margin: 5px 0; }
        .item-meta { display: flex; justify-content: space-between; font-size: 0.8em; color: #9ca3af; margin-top: 10px; }
        .quality-score { display: inline-block; background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background: #f9fafb; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        .error-list { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0; }
        .error-item { color: #dc2626; margin: 5px 0; }
        @media print {
            .container { box-shadow: none; margin: 0; }
            .item-card { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Gallery Scraper Report</h1>
        
        <div class="summary">
            <div class="stat-card">
                <span class="stat-number">${items.length}</span>
                <span class="stat-label">Total Items</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${summary.successful || items.length}</span>
                <span class="stat-label">Successful</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${summary.failed || 0}</span>
                <span class="stat-label">Failed</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${summary.duplicates || 0}</span>
                <span class="stat-label">Duplicates</span>
            </div>
        </div>

        <h2>📋 Export Information</h2>
        <table>
            <tr><td><strong>Export Date</strong></td><td>${new Date().toLocaleString()}</td></tr>
            <tr><td><strong>Source URL</strong></td><td><a href="${summary.sourceUrl || 'unknown'}" target="_blank">${summary.sourceUrl || 'unknown'}</a></td></tr>
            <tr><td><strong>Processing Time</strong></td><td>${summary.totalProcessingTime || 'N/A'}</td></tr>
            <tr><td><strong>User Agent</strong></td><td>${navigator.userAgent}</td></tr>
        </table>

        ${data.errors && data.errors.length > 0 ? `
        <h2>❌ Errors</h2>
        <div class="error-list">
            ${data.errors.map(error => `<div class="error-item">• ${error}</div>`).join('')}
        </div>
        ` : ''}

        <h2>🖼️ Extracted Items</h2>
        <div class="items-grid">
            ${items.slice(0, 100).map((item, index) => `
                <div class="item-card">
                    <div class="item-image">
                        ${item.thumbnail || item.image ? 
    `<img src="${item.thumbnail || item.image}" alt="Image ${index + 1}" loading="lazy" onerror="this.style.display='none';">` :
    '<span>No Image</span>'
}
                    </div>
                    <div class="item-info">
                        <div class="item-title">${item.text || `Item ${index + 1}`}</div>
                        ${item.image ? `<div class="item-url">🖼️ ${item.image}</div>` : ''}
                        ${item.link ? `<div class="item-url">🔗 <a href="${item.link}" target="_blank">Source Link</a></div>` : ''}
                        <div class="item-meta">
                            <span>${item.extractionMethod || 'standard'}</span>
                            ${item.enhanced?.qualityScore ? `<span class="quality-score">${item.enhanced.qualityScore}/100</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        ${items.length > 100 ? `<p><em>Showing first 100 items of ${items.length} total.</em></p>` : ''}
        
        <h2>📈 Statistics</h2>
        <table>
            ${data.extractionMethods ? data.extractionMethods.map(method => 
    `<tr><td>${method.name}</td><td>${method.count} items</td></tr>`
  ).join('') : ''}
        </table>
        
        <footer style="margin-top: 50px; text-align: center; color: #6b7280; font-size: 0.9em;">
            Generated by StepTwo Gallery Scraper v2.0 • ${new Date().toLocaleString()}
        </footer>
    </div>
</body>
</html>`;
  }

  // Utility methods
  generateCSVHeaders(items, options) {
    // Use selectedFields from options if provided, otherwise use defaults
    if (options.selectedFields && Array.isArray(options.selectedFields) && options.selectedFields.length > 0) {
      return options.selectedFields.map(field => this.getFieldLabel(field));
    }
    
    const baseHeaders = ['Index', 'Image URL', 'Thumbnail URL', 'Link', 'Text'];
    
    if (options.includeMetadata && items.length > 0) {
      const sampleItem = items[0];
      if (sampleItem.enhanced) {
        baseHeaders.push('Quality Score', 'Extraction Method', 'Processing Time');
      }
      if (sampleItem.metadata) {
        baseHeaders.push('Container Info', 'Element Classes');
      }
    }
    
    return baseHeaders;
  }

  // Helper method to get human-readable field labels
  getFieldLabel(fieldKey) {
    const fieldLabels = {
      'filename': 'Filename',
      'url': 'Image URL',
      'thumbnailUrl': 'Thumbnail URL',
      'status': 'Status',
      'size': 'File Size',
      'dimensions': 'Dimensions',
      'caption': 'Caption',
      'resolution': 'Resolution',
      'downloadTime': 'Download Time',
      'link': 'Source Link',
      'retries': 'Retry Count',
      'source': 'Source Domain',
      'extractionMethod': 'Extraction Method',
      'qualityScore': 'Quality Score',
      'processingTime': 'Processing Time',
      'containerInfo': 'Container Info',
      'agency': 'Photo Agency',
      'stockId': 'Stock ID',
      'timestamp': 'Timestamp'
    };
    
    return fieldLabels[fieldKey] || fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);
  }

  itemToCSVRow(item, headers, options) {
    const row = [];
    
    headers.forEach(header => {
      let value = '';
      
      // If using selectedFields, map from field key to value
      if (options.selectedFields && Array.isArray(options.selectedFields)) {
        const fieldKey = this.getFieldKeyFromLabel(header);
        value = this.extractFieldValue(item, fieldKey);
      } else {
        // Legacy header-based mapping
        switch (header) {
          case 'Index':
            value = item.index || '';
            break;
          case 'Image URL':
            value = item.image || '';
            break;
          case 'Thumbnail URL':
            value = item.thumbnail || '';
            break;
          case 'Link':
            value = item.link || '';
            break;
          case 'Text':
            value = item.text || '';
            break;
          case 'Quality Score':
            value = item.enhanced?.qualityScore || '';
            break;
          case 'Extraction Method':
            value = item.extractionMethod || '';
            break;
          case 'Processing Time':
            value = item.enhanced?.processingTime || '';
            break;
          default:
            value = '';
        }
      }
      
      row.push(this.escapeCSV(value));
    });
    
    return row;
  }

  // Helper method to get field key from label (reverse of getFieldLabel)
  getFieldKeyFromLabel(label) {
    const labelToFieldMap = {
      'Filename': 'filename',
      'Image URL': 'url',
      'Thumbnail URL': 'thumbnailUrl',
      'Status': 'status',
      'File Size': 'size',
      'Dimensions': 'dimensions',
      'Caption': 'caption',
      'Resolution': 'resolution',
      'Download Time': 'downloadTime',
      'Source Link': 'link',
      'Retry Count': 'retries',
      'Source Domain': 'source',
      'Extraction Method': 'extractionMethod',
      'Quality Score': 'qualityScore',
      'Processing Time': 'processingTime',
      'Container Info': 'containerInfo',
      'Photo Agency': 'agency',
      'Stock ID': 'stockId',
      'Timestamp': 'timestamp'
    };
    
    return labelToFieldMap[label] || label.toLowerCase();
  }

  // Enhanced field value extraction
  extractFieldValue(item, fieldKey) {
    switch (fieldKey) {
      case 'filename':
        return item.filename || item.name || '';
      case 'url':
        return item.image || item.url || '';
      case 'thumbnailUrl':
        return item.thumbnail || '';
      case 'status':
        return item.status || '';
      case 'size':
        return item.size || '';
      case 'dimensions':
        return item.dimensions ? `${item.dimensions.width}x${item.dimensions.height}` : 
          (item.width && item.height ? `${item.width}x${item.height}` : '');
      case 'caption':
        return item.text || item.caption || item.alt || '';
      case 'resolution':
        return item.resolution || this.extractFieldValue(item, 'dimensions');
      case 'downloadTime':
        return item.downloadTime || '';
      case 'link':
        return item.link || '';
      case 'retries':
        return item.retries || 0;
      case 'source':
        try {
          return item.source || (item.url ? new URL(item.url).hostname : '');
        } catch {
          return '';
        }
      case 'extractionMethod':
        return item.extractionMethod || '';
      case 'qualityScore':
        return item.enhanced?.qualityScore || item.qualityScore || '';
      case 'processingTime':
        return item.enhanced?.processingTime || item.processingTime || '';
      case 'containerInfo':
        return item.metadata?.containerInfo || item.containerInfo || '';
      case 'agency':
        return item.agency || '';
      case 'stockId':
        return item.stockId || item.id || '';
      case 'timestamp':
        return item.timestamp || item.createdAt || '';
      default:
        return item[fieldKey] || '';
    }
  }

  escapeCSV(value) {
    if (value === null || value === undefined) {return '';}
    
    const stringValue = String(value);
    
    // If the value contains comma, newline, or quotes, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  generateXMLContent(data, options) {
    const escape = (str) => String(str).replace(/[<>&'"]/g, (c) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[c]));

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<ScrapingReport exportDate="${new Date().toISOString()}">\n`;
    xml += '  <Summary>\n';
    xml += `    <TotalItems>${data.items?.length || 0}</TotalItems>\n`;
    xml += `    <SourceUrl>${escape(data.summary?.sourceUrl || 'unknown')}</SourceUrl>\n`;
    xml += '  </Summary>\n';
    xml += '  <Items>\n';
    
    (data.items || []).forEach((item, index) => {
      xml += `    <Item id="${index + 1}">\n`;
      xml += `      <ImageUrl>${escape(item.image || '')}</ImageUrl>\n`;
      xml += `      <ThumbnailUrl>${escape(item.thumbnail || '')}</ThumbnailUrl>\n`;
      xml += `      <Link>${escape(item.link || '')}</Link>\n`;
      xml += `      <Text>${escape(item.text || '')}</Text>\n`;
      if (item.enhanced) {
        xml += `      <QualityScore>${item.enhanced.qualityScore || 0}</QualityScore>\n`;
        xml += `      <ExtractionMethod>${escape(item.extractionMethod || '')}</ExtractionMethod>\n`;
      }
      xml += '    </Item>\n';
    });
    
    xml += '  </Items>\n';
    xml += '</ScrapingReport>';
    
    return xml;
  }

  // Placeholder for PDF generation (would need proper PDF library)
  generateBasicPDF(data, options) {
    // This is a placeholder - real implementation would use jsPDF or similar
    const pdfText = `Gallery Scraper Report\n\nTotal Items: ${data.items?.length || 0}\nExport Date: ${new Date().toISOString()}`;
    return new TextEncoder().encode(pdfText);
  }

  // Utility methods
  ensureExtension(filename, extension) {
    if (!filename.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
      return `${filename}.${extension}`;
    }
    return filename;
  }

  getImageExtension(url) {
    const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : 'jpg';
  }

  async downloadImageAsBlob(url) {
    try {
      const response = await fetch(url);
      return await response.blob();
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  async compressString(str) {
    // Placeholder for compression - would use CompressionStream or similar
    return new TextEncoder().encode(str);
  }

  updateStats(format, exportTime, fileSize) {
    this.exportStats.totalExports++;
    this.exportStats.formatCounts[format] = (this.exportStats.formatCounts[format] || 0) + 1;
    this.exportStats.averageExportTime = 
      (this.exportStats.averageExportTime * (this.exportStats.totalExports - 1) + exportTime) / 
      this.exportStats.totalExports;
    this.exportStats.totalDataExported += fileSize;
  }

  getStats() {
    return {
      ...this.exportStats,
      exportHistory: this.exportHistory.slice(-10) // Last 10 exports
    };
  }

  clearHistory() {
    this.exportHistory = [];
    this.tempData.clear();
  }
}

// Support both ES modules and legacy importScripts
// (AdvancedExportSystem class already exported via export keyword)

// Export for use in other modules
if (typeof self !== 'undefined') {
  self.AdvancedExportSystem = AdvancedExportSystem;
}

// Usage example:
// const exporter = new AdvancedExportSystem();
// const result = await exporter.exportData(scrapingData, 'xlsx', 'gallery-export');
// if (result.success) {
//   // Download the file
//   const blob = new Blob([result.data], { type: result.mimeType });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement('a');
//   a.href = url;
//   a.download = result.filename;
//   a.click();
// }