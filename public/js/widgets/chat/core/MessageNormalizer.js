/**
 * MessageNormalizer — Normalize message shape and ensure IDs.
 * Split conceptually: shape normalization vs ID generation.
 * Prefer server IDs when available; use ensureMessageId only as client fallback.
 */

import { MESSAGE_TYPES } from '../../../constants.js';

/**
 * Normalize message shape (role, content, timestamp, metadata).
 * Does NOT add ID — use ensureMessageId when server did not provide one.
 * @param {object|string} messageData - Raw message data
 * @param {string} type - Default message type (user, assistant, etc.)
 * @returns {object} Normalized shape: { role, type, content, timestamp, status, metadata, intent }
 */
export function normalizeMessageShape (messageData, type) {
    const data = (messageData && typeof messageData === 'object') ? messageData : { content: messageData };
    const role = data.role || data.type || type || MESSAGE_TYPES.USER;

    return {
        id: data.id,
        role,
        type: role,
        content: data.content || '',
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.status,
        metadata: data.metadata || {},
        intent: data.intent || (data.metadata && data.metadata.intent)
    };
}

/**
 * Add ID to message if missing. Client fallback when server ID not present.
 * @param {object} message - Message object (may have id)
 * @returns {object} Message with id guaranteed
 */
export function ensureMessageId (message) {
    if (!message || typeof message !== 'object') {
        return message;
    }
    if (message.id) {
        return message;
    }
    return {
        ...message,
        id: generateMessageId()
    };
}

/**
 * Generate a unique message ID (client fallback).
 * @returns {string}
 */
export function generateMessageId () {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
