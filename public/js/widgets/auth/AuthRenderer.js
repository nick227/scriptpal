import { BaseRenderer } from '../../core/BaseRenderer.js';
import { DOMUtils } from '../../core/DOMUtils.js';

export class AuthRenderer extends BaseRenderer {
    renderUserInfo(user) {
        if (!this.container) return;

        const content = user ?
            `Welcome, ${user.name || user.email}` :
            'Please log in';

        DOMUtils.setContent(this.container, content);
    }

    renderLoginForm() {
        if (!this.container) return;

        const form = this.createElement('form', 'login-form');
        const emailInput = this.createElement('input', 'email-input', '');
        const submitButton = this.createElement('button', 'submit-button', 'Login');

        this.setAttributes(emailInput, {
            type: 'email',
            placeholder: 'Enter your email',
            required: 'true'
        });

        this.setAttributes(submitButton, {
            type: 'submit'
        });

        form.appendChild(emailInput);
        form.appendChild(submitButton);

        return form;
    }

    renderRegisterForm() {
        if (!this.container) return;

        const form = this.createElement('form', 'register-form');
        const emailInput = this.createElement('input', 'email-input', '');
        const submitButton = this.createElement('button', 'submit-button', 'Register');

        this.setAttributes(emailInput, {
            type: 'email',
            placeholder: 'Enter your email',
            required: 'true'
        });

        this.setAttributes(submitButton, {
            type: 'submit'
        });

        form.appendChild(emailInput);
        form.appendChild(submitButton);

        return form;
    }

    renderLogoutButton() {
        if (!this.container) return;

        const button = this.createElement('button', 'logout-button', 'Logout');
        return button;
    }
}