export class ErrorManager {
    static handleError(error, context) {
        console.error(`Error in ${context}:`, error);
        NotificationManager.showError(ERROR_MESSAGES[context.toUpperCase()]);
    }

    static handleApiError(error) {
        this.handleError(error, 'api');
    }

    static handleAuthError(error) {
        this.handleError(error, 'auth');
    }
}