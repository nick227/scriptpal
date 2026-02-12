import { createTaggedListAdapter } from '../list/TaggedListAdapterFactory.js';
import { ITEM_EMPTY_LABELS, ITEM_LIST_LABELS } from '../../shared/itemLabels.js';

/* -----------------------------------
   Meta (returns HTML string)
----------------------------------- */

const getMetaText = (item) => {
  const items = Array.isArray(item.items) ? item.items : [];
  if (!items.length) return 'No items';

  const tree = buildOutlineTree(items);
  return treeToHtml(tree);
};

/* -----------------------------------
   Adapter
----------------------------------- */

export const createOutlineListAdapter = (outlineStore) => {
  const base = createTaggedListAdapter({
    store: outlineStore,
    dataKey: 'outlineId',
    orderKey: 'outlineId',
    supportsAi: true,
    supportsMedia: false,
    classNames: {
      tile: 'list-tile list-tile--outline',
      tileMeta: 'list-tile__meta list-tile__meta--outline'
    },
    emptyItem: { title: '', items: [] },
    labels: {
      title: ITEM_LIST_LABELS.OUTLINES,
      modalTitle: ITEM_LIST_LABELS.OUTLINES,
      empty: ITEM_EMPTY_LABELS.OUTLINES,
      emptyMeta: 'No items'
    }
  });

  return {
    ...base,
    view: {
      ...base.view,
      metaAsHtml: true
    },
    getMetaText
  };
};

/* -----------------------------------
   Tree Builder
----------------------------------- */

function buildOutlineTree(items = []) {
  const root = [];
  const stack = [{ indent: -1, children: root }];

  for (const raw of items) {
    const text = typeof raw === 'string' ? raw : raw?.text ?? '';
    const indent = typeof raw?.indent === 'number' ? raw.indent : 0;

    const node = { text, children: [] };

    while (stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push({ indent, children: node.children });
  }

  return root;
}

/* -----------------------------------
   HTML Renderer
----------------------------------- */

function treeToHtml(nodes) {
  if (!nodes.length) return '';

  return `<ul>
${nodes
  .map(
    (n) => `<li>
${escapeHtml(n.text)}
${treeToHtml(n.children)}
</li>`
  )
  .join('')}
</ul>`;
}

/* -----------------------------------
   Escaping
----------------------------------- */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
