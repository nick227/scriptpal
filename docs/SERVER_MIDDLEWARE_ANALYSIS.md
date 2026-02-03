# Server Middleware Processes and Routines Analysis

This document provides a comprehensive analysis of the middleware architecture, security protocols, and routine processes implemented in the ScriptPal server.

## 1. Overview
The ScriptPal server uses a multi-layered middleware architecture to handle cross-cutting concerns such as security, authentication, logging, and request validation. Middleware is organized into two primary categories: **Global Middleware** (applied to all requests) and **Route-Specific Middleware** (applied to specific API endpoints).

---

## 2. Global Middleware Pipeline
The following middleware functions are applied to every request entering the server, in the order specified in `server.js`:

| Middleware | Source | Purpose |
| :--- | :--- | :--- |
| **Request Logging** | `logger.js` | Captures request metadata (method, path, correlation ID) and logs execution time. |
| **CORS** | `cors` pkg + `server.js` | Manages cross-origin resource sharing based on an allowed origin whitelist (including localhost support). |
| **Body/Cookie Parsing**| `express` / `cookie-parser`| Standardizes payload access; must occur before sanitization to populate `req.body`. |
| **Security Headers** | `security.js` | Configures Helmet for CSP, HSTS, and custom headers (e.g., `X-Content-Type-Options`, `X-Frame-Options`). |
| **Sanitization** | `security.js` | Automatically cleans `body`, `query`, and `params` of potentially dangerous XSS patterns ($<script>$, `javascript:`, etc.). |
| **Rate Limiting** | `security.js` | Implements `express-rate-limit` (Budgeting); uses identity info from cookies/sessions. |
| **Slow Down** | `security.js` | Uses `express-slow-down` to throttle aggressive request patterns after a specific threshold. |
| **Request Size Limit**| `security.js` | Rejects payloads exceeding a defined threshold (10MB) via `content-length` analysis. |
| **Context Injection** | `server.js` | Attaches utility instances (`aiClient`, `logger`) and `correlationId` to the `req` object for downstream use. |

---

## 3. Authentication & Access Control (`auth.js`)
The server implements session-based authentication using HTTP-only cookies.

### Session Validation (`validateSession`)
*   **Routine**: Retrieves `sessionToken` from cookies.
*   **Validation**: Queries `sessionRepository` to verify token existence/expiration.
*   **Context**: Attaches `req.userId` and the full `req.user` object to the request.
*   **Failure**: Returns `401 Unauthorized`.

### User Access Enforcement (`validateUserAccess`)
*   **Routine**: Compares the `id` in path parameters (e.g., `/user/:id`) with the authenticated `req.userId`.
*   **Failure**: Returns `403 Forbidden` if a user attempts to access another user's profile.

---

## 4. Ownership Enforcement (`scriptOwnership.js`)
A specialized layer designed to prevent Insecure Direct Object Reference (IDOR) vulnerabilities across the script ecosystem.

### Script Ownership (`requireScriptOwnership`)
*   **ID Resolution**: A robust resolver looks for `scriptId` or `id` across `params`, `body`, and `query`.
*   **Verification**: Checks if the requested script belongs to the authenticated `req.userId`.
*   **Context**: Attaches the verified `req.script` object to the request, reducing redundant DB lookups in controllers.

### Nested Entity Ownership
Helpers like `ensureElementOwnership`, `ensurePersonaOwnership`, and `ensureSceneOwnership` provide deep validation for sub-resources by traversing the relationship graph back to the parent script owner.

---

## 5. Security Architecture (`security.js`)
The `SecurityMiddleware` class serves as a centralized hub for protection routines.

*   **Zod Validation**: A framework-agnostic way to define schemas (`ValidationSchemas`) and create middleware that rejects malformed data with detailed `422 Unprocessable Entity` responses.
*   **Sanitization vs. Validation**:
    *   **Sanitization** is used as a broad-spectrum defense to strip malicious patterns ($<script>$, etc.) from all incoming inputs.
    *   **Zod Validation** enforces structural integrity, data types, and business logic constraints.
*   **IP Whitelisting**: Optional middleware for restricting access to specific administrative or internal IPs.
*   **CORS Management**: A custom implementation that ensures consistent behavior across different environments (Production vs. Localhost).

---

## 6. Routine System Processes

### Centralized Error Handling
A global error middleware in `server.js` catches all unhandled exceptions:
*   Logs the full stack trace and request context.
*   Sanitizes responses in production to prevent leakage of internal system details.
*   Handles `uncaughtException` and `unhandledRejection` to ensure the process fails gracefully rather than entering an unstable state.

### Graceful Shutdown Routine
When the server receives termination signals (SIGTERM/SIGINT):
1.  Stops accepting new connections.
2.  Allows active requests a 3-second window to complete.
3.  Explicitly calls `prisma.$disconnect()` to flush connection pools.
4.  Exits the process with the appropriate code.

### File Ingestion Service
The `mediaUploadMiddleware` (via `multer`) acts as a routine gatekeeper for file uploads, validating file presence and buffering data for the `MediaIngestService` to process (virus scanning/storage).

---

## 7. Configuration Strategy
Middleware behavior is driven by the `config/index.js` module, allowing environment-specific tuning of:
*   Rate limit windows and maximum attempts.
*   CORS origin lists.
*   Security header strictness.
*   Static asset paths.

## 8. Future Considerations
*   **Per-Route Rate Limiting**: Implementing specialized budgets for AI routes (tighter) vs. Public Read routes (permissive).
*   **Payload Encryption**: Assessing the need for end-to-end encryption for sensitive script content.
