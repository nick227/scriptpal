# ScriptPal Data Schema

This document describes the current database schema as defined in
`server/schema.sql` (the file used by `setup-database.js`).

## Tables

### `users`

- `id` (int, PK, auto increment)
- `email` (varchar(100), unique)
- `password_hash` (varchar(128))
- `password_salt` (varchar(32))
- `created_at` (timestamp)

### `sessions`

- `id` (int, PK, auto increment)
- `user_id` (int, FK → users.id)
- `token` (varchar(64), indexed)
- `expires_at` (datetime)
- `created_at` (timestamp)

### `scripts`

- `id` (int, PK, auto increment)
- `user_id` (int, FK → users.id)
- `version_number` (int)
- `title` (varchar(255))
- `status` (enum: draft, in_progress, complete)
- `created_at` (timestamp)
- `updated_at` (timestamp, auto update)
- `content` (text)

### `script_elements`

- `id` (int, PK, auto increment)
- `script_id` (int, FK → scripts.id)
- `type` (enum: section, chapter, act, beat, location, character, theme, plot,
  opening, ending, style, climax, resolution, conflict, tone, genre)
- `subtype` (varchar(100), nullable)
- `content` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp, auto update)

### `personas`

- `id` (int, PK, auto increment)
- `description` (text)
- `script_id` (int, FK → scripts.id)
- `user_id` (int, FK → users.id)
- `created_at` (timestamp)

### `chat_messages` (authoritative chat log)

- `id` (int, PK, auto increment)
- `user_id` (int, FK → users.id)
- `script_id` (int, nullable, FK → scripts.id)
- `session_id` (int, nullable, FK → sessions.id)
- `role` (enum: user, assistant)
- `user_prompt` (text)
- `system_prompt` (text, nullable)
- `assistant_response` (text, nullable)
- `model` (varchar(50), nullable)
- `intent` (varchar(50), nullable)
- `function_call` (json, nullable)
- `raw_openai_response` (json, nullable)
- `prompt_tokens` (int)
- `completion_tokens` (int)
- `total_tokens` (int)
- `cost_usd` (decimal(10,6))
- `created_at` (timestamp)
- `updated_at` (timestamp, auto update)
