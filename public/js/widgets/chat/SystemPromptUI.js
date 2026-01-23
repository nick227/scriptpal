import { SYSTEM_PROMPTS } from '../../../../shared/systemPrompts.js';

export class SystemPromptUI {
    constructor ({ container, onPromptClick }) {
        this.container = container;
        this.onPromptClick = onPromptClick;
        this.toolbar = null;
        this.indicator = null;
        this.spinner = null;
        this.indicatorTimeout = null;
    }

    initialize () {
        if (!this.container) {
            return;
        }

        const computedPosition = window.getComputedStyle(this.container).position;
        if (!computedPosition || computedPosition === 'static') {
            this.container.style.position = 'relative';
        }

        if (!document.getElementById('system-prompt-spin-style')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'system-prompt-spin-style';
            styleEl.textContent = `
                @keyframes system-prompt-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styleEl);
        }

        this.toolbar = document.createElement('div');
        this.toolbar.style.display = 'flex';
        this.toolbar.style.gap = '4px';
        this.toolbar.style.zIndex = '5';
        this.toolbar.classList.add('system-chat-toolbar');

        SYSTEM_PROMPTS.forEach(prompt => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = prompt.label[0];
            button.title = prompt.label;
            button.addEventListener('click', () => this.handlePromptClick(prompt.id));
            this.toolbar.appendChild(button);
        });

        this.indicator = document.createElement('div');
        this.spinner = document.createElement('div');
        this.spinner.style.animation = 'system-prompt-spin 1s linear infinite';
        this.spinner.style.opacity = '0';
        this.spinner.setAttribute('aria-hidden', 'true');

        this.container.appendChild(this.toolbar);
        this.container.appendChild(this.indicator);
        this.indicator.appendChild(this.spinner);
    }

    handlePromptClick (promptId) {
        if (typeof this.onPromptClick === 'function') {
            this.onPromptClick(promptId);
        }
    }

    showSpinner () {
        if (this.spinner) {
            this.spinner.style.opacity = '1';
        }
    }

    hideSpinner () {
        if (this.spinner) {
            this.spinner.style.opacity = '0';
        }
    }

    updateIndicator (message) {
        if (!this.indicator) {
            return;
        }

        this.indicator.textContent = message;
        this.indicator.style.opacity = '1';

        if (this.indicatorTimeout) {
            clearTimeout(this.indicatorTimeout);
        }

        this.indicatorTimeout = setTimeout(() => {
            if (this.indicator) {
                this.indicator.style.opacity = '0';
            }
        }, 4000);
    }

    destroy () {
        if (this.toolbar) {
            this.toolbar.remove();
            this.toolbar = null;
        }

        if (this.indicator) {
            this.indicator.remove();
            this.indicator = null;
        }

        if (this.spinner) {
            this.spinner = null;
        }

        if (this.indicatorTimeout) {
            clearTimeout(this.indicatorTimeout);
            this.indicatorTimeout = null;
        }
    }
}
