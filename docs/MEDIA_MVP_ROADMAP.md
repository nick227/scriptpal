# Media + AI Generation MVP Roadmap

## Current backend patterns (snapshot)
- REST routing is a manual registry in `server/routes.js` with `{ path, method, handler, middleware }`, mounted under `/api` in `server/server.js`.
- Controllers are thin handlers; reusable controller factories exist for script items and AI idea prompts (`server/controllers/scriptItemControllerFactory.js`, `server/controllers/scriptItemIdeaControllerFactory.js`).
- Prisma schema (MySQL) currently covers scripts, scenes, characters, locations, themes, brainstorm, chat. No media tables.
- AI usage is centralized in `server/services/AIClient.js` with provider abstraction and metrics.

## Organized requirements
- Media types: images and video now, expandable to other types later.
- Media entities: scripts, characters, locations, themes, scenes (and easily more).
- Library: combined user media library across all contexts.
- UX: standardized widgets for upload, AI generate (custom prompt), and library access.
- Storage: loose coupling; first-party hosting with seamless CDN attachment (Cloudflare/Cloudinary).
- AI generation: unify file handling + generation under a single flexible framework.

## Core principles (MVP)
- Asset-first: a single `MediaAsset` is the canonical record, with variants for display.
- Attachment-based linking: attach assets to any entity without schema churn.
- Provider-agnostic storage: app-level interface for storage + URL signing + transforms.
- Generation as jobs: AI generation is asynchronous and auditable.
- Library by ownership: `userId` is the library root; attachments map to contexts.
- One ingestion path: upload and AI output converge on the same service.

## MVP locks (do not change)
- Media is a parallel domain; no schema changes to Script/Scene/Character/etc.
- Attachments only via `MediaAttachment` (no owner FKs).
- AI output === upload output (same ingest path).
- Tables required: `MediaAsset`, `MediaVariant`, `MediaAttachment`, `MediaGenerationJob`.
- Constraints: `MediaAsset.status` required; `MediaAttachment.userId` required; `visibility` exists but only `private` used in MVP.

## Proposed schema sketch (Prisma-level concepts)
- `MediaAsset`
  - `id`, `userId`, `type` (image|video|...), `mimeType`, `title`, `description`, `tags` (Json)
  - `sizeBytes`, `width`, `height`, `durationMs`
  - `storageKey` (opaque), `storageProvider`, `checksum`, `status`, `visibility`, `source`, `createdAt`, `updatedAt`, `deletedAt`
- `MediaVariant`
  - `id`, `assetId`, `kind` (original|thumbnail|preview|poster), `format`, `width`, `height`, `sizeBytes`, `storageKey`
- `MediaAttachment`
  - `id`, `assetId`, `userId`, `ownerType` (script|character|location|theme|scene|...), `ownerId`, `role` (MediaRole), `sortOrder`, `meta`, `createdAt`
- `MediaGenerationJob`
  - `id`, `userId`, `type` (image|video), `prompt`, `negativePrompt`, `params` (Json)
  - `provider`, `model`, `status` (queued|running|succeeded|failed), `error`
  - `resultAssetId`, `createdAt`, `updatedAt`

Notes:
- `MediaAttachment.ownerType` is the escape hatch for future entity types.
- `MediaAsset` can exist without attachment (library-first).
- Guardrails live in the service layer: validate owner exists + belongs to `userId`.
- Indexes to add now: `[userId, createdAt]`, `[ownerType, ownerId]`, `[assetId]`, unique `[ownerType, ownerId, role]`.
- Visibility now: `private | shared | public` (default private).

## Additional enums (MVP)
- `MediaRole`: `cover | inline | gallery | reference`

## Storage + CDN coupling (loose)
- `OriginStorageAdapter` interface (local/R2/Cloudinary):
  - `putObject({ key, stream, contentType, metadata })`
  - `deleteObject({ key })`
  - `createVariant({ sourceKey, variantSpec })` (optional per provider)
- `DeliveryAdapter` interface (local/CDN/Images):
  - `getPublicUrl({ key, variant })` or `getSignedUrl({ key, expiresIn })`
  - `getTransformedUrl({ key, transformSpec })` (optional per provider)
