const ROUTE_REGISTRY = [
    {
        test: (pathname) => pathname === '/public',
        load: () => import('../pages/publicScriptsPage.js'),
        mount: 'mountPublicScriptsPage'
    },
    {
        test: (pathname) => /^\/public\/[^/]+(?:\/[^/]+)?$/.test(pathname),
        load: () => import('../pages/publicScriptViewerPage.js'),
        mount: 'mountPublicScriptViewerPage'
    },
    {
        test: (pathname) => /^\/u\/[^/]+$/.test(pathname),
        load: () => import('../pages/publicUserPage.js'),
        mount: 'mountPublicUserPage'
    },
    {
        test: (pathname) => pathname === '/profile',
        load: () => import('../pages/profilePage.js'),
        mount: 'mountProfilePage'
    }
];

let initialized = false;
let navigating = false;
let mountedCleanup = null;
let currentUrl = null;

const normalizePathname = (pathname) => {
    if (!pathname || pathname === '/') return '/';
    return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

const findRoute = (pathname) => {
    const normalized = normalizePathname(pathname);
    return ROUTE_REGISTRY.find((route) => route.test(normalized)) || null;
};

const isModifiedClick = (event) => {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
};

const shouldInterceptLink = (anchor, event) => {
    if (!anchor || isModifiedClick(event)) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.dataset.noFrameNav === 'true') return false;
    if (anchor.getAttribute('rel')?.includes('external')) return false;
    if (!anchor.href) return false;

    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) {
        return false;
    }

    return Boolean(findRoute(url.pathname));
};

const parseDocumentFromHtml = (html) => {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
};

const setLoadingState = (loading) => {
    document.body.classList.toggle('frame-nav-pending', loading);
    const main = document.querySelector('main');
    if (main) {
        main.setAttribute('aria-busy', loading ? 'true' : 'false');
    }
};

const runMountedCleanup = () => {
    if (typeof mountedCleanup !== 'function') {
        mountedCleanup = null;
        return;
    }

    try {
        mountedCleanup();
    } catch (error) {
        console.warn('[FrameNav] Page cleanup failed:', error);
    } finally {
        mountedCleanup = null;
    }
};

const applyMainSwap = (nextDocument) => {
    const currentMain = document.querySelector('main');
    const nextMain = nextDocument.querySelector('main');
    if (!currentMain || !nextMain) {
        return null;
    }

    const previousHeight = Math.max(currentMain.getBoundingClientRect().height, 320);
    const importedMain = document.importNode(nextMain, true);
    importedMain.style.minHeight = `${Math.round(previousHeight)}px`;
    currentMain.replaceWith(importedMain);
    return importedMain;
};

const mountForPath = async (pathname, options = {}) => {
    const normalizedPath = normalizePathname(pathname);
    const route = findRoute(normalizedPath);
    if (!route) {
        return false;
    }

    const moduleNs = await route.load();
    const mountFn = moduleNs?.[route.mount];
    if (typeof mountFn !== 'function') {
        console.warn(`[FrameNav] Mount function "${route.mount}" missing for ${pathname}`);
        return false;
    }

    const cleanup = await mountFn({ preserveTopBar: true, ...options });
    mountedCleanup = typeof cleanup === 'function' ? cleanup : null;
    return true;
};

const fallbackHardNavigation = (href) => {
    window.location.assign(href);
};

const updateDocumentMeta = (nextDocument, loadingClass = false) => {
    document.title = nextDocument.title || document.title;
    document.body.className = nextDocument.body.className || '';
    if (loadingClass) {
        document.body.classList.add('frame-nav-pending');
    }
};

const normalizeUrlForCompare = (urlLike) => {
    const url = new URL(urlLike, window.location.origin);
    return `${url.pathname}${url.search}${url.hash}`;
};

export const registerPageFrameCleanup = (cleanup) => {
    mountedCleanup = typeof cleanup === 'function' ? cleanup : null;
};

export const initPageFrameNavigation = () => {
    if (initialized) return;

    initialized = true;
    currentUrl = new URL(window.location.href);

    document.addEventListener('click', (event) => {
        const anchor = event.target?.closest?.('a[href]');
        if (!shouldInterceptLink(anchor, event)) {
            return;
        }

        const targetUrl = new URL(anchor.href, window.location.origin);
        const targetKey = normalizeUrlForCompare(targetUrl.href);
        const currentKey = normalizeUrlForCompare(currentUrl?.href || window.location.href);
        if (targetKey === currentKey) {
            return;
        }

        event.preventDefault();
        void navigateFrame(targetUrl.href, { historyMode: 'push' });
    });

    window.addEventListener('popstate', () => {
        void navigateFrame(window.location.href, { historyMode: 'none', fromPopState: true });
    });
};

export const navigateFrame = async (href, { historyMode = 'push', fromPopState = false } = {}) => {
    if (navigating) {
        return;
    }

    const targetUrl = new URL(href, window.location.origin);
    const route = findRoute(targetUrl.pathname);
    if (!route) {
        fallbackHardNavigation(targetUrl.href);
        return;
    }

    const targetKey = normalizeUrlForCompare(targetUrl.href);
    const currentKey = normalizeUrlForCompare(currentUrl?.href || window.location.href);
    if (targetKey === currentKey && !fromPopState) {
        return;
    }

    navigating = true;
    setLoadingState(true);

    try {
        const response = await fetch(targetUrl.href, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'X-ScriptPal-Frame': '1'
            }
        });

        if (!response.ok) {
            fallbackHardNavigation(targetUrl.href);
            return;
        }

        const finalUrl = new URL(response.url, window.location.origin);
        if (!findRoute(finalUrl.pathname)) {
            fallbackHardNavigation(targetUrl.href);
            return;
        }

        const html = await response.text();
        const nextDocument = parseDocumentFromHtml(html);

        runMountedCleanup();

        const swappedMain = applyMainSwap(nextDocument);
        if (!swappedMain) {
            fallbackHardNavigation(targetUrl.href);
            return;
        }

        updateDocumentMeta(nextDocument, true);

        if (historyMode === 'push') {
            window.history.pushState({}, '', `${finalUrl.pathname}${finalUrl.search}${finalUrl.hash}`);
        } else if (historyMode === 'replace') {
            window.history.replaceState({}, '', `${finalUrl.pathname}${finalUrl.search}${finalUrl.hash}`);
        }

        currentUrl = new URL(window.location.href);

        if (!finalUrl.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }

        const mounted = await mountForPath(finalUrl.pathname, { navigationType: 'client' });
        if (!mounted) {
            fallbackHardNavigation(targetUrl.href);
            return;
        }

        swappedMain.style.minHeight = '';
    } catch (error) {
        console.error('[FrameNav] Navigation failed, falling back to hard reload:', error);
        fallbackHardNavigation(targetUrl.href);
    } finally {
        navigating = false;
        setLoadingState(false);
    }
};
