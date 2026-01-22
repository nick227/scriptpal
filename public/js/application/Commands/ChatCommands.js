/**
 * Chat Commands - CQRS Commands for chat operations
 * Under 300 lines, focused on command definitions
 */
import { Command } from './CommandBus.js';

/**
 * Send Message Command
 */
export class SendMessageCommand extends Command {
    /**
     *
     * @param content
     * @param sender
     */
    constructor (content, sender = 'User') {
        super();
        this.content = content;
        this.sender = sender;
    }
}

/**
 * Add Message Command
 */
export class AddMessageCommand extends Command {
    /**
     *
     * @param message
     */
    constructor (message) {
        super();
        this.message = message; // { id, content, sender, type, timestamp }
    }
}

/**
 * Clear Chat Command
 */
export class ClearChatCommand extends Command {
    /**
     *
     */
    constructor () {
        super();
    }
}

/**
 * Set Chat Enabled Command
 */
export class SetChatEnabledCommand extends Command {
    /**
     *
     * @param enabled
     */
    constructor (enabled) {
        super();
        this.enabled = enabled;
    }
}

/**
 * Focus Chat Input Command
 */
export class FocusChatInputCommand extends Command {
    /**
     *
     */
    constructor () {
        super();
    }
}
