export const filterContextOverrides = (overrides = {}, protectedKeys = []) => {
  const protectedSet = new Set(protectedKeys);
  return Object.fromEntries(
    Object.entries(overrides || {}).filter(([key]) => !protectedSet.has(key))
  );
};
