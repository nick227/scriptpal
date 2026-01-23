import {
    API_ENDPOINTS,
    API_HEADERS,
    UI_ELEMENTS,
    MESSAGE_TYPES,
    LAYOUTS,
    SERVER_PORT
} from './constants.js';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const getApiOrigin = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        return trimTrailingSlash(envUrl);
    }
    if (import.meta.env.PROD) {
        return window.location.origin;
    }
    return `http://localhost:${SERVER_PORT}`;
};

export const getApiBaseUrl = () => `${getApiOrigin()}/api`;

export const CONFIG = {
    api: {
        baseUrl: getApiBaseUrl(),
        endpoints: API_ENDPOINTS,
        headers: API_HEADERS
    },
    ui: {
        elements: UI_ELEMENTS,
        messageTypes: MESSAGE_TYPES,
        layouts: LAYOUTS
    }
};
