export function isDebugEnabled () {
    try {
        return localStorage.getItem('debug') === 'true';
    } catch (error) {
        return false;
    }
}

export function debugLog (...args) {
    if (!isDebugEnabled()) {
        return;
    }
    console.log(...args);
}
