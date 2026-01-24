const SHARED_TOPBAR_HTML = `
    <div class="navbar">
        <h1 class="title">ScriptPal</h1>
        <div class="auth-widget">
            <div class="user-info auth-user" aria-live="polite" style="display: none;">
                <span class="auth-avatar" aria-hidden="true"></span>
                <span class="auth-identity">
                    <span class="auth-name"></span>
                    <span style="display:none;" class="auth-email"></span>
                </span>
            </div>
            <button class="logout-button auth-logout" style="display: none;">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
            <div class="user-forms auth-forms"></div>
        </div>
        <div class="script-selector hidden"></div>
    </div>
`;

export const renderSharedTopBar = (containerId = 'shared-topbar') => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[sharedLayout] Container "${containerId}" not found. Attempting to append to body.`);
        const fallback = document.createElement('div');
        fallback.innerHTML = SHARED_TOPBAR_HTML;
        document.body.prepend(fallback.firstElementChild);
        return;
    }

    container.innerHTML = SHARED_TOPBAR_HTML;
};

export const getTopBarElements = () => {
    const root = document.body;
    return {
        formsContainer: root.querySelector('.auth-forms'),
        logoutButton: root.querySelector('.logout-button'),
        userInfo: root.querySelector('.auth-user'),
        messagesContainer: null
    };
};
