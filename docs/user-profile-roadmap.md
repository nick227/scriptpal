# User Profile Roadmap

## Goal
Ship a logged-in profile page where users can:
- update their unique username,
- reset/change their password,
- soft-delete their account.

This roadmap is based on the current backend route architecture and frontend page bootstrap/layout flow in this repo.

## Current State Analysis

### API and REST routing (today)
Current API routes are registered in `server/routes.js` and mounted at `/api` in `server/server.js`.

Relevant user/auth routes today:
- `POST /api/login`
- `POST /api/logout`
- `POST /api/user` (register)
- `GET /api/user/current` (session user)
- `GET /api/user/token-watch`
- `GET /api/user/:id` (auth + `validateUserAccess`)
- `PUT /api/user/:id` (auth + `validateUserAccess`)

Current capability gaps for profile requirements:
- no username field in DB/API contract,
- no password-change endpoint,
- no account soft-delete endpoint,
- current `PUT /api/user/:id` updates email only.

### Data model and auth/session (today)
In `server/prisma/schema.prisma`, `User` currently has:
- `id`, `email`, `passwordHash`, `passwordSalt`, `createdAt`

Not present yet:
- `username`,
- account lifecycle flags/timestamps (e.g., `deletedAt`),
- any profile metadata for deletion reason/timestamp.

Session enforcement is cookie-based via `validateSession` in `server/middleware/auth.js`, backed by `sessionRepository` and `sessionCache`.

### Frontend page-building process (today)
Current page composition pattern:
- Server returns static HTML shells (`index.html`, `auth.html`, etc.) in `server/server.js`.
- Protected pages run auth gate (`requireAuth`) before full initialization (`public/js/pages/appBootstrap.js`).
- Shared header/top bar is injected by `renderSharedTopBar()` from `public/js/layout/sharedLayout.js`.
- Auth/token widgets attach through `initSharedTopBarWidgets()` in `public/js/layout/sharedTopBarWidgets.js`.
- Main app page bootstraps stores/widgets via `initScriptPal()` and `AuthenticatedAppBootstrap`.

This gives us an established pattern for adding a dedicated profile page.

## Proposed API Contract

### 1) Username update
Use current-user scoped routes (avoid user-id in client path for profile actions):
- `PATCH /api/user/current/profile`

Request:
```json
{
  "username": "new_handle"
}
```

Response:
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "new_handle"
}
```

Validation rules:
- required,
- normalized lowercase uniqueness check,
- allowed chars: `[a-z0-9_]+`,
- length: e.g. 3-32.

### 2) Password reset/change (logged in)
Since this is profile-scoped and user is authenticated, treat as password change:
- `POST /api/user/current/password`

Request:
```json
{
  "currentPassword": "old",
  "newPassword": "newStrongPassword"
}
```

Behavior:
- verify current password,
- hash + store new password,
- optionally invalidate all sessions except current (recommended: invalidate all).

### 3) Soft delete account
- `DELETE /api/user/current`

Request:
```json
{
  "password": "currentPassword",
  "confirm": "DELETE"
}
```

Behavior:
- verify password,
- soft-delete user account,
- revoke all sessions,
- clear auth cookie,
- deny future login.

Recommended response:
- `204 No Content`

## Data Model Changes

### User table additions
Add fields to `User` model:
- `username String? @unique` (or required after backfill),
- `usernameNormalized String? @unique` (recommended),
- `deletedAt DateTime?`,
- `deleteReason String?` (optional audit),
- `updatedAt DateTime @updatedAt`.

Soft-delete behavior decision:
- simplest and safest: usernames remain globally reserved forever, including deleted accounts.

### Session/login behavior updates
- `login` must reject users with `deletedAt != null`.
- `validateSession` should reject deleted users and clear cache entry.
- account delete flow should remove all sessions for that user.

## Frontend Implementation Plan (Page + Services)

### New page route and shell
Add a protected route in `server/server.js`:
- `GET /profile` -> `profile.html` (with `validateSession`).

Create `public/profile.html` using same structure style as existing pages:
- `<div id="shared-topbar"></div>`
- profile settings container
- module entry script.

### New page bootstrap
Create `public/js/pages/profilePage.js`:
- run `requireAuth()`,
- `renderSharedTopBar()` + `initSharedTopBarWidgets()`,
- initialize profile widget/controller,
- bind logout/auth-state redirects.

### API service additions
Extend API layer (`public/js/services/api`):
- `UserService.updateCurrentProfile({ username })`
- `UserService.changePassword({ currentPassword, newPassword })`
- `UserService.softDeleteCurrentUser({ password, confirm })`

Update `ScriptPalUser` to refresh cached `currentUser` after username change.

### UI/UX sections for profile page
- Profile basics: email (read-only), username editor.
- Security: current/new password form.
- Danger zone: soft delete with explicit confirmation.

## Backend Implementation Plan (Phased)

### Phase 1: Schema and repository
- Prisma migration for new `User` fields.
- Repository methods:
  - find by normalized username,
  - update username,
  - update password hash/salt,
  - soft delete user,
  - delete all sessions by userId.

### Phase 2: Controller and routes
- Add new handlers in `server/controllers/user/user.controller.js`.
- Register routes in `server/routes.js` with `validateSession`.
- Keep old `PUT /api/user/:id` behavior for compatibility, but stop using it from new profile page.

### Phase 3: Auth/session hardening
- enforce deleted-user checks in login/session validation paths,
- clear session cache on profile update/delete where needed.

### Phase 4: Frontend profile page
- add `profile.html`, `profilePage.js`, profile widget styles,
- add nav link to profile in shared top bar (optional but recommended).

### Phase 5: QA and rollout
- manual and automated tests,
- backfill usernames for existing users,
- production rollout with migration guardrails.

## Testing Roadmap

### Backend tests
Extend/add tests in `server/__tests__/controllers/userController.test.js` and repository tests:
- username update success/conflict/invalid format,
- password change success/wrong current password/weak password,
- soft delete success and blocked future login,
- session invalidation after delete,
- deleted user blocked by `validateSession`.

### Frontend tests
Add tests for:
- profile page auth gate behavior,
- username form validation + success state,
- password flow errors/success,
- delete confirmation and post-delete redirect/logout.

## Risks and Decisions to Lock Early
- Username policy (character set, case sensitivity, reserved words).
- Whether deleted usernames can be reused.
- Whether password change invalidates all sessions.
- Soft delete scope for owned content (keep scripts vs hide public artifacts).

## Suggested Endpoint Summary
- `PATCH /api/user/current/profile`
- `POST /api/user/current/password`
- `DELETE /api/user/current`

This keeps profile actions consistent with existing `/api/user/current` semantics and avoids exposing mutable profile operations via `:id` routes.
