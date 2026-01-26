/**
 * Manages authentication-related UI updates
 */
export class AuthUIManager {
    /**
     *
     * @param elements
     * @param userRenderer
     */
    constructor (elements, userRenderer) {
        this.elements = elements;
        this.userRenderer = userRenderer;
    }

    /**
     *
     * @param user
     */
    updateForAuthenticatedUser (user) {
        this.toggleAuthForms(false);
        this.updateUserInfo(user);
        this.toggleChatControls(true);
    }

    /**
     *
     */
    updateForUnauthenticatedUser () {
        this.toggleAuthForms(true);
        this.updateUserInfo(null);
        this.toggleChatControls(false);
    }

    /**
     *
     * @param show
     */
    toggleAuthForms (show) {
        if (this.elements.loginForm) {
            this.elements.loginForm.style.display = show ? 'block' : 'none';
        }
        if (this.elements.registerForm) {
            this.elements.registerForm.style.display = show ? 'block' : 'none';
        }
    }

    /**
     *
     * @param enable
     */
    toggleChatControls (enable) {
        if (this.elements.input) {
            this.elements.input.disabled = !enable;
        }
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = !enable;
        }
    }

    /**
     *
     * @param user
     */
    updateUserInfo (user) {
        if (this.elements.userInfo) {
            this.userRenderer.updateUserInfo(user);
        }
        if (this.elements.logoutButton) {
            this.elements.logoutButton.style.display = user ? 'block' : 'none';
        }
    }
}
