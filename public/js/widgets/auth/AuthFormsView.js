/**
 * AuthFormsView - renders and manages auth form markup.
 */
export class AuthFormsView {
    /**
     * @param {HTMLElement} container
     */
    constructor (container) {
        if (!container) {
            throw new Error('AuthFormsView requires a container element');
        }
        this.container = container;
    }

    /**
     * Render the auth form markup and return key elements.
     */
    render () {
        this.container.innerHTML = `
            <h2>ScriptPal</h2>
            <div class="auth-toggle">
                <button type="button" class="auth-toggle-button is-active" data-auth-mode="login">Login</button>
                <button type="button" class="auth-toggle-button" data-auth-mode="register">Register</button>
            </div>
            <form id="login-form" class="login-form auth-form auth-form--login">
                <div class="auth-field">
                    <label class="auth-label" for="email">Email</label>
                    <input type="email" id="email" class="auth-input" placeholder="you@domain.com" autocomplete="username">
                </div>
                <div class="auth-field">
                    <label class="auth-label" for="password">Password</label>
                    <input type="password" id="password" class="auth-input" placeholder="Your password" autocomplete="current-password">
                </div>
                <div class="auth-feedback" data-auth-feedback="login" aria-live="polite"></div>
                <button type="submit" class="auth-submit">Sign in</button>
            </form>
            <form id="register-form" class="register-form auth-form auth-form--register" style="display: none;">
                <div class="auth-field">
                    <label class="auth-label" for="register-email">Email</label>
                    <input type="email" id="register-email" class="auth-input" placeholder="you@domain.com" autocomplete="email">
                </div>
                <div class="auth-field">
                    <label class="auth-label" for="register-password">Create password</label>
                    <input type="password" id="register-password" class="auth-input" placeholder="Create a password" autocomplete="new-password">
                </div>
                <div class="auth-feedback" data-auth-feedback="register" aria-live="polite"></div>
                <button type="submit" class="auth-submit auth-submit--secondary">Create account</button>
            </form>
        `;

        return {
            loginForm: this.container.querySelector('#login-form'),
            registerForm: this.container.querySelector('#register-form'),
            toggleButtons: Array.from(this.container.querySelectorAll('.auth-toggle-button'))
        };
    }

    /**
     * @param {boolean} isVisible
     */
    setVisible (isVisible) {
        this.container.style.display = isVisible ? 'block' : 'none';
    }
}
