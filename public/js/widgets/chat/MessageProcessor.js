import { MESSAGE_TYPES } from '../../constants.js';

export class MessageProcessor {
    constructor ({ messageIdFactory } = {}) {
        this.messageIdFactory = messageIdFactory;
    }

    process (messageData, type) {
        if (!messageData) {
            return null;
        }

        const parsedData = this._parse(messageData);
        const content = this._extractContent(parsedData);
        if (!content) {
            console.warn('[MessageProcessor] No content extracted from message data:', messageData);
            return null;
        }

        const normalizedMessage = this.normalize({
            ...((typeof parsedData === 'object' && parsedData) ? parsedData : {}),
            content
        }, type);

        return {
            parsedData,
            normalizedMessage
        };
    }

    extractResponseContent (data) {
        if (!data || !data.response) {
            return null;
        }

        if (typeof data.response === 'string') {
            return data.response;
        }

        if (typeof data.response === 'object') {
            return data.response.response ||
                   data.response.message ||
                   data.response.content ||
                   data.response;
        }

        return null;
    }

    normalize (messageData, type) {
        const data = (messageData && typeof messageData === 'object') ? messageData : { content: messageData };
        const role = data.role || data.type || type || MESSAGE_TYPES.USER;

        return {
            id: data.id || this._generateMessageId(),
            role,
            type: role,
            content: data.content || '',
            timestamp: data.timestamp || new Date().toISOString(),
            status: data.status,
            metadata: data.metadata || {},
            intent: data.intent || (data.metadata && data.metadata.intent)
        };
    }

    _parse (data) {
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (error) {
                return data;
            }
        }
        return data;
    }

    _extractContent (data) {
        if (typeof data === 'string') {
            return data.trim();
        }

        if (!data) {
            return '';
        }

        if (typeof data === 'object') {
            if (data.response && typeof data.response === 'string') {
                return data.response.trim();
            }

            const messageFields = ['message', 'text', 'content', 'details', 'answer', 'reply'];
            for (const field of messageFields) {
                if (data[field] && typeof data[field] === 'string') {
                    return data[field].trim();
                }
            }

            if (data.response && typeof data.response === 'object') {
                return this._extractContent(data.response);
            }

            if (data.content && typeof data.content === 'string') {
                return data.content.trim();
            }

            if (typeof data.toString === 'function' && data.toString() !== '[object Object]') {
                return data.toString().trim();
            }
        }

        console.warn('[MessageProcessor] Could not extract content from response:', data);
        return '';
    }

    _generateMessageId () {
        if (typeof this.messageIdFactory === 'function') {
            return this.messageIdFactory();
        }
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
