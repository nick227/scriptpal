/**
 *
 */
export class ErrorManager {
    /**
     *
     * @param error
     * @param context
     */
    static handleError (error, context) {
        console.error(`Error in ${context}:`, error);
        NotificationManager.showError(ERROR_MESSAGES[context.toUpperCase()]);
    }

    /**
     *
     * @param error
     */
    static handleApiError (error) {
        this.handleError(error, 'api');
    }

    /**
     *
     * @param error
     */
    static handleAuthError (error) {
        this.handleError(error, 'auth');
    }
}
