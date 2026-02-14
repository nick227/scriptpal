/**
 * Server Configuration
 */
export const SERVER_PORT = 3001;
export const CLIENT_PORT = 5555;

/**
 * API Configuration
 */
export const API_ENDPOINTS = {
    CHAT: '/chat',
    SCRIPT: '/script',
    USER: '/user',
    SYSTEM_PROMPTS: '/system-prompts',
    BRAINSTORM_BOARDS: '/brainstorm/boards',
    MEDIA: '/media',
    MEDIA_UPLOAD: '/media/upload',
    MEDIA_GENERATE: '/media/generate',
    MEDIA_JOBS: '/media/jobs'
};
API_ENDPOINTS.USER_TOKEN_WATCH = '/user/token-watch';
API_ENDPOINTS.USER_CURRENT = '/user/current';
API_ENDPOINTS.USER_CURRENT_PROFILE = '/user/current/profile';
API_ENDPOINTS.USER_CURRENT_PASSWORD = '/user/current/password';
API_ENDPOINTS.PUBLIC_SCRIPTS = '/public/scripts';
API_ENDPOINTS.PUBLIC_USERS = '/public/users';
API_ENDPOINTS.PUBLIC_SCRIPTS_SLUG = '/public/scripts/slug';
API_ENDPOINTS.PUBLIC_SCRIPT_BY_PUBLIC_ID = (publicId) => `/public/scripts/public/${publicId}`;
API_ENDPOINTS.PUBLIC_SCRIPT_CLONE = (publicId) => `/public/scripts/public/${publicId}/clone`;
API_ENDPOINTS.SCRIPT_SLUG = '/script/slug';
API_ENDPOINTS.PUBLIC_SCRIPT_COMMENTS = (scriptId) => `/public/scripts/${scriptId}/comments`;
API_ENDPOINTS.BRAINSTORM_AI = (boardId, category) => `/brainstorm/boards/${boardId}/ai/${category}`;
API_ENDPOINTS.OWNER_MEDIA = (ownerType, ownerId) => `/owners/${ownerType}/${ownerId}/media`;

export const API_HEADERS = {
    'Content-Type': 'application/json'
};

/**
 * UI Element Selectors
 */
export const UI_ELEMENTS = {
    MESSAGES_CONTAINER: '.chat-messages',
    CHAT_PANEL: '.chatbot-container',
    EDITOR_CONTAINER: '.editor-container',
    EDITOR_TOOLBAR: '.editor-toolbar',
    USER_SCRIPTS_PANEL: '.user-scripts',
    USER_SCENES_PANEL: '.user-scenes',
    USER_OUTLINES_PANEL: '.user-outlines',
    USER_CHARACTERS_PANEL: '.user-characters',
    USER_LOCATION_PANEL: '.user-location',
    USER_THEMES_PANEL: '.user-themes',
    USER_MEDIA_PANEL: '.user-media',
    SIDE_PANEL_PANEL: '.side-panel-panel',
    TOGGLE_VIEW: '#toggle-view',
    EDITOR_VIEW: '#editor-view',
    SETTINGS_VIEW: '#settings-view',
    ASSISTANT_RESPONSE: '.assistant-response',
    SITE_CONTROLS: '.site-controls',
    USER_INFO: '.user-info',
    AUTH_FORMS: '.auth-forms',
    LOGIN_FORM: '#login-form',
    REGISTER_FORM: '#register-form',
    LOGOUT_BUTTON: '.logout-button',
    ERROR_MESSAGE: '.error-message',
    SUCCESS_MESSAGE: '.success-message',
    LOADING_INDICATOR: '.loading-indicator',
    EDITOR_LOADING_INDICATOR: '.editor-loading-indicator',
    CHAT_LOADING_INDICATOR: '.chat-loading-indicator',
    AUTH_LOADING_INDICATOR: '.auth-loading-indicator',
    CONTROL_BUTTON: '.view-button',
    EDITOR_PAGE_CONTENT: '.editor-page-content',
    MINIMAP_CONTAINER: '.minimap-container',
    EDITOR_AREA: '.editor-area'
};
UI_ELEMENTS.PANEL_NAVIGATION = '.panel-navigation';
UI_ELEMENTS.PUBLIC_SCRIPTS_PANEL = '.public-scripts-panel';
UI_ELEMENTS.PUBLIC_SCRIPTS_LIST = '.public-scripts-list';
UI_ELEMENTS.PUBLIC_SCRIPT_VIEWER = '.public-script-viewer';

export const UI_COMPONENTS = {
    SCRIPT_PAL_UI: 'ScriptPalUI'
};

export const UI_LOADING_TYPES = {
    GLOBAL: 'global',
    EDITOR: 'editor',
    CHAT: 'chat',
    AUTH: 'auth'
};

export const UI_LOADING_STATE_KEYS = {
    [UI_LOADING_TYPES.GLOBAL]: 'loading',
    [UI_LOADING_TYPES.EDITOR]: 'editorLoading',
    [UI_LOADING_TYPES.CHAT]: 'chatLoading',
    [UI_LOADING_TYPES.AUTH]: 'authLoading'
};

/**
 * Message Types
 */
export const MESSAGE_TYPES = {
    USER: 'user',
    ASSISTANT: 'assistant',
    ERROR: 'error',
    SUCCESS: 'success'
};

/**
 * Layout Classes
 */
export const LAYOUTS = {
    VERTICAL: 'vertical-layout',
    HORIZONTAL: 'horizontal-layout'
};

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
    INIT_ERROR: 'Failed to initialize application',
    AUTH_ERROR: 'Authentication failed',
    SCRIPT_ERROR: 'Script operation failed',
    NETWORK_ERROR: 'Network request failed',
    VALIDATION_ERROR: 'Validation failed',
    UPDATE_ERROR: 'Update failed',
    SYNC_ERROR: 'Sync failed',
    UI_INIT_ERROR: 'Failed to initialize UI',
    ELEMENT_NOT_FOUND: 'Required UI element not found',
    REQUIRED_ELEMENTS_MISSING: 'Required UI elements are missing',
    API_ERROR: 'Error communicating with the server',
    NO_RESPONSE: 'No response from server',
    LOGIN_FAILED: 'Login failed. Please try again.',
    LOGOUT_FAILED: 'Logout failed. Please try again.',
    USER_NOT_FOUND: 'User not found',
    NOT_FOUND: 'Resource not found',
    USER_CREATION_FAILED: 'Failed to create user',
    MESSAGE_SEND_FAILED: 'Failed to send message',
    NOT_AUTHENTICATED: 'Please log in to continue',
    SCRIPT_NOT_FOUND: 'Script not found',
    SCRIPT_CREATION_FAILED: 'Failed to create script',
    INVALID_EMAIL: 'Please enter a valid email address',
    SERVER_ERROR: 'Server error. Please try again later.'
};

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Logged in successfully',
    LOGOUT_SUCCESS: 'Logged out successfully',
    MESSAGE_SENT: 'Message sent successfully',
    SCRIPT_CREATED: 'Script created successfully'
};

/**
 * Response Types
 */
export const RESPONSE_TYPES = {
    STRING: 'string',
    OBJECT: 'object'
};
