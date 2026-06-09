import './styles/main.css';
import { ShopRepository } from './repositories/ShopRepository';
import { ShopService } from './services/ShopService';
import { ShopListView } from './views/ShopListView';
import { ValidationError, NotFoundError, StorageError } from './errors';

/**
 * 想定内（ユーザーへ日本語で提示してよい）エラーかを判定する。
 * これ以外は握り潰さず再 throw し、バグを早期に表面化させる。
 */
function isExpectedError(error: unknown): error is Error {
  return (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof StorageError
  );
}

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
        if (isExpectedError(error)) {
          // 予期されるエラーは日本語メッセージをユーザーへ表示する
          view.showValidationError(error.message);
          return;
        }
        throw error; // 想定外のエラーは握り潰さず再 throw
      }
    },
    onToggle: (id, enabled) => {
      try {
        service.toggleEnabled(id, enabled);
        view.clearError();
        view.render(service.list());
      } catch (error) {
        if (isExpectedError(error)) {
          view.showValidationError(error.message);
          view.render(service.list()); // チェック状態を実データへ戻す
          return;
        }
        throw error;
      }
    },
    onEdit: (id, input) => {
      try {
        service.update(id, input);
        view.finishEditing();
        view.clearError();
        view.render(service.list());
      } catch (error) {
        // ValidationError だけは編集行内に表示するため、共通の isExpectedError を
        // 使わず個別に分岐する（NotFoundError / StorageError は共通エラー欄へ）
        if (error instanceof ValidationError) {
          // 入力起因は編集行に留めて理由を表示する
          view.showEditError(error.message);
          return;
        }
        if (error instanceof NotFoundError || error instanceof StorageError) {
          // 対象消失・保存失敗は編集を解除し、共通エラー欄へ表示する
          view.finishEditing();
          view.showValidationError(error.message);
          view.render(service.list());
          return;
        }
        throw error;
      }
    },
    onDelete: (id) => {
      try {
        service.remove(id);
        view.clearError();
        view.render(service.list());
      } catch (error) {
        if (isExpectedError(error)) {
          view.showValidationError(error.message);
          view.render(service.list());
          return;
        }
        throw error;
      }
    },
  });

  // 起動時に保存済みのお店を復元して描画（破損時は空で継続）
  view.render(service.list());
}

bootstrap();
