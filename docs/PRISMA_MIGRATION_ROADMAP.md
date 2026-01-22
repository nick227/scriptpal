# Prisma Migration Roadmap (Action-Driven)

## Phase 0 — Prep
- Inventory DB touchpoints and group by domain.
- Freeze schema changes until Prisma baseline is live.
- Decide target MySQL DB for Prisma to point at first.
- Define write rules and enforcement gates.

## Phase 1 — Model First (Schema Reset)
- Split `scripts` into `Script` + `ScriptVersion`.
- Add `ScriptCommand` as the source of truth.
- Add unique constraint `(@@unique([scriptId, versionNumber]))`.
- Capture relationships for `users`, `sessions`, `chat_messages`, `script_elements`, `personas`.

## Phase 2 — Bootstrap Prisma
- Install: `npm install prisma @prisma/client`.
- Init: `npx prisma init`.
- Point Prisma to existing DB via `DATABASE_URL`.
- Generate client: `npx prisma generate`.

## Phase 3 — Enforce Write Rules (No Thin Wrapper)
- All writes go through repositories.
- Commands only; no direct snapshot writes.
- Snapshots only via materialization jobs.
- Transactions required for command + snapshot.

## Phase 4 — Backfill + Validation
- Backfill `ScriptVersion` from legacy content.
- Backfill `ScriptCommand` from edit history (minimal viable).
- Validate invariants: version order, command order, script ownership.
- Fail migration if any invariant fails.

## Phase 5 — Migrate By Domain (low → high risk)
- Users (read/write).
- Sessions (read/write).
- ChatMessages (read/write, consolidated schema).
- Scripts (read-only).
- ScriptCommands + ScriptVersions (writes + transaction).
- ScriptElements + Personas.
- AI edit paths.

## Phase 6 — Replace God DB With Repos
- Create domain repos with explicit transactions.
- Move version logic out of controllers.
- Remove duplicated SQL.

## Phase 7 — Gates (Migration Enforcement)
- Block raw SQL for writes.
- Block version writes outside materializers.
- Block non-command edits from AI paths.
- Add CI check to fail on direct DB writes.

## Phase 8 — Decommission Raw SQL Layer
- Remove `server/db/index.js`.
- Delete unused queries and scripts.
- Keep only Prisma client and repos.

## Write Rules (Explicit)
- Commands are canonical.
- Versions are derived snapshots.
- AI edits must emit commands.
- No table holds two responsibilities.

## Optional Phase 2 — Page-Scoped Structure
- Add `ScriptPage` only after command pipeline is stable.
- Keep page edits command-based.
