import { debugLog } from '../core/logger.js';

/**
 * Handles UI notifications (errors and success messages)
 */
export class NotificationManager {
    /**
     *
     * @param message
     * @param type
     */
    static show (message, type = 'error') {
        const element = document.createElement('div');
        element.className = `${type}-message`;
        element.textContent = message;
        document.body.appendChild(element);

        setTimeout(() => {
            element.remove();
        }, type === 'error' ? 5000 : 3000);
    }

    /**
     *
     * @param message
     */
    static showError (message) {
        console.error('Error:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }

    /**
     *
     * @param message
     */
    static showSuccess (message) {
        debugLog('Success:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }

    /**
     *
     * @param message
     */
    static showWarning (message) {
        console.warn('Warning:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }

    /**
     *
     * @param message
     */
    static showInfo (message) {
        console.info('Info:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }
}
