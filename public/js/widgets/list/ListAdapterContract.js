/**
 * ListAdapter Contract (UI)
 *
 * Required:
 * - getId(item) -> string|number
 * - getTitle(item) -> string
 * - getMetaText(item) -> string
 * - getEmptyItem() -> object
 * - buildRenamePayload(title) -> object
 * - buildOrderPayload(items) -> array
 * - createItem(contextId, payload) -> Promise
 * - updateItem(contextId, itemId, payload) -> Promise
 * - deleteItem(contextId, itemId) -> Promise
 * - reorderItems(contextId, order) -> Promise
 * - view: { labels, classNames, dataKey }
 *
 * Optional:
 * - supportsAi -> boolean
 * - generateIdea(contextId, itemId, draft) -> Promise|null
 */

export const LIST_ADAPTER_CONTRACT = Object.freeze({
    requiredMethods: [
        'getId',
        'getTitle',
        'getMetaText',
        'getEmptyItem',
        'buildRenamePayload',
        'buildOrderPayload',
        'createItem',
        'updateItem',
        'deleteItem',
        'reorderItems'
    ],
    requiredViewKeys: [
        'labels',
        'classNames',
        'dataKey'
    ]
});
