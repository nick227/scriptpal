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
        } else {
            console.warn(`View button with id '${buttonId}' not found`);
        }
    }
}