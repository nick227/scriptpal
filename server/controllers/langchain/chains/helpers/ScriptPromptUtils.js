export const buildScriptHeader = (scriptTitle, scriptDescription) => {
  const title = scriptTitle || 'Untitled Script';
  const description = scriptDescription || '';
  return `Script Title: ${title}\nScript Description: ${description}`;
};
