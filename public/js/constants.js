/**
 * API Configuration
 */
export const API_ENDPOINTS = {
    CHAT: '/chat',
    SCRIPT: '/script',
    USER: '/user'
};

export const API_HEADERS = {
    'Content-Type': 'application/json'
};

/**
 * UI Element Selectors
 */
export const UI_ELEMENTS = {
    CHAT_CONTAINER: '.chat-container',
    MESSAGES_CONTAINER: '.chat-messages',
    EDITOR_CONTAINER: '.editor-container',
    USER_SCRIPTS_PANEL: '.user-scripts',
    INPUT: '#user-input',
    SEND_BUTTON: '#send',
    RECORD_BUTTON: '#record',
    TOGGLE_VIEW: '#toggle-view',
    EDITOR_VIEW: '#editor-view',
    SETTINGS_VIEW: '#settings-view',
    ASSISTANT_RESPONSE: '.assistant-response',
    SITE_CONTROLS: '.site-controls',
    USER_INFO: '.user-info',
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
    INIT_ERROR: 'Failed to initialize ScriptPal',
    UI_INIT_ERROR: 'Failed to initialize UI',
    ELEMENT_NOT_FOUND: 'Required UI element not found',
    REQUIRED_ELEMENTS_MISSING: 'Required UI elements are missing',
    API_ERROR: 'Error communicating with the server',
    NO_RESPONSE: 'No response from server',
    LOGIN_FAILED: 'Login failed. Please try again.',
    LOGOUT_FAILED: 'Logout failed. Please try again.',
    USER_NOT_FOUND: 'User not found',
    USER_CREATION_FAILED: 'Failed to create user',
    MESSAGE_SEND_FAILED: 'Failed to send message',
    NOT_AUTHENTICATED: 'Please log in to continue',
    SCRIPT_NOT_FOUND: 'Script not found',
    SCRIPT_CREATION_FAILED: 'Failed to create script',
    INVALID_EMAIL: 'Please enter a valid email address',
    NETWORK_ERROR: 'Network error. Please check your connection.',
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