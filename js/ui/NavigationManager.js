import { UI_ELEMENTS } from '../constants.js';

export class NavigationManager {
    constructor(elements) {
        this.elements = elements;
        this.initialize();
    }

    initialize() {
        // Get the active button and show its panel on initialization
        if (this.elements.siteControls) {
            const activeButton = this.elements.siteControls.querySelector('.view-button.active');
            if (activeButton) {
                this.setActiveButton(activeButton.id);
            }
        }
    }

    setActiveButton(buttonId) {
        if (!this.elements.siteControls) {
            console.warn('Site controls container not found');
            return;
        }

        // Get all view buttons within site-controls
        const viewButtons = this.elements.siteControls.querySelectorAll('.view-button');

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
        // '.chat-container.output-container'
        const outputContainer = document.querySelector(UI_ELEMENTS.CHAT_CONTAINER);
        if (!outputContainer) {
            console.warn('Output container not found');
            return;
        }

        // Get all output panels
        const panels = outputContainer.querySelectorAll('.output-panel');

        // Hide all panels first
        panels.forEach(panel => {
            panel.classList.add('hidden');
        });

        // Show the active panel
        const activePanel = outputContainer.querySelector(`.output-panel[data-name="${activeView}"]`);
        if (activePanel) {
            activePanel.classList.remove('hidden');
            console.log(`Showing panel for view: ${activeView}`);
        } else {
            console.warn(`Output panel for view '${activeView}' not found`);
        }
    }
}