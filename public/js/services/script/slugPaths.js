const getMineSlugFromPathname = (pathname) => {
    const path = typeof pathname === 'string' ? pathname : (typeof window !== 'undefined' ? window.location.pathname : '');

    const parts = path.split('/').filter(Boolean);
    const mineIndex = parts.indexOf('mine');
    if (mineIndex === -1) {
        return null;
    }
    const slug = parts[mineIndex + 1];
    return slug ? decodeURIComponent(slug) : null;
};

const buildMinePath = (slug) => {
    if (!slug) {
        return '/mine';
    }
    return `/mine/${encodeURIComponent(slug)}`;
};

export {
    getMineSlugFromPathname,
    buildMinePath
};
