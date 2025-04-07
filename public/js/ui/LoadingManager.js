/**
 * Manages loading states for UI elements
 */
export class LoadingManager {
    constructor(elements) {
        this.elements = elements;
    }

    setLoading(isLoading) {
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = isLoading;
            this.elements.sendButton.innerHTML = isLoading ? '...' : '<i class="fas fa-paper-plane"></i>';
        }
        if (this.elements.input) {
            this.elements.input.disabled = isLoading;
        }
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.textContent = isLoading ? 'loading...' : '';
        }
    }
}