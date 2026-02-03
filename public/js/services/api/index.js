/**
 * API Services Index
 *
 * Usage:
 * import { ScriptPalAPI } from './services/api/index.js';
 * // or individual services:
 * import { AuthService, ScriptService, HttpClient } from './services/api/index.js';
 */

// Main facade (backwards compatible)
export { ScriptPalAPI } from './ScriptPalAPI.js';

// Individual services
export { HttpClient } from './HttpClient.js';
export { AuthService } from './AuthService.js';
export { UserService } from './UserService.js';
export { ScriptService } from './ScriptService.js';
export { ChatService } from './ChatService.js';
export { MediaService } from './MediaService.js';
export { BrainstormService } from './BrainstormService.js';
export { ScriptEntitiesService } from './ScriptEntitiesService.js';
export { PublicScriptService } from './PublicScriptService.js';

// Error types
export {
    APIError,
    ValidationError,
    NetworkError,
    TimeoutError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError
} from './APIError.js';

// Configuration
export {
    RETRY_CONFIG,
    TIMEOUT_CONFIG,
    IDEMPOTENT_METHODS,
    shouldRetry,
    calculateRetryDelay,
    getTimeoutForRequest,
    generateCorrelationId
} from './APIConfig.js';
