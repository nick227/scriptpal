/**
 * Light client context for POST /api/chat — server assembles model context.
 */
export async function buildChatRequestContext (scriptContextManager, options = {}) {
    const {
        includeHistory = false,
        includeContent = false,
        includeAnalysis = false,
        includeMetadata = true,
        getSelection = null,
        ...rest
    } = options;

    const base = await scriptContextManager.getAIChatContext({
        includeHistory,
        includeContent,
        includeAnalysis,
        includeMetadata,
        ...rest
    });

    const selection = typeof getSelection === 'function' ? getSelection() : null;

    return {
        ...base,
        selection
    };
}
