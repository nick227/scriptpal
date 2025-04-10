import { BaseWidget } from '../BaseWidget.js';

// Command base class
class AICommand {
    constructor(params) {
        this.params = params;
    }

    async execute() {
        throw new Error('Command must implement execute()');
    }

    validate() {
        return true;
    }

    // Add rollback support for transactions
    async rollback() {
        // Default no-op rollback
        return true;
    }
}

// Command batch class for transaction support
class CommandBatch {
    constructor(commands = []) {
        this.commands = commands;
        this.results = [];
        this.error = null;
        this.executedCommands = [];
    }

    addCommand(command) {
        this.commands.push(command);
    }

    async execute(manager, onProgress) {
        try {
            // Validate all commands first
            for (const command of this.commands) {
                const aiCommand = AICommandFactory.createCommand(command.type, command.params);
                if (!aiCommand.validate()) {
                    throw new Error(`Invalid parameters for command: ${command.type}`);
                }
            }

            // Execute all commands
            for (let i = 0; i < this.commands.length; i++) {
                const command = this.commands[i];
                const aiCommand = AICommandFactory.createCommand(command.type, command.params);

                // Notify progress if callback provided
                if (onProgress) {
                    onProgress(command, i);
                }

                const result = await manager.executeCommand(command);
                this.results.push(result);
                this.executedCommands.push({ command, aiCommand });
            }

            return this.results;
        } catch (error) {
            this.error = error;
            // Rollback executed commands in reverse order
            for (let i = this.executedCommands.length - 1; i >= 0; i--) {
                const { command, aiCommand } = this.executedCommands[i];
                try {
                    await aiCommand.rollback();
                } catch (rollbackError) {
                    console.error('Rollback failed for command:', command, rollbackError);
                }
            }
            throw error;
        }
    }
}

// Concrete command classes
class AddLineCommand extends AICommand {
    async execute(content) {
        const { format = 'action', content: lineContent = '' } = this.params;
        const newLine = content.createNewLine(format);
        if (lineContent) {
            newLine.textContent = lineContent;
        }
        this.createdLine = newLine; // Store for rollback
        return newLine;
    }

    async rollback() {
        if (this.createdLine && this.createdLine.parentElement) {
            this.createdLine.remove();
        }
    }

    validate() {
        return this.params.format && ['action', 'dialog', 'speaker', 'header', 'directions', 'chapter-break'].includes(this.params.format);
    }
}

class SetFormatCommand extends AICommand {
    async execute(content) {
        const { lineIndex, format } = this.params;
        const line = content.getLineAtIndex(lineIndex);
        if (!line) throw new Error(`Line at index ${lineIndex} not found`);
        content.setLineFormat(line, format);
        return line;
    }

    validate() {
        return typeof this.params.lineIndex === 'number' &&
            this.params.format && ['action', 'dialog', 'speaker', 'header', 'directions', 'chapter-break'].includes(this.params.format);
    }
}

class SetContentCommand extends AICommand {
    async execute(content) {
        const { lineIndex, content: lineContent } = this.params;
        const line = content.getLineAtIndex(lineIndex);
        if (!line) throw new Error(`Line at index ${lineIndex} not found`);
        line.textContent = lineContent;
        return line;
    }

    validate() {
        return typeof this.params.lineIndex === 'number' &&
            typeof this.params.content === 'string';
    }
}

class CreateChapterCommand extends AICommand {
    async execute(chapterManager) {
        const { title, pageNumber } = this.params;
        return chapterManager.createChapter(title, pageNumber);
    }

    validate() {
        return typeof this.params.title === 'string' &&
            typeof this.params.pageNumber === 'number' &&
            this.params.pageNumber >= 0;
    }
}

class ScrollToCommand extends AICommand {
    async execute(content) {
        const { pageNumber } = this.params;
        content.scrollToPage(pageNumber);
    }

    validate() {
        return typeof this.params.pageNumber === 'number' &&
            this.params.pageNumber >= 0;
    }
}

// Command factory
class AICommandFactory {
    static createCommand(type, params) {
        const commandMap = {
            'add_line': AddLineCommand,
            'set_format': SetFormatCommand,
            'set_content': SetContentCommand,
            'create_chapter': CreateChapterCommand,
            'scroll_to': ScrollToCommand
        };

        const CommandClass = commandMap[type];
        if (!CommandClass) {
            throw new Error(`Unknown command type: ${type}`);
        }

        return new CommandClass(params);
    }
}

