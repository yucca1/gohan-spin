import { defineConfig } from 'vite';

// GitHub Pagesのプロジェクトページ（https://<user>.github.io/gohan-spin/）配信のため
// アセットパスの基準を '/gohan-spin/' にする
export default defineConfig({
  base: '/gohan-spin/',
});
