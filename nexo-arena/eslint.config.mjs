import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals, ...nextTs,
  { settings: { next: { rootDir: 'apps/web/' } }, rules: { 'react-hooks/set-state-in-effect': 'off' } },
  { files: ['apps/mobile/**/*.{cjs,ts,tsx}'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  globalIgnores(['**/.next/**', '**/out/**', '**/next-env.d.ts', '**/.expo/**', '**/dist-native/**', '**/dist-web/**', '**/expo-env.d.ts', 'test-results/**', 'mobile-test-results/**', 'playwright-report/**']),
]);
