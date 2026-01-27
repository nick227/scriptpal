# ScriptPal Frontend Documentation

## Overview

The ScriptPal frontend is a sophisticated single-page application built with vanilla JavaScript, featuring a widget-based architecture, event-driven communication, and AI-powered script editing capabilities.

## Technology Stack

- **JavaScript**: ES6+ modules with modern features
- **Vite**: Development server and build tool
- **CSS3**: Custom styling with CSS variables
- **DOM APIs**: Direct DOM manipulation for performance
- **Jest**: Testing framework with jsdom environment

## Project Structure

```
public/
├── js/
│   ├── app.js                    # Main application orchestrator
│   ├── init.js                   # Application initialization
│   ├── classes/                  # Core application classes
│   │   ├── api.js               # HTTP client
│   │   ├── ui.js                # UI coordination
│   │   └── user.js              # User management
│   ├── constants/                # Application constants
│   │   └── formats.js           # Script format definitions
│   ├── core/                     # Core services
│   │   ├── BaseEvents.js        # Event base class
│   │   ├── BaseManager.js       # Manager base class
│   │   ├── BaseRenderer.js      # Renderer base class
│   │   ├── DOMUtils.js          # DOM utilities
│   │   ├── ErrorHandler.js      # Error handling
│   │   ├── EventBus.js          # Event bus
│   │   ├── EventEmitter.js      # Event emitter
│   │   ├── EventManager.js      # Event management
│   │   ├── SecurityManager.js   # Security utilities
│   │   └── StateManager.js      # State management
│   ├── managers/                 # Business logic managers
│   │   ├── ScriptManager.js     # Script operations
│   │   ├── ScriptOrchestrator.js # Script coordination
│   │   └── ScriptSyncService.js # Auto-save service
│   ├── services/                 # Utility services
│   │   └── scriptFormatter.js   # Script formatting
│   ├── ui/                       # UI management
│   │   ├── AuthUIManager.js     # Authentication UI
│   │   ├── ErrorManager.js      # Error display
│   │   ├── LoadingManager.js    # Loading states
│   │   ├── ManagerFactory.js    # UI manager factory
│   │   ├── NavigationManager.js # Navigation
│   │   ├── NotificationManager.js # Notifications
│   │   └── ViewManager.js       # View management
│   ├── widgets/                  # UI components
│   │   ├── auth/                # Authentication widgets
│   │   ├── chat/                # Chat widgets
│   │   ├── editor/              # Editor widgets
│   │   ├── script/              # Script widgets
│   │   ├── uploader/            # File upload widgets
│   │   ├── BaseWidget.js        # Widget base class
│   │   └── WidgetStateManager.js # Widget state
│   └── renderers.js             # DOM renderers
├── css/                          # Stylesheets
│   ├── base/                    # Base styles
│   ├── components/              # Component styles
│   └── layout/                  # Layout styles
└── index.html                   # Main HTML file
```

## Core Application Architecture

### Main Application Class

The `ScriptPal` class serves as the main orchestrator, coordinating all application components:

```javascript
class ScriptPal {
  constructor() {
    this._initialized = false;
  }

  async initialize() {
    // 1. Initialize core services
    this.api = new ScriptPalAPI();
    this.user = new ScriptPalUser(this.api);
    
    // 2. Check authentication
    const isAuthenticated = await this.user.checkSession();
    
    // 3. Initialize managers
    const stateManager = new StateManager();
    const eventManager = new EventManager();
    
    // 4. Initialize UI
    this.ui = new ScriptPalUI();
    await this.ui.initialize(currentUser);
    
    // 5. Initialize editor
    this.editor = new EditorWidget(editorElements);
    await this.editor.initialize(this.api, this.user, this.scriptManager);
    
    // 6. Initialize services
    this.scriptManager = new ScriptManager(this.api, stateManager, eventManager);
    this.scriptSyncService = new ScriptSyncService(this.scriptManager, eventManager);
    this.scriptOrchestrator = new ScriptOrchestrator(/* dependencies */);
    
    // 7. Initialize chat
    this.chat = new ChatIntegration(this.api, stateManager, eventManager);
    await this.chat.initialize();
    
    // 8. Load initial data
    await this.loadInitialData();
  }
}
```

### Initialization Flow

1. **Core Services**: API client and user management
2. **Authentication**: Session validation and user context
3. **Managers**: State and event management
4. **UI Components**: Editor, chat, and navigation
5. **Business Logic**: Script management and synchronization
6. **Data Loading**: Initial script and chat history

