import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants.js';
import { BaseManager } from '../../core/BaseManager.js';
import { EventManager } from '../../core/EventManager.js';
import { debugLog } from '../../core/logger.js';

/**
 *
 */
export class AuthManager extends BaseManager {
    /**
     *
     * @param stateManager
     * @param api
     * @param eventManager
     */
    constructor (stateManager, api, eventManager) {
        super(stateManager);
        this.api = api;
        this.eventManager = eventManager;
    }

    /**
     *
     * @param email
     * @param password
     */
    async handleLogin (email, password) {
        if (!email || !password) {
            throw new Error('Invalid email');
        }

        try {
            this.setLoading(true);
            const response = await this.api.login(email, password);

            if (!response || !response.user) {
                throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
            }

            const user = response.user;

            // Update state and notify
            this.stateManager.setState('authenticated', true);
            this.stateManager.setState('currentUser', user);
            this.eventManager.publish(EventManager.EVENTS.AUTH.LOGIN, user);

            debugLog('[AUTH] Login successful:', {
                email: user.email,
                hasToken: !!response.token
            });

            // Schedule page reload after state updates
            this._scheduleReload();

            return user;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     *
     */
    _scheduleReload () {
        // Small delay to ensure all state updates and token storage are complete
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    /**
     *
     * @param email
     * @param password
     */
    async handleRegister (email, password) {
        if (!email || !password) {
            throw new Error('Invalid email');
        }

        try {
            this.setLoading(true);
            const user = await this.api.createUser({ email, password });

            // Auto login after registration
            return this.handleLogin(email, password);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     *
     */
    async handleLogout () {
        try {
            this.setLoading(true);
            await this.api.logout();

            // Clear state and notify
            this.stateManager.setState('authenticated', false);
            this.stateManager.setState('currentUser', null);
            this.eventManager.publish(EventManager.EVENTS.AUTH.LOGOUT);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     *
     */
    getCurrentUser () {
        return this.stateManager.getState('currentUser');
    }

    /**
     *
     */
    isAuthenticated () {
        return this.stateManager.getState('authenticated') === true;
    }

    /**
     *
     * @param user
     */
    updateUserInfo (user) {
        if (this.renderer) {
            this.renderer.renderUserInfo(user);
        }
    }
}
