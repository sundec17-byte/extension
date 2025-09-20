# STEPTWO Gallery Scraper - Project Overview

## Project Purpose
A professional-grade Chrome extension for scraping image galleries with AI-powered pattern recognition and enterprise-level reliability. The project has been successfully imported and configured to run in the Replit environment as a web application demo.

## Current State
- ✅ **Web Server**: Running on port 5000 with Express.js
- ✅ **Chrome Extension**: Fully functional with comprehensive bug fixes and MV3 compliance
- ✅ **Deployment**: Configured for autoscale production deployment
- ✅ **UI/UX**: Unified dashboard interface with real-time status updates
- ✅ **Architecture**: Manifest V3 compliant with proper service worker configuration

## Recent Changes (September 20, 2025)

### Major Improvements Completed:
1. **Critical Bug Fixes**:
   - Fixed ES module exports in content/scraper.js (runScrape function properly exported)
   - Resolved background service worker configuration (removed module type for importScripts compatibility)
   - Eliminated all CSP violations and MV3 compliance issues
   - Fixed element picker navigation prevention

2. **UI/UX Enhancements**:
   - Merged popup and windowed dashboard into unified interface
   - Added real-time scan status with progress indicators
   - Renamed buttons with clear, user-friendly labels
   - Implemented tabbed interface (Scanner/Settings/Results)

3. **Manifest V3 Compliance**:
   - Updated content_security_policy to proper MV3 format
   - Enhanced host permissions for cross-origin support
   - Proper service worker configuration with importScripts
   - Added blob: support for image handling

4. **Scraping Logic Improvements**:
   - Enhanced auto-gallery detection with sophisticated pattern recognition
   - Improved pagination handling with SPA detection
   - Fixed infinite scroll with loop prevention and memory optimization
   - Added comprehensive error handling and recovery

## Project Architecture

### Frontend Components:
- **index.html**: Main browser dashboard (Vue.js-based)
- **ui/popup.html**: Unified Chrome extension popup interface
- **ui/windowed-dashboard.html**: Advanced features window

### Backend Components:
- **server.js**: Express.js server serving static files and API endpoints
- **background/service-worker-modern.js**: Chrome extension background worker

### Content Scripts:
- **content/injector.js**: Gallery detection and dynamic module loading
- **content/scraper.js**: Core scraping functionality with ES module exports
- **content/picker.js**: Element selection with click navigation prevention

### Key Features:
- Smart gallery detection with AI-powered pattern recognition
- Multi-site support with adaptive selectors
- Pagination and infinite scroll handling
- Memory-optimized processing for large galleries
- Professional export options (JSON, CSV, Excel, ZIP)
- Real-time progress tracking and status updates

## User Preferences
- **Interface**: Prefers unified, intuitive UI over separate popup/dashboard modes
- **Functionality**: Expects comprehensive scraping capabilities with reliable navigation handling
- **Compliance**: Requires full Manifest V3 compliance for Chrome extension store submission
- **Performance**: Needs memory optimization for large galleries (1000+ images)

## Technical Stack
- **Language**: Node.js (v18+)
- **Framework**: Express.js for server, Vue.js for frontend
- **Extension**: Chrome Extension Manifest V3
- **Libraries**: PapaParse, JSZip, XLSX (all bundled locally)
- **Deployment**: Replit autoscale deployment configured

## Development Notes
- All code follows Chrome Extension MV3 security requirements
- No eval() or dynamic code execution (CSP compliant)
- All resources bundled locally for security
- Service worker uses classic format with importScripts (not ES modules)
- Comprehensive error handling and user feedback implemented

## Next Steps
Project is fully functional and ready for:
1. Chrome Extension store submission
2. Production deployment via Replit
3. User testing and feedback collection
4. Additional site profile expansions as needed