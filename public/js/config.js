import {
    API_ENDPOINTS,
    API_HEADERS,
    UI_ELEMENTS,
    MESSAGE_TYPES,
    LAYOUTS
} from './constants.js';

export const CONFIG = {
    api: {
        baseUrl: '/api',
        endpoints: API_ENDPOINTS,
        headers: API_HEADERS
    },
    ui: {
        elements: UI_ELEMENTS,
        messageTypes: MESSAGE_TYPES,
        layouts: LAYOUTS
    }
};