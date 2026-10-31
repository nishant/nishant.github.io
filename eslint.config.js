import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import nish from '@nish/ui/eslint';
import tseslint from 'typescript-eslint';

// The nish arrays carry their own `files` globs; scope them to one tree.
const scope = (configs, files, languageOptions) =>
  configs.map((c) => ({ ...c, files, languageOptions }));

export default tseslint.config(
  { ignores: ['docs/**', 'dist/**', 'server/dist/**', 'node_modules/**', 'server/node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...scope(nish.configs.react, ['src/**/*.{ts,tsx}'], { globals: globals.browser }),
  { ...reactHooks.configs.flat.recommended, files: ['src/**/*.{ts,tsx}'] },
  ...scope(nish.configs.node, ['server/src/**/*.ts'], { globals: globals.node }),
  // Express error handlers are recognised by their four parameters, so `_next` must stay.
  { files: ['server/src/**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  prettier,
);
