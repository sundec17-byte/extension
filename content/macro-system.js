// macro-system.js - Consolidated macro recording and playback system
// Combines recorder.js and runner.js functionality

// =============================================================================
// MACRO RECORDER (from recorder.js)
// =============================================================================

let recording = false;
let steps = [];
let lastTime = Date.now();
let lastTarget = null;
let mutationObserver;
let urlAtStart = location.href;
let urlAtClick = location.href;
let sessionId = null;
let recordingStartTime = null;

// Recording functionality
function startObservers() {
  if (mutationObserver) {return;}
  
  // Enhanced mutation observer with more detailed tracking
  mutationObserver = new MutationObserver((mutations) => {
    if (!recording) {return;}
    
    // Track significant DOM changes
    const significantChanges = mutations.filter(mut => 
      (mut.type === 'childList' && mut.addedNodes.length > 0) ||
      (mut.type === 'attributes' && ['class', 'style', 'src'].includes(mut.attributeName))
    );
    
    if (significantChanges.length > 3) {
      addStep({
        type: 'waitUntil',
        condition: 'domStable',
        timeout: 2000,
        description: `Wait for DOM to stabilize (${significantChanges.length} changes detected)`
      });
    }
  });
  
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'src', 'href']
  });
}

function stopObservers() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
}

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

function addStep(step) {
  if (!recording) {return;}
  
  const now = Date.now();
  const timeSinceLastStep = now - lastTime;
  
  // Add automatic delay if significant time passed
  if (timeSinceLastStep > 1000 && steps.length > 0) {
    steps.push({
      type: 'delay',
      ms: Math.min(timeSinceLastStep, 3000),
      description: 'Automatic delay between actions'
    });
  }
  
  steps.push({
    ...step,
    timestamp: now,
    sessionId: sessionId,
    url: location.href
  });
  
  lastTime = now;
  console.log('Macro step recorded:', step);
}

