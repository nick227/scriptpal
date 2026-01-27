import { UI_ELEMENTS } from '../../constants.js';

export class SidePanelWidget {
    constructor (options = {}) {
        this.panelSelector = options.panelSelector || UI_ELEMENTS.SIDE_PANEL_PANEL;
        this.navigationSelector = options.navigationSelector || UI_ELEMENTS.PANEL_NAVIGATION;
        this.panelContainer = null;
        this.navigation = null;
        this.navButtons = [];
        this.navButtonHandlers = [];
        this.minimizeButton = null;
        this.minimizeClickHandler = null;
        this.panelClickHandler = null;
        this.isMinimized = false;
        this.activeTarget = 'user-scripts';
    }

    async initialize () {
        this.panelContainer = document.querySelector(this.panelSelector);
        this.navigation = document.querySelector(this.navigationSelector);

        if (!this.panelContainer) {
            throw new Error('Side panel container not found');
        }
        if (!this.navigation) {
            throw new Error('Panel navigation element not found');
        }

        this.setupNavigationButtons();
        this.setupPanelClickHandler();
        this.minimizeButton = this.createMinimizeButton();
        this.navigation.appendChild(this.minimizeButton);
        this.setActive(this.activeTarget);
    }

    setupNavigationButtons () {
        this.navButtons = Array.from(this.navigation.querySelectorAll('.panel-navigation-button'));
        this.navButtons.forEach(button => {
            const handler = () => {
                const target = button.dataset.target;
                if (target) {
                    this.setActive(target);
                }
            };
            button.addEventListener('click', handler);
            this.navButtonHandlers.push({ button, handler });
        });
    }

    setActive (target) {
        if (!target) return;
        this.activeTarget = target;
        this.navButtons.forEach(button => {
            const isActive = button.dataset.target === target;
            button.classList.toggle('is-active', isActive);
        });
        this.togglePanel(UI_ELEMENTS.USER_SCRIPTS_PANEL, target === 'user-scripts');
        this.togglePanel(UI_ELEMENTS.USER_SCENES_PANEL, target === 'user-scenes');
    }

    togglePanel (selector, isVisible) {
        const panel = document.querySelector(selector);
        if (!panel) {
            return;
        }
        panel.classList.toggle('hidden', !isVisible);
    }

    setupPanelClickHandler () {
        if (!this.panelContainer) {
            return;
        }
        this.panelClickHandler = () => {
            if (!this.isMinimized) {
                return;
            }
            this.toggleMinimize();
        };
        this.panelContainer.addEventListener('click', this.panelClickHandler);
    }

    toggleMinimize () {
        if (!this.panelContainer) {
            return;
        }
        this.isMinimized = !this.isMinimized;
        this.panelContainer.classList.toggle('is-minimized', this.isMinimized);
        const scriptsPanel = document.querySelector(UI_ELEMENTS.USER_SCRIPTS_PANEL);
        if (scriptsPanel) {
            scriptsPanel.classList.toggle('is-minimized', this.isMinimized);
        }
    }

    createMinimizeButton () {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'panel-navigation-control panel-navigation-minimize';
        button.title = 'Toggle side panel';
        button.setAttribute('aria-label', 'Toggle side panel visibility');
        button.innerHTML = '<i class="fas fa-minus"></i>';
        this.minimizeClickHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleMinimize();
        };
        button.addEventListener('click', this.minimizeClickHandler);
        return button;
    }

    destroy () {
        this.navButtonHandlers.forEach(({ button, handler }) => {
            button.removeEventListener('click', handler);
        });
        this.navButtonHandlers = [];
        if (this.minimizeButton && this.minimizeClickHandler) {
            this.minimizeButton.removeEventListener('click', this.minimizeClickHandler);
        }
        if (this.panelContainer && this.panelClickHandler) {
            this.panelContainer.removeEventListener('click', this.panelClickHandler);
        }
        this.navButtons = [];
        this.panelContainer = null;
        this.navigation = null;
        this.minimizeButton = null;
        this.minimizeClickHandler = null;
        this.panelClickHandler = null;
        this.isMinimized = false;
    }
}
