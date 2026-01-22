/**
 * Chat Queries - CQRS Queries for chat data retrieval
 * Under 300 lines, focused on query definitions
 */
import { Query } from './QueryBus.js';

/**
 * Get Chat Messages Query
 */
export class GetChatMessagesQuery extends Query {
    /**
     *
     * @param limit
     */
    constructor (limit = 50) {
        super();
        this.limit = limit;
    }
}

/**
 * Get Chat Message By ID Query
 */
export class GetChatMessageByIdQuery extends Query {
    /**
     *
     * @param messageId
     */
    constructor (messageId) {
        super();
        this.messageId = messageId;
    }
}

/**
 * Get Chat History Query
 */
export class GetChatHistoryQuery extends Query {
    /**
     *
     * @param scriptId
     * @param limit
     */
    constructor (scriptId, limit = 100) {
        super();
        this.scriptId = scriptId;
        this.limit = limit;
    }
}

/**
 * Search Chat Messages Query
 */
export class SearchChatMessagesQuery extends Query {
    /**
     *
     * @param searchTerm
     * @param limit
     */
    constructor (searchTerm, limit = 20) {
        super();
        this.searchTerm = searchTerm;
        this.limit = limit;
    }
}
