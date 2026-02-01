# Data Layer Performance & Optimization Proposal

## Scope
- Data access layer performance across repositories, models, and Prisma usage
- Focus on query efficiency, indexes, batching, and payload size
- No feature changes; performance-only improvements

## MVP Cut: Must-Have vs Overkill

### Must-Have (do now)

#### 1) Add missing indexes
Keep:
- `ChatMessage`: `userId`, `scriptId`, `createdAt`, and `(userId, scriptId)`
- `ScriptVersion`: `(scriptId, versionNumber)`
- `Session`: `expiresAt`, `token`

Why: catastrophic without them once data grows  
Effort: low  
Impact: very high

#### 2) Remove large content from list endpoints
Target:
- `scriptRepository.getPublicScripts()` and similar list views

Change:
- Exclude `content` in version selects for list endpoints.

Why: payload + DB read bloat  
Effort: very low  
Impact: very high

#### 3) Fix N+1 / sequential queries in script profile
Target:
- `scriptModel.getScriptProfile()`

Change:
- Fetch related collections in a single `Promise.all` or `$transaction`.

Why: slow UX, obvious inefficiency  
Effort: low  
Impact: high

#### 4) Batch comment counts
Target:
- Public script list loading

Change:
- Use `groupBy` to fetch counts for all scripts in the page in one query.

Why: easy win, common list endpoint  
Effort: low  
Impact: medium-high

### Nice-to-Have (defer)

#### 5) Brainstorm diff-based updates
Target:
- `brainstormRepository.updateBoard()`

Change:
- Replace delete-all-then-create with diff-based updates or upserts.

Why: write efficiency + ID stability  
Effort: medium  
Impact: medium  
Risk: logic complexity if rushed

#### 6) Raw insert to Prisma create
Target:
- `chatMessageRepository.create()`

Change:
- Replace `$executeRaw`/`$queryRaw` with `prisma.chatMessage.create`.

Why: code cleanliness, not performance critical  
Effort: low-medium  
Impact: low

#### 7) Connection pool tuning
Target:
- `server/db/prismaClient.js`

Change:
- Raise default `DB_CONNECTION_LIMIT`.

Why: only matters under concurrency  
Effort: medium  
Impact: situational  
Risk: premature without metrics

### Overkill for MVP (skip)

#### 8) Caching layer
Target:
- Public script lists, script metadata, sessions

Change:
- Add TTL-based cache.

Why: premature optimization, adds invalidation complexity  
Effort: medium  
Impact: low at MVP scale

## MVP Implementation Plan
1. Add indexes in Prisma schema; apply migration.
2. Update `getScriptProfile()` to batch queries.
3. Remove `content` from list queries.
4. Batch comment counts via `groupBy`.

## Risk Notes (MVP)
- Index changes require migration and may lock tables briefly; schedule off-peak.
- Removing `content` from list queries requires verifying frontend does not depend on it.

## MVP Success Metrics
- Reduced query counts per request (profile and list endpoints)
- Lower average response times for public script lists
- Smaller payload sizes in list responses