## Widget System

### Base Widget Class

All UI components extend the `BaseWidget` class:

```javascript
class BaseWidget {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.elements = {};
    this.state = {};
    this.eventManager = new EventManager();
  }

  async initialize() {
    this.createElements();
    this.bindEvents();
    this.render();
  }

  createElements() {
    // Override in subclasses
  }

  bindEvents() {
    // Override in subclasses
  }

  render() {
    // Override in subclasses
  }

  destroy() {
    this.eventManager.removeAllListeners();
    this.container.innerHTML = '';
  }
}
```

### Editor Widget

The `EditorWidget` handles script editing with format-aware functionality:

```javascript
class EditorWidget extends BaseWidget {
  constructor(elements) {
    super(elements.container);
    this.toolbar = elements.toolbar;
    this.content = null;
    this.stateController = null;
  }

  async initialize(api, user, scriptManager) {
    this.api = api;
    this.user = user;
    this.scriptManager = scriptManager;
    
    // Initialize content editor
    this.content = new EditorContent(this.container);
    await this.content.initialize();
    
    // Initialize state controller
    this.stateController = new EditorStateController();
    await this.stateController.initialize();
    
    // Bind events
    this.bindEditorEvents();
  }

  bindEditorEvents() {
    // Format cycling on Enter
    this.content.on('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        this.cycleFormat();
      }
    });

    // Auto-save on content change
    this.content.on('input', debounce(() => {
      this.autoSave();
    }, 1500));
  }
}
```

### Modern Chat

The modern chat UI is created by `ModernChatWidget` and wired to `ChatManager` via `ChatIntegration`:

```javascript
const chatIntegration = new ChatIntegration(api, stateManager, eventManager);
await chatIntegration.initialize();
```

## Manager System

### Script Manager

The `ScriptManager` handles all script-related operations:

```javascript
class ScriptManager extends BaseManager {
  constructor(api, stateManager, eventManager) {
    super(stateManager);
    this.api = api;
    this.eventManager = eventManager;
    this.scripts = [];
    this.currentScriptId = null;
    this.formatter = new ScriptFormatter();
  }

  async loadScripts(userId) {
    if (this.scripts.length > 0) {
      return this.scripts; // Use cache
    }

    try {
      this.setLoading(true);
      const scripts = await this.api.getAllScriptsByUser(userId);
      this.scripts = scripts.map(script => this.standardizeScript(script));
      await this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);
      return this.scripts;
    } catch (error) {
      this.handleError(error, 'script');
      return [];
    } finally {
      this.setLoading(false);
    }
  }

  async updateScript(id, scriptData) {
    try {
      // Format and validate content
      const formattedContent = this.formatter.format(scriptData.content);
      if (!this.formatter.validateFormat(formattedContent)) {
        throw new Error('Invalid script format');
      }

      const updatedScript = await this.api.updateScript(id, {
        ...scriptData,
        content: formattedContent
      });

      // Update cache and state
      this.updateScriptInCache(updatedScript);
      await this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, updatedScript);

      return updatedScript;
    } catch (error) {
      this.handleError(error, 'script');
      return null;
    }
  }
}
```

### Script Orchestrator

The `ScriptOrchestrator` coordinates script operations across components:

```javascript
class ScriptOrchestrator {
  constructor(scriptManager, syncService, scriptContainer, editor) {
    this.scriptManager = scriptManager;
    this.syncService = syncService;
    this.scriptContainer = scriptContainer;
    this.editor = editor;
  }

  async handleScriptSelected(scriptId, options = {}) {
    try {
      const script = await this.scriptManager.loadScript(scriptId, options);
      if (!script) return;

      // Update UI
      await this.updateScriptUI(script);
      
      // Load editor content
      await this.editor.loadScript(script);
      
      // Load chat history
      await this.loadChatHistory(scriptId);
      
      // Publish event
      this.eventManager.publish(EventManager.EVENTS.SCRIPT.SELECTED, {
        script,
        preserveState: options.preserveState
      });
    } catch (error) {
      this.handleError(error);
    }
  }
}
```

### Script Sync Service

The `ScriptSyncService` handles auto-save functionality:

