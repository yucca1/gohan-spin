import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ShopListView,
  type ShopListHandlers,
} from '../../../src/views/ShopListView';
import type { Shop } from '../../../src/types/Shop';

/**
 * テスト用の Shop ファクトリ。必要な項目だけ overrides で上書きする。
 * id は連番で一意にし、操作対象の特定をテスト内で容易にする。
 */
let idCounter = 0;
function makeShop(overrides: Partial<Shop> = {}): Shop {
  idCounter += 1;
  const now = new Date().toISOString();
  return {
    id: `id-${idCounter}`,
    name: 'テスト店',
    iconKey: 'ramen',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ShopListView', () => {
  let root: HTMLElement;
  let view: ShopListView;
  let handlers: ShopListHandlers;

  beforeEach(() => {
    root = document.createElement('div');
    view = new ShopListView(root);
    handlers = {
      onCreate: vi.fn(),
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    };
    view.bindEvents(handlers);
  });

  describe('構築', () => {
    it('コンストラクタで追加フォームと一覧が root 配下に描画される', () => {
      // Then
      expect(root.querySelector('form.add-shop-form')).not.toBeNull();
      expect(root.querySelector('ul.shop-list')).not.toBeNull();
    });
  });

  describe('登録（submit）', () => {
    it('フォーム送信で onCreate が入力値とともに呼ばれる', () => {
      // Given
      const nameInput = root.querySelector('#shop-name') as HTMLInputElement;
      const iconSelect = root.querySelector('#shop-icon') as HTMLSelectElement;
      nameInput.value = 'ラーメンA';
      iconSelect.value = 'ramen';
      // When
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      // Then
      expect(handlers.onCreate).toHaveBeenCalledWith({
        name: 'ラーメンA',
        iconKey: 'ramen',
      });
    });

    it('不正な iconKey は other にフォールバックして onCreate に渡る', () => {
      // Given
      const nameInput = root.querySelector('#shop-name') as HTMLInputElement;
      const iconSelect = root.querySelector('#shop-icon') as HTMLSelectElement;
      nameInput.value = 'カレーD';
      // option に存在しない値の代入は select 上で '' に正規化され、
      // 型ガード（isIconKey）が false になり 'other' に倒れる
      iconSelect.value = 'not-a-real-key';
      // When
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      // Then
      expect(handlers.onCreate).toHaveBeenCalledWith({
        name: 'カレーD',
        iconKey: 'other',
      });
    });
  });

  describe('対象切替（change）', () => {
    it('トグル変更で onToggle が id と checked 状態で呼ばれる', () => {
      // Given
      view.render([makeShop({ id: 's1', enabled: true })]);
      const checkbox = root.querySelector(
        '.toggle-checkbox',
      ) as HTMLInputElement;
      // When（OFF に切り替え）
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      // Then
      expect(handlers.onToggle).toHaveBeenCalledWith('s1', false);
    });
  });

  describe('編集開始（click）', () => {
    it('edit-btn クリックで該当行が編集行に切り替わる', () => {
      // Given
      view.render([makeShop({ id: 's1', name: '旧名' })]);
      // When
      (root.querySelector('.edit-btn') as HTMLButtonElement).click();
      // Then
      const row = root.querySelector('.shop-row') as HTMLElement;
      expect(row.classList.contains('is-editing')).toBe(true);
      expect(row.querySelector('.edit-name')).not.toBeNull();
    });
  });

  describe('保存（click）', () => {
    it('編集行で値を変更して保存すると onEdit が新しい値で呼ばれる', () => {
      // Given
      view.render([makeShop({ id: 's1', name: '旧名', iconKey: 'ramen' })]);
      (root.querySelector('.edit-btn') as HTMLButtonElement).click();
      const nameInput = root.querySelector('.edit-name') as HTMLInputElement;
      const iconSelect = root.querySelector('.edit-icon') as HTMLSelectElement;
      nameInput.value = '新名';
      iconSelect.value = 'curry';
      // When
      (root.querySelector('.save-btn') as HTMLButtonElement).click();
      // Then
      expect(handlers.onEdit).toHaveBeenCalledWith('s1', {
        name: '新名',
        iconKey: 'curry',
      });
    });
  });

  describe('キャンセル（click）', () => {
    it('cancel-btn で編集モードが解除され通常行に戻る', () => {
      // Given
      view.render([makeShop({ id: 's1' })]);
      (root.querySelector('.edit-btn') as HTMLButtonElement).click();
      // When
      (root.querySelector('.cancel-btn') as HTMLButtonElement).click();
      // Then
      const row = root.querySelector('.shop-row') as HTMLElement;
      expect(row.classList.contains('is-editing')).toBe(false);
      expect(row.querySelector('.edit-name')).toBeNull();
    });
  });

  describe('削除（click + confirm 分岐）', () => {
    it('確認ダイアログで OK すると onDelete が呼ばれる', () => {
      // Given
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      view.render([makeShop({ id: 's1', name: '消す店' })]);
      // When
      (root.querySelector('.delete-btn') as HTMLButtonElement).click();
      // Then
      expect(handlers.onDelete).toHaveBeenCalledWith('s1');
      confirmSpy.mockRestore();
    });

    it('確認ダイアログでキャンセルすると onDelete は呼ばれない', () => {
      // Given
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      view.render([makeShop({ id: 's1' })]);
      // When
      (root.querySelector('.delete-btn') as HTMLButtonElement).click();
      // Then
      expect(handlers.onDelete).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('render の出し分け', () => {
    it('enabled が false の行に is-disabled クラスが付く', () => {
      // Given / When
      view.render([makeShop({ id: 's1', enabled: false })]);
      // Then
      const row = root.querySelector('.shop-row') as HTMLElement;
      expect(row.classList.contains('is-disabled')).toBe(true);
    });

    it('渡したお店の数だけ行が描画される', () => {
      // Given / When
      view.render([makeShop(), makeShop(), makeShop()]);
      // Then
      expect(root.querySelectorAll('.shop-row')).toHaveLength(3);
    });

    it('店名は textContent で反映され HTML としてパースされない（XSS 無害化）', () => {
      // Given / When
      view.render([makeShop({ name: '<img src=x onerror=alert(1)>' })]);
      // Then
      const nameEl = root.querySelector('.shop-name') as HTMLElement;
      expect(nameEl.querySelector('img')).toBeNull();
      expect(nameEl.textContent).toBe('<img src=x onerror=alert(1)>');
    });
  });

  describe('エラー表示系', () => {
    it('showValidationError でメッセージ表示と has-error 付与が行われる', () => {
      // When
      view.showValidationError('店名を入力してください');
      // Then
      const form = root.querySelector('form') as HTMLFormElement;
      const errorEl = root.querySelector('.form-error') as HTMLElement;
      expect(errorEl.textContent).toBe('店名を入力してください');
      expect(form.classList.contains('has-error')).toBe(true);
    });

    it('clearError でエラー表示が解除される', () => {
      // Given
      view.showValidationError('エラー');
      // When
      view.clearError();
      // Then
      const form = root.querySelector('form') as HTMLFormElement;
      const errorEl = root.querySelector('.form-error') as HTMLElement;
      expect(errorEl.textContent).toBe('');
      expect(form.classList.contains('has-error')).toBe(false);
    });

    it('resetForm で入力がクリアされる', () => {
      // Given
      const nameInput = root.querySelector('#shop-name') as HTMLInputElement;
      nameInput.value = '入力中のお店';
      // When
      view.resetForm();
      // Then
      expect(nameInput.value).toBe('');
    });

    it('showEditError で編集中の行に edit-error メッセージが表示される', () => {
      // Given（編集モードに入る）
      view.render([makeShop({ id: 's1' })]);
      (root.querySelector('.edit-btn') as HTMLButtonElement).click();
      // When
      view.showEditError('店名を入力してください');
      // Then
      const errorEl = root.querySelector('.edit-error') as HTMLElement;
      expect(errorEl.textContent).toBe('店名を入力してください');
    });
  });

  describe('編集モード終了（finishEditing）', () => {
    it('finishEditing 後の再描画で編集行が通常行に戻る', () => {
      // Given（編集モードに入る）
      view.render([makeShop({ id: 's1' })]);
      (root.querySelector('.edit-btn') as HTMLButtonElement).click();
      expect(root.querySelector('.is-editing')).not.toBeNull();
      // When（編集モード解除 → 再描画）
      view.finishEditing();
      view.render([makeShop({ id: 's1' })]);
      // Then
      expect(root.querySelector('.is-editing')).toBeNull();
      expect(root.querySelector('.edit-name')).toBeNull();
    });
  });
});
