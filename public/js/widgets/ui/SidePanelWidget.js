import { UI_ELEMENTS } from '../../constants.js';

import { PanelNavigation } from './PanelNavigation.js';

/**
 *
 */
export class SidePanelWidget {
    /**
     *
     * @param options
     */
    constructor (options = {}) {
        this.panelSelector = options.panelSelector || UI_ELEMENTS.SIDE_PANEL_PANEL;
        this.navigationSelector = options.navigationSelector || UI_ELEMENTS.PANEL_NAVIGATION;
        this.targetsMap = options.targetsMap || {
            'user-scripts': UI_ELEMENTS.USER_SCRIPTS_PANEL,
            'user-scenes': UI_ELEMENTS.USER_SCENES_PANEL
        };
        this.panelContainer = null;
        this.navigation = null;
        this.panelNavigation = null;
        this.minimizeButton = null;
        this.minimizeClickHandler = null;
        this.panelClickHandler = null;
        this.panelHeader = null;
        this.isMinimized = true;
        this.activeTarget = options.defaultTarget || 'user-scripts';
    }

    /**
     *
     */
    async initialize () {
        this.panelContainer = document.querySelector(this.panelSelector);
        this.navigation = document.querySelector(this.navigationSelector);

        if (!this.panelContainer) {
            throw new Error('Side panel container not found');
        }
        if (!this.navigation) {
            throw new Error('Panel navigation element not found');
        }

        this.panelNavigation = new PanelNavigation({
            navigationElement: this.navigation,
            targetsMap: this.targetsMap,
            defaultTarget: this.activeTarget
        });
        this.panelNavigation.initialize();
        this.setupPanelClickHandler();
        this.minimizeButton = this.createMinimizeButton();
        this.navigation.appendChild(this.minimizeButton);
    }

    /**
     *
     * @param target
     */
    setActive (target) {
        this.activeTarget = target;
        if (this.panelNavigation) {
            this.panelNavigation.setActive(target);
        }
    }

    /**
     *
     */
    setupPanelClickHandler () {
        if (!this.panelContainer) {
            return;
        }
        this.panelHeader = this.panelContainer.querySelector('h3');
        if (!this.panelHeader) {
            throw new Error('Side panel header not found');
        }
        this.panelClickHandler = (event) => {
            event.preventDefault();
            this.toggleMinimize();
        };
        this.panelHeader.addEventListener('click', this.panelClickHandler);
    }

    /**
     *
     */
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

    /**
     *
     */
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

    /**
     *
     */
    destroy () {
        if (this.panelNavigation) {
            this.panelNavigation.destroy();
        }
        if (this.minimizeButton && this.minimizeClickHandler) {
            this.minimizeButton.removeEventListener('click', this.minimizeClickHandler);
        }
        if (this.panelContainer && this.panelClickHandler) {
            this.panelHeader.removeEventListener('click', this.panelClickHandler);
        }
        this.panelContainer = null;
        this.navigation = null;
        this.panelNavigation = null;
        this.minimizeButton = null;
        this.minimizeClickHandler = null;
        this.panelClickHandler = null;
        this.panelHeader = null;
        this.isMinimized = false;
    }
}
