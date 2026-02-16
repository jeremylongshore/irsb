module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    // Import rules - disable resolver-dependent rules (ESM compatibility issues)
    'import/order': 'off', // Resolver issues with ESM - use TypeScript for this
    'import/no-unresolved': 'off', // TypeScript handles this
    'import/namespace': 'off', // Resolver issues with ESM
    'import/default': 'off', // Resolver issues with ESM
    'import/export': 'off', // Resolver issues with ESM
    'import/no-named-as-default': 'off', // Resolver issues with ESM
    'import/no-named-as-default-member': 'off', // Resolver issues with ESM
    'import/no-duplicates': 'off', // Resolver issues with ESM

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    '*.js',
    '*.cjs',
    '*.mjs',
  ],
};
