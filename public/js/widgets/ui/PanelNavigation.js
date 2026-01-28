export class PanelNavigation {
    constructor (options = {}) {
        this.navigationElement = options.navigationElement || null;
        this.targetsMap = options.targetsMap || {};
        this.activeTarget = options.defaultTarget || null;
        this.navButtons = [];
        this.navButtonHandlers = [];
    }

    initialize () {
        if (!this.navigationElement) {
            throw new Error('Panel navigation element not found');
        }
        this.setupNavigationButtons();
        if (this.activeTarget) {
            this.setActive(this.activeTarget);
        }
    }

    setupNavigationButtons () {
        this.navButtons = Array.from(this.navigationElement.querySelectorAll('.panel-navigation-button'));
        this.navButtons.forEach(button => {
            const handler = () => {
                const { target } = button.dataset;
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
        Object.entries(this.targetsMap).forEach(([key, selector]) => {
            const panel = document.querySelector(selector);
            if (!panel) {
                return;
            }
            panel.classList.toggle('hidden', key !== target);
        });
    }

    destroy () {
        this.navButtonHandlers.forEach(({ button, handler }) => {
            button.removeEventListener('click', handler);
        });
        this.navButtonHandlers = [];
        this.navButtons = [];
        this.navigationElement = null;
        this.targetsMap = {};
        this.activeTarget = null;
    }
}
