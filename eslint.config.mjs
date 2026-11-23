import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({
  baseDirectory: fileURLToPath(import.meta.url),
});

export default [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'Greeter/**',
      'hello/**',
      'docs/**',
      '.devteam/**',
    ],
  },
];
