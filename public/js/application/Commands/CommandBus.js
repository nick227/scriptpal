/**
 * Command Bus - CQRS pattern for handling commands
 * Single responsibility: Route commands to handlers
 */
export class CommandBus {
    /**
     *
     */
    constructor () {
        this.handlers = new Map();
    }

    /**
     * Register a command handler
     * @param commandType
     * @param handler
     */
    register (commandType, handler) {
        this.handlers.set(commandType, handler);
    }

    /**
     * Execute a command
     * @param command
     */
    async execute (command) {
        const handler = this.handlers.get(command.constructor.name);
        if (!handler) {
            throw new Error(`No handler found for command: ${command.constructor.name}`);
        }

        return await handler.handle(command);
    }
}

/**
 * Base Command class
 */
export class Command {
    /**
     *
     */
    constructor () {
        this.timestamp = Date.now();
    }
}
