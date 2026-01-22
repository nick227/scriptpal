import { ScriptPal } from './app.js';
import { ERROR_MESSAGES } from './constants.js';

// Initialize the application
window.addEventListener('DOMContentLoaded', async () => {
    try {

        // Clean up any existing app instance
        if (window.app) {
            window.app.destroy();
            window.app = null;
        }

        window.app = new ScriptPal();
        await window.app.initialize();
    } catch (error) {
        console.error('Failed to initialize ScriptPal:', error);
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <h2>Application Error</h2>
            <p>Failed to initialize ScriptPal. Please refresh the page or check the console for details.</p>
            <button onclick="location.reload()">Refresh Page</button>
        `;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            text-align: center;
        `;
        document.body.appendChild(errorDiv);
    }
});

// Handle uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
        window.app = null;
    }
});

// Clean up on page hide (mobile browsers)
window.addEventListener('pagehide', () => {
    if (window.app) {
        window.app.destroy();
        window.app = null;
    }
});