```javascript
class ScriptSyncService {
  constructor(scriptManager, eventManager) {
    this.scriptManager = scriptManager;
    this.eventManager = eventManager;
    this.pendingUpdates = new Map();
    this.debounceDelay = 1500;
  }

  scheduleAutoSave(scriptId, content) {
    // Cancel existing save
    if (this.pendingUpdates.has(scriptId)) {
      clearTimeout(this.pendingUpdates.get(scriptId));
    }

    // Schedule new save
    const timeoutId = setTimeout(async () => {
      await this.performAutoSave(scriptId, content);
      this.pendingUpdates.delete(scriptId);
    }, this.debounceDelay);

    this.pendingUpdates.set(scriptId, timeoutId);
  }

  async performAutoSave(scriptId, content) {
    try {
      const script = this.scriptManager.getCurrentScript();
      if (!script || script.id !== scriptId) return;

      await this.scriptManager.updateScript(scriptId, {
        ...script,
        content,
        version_number: script.version_number + 1
      });

      this.eventManager.publish(EventManager.EVENTS.SCRIPT.AUTO_SAVED, {
        scriptId,
        timestamp: Date.now()
      });
    } catch (error) {
      this.eventManager.publish(EventManager.EVENTS.SCRIPT.SAVE_FAILED, {
        scriptId,
        error: error.message
      });
    }
  }
}
```

## Core Services

### Event Manager

The `EventManager` provides centralized event handling:

```javascript
class EventManager {
  constructor() {
    this.listeners = new Map();
  }

  publish(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  unsubscribe(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  once(event, callback) {
    const onceCallback = (data) => {
      callback(data);
      this.unsubscribe(event, onceCallback);
    };
    this.subscribe(event, onceCallback);
  }
}
```

### State Manager

The `StateManager` handles application state:

```javascript
class StateManager {
  static KEYS = Object.freeze({
    CURRENT_SCRIPT: 'currentScript',
    SCRIPTS: 'scripts',
    USER: 'user',
    CHAT_HISTORY: 'chatHistory',
    UI_STATE: 'uiState'
  });

  constructor() {
    this.state = new Map();
    this.subscribers = new Map();
  }

  async setState(key, value) {
    const oldValue = this.state.get(key);
    this.state.set(key, value);
    
    // Notify subscribers
    const callbacks = this.subscribers.get(key) || [];
    callbacks.forEach(callback => {
      try {
        callback(value, oldValue);
      } catch (error) {
        console.error(`Error in state subscriber for ${key}:`, error);
      }
    });
  }

  getState(key) {
    return this.state.get(key);
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key).push(callback);
  }
}
```

### API Client

The `ScriptPalAPI` handles HTTP communication:

```javascript
class ScriptPalAPI {
  constructor() {
    this.baseURL = '/api';
    this.timeout = 30000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: this.timeout,
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async getScript(id) {
    return this.request(`/scripts/${id}`);
  }

  async updateScript(id, data) {
    return this.request(`/scripts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async sendChatMessage(content, scriptId = null) {
    return this.request('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ content, scriptId })
    });
  }
}
```

## Script Format System

### Format Constants

Script formats are defined in `constants/formats.js`:

```javascript
export const VALID_FORMATS = Object.freeze({
  HEADER: 'header',
  ACTION: 'action',
  SPEAKER: 'speaker',
  DIALOG: 'dialog',
  DIRECTIONS: 'directions',
  CHAPTER_BREAK: 'chapter-break'
});

export const FORMAT_FLOW = Object.freeze({
  [VALID_FORMATS.HEADER]: VALID_FORMATS.ACTION,
  [VALID_FORMATS.ACTION]: VALID_FORMATS.ACTION,
  [VALID_FORMATS.SPEAKER]: VALID_FORMATS.DIALOG,
  [VALID_FORMATS.DIALOG]: VALID_FORMATS.SPEAKER,
  [VALID_FORMATS.DIRECTIONS]: VALID_FORMATS.DIALOG,
  [VALID_FORMATS.CHAPTER_BREAK]: VALID_FORMATS.HEADER
});
```

### Script Formatter

The `ScriptFormatter` handles format validation and transformation:

```javascript
class ScriptFormatter {
  constructor() {
    this.validFormats = Object.values(VALID_FORMATS);
  }

  format(content) {
    if (typeof content === 'string') {
      return this.formatStringContent(content);
    }
    return content;
  }

  validateFormat(content) {
    if (typeof content !== 'string') return false;
    
    // Check for valid XML tags
    const tagPattern = /<(\w+)>.*?<\/\1>/g;
    const matches = content.match(tagPattern);
    
    if (!matches) return false;
    
    // Validate all tags are allowed
    const invalidTags = matches
      .map(match => match.match(/<(\w+)>/)[1])
      .filter(tag => !this.validFormats.includes(tag));
    
    return invalidTags.length === 0;
  }

