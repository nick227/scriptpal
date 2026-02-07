/** UL/li editor: Enter=new item, Tab=indent, Shift+Tab=outdent */
const INDENT_PX = 24;
const MAX_INDENT = 4;

export function mountOutlineCreator (container, options = {}) {
    const { hiddenInput, initialValue = [], onReady } = options;
    let items = Array.isArray(initialValue) ? initialValue.map(normalize) : [];

    function normalize (entry) {
        if (typeof entry === 'string') return { text: entry, indent: 0 };
        return { text: String(entry?.text ?? ''), indent: Math.min(MAX_INDENT, Math.max(0, Number(entry?.indent) || 0)) };
    }

    function syncHiddenInput () {
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(items);
        }
    }

    function render () {
        if (items.length === 0) items = [{ text: '', indent: 0 }];
        container.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'outline-creator-list';
        ul.setAttribute('role', 'list');
        items.forEach((entry, idx) => {
            const li = document.createElement('li');
            li.className = 'outline-creator-item';
            li.dataset.indent = String(entry.indent ?? 0);
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'outline-creator-input';
            input.value = entry.text;
            input.style.marginLeft = `${(entry.indent || 0) * INDENT_PX}px`;
            input.dataset.idx = String(idx);
            input.placeholder = idx === 0 && items.length === 1 ? 'Type and press Enter to add items…' : '';
            input.addEventListener('input', () => {
                items[idx] = { ...items[idx], text: input.value };
                syncHiddenInput();
            });
            input.addEventListener('keydown', (e) => handleKeydown(e, idx, input));
            input.addEventListener('blur', () => {
                if (items.length > 1 && !input.value.trim()) {
                    items.splice(idx, 1);
                    syncHiddenInput();
                    render();
                }
            });
            li.appendChild(input);
            ul.appendChild(li);
        });
        container.appendChild(ul);
    }

    function handleKeydown (e, idx, input) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const entry = items[idx] ?? { text: '', indent: 0 };
            items.splice(idx + 1, 0, { text: '', indent: entry.indent ?? 0 });
            syncHiddenInput();
            render();
            focusItem(idx + 1);
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const entry = items[idx];
            if (!entry) return;
            entry.indent = e.shiftKey
                ? Math.max(0, (entry.indent ?? 0) - 1)
                : Math.min(MAX_INDENT, (entry.indent ?? 0) + 1);
            syncHiddenInput();
            render();
            focusItem(idx);
            return;
        }
        if (e.key === 'Backspace' && !input.value && items.length > 1) {
            e.preventDefault();
            items.splice(idx, 1);
            syncHiddenInput();
            render();
            focusItem(Math.max(0, idx - 1));
        }
    }

    function focusItem (idx) {
        requestAnimationFrame(() => {
            const inp = container.querySelector(`.outline-creator-input[data-idx="${idx}"]`);
            if (inp) inp.focus();
        });
    }

    const api = {
        getValue () {
            return items.filter((e) => e.text.trim()).map((e) => ({ text: e.text.trim(), indent: e.indent || 0 }));
        },
        setValue (arr) {
            items = Array.isArray(arr) ? arr.map(normalize) : [{ text: '', indent: 0 }];
            syncHiddenInput();
            render();
        }
    };

    if (hiddenInput?.value?.trim()) {
        try {
            const parsed = JSON.parse(hiddenInput.value);
            if (Array.isArray(parsed) && parsed.length) items = parsed.map(normalize);
        } catch (_) { /* keep default */ }
    }
    render();
    syncHiddenInput();
    if (onReady) onReady(api);
    return api;
}
