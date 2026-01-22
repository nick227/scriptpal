AI Script Helper Analysis
========================

Decision Brief
--------------
This plan adds command-based AI edits without breaking the current flow, then
phases out full-content AI writes and introduces undo/redo.

Step 1 - Add commands (no behavior change)
------------------------------------------
Backend returns both:
- content
- commands[]

Frontend ignores commands for now. Nothing breaks.

Step 2 - Teach the editor to apply commands
-------------------------------------------
Add:
- editor.applyCommands(commands)

Keep:
- editor.updateScriptContent(fullText)

Choose command path only when commands exist.

Step 3 - Stop frontend saving AI edits
--------------------------------------
Backend AI edits are already saved.

Frontend:
- updates editor state
- does NOT POST /api/script/:id

Double-write is gone.

Step 4 - Make commands the default for AI
-----------------------------------------
AI edits:
- editor.applyCommands(commands)

Full-content replacement:
- fallback only
- never used for AI

Step 5 - Add undo / redo
------------------------
Push AI command batches to undo stack.

Undo:
- apply inverse commands

Redo:
- reapply commands

Save only on user commit.

Step 6 - Remove full-content AI path
------------------------------------
Delete AI uses of updateScriptContent.

Keep full content only for:
- initial load
- recovery
- export

Final rule
----------
AI edits = backend commands
User edits = frontend drafts
Full content = snapshot, not authority
