# Controller Naming & Layout Roadmap

## Current state summary
- `server/controllers` mixes boundaries: top-level files range from controller-style exports (`brainstormBoardController.js`, `characterIdeaController.js`, `scriptController.js`) to helpers/services that lack the `Controller` suffix (`aiResponse.js`, `script/context-builder.service.js`, `scriptContextCollections.js`).
- Subdirectories such as `chat/`, `langchain/`, and the legacy helper folder (now `script-services/`) already group related code, but their naming is inconsistent (PascalCase `HistoryManager.js` under `chat/history`, `ScriptManager.js` under `script-services`, etc.) and the folders use neither a clear feature prefix nor consistent casing.
- `Controller` files currently use camelCase (e.g., `mediaLibraryController.js`) while related idea/controllers, factories, and services are intermingled with overlapping naming patterns (e.g., `scriptItemControllerFactory.js`).

## Proposed naming conventions
1. **Feature folders in kebab-case.** Each feature (e.g., brainstorm, media, chat, script) lives under a folder named after its domain: `server/controllers/brainstorm/`, `server/controllers/media/`, etc.
2. **Controller files in kebab-case with a `.controller.js` suffix.** Examples:
   - `brainstormBoardController.js` → `brainstorm/board.controller.js`
   - `locationIdeaController.js` → `location/idea.controller.js`
   - `mediaAttachmentController.js` → `media/attachment.controller.js`
3. **Factories/services helpers keep descriptive suffixes.** Use `.factory.js`, `.service.js`, `.manager.js`, etc., while keeping kebab-case. Prefer naming that reflects each factory's role (e.g., `script/item.factory.js` for the shared script-item handlers or `script/item-idea.factory.js` for the AI prompt controllers) instead of leaking implementation details such as `controller-factory`. Only append `controller-` when the module literally builds controller instances.
4. **Non-controller modules get dedicated folders.** Helpers such as `script/context-collections.service.js` or `ai-response.service.js` should move into `server/controllers/common/` (e.g., `server/controllers/common/ai-response.service.js`) or their feature folder with descriptive suffixes (`context-collections.service.js`, `ai-response.service.js`).
5. **Exports remain default or named but clearly documented.** Keep the current default export structure and only adjust the importer path when the file name changes so runtime behavior is unaffected.

## Implementation roadmap (without breaking imports)
1. **Inventory and mapping sheet.** Run `rg --files server/controllers --glob "*.js"` and capture current names. Create a simple mapping document (CSV/Markdown) listing each file, proposed new name, folder, and whether it is a controller or helper. Flag files already inside feature subfolders to avoid unnecessary moves.
2. **Stage new folders and files.** Incrementally create the desired structure (e.g., `server/controllers/brainstorm/`, `server/controllers/media/`). For each controller, create the renamed file using `git mv` or copy/rename, and keep exports the same.
3. **Temporary re-export shims.** To avoid breaking imports during rollout, leave a small file at the old path that re-exports the renamed module:
   ```js
   export { default } from './brainstorm/board.controller.js';
   ```
   This keeps existing import paths intact while allowing the real logic to live in the new location. Remove the shim after all callers update to the new path.
4. **Update imports in batches.** Use `rg -l "brainstormBoardController" -0 | xargs -0 sed -i` or a code-aware search tool to replace old paths with the new kebab-case controllers. Run `npm run lint` or `npm run build` after each batch to ensure no broken paths remain.
5. **Remove shims and tidy exports.** Once consumers point to `brainstorm/board.controller.js` directly, delete the shim files. Delay adding feature barrel/index files until a feature has three or more controllers; premature barrels can obscure dependencies early on.
6. **Automate future enforcement.** Avoid heavyweight lint rules. A tiny script such as `rg 'Controller\.js' server/controllers && echo '❌ Legacy controller naming found'` can serve as a pre-commit/CI warning that flags files still using legacy suffixes without adding configuration debt.

## Validation & follow-up
- Use `rg --files server/controllers | sort` before and after to confirm every file follows the new naming pattern.
- Run the existing test suite (`npm run test`/`npm run lint`) to catch any remaining import regressions.
- Once the rename is stable, update documentation (e.g., `docs/architecture.md`) with the new conventions and remind new contributors to follow the renamed structure.
- Media controllers now live under `server/controllers/media/` with kebab-case `.controller.js` files and corresponding route/test imports; keep applying the same roll-out steps as you migrate the next feature.
- Script controllers/factories live under `server/controllers/script/` with `.controller.js`/`.factory.js` names; keep the inventory→rename→shim (if needed)→import-update workflow for the next feature.
- User auth handlers now live at `server/controllers/user/user.controller.js`; update any documentation or helpers that still mention the legacy `userController.js` path.
- Script-item controllers plus their idea variants now live under `server/controllers/script/items/` and `server/controllers/script/ideas/` with kebab `.controller.js` files that still rely on the shared factories in `server/controllers/script/`.
- Legacy helper folder `server/controllers/scripts/` was renamed to `server/controllers/script-services/` to keep the `script` (feature) controllers separate from the older script-processing utilities.
- Chat controllers (chat, next-lines, system-prompt) now live under `server/controllers/chat/` with kebab `.controller.js` names; keep using the inventory→rename→shim→import-update checklist before moving the next feature.
- The append-page logic and AI response helper now live under `server/controllers/script/append-page.controller.js` and `server/controllers/common/ai-response.service.js`, respectively, so shared utilities can be imported uniformly from those new locations.
- Persona and health helpers now reside under `server/controllers/script/persona.controller.js` and `server/controllers/common/health.controller.js`, keeping domain-specific logic grouped with the rest of the script/chat utilities and the system/infrastructure helpers.
- Context-builder helper now lives under `server/controllers/script/context-builder.service.js`, which keeps script context assembly collocated with the rest of the `script` helpers while still being available to chat, next-lines, and idea flows.
- Public script endpoints now import from `server/controllers/public/public-script.controller.js` and `server/controllers/public/public-script-comment.controller.js`, matching the kebab naming conventions while keeping the controllers grouped under a `public` feature folder.