  getNextFormat(currentFormat) {
    return FORMAT_FLOW[currentFormat] || VALID_FORMATS.ACTION;
  }
}
```

## UI Management

### UI Manager

The `ScriptPalUI` coordinates UI components:

```javascript
class ScriptPalUI {
  constructor() {
    this.elements = {};
    this.managers = {};
  }

  async initialize(currentUser) {
    this.createUIElements();
    this.initializeManagers();
    this.bindGlobalEvents();
    this.renderUserState(currentUser);
  }

  createUIElements() {
    this.elements = {
      editorContainer: document.querySelector('.editor-container'),
      editorToolbar: document.querySelector('.editor-toolbar'),
      chatContainer: document.querySelector('.chatbot-container'),
      sidePanel: document.querySelector('.side-panel-panel'),
      navigationBar: document.querySelector('.navigation-bar')
    };
  }

  async updateComponents(chat, scriptManager) {
    // Update chat component
    if (chat) {
      this.managers.chat = chat;
    }

    // Update script manager
    if (scriptManager) {
      this.managers.script = scriptManager;
    }
  }
}
```

## Event System

### Event Types

The application uses a comprehensive event system:

```javascript
// Script Events
EventManager.EVENTS.SCRIPT = {
  SELECTED: 'script:selected',
  UPDATED: 'script:updated',
  DELETED: 'script:deleted',
  AUTO_SAVED: 'script:auto_saved',
  SAVE_FAILED: 'script:save_failed',
  VERSION_CONFLICT: 'script:version_conflict'
};

// UI Events
EventManager.EVENTS.UI = {
  CHAT_TOGGLED: 'ui:chat_toggled',
  EDITOR_FOCUSED: 'ui:editor_focused',
  SAVE_COMPLETED: 'ui:save_completed'
};

// System Events
EventManager.EVENTS.SYSTEM = {
  ERROR: 'system:error',
  LOADING_STATE_CHANGED: 'system:loading_state_changed',
  NETWORK_STATUS_CHANGED: 'system:network_status_changed'
};
```

## Performance Optimizations

### Virtual Scrolling

For large scripts, the editor uses virtual scrolling:

```javascript
class VirtualScrollingEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 20;
    this.visibleItems = Math.ceil(container.clientHeight / this.itemHeight);
    this.scrollTop = 0;
  }

  render(items) {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleItems, items.length);
    
    const visibleItems = items.slice(startIndex, endIndex);
    this.renderVisibleItems(visibleItems, startIndex);
  }
}
```

### Debounced Auto-save

Auto-save is debounced to reduce server load:

```javascript
function debounce(func, wait) {
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
```

## Testing

### Test Structure

Tests are organized by component:

```
__tests__/
├── classes/           # Class tests
├── core/             # Core service tests
├── managers/         # Manager tests
├── services/         # Service tests
├── widgets/          # Widget tests
└── utils/            # Utility tests
```

### Test Example

```javascript
describe('ScriptManager', () => {
  let scriptManager;
  let mockAPI;
  let mockStateManager;
  let mockEventManager;

  beforeEach(() => {
    mockAPI = {
      getAllScriptsByUser: jest.fn(),
      getScript: jest.fn(),
      updateScript: jest.fn()
    };
    mockStateManager = new StateManager();
    mockEventManager = new EventManager();
    scriptManager = new ScriptManager(mockAPI, mockStateManager, mockEventManager);
  });

  test('should load scripts for user', async () => {
    const mockScripts = [{ id: 1, title: 'Test Script' }];
    mockAPI.getAllScriptsByUser.mockResolvedValue(mockScripts);

    const result = await scriptManager.loadScripts(1);

    expect(result).toEqual(mockScripts);
    expect(mockAPI.getAllScriptsByUser).toHaveBeenCalledWith(1);
  });
});
```

## Development Workflow

### Code Quality

- **ESLint**: Enforces coding standards and security practices
- **Prettier**: Maintains consistent code formatting
- **Husky**: Pre-commit hooks ensure quality gates

### Build Process

- **Vite**: Development server with hot reload
- **ES6 Modules**: Modern JavaScript module system
- **CSS Processing**: PostCSS with autoprefixer

### Testing

- **Jest**: Unit and integration testing
- **jsdom**: DOM testing environment
- **Coverage**: Comprehensive test coverage reporting

This frontend architecture provides a robust, maintainable foundation for the ScriptPal application with modern JavaScript practices, comprehensive testing, and excellent user experience.