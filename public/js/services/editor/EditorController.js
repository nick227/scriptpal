import { Controller } from '../../core/Controller.js';

/**
 * Adapter controller for the editor view.
 * The Widgets layer owns the UI lifecycle; this controller is a shim solely
 * to keep the legacy App bootstrap happy.
 */
export class EditorController extends Controller {
    constructor () {
        super('Editor');
    }

    onEnter () {
        // Intentionally minimal: widget lifecycle is managed outside of this shim.
    }

    onExit () {
        // No-op for now.
    }
}
