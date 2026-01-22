/**
 *
 */
export class AuthFormView {
    /**
     *
     * @param root0
     * @param root0.form
     * @param root0.fields
     * @param root0.feedbackSelector
     * @param root0.submitSelector
     */
    constructor ({ form, fields, feedbackSelector, submitSelector }) {
        if (!form) {
            throw new Error('AuthFormView requires a form element');
        }
        this.form = form;
        this.fields = fields;
        this.feedback = form.querySelector(feedbackSelector);
        this.submitButton = form.querySelector(submitSelector);

        if (!this.feedback) {
            throw new Error('AuthFormView requires a feedback element');
        }
        if (!this.submitButton) {
            throw new Error('AuthFormView requires a submit button');
        }
    }

    /**
     *
     */
    getValues () {
        return Object.keys(this.fields).reduce((values, key) => {
            const input = this.form.querySelector(this.fields[key]);
            if (!input) {
                throw new Error(`AuthFormView missing field: ${key}`);
            }
            values[key] = input.value;
            return values;
        }, {});
    }

    /**
     *
     * @param message
     */
    showError (message) {
        this.setFeedback(message, 'error');
    }

    /**
     *
     * @param message
     */
    showSuccess (message) {
        this.setFeedback(message, 'success');
    }

    /**
     *
     */
    clearFeedback () {
        this.feedback.textContent = '';
        this.feedback.dataset.state = '';
        this.feedback.classList.remove('is-visible');
    }

    /**
     *
     * @param message
     * @param state
     */
    setFeedback (message, state) {
        this.feedback.textContent = message;
        this.feedback.dataset.state = state;
        this.feedback.classList.toggle('is-visible', !!message);
    }
}
