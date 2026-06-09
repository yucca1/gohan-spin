import './styles/main.css';
import { ShopRepository } from './repositories/ShopRepository';
import { ShopService } from './services/ShopService';
import { ShopListView } from './views/ShopListView';
import { ValidationError, StorageError } from './errors';

/**
 * アプリのエントリ。各レイヤーを生成し依存を注入して結線する。
 * （ShopRepository → ShopService → ShopListView）
 */
function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('#app 要素が見つかりません');
  }

  const service = new ShopService(new ShopRepository());
  const view = new ShopListView(root);

  view.bindEvents({
    onCreate: (input) => {
      try {
        service.create(input);
        view.render(service.list());
        view.resetForm();
      } catch (error) {
        if (error instanceof ValidationError || error instanceof StorageError) {
          // 予期されるエラーは日本語メッセージをユーザーへ表示する
          view.showValidationError(error.message);
          return;
        }
        throw error; // 想定外のエラーは握り潰さず再 throw
      }
    },
  });

  // 起動時に保存済みのお店を復元して描画（破損時は空で継続）
  view.render(service.list());
}

bootstrap();
