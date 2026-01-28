export const ORDERED_ITEM_SORT = Object.freeze([
  { sortIndex: 'asc' },
  { createdAt: 'asc' }
]);

export const listScriptItems = (model, scriptId) => (
  model.findMany({
    where: { scriptId },
    orderBy: ORDERED_ITEM_SORT
  })
);
