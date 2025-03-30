/**
 * Manages authentication-related UI updates
 */
export class AuthUIManager {
    constructor(elements, userRenderer) {
        this.elements = elements;
        this.userRenderer = userRenderer;
    }

    updateForAuthenticatedUser(user) {
        this.toggleAuthForms(false);
        this.updateUserInfo(user);
        this.toggleChatControls(true);
    }

    updateForUnauthenticatedUser() {
        this.toggleAuthForms(true);
        this.updateUserInfo(null);
        this.toggleChatControls(false);
    }

    toggleAuthForms(show) {
        if (this.elements.loginForm) {
            this.elements.loginForm.style.display = show ? 'block' : 'none';
        }
        if (this.elements.registerForm) {
            this.elements.registerForm.style.display = show ? 'block' : 'none';
        }
    }

    toggleChatControls(enable) {
        if (this.elements.input) {
            this.elements.input.disabled = !enable;
        }
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = !enable;
        }
    }

    updateUserInfo(user) {
        if (this.elements.userInfo) {
            this.userRenderer.updateUserInfo(user);
        }
        if (this.elements.logoutButton) {
            this.elements.logoutButton.style.display = user ? 'block' : 'none';
        }
    }
}