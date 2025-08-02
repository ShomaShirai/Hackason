import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // 基本設定
  js.configs.recommended,
  prettierConfig,

  {
    ignores: [
      'test-simple.js',
      'test-video-call.js',
      'dist/',
      'node_modules/',
      '.next/',
      '.wrangler/',
      '*.log'
    ]
  },

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: ['./tsconfig.cloudflare.json', './tsconfig.node.json', './tsconfig.test.json'],
        tsconfigRootDir: './',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        D1Database: 'readonly',
        DurableObjectState: 'readonly',
        DurableObjectNamespace: 'readonly',
        WebSocketPair: 'readonly',
        Fetcher: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off', // TypeScript版を使用
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],

      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General
      // ハッカソン開発のためconsole使用を許可
      'no-console': 'off',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },

  // 無視するファイル
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'drizzle/**',
      'workers/generate-hash.js',
      'tmp/**',
      'workers/seed-data-generator.ts',
      'worker-configuration.d.ts',
      '.react-router/**',
      'coverage/**',
      '.cloudflare/**',
      'frontend/**',
      'src/prisma/**',
      'public/**',
      'local.db',
      'tmp-script/**',
      'tmp-orange/**',
    ],
  },
];
