/** @type {import('lint-staged').Config} */
export default {
  '*.js': [
    'eslint --fix',
    'prettier --write'
  ],
  '*.{json,md}': [
    'prettier --write'
  ]
};
