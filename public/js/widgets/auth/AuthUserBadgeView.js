/**
 *
 */
export class AuthUserBadgeView {
    /**
     *
     * @param container
     */
    constructor (container) {
        if (!container) {
            throw new Error('AuthUserBadgeView requires a container element');
        }

        this.container = container;
        this.avatar = container.querySelector('.auth-avatar');
        this.name = container.querySelector('.auth-name');
        this.email = container.querySelector('.auth-email');

        if (!this.avatar || !this.name || !this.email) {
            throw new Error('AuthUserBadgeView requires avatar, name, and email elements');
        }
    }

    /**
     *
     * @param user
     */
    update (user) {
        const displayName = user.name || user.username || user.email;
        this.name.textContent = displayName;
        this.email.textContent = user.email || '';
        this.avatar.textContent = this.getInitials(displayName);
    }

    /**
     *
     */
    clear () {
        this.name.textContent = '';
        this.email.textContent = '';
        this.avatar.textContent = '';
    }

    /**
     *
     * @param label
     */
    getInitials (label) {
        if (!label) {
            return '';
        }

        const parts = label.trim().split(/\s+/);
        const first = parts[0] ? parts[0][0] : '';
        const last = parts.length > 1 ? parts[parts.length - 1][0] : '';

        return `${first}${last}`.toUpperCase();
    }
}
