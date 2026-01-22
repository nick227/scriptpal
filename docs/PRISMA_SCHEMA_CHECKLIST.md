# Prisma Schema Checklist (Command-First)

## Core Models
- `Script` = identity only (no content).
- `ScriptVersion` = snapshots only.
- `ScriptCommand` = canonical edits.

## Required Fields
- `Script`: `userId`, `title`, `status`, timestamps.
- `ScriptVersion`: `scriptId`, `versionNumber`, `content`, `createdAt`.
- `ScriptCommand`: `scriptId`, `type`, `payload`, `author`, `createdAt`.

## Constraints
- `ScriptVersion` unique: `@@unique([scriptId, versionNumber])`.
- No nullable foreign keys unless required.
- No table with mixed responsibilities.

## Relations
- `Script` → `ScriptVersion[]` (1:N).
- `Script` → `ScriptCommand[]` (1:N).
- Optional: `Script` → `ScriptPage[]` (1:N, Phase 2).

## Authority Rules (Schema-Level)
- Commands are source of truth.
- Versions are materialized.
- AI edits must create commands.

## Chat Consolidation
- Single `ChatMessage` model.
- Optional `scriptId`.
- `content` is canonical; `metadata` is JSON.
- Metrics move to separate table.

## Script Elements
- If kept: metadata only (`payload` JSON + `source`).
- Do not store editor primitives here (Phase 2+ only).

## Write Gates
- No direct version writes outside materializers.
- No raw SQL writes once Prisma is active.
- All writes go through repo layer.

## Validation Gates
- Version numbers are contiguous per script.
- Command order strictly by `createdAt` (or sequence id).
- Ownership consistent across all related rows.
