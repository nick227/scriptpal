/** @type {import('prettier').Config} */
export default {
  // Basic formatting
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'none',
  tabWidth: 2,
  useTabs: false,

  // Line formatting
  printWidth: 100,
  endOfLine: 'lf',

  // Bracket formatting
  bracketSpacing: true,
  bracketSameLine: false,

  // Arrow function formatting
  arrowParens: 'avoid',

  // JSX formatting (if needed)
  jsxSingleQuote: true,

  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        singleQuote: false
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always'
      }
    }
  ]
};
