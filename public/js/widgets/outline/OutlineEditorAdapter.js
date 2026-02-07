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
    title: 'Outline',
    close: 'cancel',
    save: 'save',
    aiGenerate: '✨'
};

function parseItems (raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(normalizeItem);
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
        } catch {
            return raw.split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t, indent: 0 }));
        }
    }
    return [];
}

function normalizeItem (entry) {
    if (typeof entry === 'string') return { text: entry, indent: 0 };
    return { text: String(entry?.text ?? ''), indent: Math.min(4, Math.max(0, Number(entry?.indent) || 0)) };
}

export const createOutlineEditorAdapter = () => ({
    buildPayload: (data) => {
        const title = String(data.get('title') ?? '').trim();
        const itemsRaw = data.get('items');
        const items = parseItems(itemsRaw);
        return { title, items };
    },
    getFieldValues: (item) => ({
        title: item.title ?? '',
        items: (item.items ?? []).map((i) => ({
            text: typeof i === 'string' ? i : (i?.text ?? ''),
            indent: typeof i?.indent === 'number' ? i.indent : 0
        }))
    }),
    applySuggestion: (view, suggestion) => {
        if (typeof suggestion.title === 'string') {
            view.setFieldValue('title', suggestion.title);
        }
        if (Array.isArray(suggestion.items)) {
            const items = suggestion.items.map((i) => ({
                text: typeof i === 'string' ? i : (i?.text ?? ''),
                indent: typeof i?.indent === 'number' ? i.indent : 0
            }));
            view.setFieldValue('items', items);
        }
    },
    view: {
        labels: DEFAULT_LABELS,
        classNames: DEFAULT_CLASS_NAMES,
        fields: [
            { name: 'title', label: 'Title', required: true },
            { name: 'items', label: 'Items', type: 'outline', aiGenerate: true }
        ]
    }
});
