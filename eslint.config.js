import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles this
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
