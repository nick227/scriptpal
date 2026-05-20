/**
 * Light client context for POST /api/chat — server assembles model context.
 */
export async function buildChatRequestContext (scriptContextManager, options = {}) {
    const {
        includeHistory = false,
        includeContent = false,
        includeAnalysis = false,
        includeMetadata = true,
        ...rest
    } = options;

    return scriptContextManager.getAIChatContext({
        includeHistory,
        includeContent,
        includeAnalysis,
        includeMetadata,
        ...rest
    });
}