- Provider selection via config/env:
  - `MEDIA_ORIGIN=local|r2|cloudinary`
  - `MEDIA_DELIVERY=local|public|signed|cloudflare_images|cloudinary`
  - `MEDIA_BASE_URL` for local/public paths
  - Cloudflare-ready: R2 (S3-compatible) + optional Images for variants; switching is API-key only.

## Standardized widgets (frontend contracts)
- Upload: accepts file, returns `MediaAsset` + default variants.
- Generate: accepts prompt + type; returns `MediaGenerationJob` and later `MediaAsset`.
- Library: fetch paged `MediaAsset` list (filter by type, tags).
- Attach: selects `MediaAsset` and creates `MediaAttachment`.

## Suggested API shape (aligned to current routing)
- `POST /media/upload`
- `POST /media/generate`
- `GET /media`
- `POST /media/:id/attach`
- `DELETE /media/:id`
- `GET /media/jobs/:id`

## Variant policy (MVP)
- Local/R2: server generates thumbnails/previews and stores as `MediaVariant`.
- Cloudinary/Cloudflare Images: provider generates variants; still record `MediaVariant` with provider keys.

## MVP cuts (explicitly defer)
- No Cloudflare Images.
- No video generation (video uploads only).
- No signed URL behavior (stub only).
- No shared/public visibility behavior.
- No background workers/queues (in-process async only).
- No webhooks.
- No audit/event tables.

## MVP storage decision
- Local filesystem first, laid out like object storage:
  - `/uploads/{userId}/{assetId}/{variant}/{filename}`
- Adapters to implement now:
  - `OriginStorageAdapter`: `putObject`, `deleteObject`
  - `DeliveryAdapter`: `getPublicUrl` (stub `getSignedUrl` to public)

## MVP AI scope
- Images only, single provider, no retries/cancel/streaming.
- Flow: create job → generate → ingest buffer → update job status.

## Media consumption rule
- Do not auto-join media into Script/Scene/Character endpoints.
- Use `?includeMedia=true` or `GET /owners/:ownerType/:ownerId/media`.

## MVP execution order (locked)
1. **Foundation**
   - Add Prisma models + indexes.
   - Add `MediaRepo` (CRUD + list).
   - Add local storage adapter.
   - Add ingest service.
2. **Upload + library**
   - `POST /media/upload`
   - `GET /media`
   - Generate image thumbnails via server (Sharp).
3. **Attachments**
   - `POST /media/:id/attach`
   - Owner media fetch endpoint.
4. **AI images**
   - `MediaGenerationJob`
   - `POST /media/generate`
   - In-process execution, ingest result.
5. **Cloudflare-ready (optional)**
   - R2 origin adapter.
   - Env-only switch.

## MVP success criteria
- Upload → appears in library.
- Generate → appears in library.
- Attach → appears on script/scene/character.
- Switching `MEDIA_ORIGIN=local → r2` works with only adapter config changes.

## Actionable steps (<=25)
1. Add Prisma enums for media type/status/visibility/owner.
2. Add Prisma models: `MediaAsset`, `MediaVariant`, `MediaAttachment`, `MediaGenerationJob`.
3. Add required indexes and constraints from the locks section.
4. Generate and apply Prisma migration.
5. Create `MediaRepo` with CRUD + library list queries.
6. Add `OriginStorageAdapter` interface and local implementation.
7. Add `DeliveryAdapter` interface and local implementation.
8. Define upload path pattern `/uploads/{userId}/{assetId}/{variant}/{filename}`.
9. Implement `MediaIngestService.ingest(...)` contract.
10. Implement image variant generation (Sharp) inside ingest flow.
11. Add media upload controller (uses ingest service).
12. Add `POST /media/upload` route.
13. Add media library list controller (scoped to `userId`).
14. Add `GET /media` route.
15. Add media attach controller with owner validation.
16. Add `POST /media/:id/attach` route.
17. Add owner-media fetch endpoint (`GET /owners/:ownerType/:ownerId/media` or `?includeMedia=true`).
18. Add `MediaGenerationJob` creation logic (queued).
19. Add `POST /media/generate` route.
20. Implement in-process AI execution (image only).
21. Pipe AI output buffer into `MediaIngestService.ingest(...)`.
22. Update job status to succeeded/failed.
23. Add `GET /media/jobs/:id` route.
24. Add R2 origin adapter (optional phase).

## Scope note
- Add media as a parallel domain only. Do not modify Script/Scene/etc schemas beyond optional hydration.

