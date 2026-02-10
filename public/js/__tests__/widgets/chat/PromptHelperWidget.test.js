import { PromptHelperWidget } from '../../../widgets/chat/ui/PromptHelperWidget.js';

describe('PromptHelperWidget', () => {
    let container;
    let widget;

    beforeEach(() => {
        jest.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        widget = new PromptHelperWidget({
            container,
            sections: [],
            onHelperClick: jest.fn()
        });
        widget.initialize();
    });

    afterEach(() => {
        widget.destroy();
        container.remove();
        jest.useRealTimers();
    });

    test('shows and hides spinner', () => {
        widget.showSpinner();
        expect(widget.spinner.style.display).toBe('block');

        widget.hideSpinner();
        expect(widget.spinner.style.display).toBe('none');
    });

    test('shows indicator then auto-hides it', async () => {
        widget.updateIndicator('✓');
        expect(widget.indicator.style.display).toBe('block');
        expect(widget.indicator.style.opacity).toBe('1');

        await jest.advanceTimersByTimeAsync(4000);
        expect(widget.indicator.style.opacity).toBe('0');
        expect(widget.indicator.style.display).toBe('none');
    });
});

