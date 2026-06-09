import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.steering/**',
        '**/*.config.{ts,js}',
        '**/types/**',
        // UI層はロジックが薄く、テストは手動E2Eで担保する方針（development-guidelines.md）
        '**/views/**',
        'src/main.ts',
        // アンビエント型宣言（実行コードなし）
        '**/*.d.ts',
        // テストコード自体・補助はカバレッジ計測対象外
        'tests/**',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