export class AICommandManager extends BaseWidget {
    constructor() {
        // AICommandManager doesn't need UI elements
        super();

        // Command handlers
        this._handlers = {
            commandExecuted: null,
            commandFailed: null,
            batchStarted: null,
            batchCompleted: null,
            batchFailed: null,
            progressUpdate: null
        };

        // Component references
        this.content = null;
        this.chapterManager = null;
        this._currentBatch = null;
        this._batchProgress = {
            total: 0,
            completed: 0,
            current: null
        };
    }

    async setupEventListeners() {
        // No UI events to set up
    }

    async setupStateSubscriptions() {
        // No state subscriptions needed
    }

    // Command execution methods
    async executeCommand(command) {
        try {
            const aiCommand = AICommandFactory.createCommand(command.type, command.params);

            if (!aiCommand.validate()) {
                throw new Error(`Invalid parameters for command: ${command.type}`);
            }

            let result;
            switch (command.type) {
                case 'create_chapter':
                    result = await aiCommand.execute(this.chapterManager);
                    break;
                default:
                    result = await aiCommand.execute(this.content);
            }

            this.notifyCommandExecuted(command, result);
            return result;
        } catch (error) {
            this.notifyCommandFailed(command, error);
            throw error;
        }
    }

    // Batch command methods
    createBatch() {
        return new CommandBatch();
    }

    async executeBatch(batch) {
        if (!(batch instanceof CommandBatch)) {
            throw new Error('Invalid batch object');
        }

        try {
            this._batchProgress = {
                total: batch.commands.length,
                completed: 0,
                current: null
            };

            this.notifyBatchStarted(batch);
            this._currentBatch = batch;

            const results = await batch.execute(this, (command, index) => {
                this._batchProgress.completed = index;
                this._batchProgress.current = command;
                this.notifyProgressUpdate(this._batchProgress);
            });

            this._batchProgress.completed = batch.commands.length;
            this.notifyProgressUpdate(this._batchProgress);
            this.notifyBatchCompleted(batch, results);

            return results;
        } catch (error) {
            this.notifyBatchFailed(batch, error);
            throw error;
        } finally {
            this._currentBatch = null;
            this._batchProgress = {
                total: 0,
                completed: 0,
                current: null
            };
        }
    }

    // Event handlers
    onCommandExecuted(callback) {
        this._handlers.commandExecuted = callback;
    }

    onCommandFailed(callback) {
        this._handlers.commandFailed = callback;
    }

    onBatchStarted(callback) {
        this._handlers.batchStarted = callback;
    }

    onBatchCompleted(callback) {
        this._handlers.batchCompleted = callback;
    }

    onBatchFailed(callback) {
        this._handlers.batchFailed = callback;
    }

    onProgressUpdate(callback) {
        this._handlers.progressUpdate = callback;
    }

    // Notification methods
    notifyCommandExecuted(command, result) {
        if (this._handlers.commandExecuted) {
            this._handlers.commandExecuted(command, result);
        }
    }

    notifyCommandFailed(command, error) {
        if (this._handlers.commandFailed) {
            this._handlers.commandFailed(command, error);
        }
    }

    notifyBatchStarted(batch) {
        if (this._handlers.batchStarted) {
            this._handlers.batchStarted(batch);
        }
    }

    notifyBatchCompleted(batch, results) {
        if (this._handlers.batchCompleted) {
            this._handlers.batchCompleted(batch, results);
        }
    }

    notifyBatchFailed(batch, error) {
        if (this._handlers.batchFailed) {
            this._handlers.batchFailed(batch, error);
        }
    }

    notifyProgressUpdate(progress) {
        if (this._handlers.progressUpdate) {
            this._handlers.progressUpdate(progress);
        }
    }

    // Component references
    setContent(content) {
        this.content = content;
    }

    setChapterManager(chapterManager) {
        this.chapterManager = chapterManager;
    }

    destroy() {
        this._handlers = null;
        this.content = null;
        this.chapterManager = null;
        this._currentBatch = null;
        this._batchProgress = null;
        super.destroy();
    }
}