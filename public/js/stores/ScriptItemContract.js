export const SCRIPT_ITEM_CONTRACT = Object.freeze({
    requiredApiHandlers: [
        'list',
        'create',
        'update',
        'delete',
        'reorder'
    ],
    optionalApiHandlers: [
        'generateIdea',
        'generateIdeaDraft'
    ]
});

export const validateScriptItemHandlers = (apiHandlers = {}) => {
    const missing = SCRIPT_ITEM_CONTRACT.requiredApiHandlers.filter(
        (key) => typeof apiHandlers[key] !== 'function'
    );
    return {
        valid: missing.length === 0,
        missing
    };
};
