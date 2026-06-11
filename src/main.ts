import './styles/main.css';
import { ShopRepository } from './repositories/ShopRepository';
import { ShopService } from './services/ShopService';
import { ShopListView } from './views/ShopListView';
import { RouletteView } from './views/RouletteView';
import { RouletteEngine } from './engine/RouletteEngine';
import { SoundDirector } from './audio/SoundDirector';
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
 * #app 内に2カラムレイアウトのコンテナを生成する。
 * DOM 順はルーレットが先（モバイルの縦積みで主役として最上部に来る）。
 * デスクトップでは CSS の order でお店管理が左・ルーレットが右に並ぶ。
 */
function buildLayout(root: HTMLElement): {
  rouletteRoot: HTMLElement;
  shopsRoot: HTMLElement;
} {
  root.innerHTML = '';
  const layout = document.createElement('div');
  layout.className = 'app-layout';

  const rouletteRoot = document.createElement('div');
  rouletteRoot.className = 'layout-roulette';

  const shopsRoot = document.createElement('div');
  shopsRoot.className = 'layout-shops';

  layout.append(rouletteRoot, shopsRoot);
  root.appendChild(layout);
  return { rouletteRoot, shopsRoot };
}

/**
 * アプリのエントリ。各レイヤーを生成し依存を注入して結線する。
 * （ShopRepository → ShopService → ShopListView / RouletteEngine → RouletteView）
 */
function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('#app 要素が見つかりません');
  }

  const { rouletteRoot, shopsRoot } = buildLayout(root);

  const service = new ShopService(new ShopRepository());
  const view = new ShopListView(shopsRoot);
  const engine = new RouletteEngine();
  const rouletteView = new RouletteView(rouletteRoot, new SoundDirector());

  /**
   * アイドル中のみホイールを最新の対象店で再構築し、Start 可否を更新する。
   * 回転中（spinning / decelerating）は再構築しない（当選判定は Engine 内の
   * セグメントスナップショットで完結するため安全。停止後のリセットで反映される）。
   */
  const refreshWheel = (): void => {
    if (engine.state !== 'idle') return;
    const enabledShops = service.listEnabled();
    rouletteView.setControlsEnabled(enabledShops.length > 0);
    rouletteView.renderWheel(engine.build(enabledShops));
  };

  rouletteView.bindEvents({
    onStart: () => {
      const enabledShops = service.listEnabled();
      if (enabledShops.length === 0) return; // ボタンは disabled だが防御的にガード
      // Start のたびに build し直し、配置をシャッフルする（公平感・意外性）
      rouletteView.renderWheel(engine.build(enabledShops));
      engine.start((angle) => rouletteView.setAngle(angle));
      rouletteView.setPhase(engine.state);
    },
    onStop: () => {
      engine.stop(
        (angle) => rouletteView.setAngle(angle),
        (winner) => {
          rouletteView.setPhase(engine.state); // finished
          rouletteView.playWinnerEffect(winner);
        }
      );
      rouletteView.setPhase(engine.state); // decelerating
    },
    onReset: () => {
      engine.reset();
      rouletteView.hideWinner();
      rouletteView.setAngle(0); // Engine の角度リセットと表示を一致させる
      rouletteView.setPhase(engine.state); // idle
      refreshWheel(); // お店の増減・対象切替をここで反映する
    },
  });

  view.bindEvents({
    onCreate: (input) => {
      try {
        service.create(input);
        view.render(service.list());
        view.resetForm();
        refreshWheel();
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
        refreshWheel();
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
        refreshWheel();
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
        refreshWheel();
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
  refreshWheel();
}

bootstrap();
