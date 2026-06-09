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
        // View層は描画と操作受付が中心でロジックが薄いため、振る舞いを薄くテストする方針。
        // glob別閾値は「該当ファイルに追加の個別下限を課す」もの。Vitestの仕様として、
        // 対象ファイルはグローバル閾値の計算にも引き続き含まれる（Jestとは異なる）。
        // view を含めても全体が80%を維持できることは実測で確認済み。
        'src/views/**': {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
  },
});
