import { API_HEADERS, ERROR_MESSAGES } from './constants.js';

export const utils = {
    async fetchAPI(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...API_HEADERS,
                    ...options.headers
                },
                mode: 'cors',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                console.error('CORS Error: Make sure the server allows requests from this origin');
            }
            return null;
        }
    }
};