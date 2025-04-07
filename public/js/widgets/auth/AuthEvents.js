import { BaseEvents } from '../../core/BaseEvents.js';

export class AuthEvents extends BaseEvents {
    setupEvents() {
        const { loginForm, registerForm, logoutButton } = this.elements;

        // Handle login form submission
        if (loginForm) {
            this.addEventListener(loginForm, 'submit', (e) => {
                e.preventDefault();
                const email = loginForm.querySelector('input[type="email"]').value.trim();
                this.handlers.handleLogin(email);
            });
        }

        // Handle register form submission
        if (registerForm) {
            this.addEventListener(registerForm, 'submit', (e) => {
                e.preventDefault();
                const email = registerForm.querySelector('input[type="email"]').value.trim();
                this.handlers.handleRegister(email);
            });
        }

        // Handle logout button click
        if (logoutButton) {
            this.addEventListener(logoutButton, 'click', (e) => {
                e.preventDefault();
                this.handlers.handleLogout();
            });
        }
    }
}