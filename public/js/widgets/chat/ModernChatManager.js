/**
 * Modern Chat Manager
 *
 * Thin adapter around ChatManager to avoid duplicate business logic.
 */

import { ChatManager } from './ChatManager.js';

/**
 *
 */
export class ModernChatManager extends ChatManager {
    /**
     *
     * @param stateManager
     * @param api
     * @param eventManager
     */
    constructor (stateManager, api, eventManager) {
        super(stateManager, api, eventManager);
        this.mode = 'modern';
    }
}
