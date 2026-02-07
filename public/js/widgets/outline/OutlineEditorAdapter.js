const DEFAULT_CLASS_NAMES = {
    modal: 'list-editor-modal',
    hidden: 'hidden',
    backdrop: 'list-editor-modal__backdrop',
    content: 'list-editor-modal__content',
    header: 'list-editor-modal__header',
    title: 'list-editor-modal__title',
    close: 'list-editor-modal__close',
    form: 'list-editor-modal__form',
    row: 'row',
    actions: 'list-editor-modal__actions',
    save: 'list-editor-modal__save'
};

const DEFAULT_LABELS = {
    title: 'Outline',
    close: 'cancel',
    save: 'save',
    aiGenerate: 'generate'
};

export const createOutlineEditorAdapter = () => ({
    buildPayload: (data) => {
        const title = String(data.get('title') ?? '').trim();
        const itemsRaw = String(data.get('items') ?? '');
        const items = itemsRaw
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((t) => ({ text: t }));
        return { title, items };
    },
    getFieldValues: (item) => ({
        title: item.title ?? '',
        items: (item.items ?? []).map((i) => (typeof i === 'string' ? i : i?.text ?? '')).join('\n')
    }),
    applySuggestion: (view, suggestion) => {
        if (typeof suggestion.title === 'string') {
            view.setFieldValue('title', suggestion.title);
        }
        if (Array.isArray(suggestion.items)) {
            const text = suggestion.items.map((i) => (typeof i === 'string' ? i : i?.text ?? '')).join('\n');
            view.setFieldValue('items', text);
        }
    },
    view: {
        labels: DEFAULT_LABELS,
        classNames: DEFAULT_CLASS_NAMES,
        fields: [
            { name: 'title', label: 'Title', required: true, aiGenerate: true },
            { name: 'items', label: 'Items', type: 'textarea', rows: 8, placeholder: 'One item per line' }
        ]
    }
});