function startRecording() {
  if (recording) {return false;}
  
  recording = true;
  steps = [];
  sessionId = `macro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  recordingStartTime = Date.now();
  urlAtStart = location.href;
  lastTime = Date.now();
  
  startObservers();
  attachEventListeners();
  
  addStep({
    type: 'init',
    url: location.href,
    title: document.title,
    description: 'Recording started'
  });
  
  console.log('✅ Macro recording started');
  return true;
}

function stopRecording() {
  if (!recording) {return [];}
  
  recording = false;
  stopObservers();
  detachEventListeners();
  
  const duration = Date.now() - recordingStartTime;
  addStep({
    type: 'complete',
    duration: duration,
    description: 'Recording completed'
  });
  
  console.log(`✅ Macro recording stopped. ${steps.length} steps recorded in ${duration}ms`);
  return [...steps];
}

// Event listeners for recording
function attachEventListeners() {
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('scroll', handleScroll, true);
  window.addEventListener('beforeunload', handleBeforeUnload);
}

function detachEventListeners() {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('scroll', handleScroll, true);
  window.removeEventListener('beforeunload', handleBeforeUnload);
}

function handleClick(event) {
  if (!recording) {return;}
  
  const target = event.target;
  const selector = getCssPath(target);
  urlAtClick = location.href;
  
  addStep({
    type: 'click',
    selector: [selector],
    button: event.button,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    description: `Click ${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${target.className ? `.${target.className.split(' ')[0]}` : ''}`
  });
  
  lastTarget = target;
}

function handleInput(event) {
  if (!recording) {return;}
  
  const target = event.target;
  if (target.type === 'password') {return;} // Skip password fields
  
  const selector = getCssPath(target);
  
  addStep({
    type: 'input',
    selector: [selector],
    value: target.value,
    inputType: target.type,
    description: `Input into ${target.tagName.toLowerCase()}${target.name ? `[name="${target.name}"]` : ''}`
  });
}

function handleScroll(_event) {
  if (!recording) {return;}
  
  // Throttle scroll events
  const now = Date.now();
  if (now - lastTime < 500) {return;}
  
  addStep({
    type: 'scroll',
    deltaY: window.pageYOffset,
    description: `Scroll to position ${window.pageYOffset}`
  });
}

function handleBeforeUnload(_event) {
  if (recording) {
    addStep({
      type: 'navigate',
      fromUrl: urlAtClick,
      toUrl: 'about:blank',
      description: 'Page unload detected'
    });
  }
}

// =============================================================================
// MACRO RUNNER (from runner.js)
// =============================================================================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function queryVisible(selectors, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent) {return el;}
    }
    await sleep(100);
  }
  throw new Error('Element not found');
}

function waitDomStable(timeout = 4000) {
  return new Promise((resolve, reject) => {
    let lastMut = Date.now();
    const obs = new MutationObserver(() => lastMut = Date.now());
    obs.observe(document.body, { childList: true, subtree: true });
    const start = Date.now();
    
    const check = () => {
      if (Date.now() - lastMut > 500) {
        obs.disconnect();
        resolve();
      } else if (Date.now() > start + timeout) {
        obs.disconnect();
        reject(new Error('domStable timeout'));
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function waitUrlChange(timeout = 10000, startUrl = location.href) {
  return new Promise((resolve, reject) => {
    const end = Date.now() + timeout;
    const tick = () => {
      if (location.href !== startUrl) {return resolve();}
      if (Date.now() > end) {return reject(new Error('urlChange timeout'));}
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function runMacro(steps) {
  console.log(`🎬 Starting macro playback with ${steps.length} steps`);
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`▶️ Step ${i + 1}/${steps.length}: ${step.type} - ${step.description || ''}`);
    
    const guard = async (promise) => {
      return await Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('step timeout')), 10000)
        )
      ]);
    };
    
    try {
      switch (step.type) {
        case 'delay':
          await sleep(step.ms);
          break;
          
        case 'click': {
          const el = await guard(queryVisible(step.selector));
          el.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            button: step.button || 0,
            ctrlKey: step.ctrlKey || false,
            shiftKey: step.shiftKey || false,
            altKey: step.altKey || false
          }));
          break;
        }
        
        case 'input': {
          const el = await guard(queryVisible(step.selector));
          el.value = step.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
        
        case 'scroll':
          window.scrollTo({ top: step.deltaY || 0, behavior: 'smooth' });
          await sleep(400);
          break;
          
        case 'waitUntil':
          if (step.condition === 'domStable') {
            await guard(waitDomStable(step.timeout || 4000));
          } else if (step.condition === 'urlChange') {
            await guard(waitUrlChange(step.timeout || 10000, step.fromUrl));
          }
          break;
          
        case 'navigate':
          if (step.toUrl && step.toUrl !== 'about:blank') {
            window.location.href = step.toUrl;
            await guard(waitUrlChange(5000));
          }
          break;
          
        case 'init':
        case 'complete':
          // Informational steps, no action needed
          break;
          
        default:
          console.warn(`Unknown step type: ${step.type}`);
      }
    } catch (error) {
      console.error(`❌ Error in step ${i + 1}: ${error.message}`, step);
      throw new Error(`Macro failed at step ${i + 1}: ${error.message}`);
    }
  }
  
  console.log('✅ Macro playback completed successfully');
}

// =============================================================================
// MACRO SYSTEM API
// =============================================================================

class MacroSystem {
  constructor() {
    this.isRecording = false;
    this.currentMacro = null;
  }
  
  startRecording() {
    this.isRecording = startRecording();
    return this.isRecording;
  }
  
  stopRecording() {
    if (this.isRecording) {
      this.currentMacro = stopRecording();
      this.isRecording = false;
      return this.currentMacro;
    }
    return null;
  }
  
  async playMacro(macroSteps) {
    if (this.isRecording) {
      throw new Error('Cannot play macro while recording');
    }
    
    await runMacro(macroSteps);
  }
  
  getCurrentSteps() {
    return [...steps];
  }
  
  isCurrentlyRecording() {
    return this.isRecording;
  }
  
  exportMacro(macroSteps = null) {
    const stepsToExport = macroSteps || this.currentMacro || steps;
    return {
      version: '1.0',
      created: new Date().toISOString(),
      steps: stepsToExport,
      metadata: {
        stepCount: stepsToExport.length,
        duration: stepsToExport.length > 0 ? 
          stepsToExport[stepsToExport.length - 1].timestamp - stepsToExport[0].timestamp : 0
      }
    };
  }
  
  importMacro(macroData) {
    if (!macroData.steps || !Array.isArray(macroData.steps)) {
      throw new Error('Invalid macro data format');
    }
    
    return macroData.steps;
  }
}

// =============================================================================
// GLOBAL EXPORTS
// =============================================================================

// Create global instance
const macroSystem = new MacroSystem();

// Make available globally
if (typeof window !== 'undefined') {
  window.MacroSystem = MacroSystem;
  window.macroSystem = macroSystem;
  window.runMacro = runMacro;
}

// For service worker/importScripts environment
if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
  self.MacroSystem = MacroSystem;
  self.macroSystem = macroSystem;
  self.runMacro = runMacro;
}

// ES modules export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MacroSystem, macroSystem, runMacro };
}