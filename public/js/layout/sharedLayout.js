const SHARED_TOPBAR_HTML = `
    <header class="site-header">
        <div class="site-brand">
            <a href="/public/" class="site-nav__link"><h1 class="title">screenplaye</h1></a>
        </div>
        <nav class="site-nav">
            <a href="/mine/" class="site-nav__link">My Scripts</a>
        </nav>
        <div class="auth-widget">
            <div class="user-info auth-user" aria-live="polite" style="display: none;">
                <a href="/profile" class="site-nav__link hidden"><span class="auth-avatar" aria-hidden="true"></span></a>
                <span class="auth-identity">
                    <a href="/profile" class="site-nav__link"><span class="auth-name"></span></a>
                    <span style="display:none;" class="auth-email"></span>
                </span>
            </div>
            <button class="logout-button auth-logout" style="display: none;">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
            <div class="user-forms auth-forms"></div>
        </div>
    </header>
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

    const existingHeader = container.querySelector('.site-header');
    if (existingHeader) {
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
        tokenWatchContainer: null,
        messagesContainer: null
    };
};
