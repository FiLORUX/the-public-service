import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import importPlugin from 'eslint-plugin-import'

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      '**/*.min.js',
      // Google Apps Script files - separate tooling
      '*.gs',
    ],
  },

  // Base config for all TypeScript files
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.es2023,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Console usage - allow error/warn, flag log/info
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // TypeScript strict rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import organisation
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-duplicates': 'error',

      // General code quality
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // React-specific config for studio-app
  {
    files: ['studio-app/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Cloudflare Worker config
  {
    files: ['worker/**/*.ts'],
    languageOptions: {
      globals: {
        // Cloudflare Worker globals
        caches: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        Headers: 'readonly',
        console: 'readonly',
        addEventListener: 'readonly',
      },
    },
    rules: {
      // Workers often use console for debugging
      'no-console': 'off',
    },
  },

  // Config files (JS)
  {
    files: ['*.config.js', '*.config.ts', 'vite.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
)
