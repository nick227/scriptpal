# Lint Fix Plan

## Phase 1: Configuration Fixes (High Impact)
The majority of the 437 errors are `no-undef` for standard browser APIs (`performance`, `Storage`, `MouseEvent`, `KeyboardEvent`, `Node`, `MediaRecorder`). These are defined in the browser environment but missing from the manual `globals` list configuration.

1.  **Update `eslint.config.js`**:
    *   Import `globals` from the `globals` package.
    *   Replace the manual `globals` object with `...globals.browser`.
    *   This single change should resolve ~200+ errors.

## Phase 2: Code Quality & Logic Fixes (Manual Intervention)
These errors indicate actual bugs or broken code structure.

2.  **Fix Duplicate Class Members**:
    *   Several classes have duplicate method definitions (e.g., `setLineFormat`, `createLineElement`, `getCurrentScriptHistory`).
    *   **Action**: Locate these files and remove/merge the duplicate methods.
    
3.  **Fix Promise API Usage**:
    *   Errors: `promise/catch-or-return`, `promise/always-return`.
    *   **Action**: Ensure all Promise chains return a value or throw, and have a `.catch()` block (or return the promise to the caller).

4.  **Fix Imports**:
    *   `import/no-unresolved`: Fix file path casing issues (e.g., `./app.js` vs `./App.js`).

## Phase 3: Cleanup (Low Risk)

5.  **Address Unused Variables**:
    *   Rule: `no-unused-vars`.
    *   **Action**: 
        *   Prefix unused arguments with `_` (e.g., `(event)` -> `(_event)`).
        *   Remove unused local variables.

## Execution Order
1.  Run `Phase 1` (Config update).
2.  Run `lint` again to verify error count reduction.
3.  Run `Phase 2` (Manual fixes).
4.  Run `lint` again.
5.  Run `Phase 3` (Auto-fixable where possible or manual).
