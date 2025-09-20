const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins (required for Replit)
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Add basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow iframe in development for Replit preview
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('X-Frame-Options', 'DENY');
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';");
  next();
});

// Serve static files from specific directories
app.use('/lib', express.static('lib'));
app.use('/icons', express.static('icons'));
app.use('/content', express.static('content'));
app.use('/ui', express.static('ui'));

// Serve test files
app.use(express.static('.', { 
  extensions: ['html'],
  index: false
}));

// Main dashboard route - serve browser-compatible version
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Extension dashboard route (for Chrome extension compatibility)
app.get('/extension', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'windowed-dashboard.html'));
});

// Extension popup route (for Chrome extension compatibility)
app.get('/extension/popup', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'popup.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API endpoint for demo data (since Chrome APIs won't work)
app.get('/api/demo-data', (req, res) => {
  res.json({
    stats: {
      totalItems: 42,
      completedItems: 35,
      duplicates: 3,
      progressPercent: 83,
      downloadRate: 2.5,
      queueSize: 7,
      errorCount: 4
    },
    galleries: [
      {
        name: "Sample Gallery 1",
        url: "https://example.com/gallery1",
        itemCount: 25,
        status: "completed"
      },
      {
        name: "Sample Gallery 2", 
        url: "https://example.com/gallery2",
        itemCount: 17,
        status: "processing"
      }
    ],
    recentActivity: [
      "Processed 5 new images from Gallery 1",
      "Detected duplicate in Gallery 2",
      "Export completed: 30 images downloaded",
      "New gallery detected on current page"
    ]
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`STEPTWO Gallery Scraper Dashboard running on port ${PORT}`);
  console.log(`Access the dashboard at: http://localhost:${PORT}`);
  console.log(`Extension interface at: http://localhost:${PORT}/extension`);
  console.log(`Health check at: http://localhost:${PORT}/api/health`);
});