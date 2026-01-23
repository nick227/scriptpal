import node from 'eslint-plugin-node';
import security from 'eslint-plugin-security';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly'
      }
    },
    plugins: {
      node,
      security
    },
    rules: {
      // MVP dev: bare minimum for Railway builds
      'no-debugger': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-func-assign': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',

      // Disable high-noise rules
      'no-console': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-var': 'off',
      'require-await': 'off',
      'no-await-in-loop': 'off',

      // Node.js specific rules
      'node/no-unsupported-features/es-syntax': 'off',
      'node/no-missing-import': 'off',
      'node/no-unpublished-import': 'off',

      // Security rules (too noisy for MVP)
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'off',
      'security/detect-buffer-noassert': 'off',
      'security/detect-child-process': 'off',
      'security/detect-disable-mustache-escape': 'off',
      'security/detect-eval-with-expression': 'off',
      'security/detect-no-csrf-before-method-override': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-require': 'off',
      'security/detect-possible-timing-attacks': 'off',
      'security/detect-pseudoRandomBytes': 'off',

      // Code style
      'indent': 'off',
      'quotes': 'off',
      'semi': 'off',
      'comma-dangle': 'off',
      'object-curly-spacing': 'off',
      'array-bracket-spacing': 'off',
      'space-before-function-paren': 'off',
      'keyword-spacing': 'off',
      'space-infix-ops': 'off',
      'eol-last': 'off',
      'no-trailing-spaces': 'off',
      'no-multiple-empty-lines': 'off',

      // Best practices
      'eqeqeq': 'off',
      'no-eval': 'off',
      'no-implied-eval': 'off',
      'no-new-func': 'off',
      'no-return-assign': 'off',
      'no-self-compare': 'off',
      'no-throw-literal': 'off',
      'no-useless-call': 'off',
      'no-useless-concat': 'off',
      'no-useless-return': 'off',
      'prefer-arrow-callback': 'off',
      'prefer-template': 'off',
      'template-curly-spacing': 'off',

      // Async/await
      'no-async-promise-executor': 'off',
      'no-promise-executor-return': 'off',
      'prefer-promise-reject-errors': 'off'
    }
  },
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-console': 'off',
      'security/detect-object-injection': 'off'
    }
  },
  {
    ignores: [
      'node_modules/',
      'coverage/',
      '*.min.js'
    ]
  }
];
