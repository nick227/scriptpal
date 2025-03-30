import { BaseManager } from '../../core/BaseManager.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants.js';
import { EventBus } from '../../core/EventBus.js';

export class AuthManager extends BaseManager {
    constructor(stateManager, api, eventBus) {
        super(stateManager);
        this.api = api;
        this.eventBus = eventBus;
    }

    async handleLogin(email) {
        if (!email) {
            this.handleError(new Error('Invalid email'), 'auth');
            return;
        }

        try {
            this.setLoading(true);
            const user = await this.api.login(email);

            if (!user) {
                throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
            }

            this.stateManager.setState('authenticated', true);
            this.eventBus.publish(EventBus.EVENTS.AUTH.LOGIN, { user });
        } catch (error) {
            this.handleError(error, 'auth');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    async handleRegister(email) {
        if (!email) {
            this.handleError(new Error('Invalid email'), 'auth');
            return;
        }

        try {
            this.setLoading(true);
            await this.api.createUser({ email });
            this.eventBus.publish(EventBus.EVENTS.AUTH.REGISTER, { email });

            // Auto login after registration
            await this.handleLogin(email);
        } catch (error) {
            this.handleError(error, 'auth');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    async handleLogout() {
        try {
            this.setLoading(true);
            await this.api.logout();
            this.stateManager.setState('authenticated', false);
            this.eventBus.publish(EventBus.EVENTS.AUTH.LOGOUT);
        } catch (error) {
            this.handleError(error, 'auth');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    updateUserInfo(user) {
        if (this.renderer) {
            this.renderer.renderUserInfo(user);
        }
    }
}