/**
 * Script Commands - CQRS Commands for script operations
 * Under 300 lines, focused on command definitions
 */
import { Command } from './CommandBus.js';

/**
 * Create Script Command
 */
export class CreateScriptCommand extends Command {
    /**
     *
     * @param title
     * @param content
     */
    constructor (title, content = '') {
        super();
        this.title = title;
        this.content = content;
    }
}

/**
 * Update Script Command
 */
export class UpdateScriptCommand extends Command {
    /**
     *
     * @param scriptId
     * @param updates
     */
    constructor (scriptId, updates) {
        super();
        this.scriptId = scriptId;
        this.updates = updates; // { title, content, etc. }
    }
}

/**
 * Delete Script Command
 */
export class DeleteScriptCommand extends Command {
    /**
     *
     * @param scriptId
     */
    constructor (scriptId) {
        super();
        this.scriptId = scriptId;
    }
}

/**
 * Select Script Command
 */
export class SelectScriptCommand extends Command {
    /**
     *
     * @param scriptId
     */
    constructor (scriptId) {
        super();
        this.scriptId = scriptId;
    }
}

/**
 * Add Page Command
 */
export class AddPageCommand extends Command {
    /**
     *
     * @param scriptId
     * @param content
     * @param format
     */
    constructor (scriptId, content = '', format = 'action') {
        super();
        this.scriptId = scriptId;
        this.content = content;
        this.format = format;
    }
}

/**
 * Update Page Command
 */
export class UpdatePageCommand extends Command {
    /**
     *
     * @param scriptId
     * @param pageId
     * @param content
     */
    constructor (scriptId, pageId, content) {
        super();
        this.scriptId = scriptId;
        this.pageId = pageId;
        this.content = content;
    }
}

/**
 * Delete Page Command
 */
export class DeletePageCommand extends Command {
    /**
     *
     * @param scriptId
     * @param pageId
     */
    constructor (scriptId, pageId) {
        super();
        this.scriptId = scriptId;
        this.pageId = pageId;
    }
}

/**
 * Add Page Break Command
 */
export class AddPageBreakCommand extends Command {
    /**
     *
     * @param scriptId
     * @param position
     * @param label
     */
    constructor (scriptId, position, label = 'PAGE BREAK') {
        super();
        this.scriptId = scriptId;
        this.position = position;
        this.label = label;
    }
}

/**
 * Remove Page Break Command
 */
export class RemovePageBreakCommand extends Command {
    /**
     *
     * @param scriptId
     * @param pageBreakId
     */
    constructor (scriptId, pageBreakId) {
        super();
        this.scriptId = scriptId;
        this.pageBreakId = pageBreakId;
    }
}
