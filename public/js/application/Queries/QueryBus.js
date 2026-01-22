/**
 * Query Bus - CQRS pattern for handling queries
 * Single responsibility: Route queries to handlers
 */
export class QueryBus {
    /**
     *
     */
    constructor () {
        this.handlers = new Map();
    }

    /**
     * Register a query handler
     * @param queryType
     * @param handler
     */
    register (queryType, handler) {
        this.handlers.set(queryType, handler);
    }

    /**
     * Execute a query
     * @param query
     */
    async execute (query) {
        const handler = this.handlers.get(query.constructor.name);
        if (!handler) {
            throw new Error(`No handler found for query: ${query.constructor.name}`);
        }

        return await handler.handle(query);
    }
}

/**
 * Base Query class
 */
export class Query {
    /**
     *
     */
    constructor () {
        this.timestamp = Date.now();
    }
}
