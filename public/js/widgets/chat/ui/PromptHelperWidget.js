/**
 *
 */
export class PromptHelperWidget {
    /**
     *
     * @param root0
     * @param root0.container
     * @param root0.sections
     * @param root0.onHelperClick
     */
    constructor ({ container, sections = [], onHelperClick }) {
        this.container = container;
        this.sections = sections;
        this.onHelperClick = onHelperClick;
        this.panel = null;
        this.indicator = null;
        this.spinner = null;
        this.indicatorTimeout = null;
    }

    /**
     *
     */
    initialize () {
        if (!this.container) {
            return;
        }

        const computedPosition = window.getComputedStyle(this.container).position;
        if (!computedPosition || computedPosition === 'static') {
            this.container.style.position = 'relative';
        }

        this.panel = document.createElement('div');
        this.panel.classList.add('prompt-helper-panel');

        this.indicator = document.createElement('div');
        this.indicator.classList.add('prompt-helper-indicator');
        this.indicator.textContent = '';

        this.spinner = document.createElement('div');
        this.spinner.classList.add('prompt-helper-spinner');
        this.spinner.setAttribute('aria-hidden', 'true');
        this.spinner.style.display = 'none';

        this.panel.appendChild(this.indicator);
        this.panel.appendChild(this.spinner);

        this.sections.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.classList.add('prompt-helper-section');

            if (section.description) {
                const desc = document.createElement('div');
                desc.classList.add('prompt-helper-section-description');
                desc.textContent = section.description;
                sectionEl.appendChild(desc);
            }

            const buttonsBar = this.generateButtonBar(section);

            sectionEl.appendChild(buttonsBar);
            this.panel.appendChild(sectionEl);
        });

        this.container.appendChild(this.panel);
    }

    /**
     *
     * @param buttonsBar
     */
    handleHeadingClick (buttonsBar) {
        if (buttonsBar.style.display === 'none') {
            buttonsBar.style.display = 'block';
        } else {
            buttonsBar.style.display = 'none';
        }
    }

    /**
     *
     * @param section
     */
    generateButtonBar (section = {}) {

        const buttonsBar = document.createElement('div');
        buttonsBar.classList.add('prompt-helper-buttons');

        (section.helpers || []).forEach(helper => {
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add('prompt-helper-button');
            button.textContent = helper.label;
            button.title = helper.description || helper.label;
            button.dataset.section = section.id;
            button.dataset.helperId = helper.id;
            if (helper.intent) {
                button.dataset.intent = helper.intent;
            }
            button.addEventListener('click', () => this.handleHelperClick(section.id, helper));
            buttonsBar.appendChild(button);
        });
        return buttonsBar;
    }

    /**
     *
     * @param sectionId
     * @param helper
     */
    handleHelperClick (sectionId, helper) {
        if (typeof this.onHelperClick === 'function') {
            this.onHelperClick(sectionId, helper);
        }
    }

    /**
     *
     */
    showSpinner () {
        if (this.spinner) {
            this.spinner.style.display = 'block';
        }
    }

    /**
     *
     */
    hideSpinner () {
        if (this.spinner) {
            this.spinner.style.display = 'none';
        }
    }

    /**
     *
     * @param message
     */
    updateIndicator (message) {
        if (!this.indicator) {
            return;
        }

        this.indicator.textContent = message || '';
        this.indicator.style.display = message ? 'block' : 'none';
        this.indicator.style.opacity = message ? '1' : '0';

        if (this.indicatorTimeout) {
            clearTimeout(this.indicatorTimeout);
        }

        if (message) {
            this.indicatorTimeout = setTimeout(() => {
                if (this.indicator) {
                    this.indicator.style.opacity = '0';
                    this.indicator.style.display = 'none';
                }
            }, 4000);
        }
    }

    /**
     *
     */
    destroy () {
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }

        if (this.indicator) {
            this.indicator.remove();
            this.indicator = null;
        }

        if (this.spinner) {
            this.spinner.remove();
            this.spinner = null;
        }

        if (this.indicatorTimeout) {
            clearTimeout(this.indicatorTimeout);
            this.indicatorTimeout = null;
        }
    }
}
