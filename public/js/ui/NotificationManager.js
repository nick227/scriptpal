/**
 * Handles UI notifications (errors and success messages)
 */
export class NotificationManager {
    static show(message, type = 'error') {
        const element = document.createElement('div');
        element.className = `${type}-message`;
        element.textContent = message;
        document.body.appendChild(element);

        setTimeout(() => {
            element.remove();
        }, type === 'error' ? 5000 : 3000);
    }

    static showError(message) {
        console.error('Error:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }

    static showSuccess(message) {
        console.log('Success:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }

    static showWarning(message) {
        console.warn('Warning:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }

    static showInfo(message) {
        console.info('Info:', message);
        // You can add more sophisticated notification UI here
        alert(message);
    }
}