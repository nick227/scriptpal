// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        expect: 'readonly' // fixes test-related no-undef
      }
    },
    rules: {
      ...js.configs.recommended.rules,

      // 🚨 Disable high-noise rules
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '.*', // <-- allow unused locals
        ignoreRestSiblings: true
      }],
      'no-undef': 'off',
      'no-empty': 'off',
      'no-console': 'off',

      // 🚫 Disable rules that fight MVP velocity
      'no-prototype-builtins': 'off',
      'no-useless-catch': 'off',
      'no-useless-escape': 'off',

      // ⚠️ Keep only structural correctness
      'no-dupe-class-members': 'error',
      'no-case-declarations': 'error'
    }
  }
];
