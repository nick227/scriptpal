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
    aiRow: 'list-editor-modal__ai-row',
    actions: 'list-editor-modal__actions',
    save: 'list-editor-modal__save'
};

const DEFAULT_LABELS = {
    title: 'item',
    close: 'cancel',
    save: 'save',
    aiGenerate: '✨'
};

export const createTaggedEditorAdapter = (options = {}) => {
    const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
    const classNames = { ...DEFAULT_CLASS_NAMES, ...(options.classNames || {}) };
    const enableAiTitle = Boolean(options.enableAiTitle);

    return {
        buildPayload: (data) => ({
            title: String(data.get('title')).trim(),
            description: String(data.get('description')),
            notes: String(data.get('notes')),
            tags: String(data.get('tags'))
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean)
        }),
        getFieldValues: (item) => ({
            title: item.title,
            description: item.description,
            notes: item.notes,
            tags: item.tags.join(', ')
        }),
        applySuggestion: (view, suggestion) => {
            if (typeof suggestion.title === 'string') {
                view.setFieldValue('title', suggestion.title);
            }
            if (typeof suggestion.description === 'string') {
                view.setFieldValue('description', suggestion.description);
            }
        },
        view: {
            labels,
            classNames,
            fields: [
                { name: 'title', label: 'Title', required: true, aiGenerate: enableAiTitle },
                { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
                { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
                { name: 'tags', label: 'Tags', placeholder: 'tag1, tag2' }
            ]
        }
    };
};
