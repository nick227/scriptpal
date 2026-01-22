/**
 * Script Queries - CQRS Queries for script data retrieval
 * Under 300 lines, focused on query definitions
 */
import { Query } from './QueryBus.js';

/**
 * Get All Scripts Query
 */
export class GetAllScriptsQuery extends Query {
    /**
     *
     */
    constructor () {
        super();
    }
}

/**
 * Get Script By ID Query
 */
export class GetScriptByIdQuery extends Query {
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
 * Get Script Pages Query
 */
export class GetScriptPagesQuery extends Query {
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
 * Get Script Page Query
 */
export class GetScriptPageQuery extends Query {
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
 * Get Script Statistics Query
 */
export class GetScriptStatisticsQuery extends Query {
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
 * Search Scripts Query
 */
export class SearchScriptsQuery extends Query {
    /**
     *
     * @param searchTerm
     */
    constructor (searchTerm) {
        super();
        this.searchTerm = searchTerm;
    }
}

/**
 * Get Recent Scripts Query
 */
export class GetRecentScriptsQuery extends Query {
    /**
     *
     * @param limit
     */
    constructor (limit = 10) {
        super();
        this.limit = limit;
    }
}
