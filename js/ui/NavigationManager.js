import { UI_ELEMENTS } from '../constants.js';

export class NavigationManager {
    constructor(elements) {
        this.elements = elements;
    }

    setActiveButton(buttonId) {
        if (!this.elements.siteControls) {
            console.warn('Site controls container not found');
            return;
        }

        // Get all view buttons within site-controls
        const viewButtons = this.elements.siteControls.querySelectorAll(UI_ELEMENTS.CONTROL_BUTTON);

        // Remove active class from all view buttons
        viewButtons.forEach(button => {
            button.classList.remove('active');
        });

        // Add active class to target button
        const targetButton = this.elements.siteControls.querySelector(`#${buttonId}`);
        if (targetButton) {
            targetButton.classList.add('active');
            // Toggle visibility of output panels using data-view attribute
            this.toggleOutputPanels(targetButton.dataset.view);
        } else {
            console.warn(`View button with id '${buttonId}' not found`);
        }
    }

    toggleOutputPanels(activeView) {
        const outputContainer = document.querySelector(UI_ELEMENTS.OUTPUT_CONTAINER);
        if (!outputContainer) return;

        // Get all output panels
        const panels = outputContainer.querySelectorAll(UI_ELEMENTS.OUTPUT_PANEL);

        // Hide all panels first
        panels.forEach(panel => {
            panel.classList.add('hidden');
        });

        // Show the active panel using data-name attribute
        const activePanel = outputContainer.querySelector(`[data-name="${activeView}"]`);
        if (activePanel) {
            activePanel.classList.remove('hidden');
        } else {
            console.warn(`Output panel for view '${activeView}' not found`);
        }
    }
}