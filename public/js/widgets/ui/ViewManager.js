import { LAYOUTS } from '../../constants.js';
import { loadRawFromStorage, saveRawToStorage } from '../../services/persistence/PersistenceManager.js';

/**
 * Manages view layout and persistence
 */
export class ViewManager {
    /**
     *
     * @param elements
     */
    constructor (elements) {
        this.elements = elements;
    }

    /**
     *
     */
    setupCurrentView () {
        const currentView = loadRawFromStorage('scriptpal-view') || LAYOUTS.VERTICAL;
        document.body.classList.add(currentView);
    }

    /**
     *
     */
    saveCurrentView () {
        const currentView = document.body.classList.contains(LAYOUTS.HORIZONTAL) ?
            LAYOUTS.HORIZONTAL :
            LAYOUTS.VERTICAL;
        saveRawToStorage('scriptpal-view', currentView);
    }

    /**
     *
     */
    toggleView () {
        // Remove both classes first to ensure clean state
        document.body.classList.remove(LAYOUTS.HORIZONTAL);
        document.body.classList.remove(LAYOUTS.VERTICAL);

        // Add the new layout class
        const currentView = loadRawFromStorage('scriptpal-view') || LAYOUTS.VERTICAL;
        const newView = currentView === LAYOUTS.VERTICAL ? LAYOUTS.HORIZONTAL : LAYOUTS.VERTICAL;
        document.body.classList.add(newView);

        // Save the new view preference
        this.saveCurrentView();
    }
}
