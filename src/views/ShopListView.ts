import type { Shop, CreateShopInput, UpdateShopInput } from '../types/Shop';
import { ICON_DEFS, getIconDef, isIconKey } from '../icons/iconDefs';

/**
 * ShopListView が外部（main.ts）へ通知する操作ハンドラ。
 * 登録・対象切替・編集・削除の4操作を上位（ShopService）へ委ねる。
 */
export interface ShopListHandlers {
  onCreate: (input: CreateShopInput) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string, input: UpdateShopInput) => void;
  onDelete: (id: string) => void;
}

/**
 * お店の追加フォームと一覧（操作付き）を描画する UI レイヤー。
 *
 * 責務は DOM 描画と操作の受付のみ。バリデーションや永続化のロジックは持たず、
 * handlers 経由で上位（ShopService）に委ねる。
 * ユーザー入力（店名）は textContent / input.value で扱い、XSS を防ぐ。
 *
 * 一覧の各行の操作はイベントデリゲーションで処理する（行が動的に増減するため、
 * listEl に click / change を1つずつ登録し、closest('.shop-row') の data-id で対象を特定）。
 */
export class ShopListView {
  private readonly form: HTMLFormElement;
  private readonly nameInput: HTMLInputElement;
  private readonly iconSelect: HTMLSelectElement;
  private readonly errorEl: HTMLParagraphElement;
  private readonly listEl: HTMLUListElement;

  /** bindEvents で受け取った操作ハンドラ。デリゲーションリスナから参照する。 */
  private handlers: ShopListHandlers | null = null;
  /** 編集モード中のお店 id（null なら全行が通常表示）。 */
  private editingId: string | null = null;
  /** 直近の描画対象。編集モード切替時に自前で再描画するため保持する。 */
  private shops: Shop[] = [];

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = '';

    const section = document.createElement('section');
    section.className = 'shop-manager';

    this.form = this.buildForm();
    this.nameInput = this.form.querySelector('#shop-name') as HTMLInputElement;
    this.iconSelect = this.form.querySelector(
      '#shop-icon',
    ) as HTMLSelectElement;
    this.errorEl = this.form.querySelector(
      '.form-error',
    ) as HTMLParagraphElement;

    this.listEl = document.createElement('ul');
    this.listEl.className = 'shop-list';

    section.appendChild(this.form);
    section.appendChild(this.listEl);
    this.root.appendChild(section);
  }

  /**
   * 操作ハンドラを結びつける。
   *
   * フォームの submit（登録）と、一覧のデリゲーション（切替・編集・削除）を登録する。
   *
   * @param handlers 各操作を受け取るコールバック群
   */
  bindEvents(handlers: ShopListHandlers): void {
    this.handlers = handlers;

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      // option は ICON_DEFS から生成されるが、型安全のため型ガードで絞り込む
      const rawIconKey = this.iconSelect.value;
      handlers.onCreate({
        name: this.nameInput.value,
        iconKey: isIconKey(rawIconKey) ? rawIconKey : 'other',
      });
    });

    // 対象チェックボックスの ON/OFF（change をデリゲーションで受ける）
    this.listEl.addEventListener('change', (event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) ||
        !target.classList.contains('toggle-checkbox')
      ) {
        return;
      }
      const id = this.rowId(target);
      if (id) handlers.onToggle(id, target.checked);
    });

    // 編集・削除・保存・キャンセル（click をデリゲーションで受ける）
    this.listEl.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('button');
      if (!button) return;
      const id = this.rowId(button);
      if (!id) return;

      if (button.classList.contains('edit-btn')) {
        this.editingId = id;
        this.render(this.shops);
      } else if (button.classList.contains('delete-btn')) {
        const shop = this.shops.find((s) => s.id === id);
        const message = shop
          ? `「${shop.name}」を削除しますか？`
          : 'このお店を削除しますか？';
        if (window.confirm(message)) handlers.onDelete(id);
      } else if (button.classList.contains('save-btn')) {
        this.submitEdit(id, button);
      } else if (button.classList.contains('cancel-btn')) {
        this.editingId = null;
        this.render(this.shops);
      }
    });
  }

  /**
   * お店一覧を再描画する。DocumentFragment でまとめて挿入しリフローを抑える。
   * 編集モード中（editingId 一致）の行は編集フォームとして描画する。
   *
   * @param shops 描画対象のお店一覧（カテゴリ順でソート済みを想定）
   */
  render(shops: Shop[]): void {
    this.shops = shops;
    const fragment = document.createDocumentFragment();
    for (const shop of shops) {
      fragment.appendChild(
        shop.id === this.editingId
          ? this.buildEditRow(shop)
          : this.buildRow(shop),
      );
    }
    this.listEl.replaceChildren(fragment);
  }

  /**
   * 登録フォームのバリデーションエラーを表示する。
   * 対象切替・削除など一覧操作のエラーもここに表示する。
   *
   * @param message ユーザーへ表示する日本語のエラーメッセージ
   */
  showValidationError(message: string): void {
    this.errorEl.textContent = message;
    this.form.classList.add('has-error');
  }

  /**
   * 共通エラー欄の表示を解除する（一覧操作が成功したときに main から呼ぶ）。
   * 「エラー表示 → 別操作が成功してもメッセージが残る」状態を防ぐ。
   */
  clearError(): void {
    this.errorEl.textContent = '';
    this.form.classList.remove('has-error');
  }

  /**
   * 編集行内にバリデーションエラーを表示する（編集モードに留める）。
   *
   * @param message ユーザーへ表示する日本語のエラーメッセージ
   */
  showEditError(message: string): void {
    if (!this.editingId) return;
    // editingId は crypto.randomUUID() 由来の UUID 形式のため、セレクタへの補間は安全
    const row = this.listEl.querySelector(
      `.shop-row[data-id="${this.editingId}"]`,
    );
    const errorEl = row?.querySelector('.edit-error');
    if (errorEl) errorEl.textContent = message;
  }

  /**
   * 編集モードを解除する（保存成功時に main から呼ぶ）。
   * 解除後に render を呼ぶと通常行で再描画される。
   */
  finishEditing(): void {
    this.editingId = null;
  }

  /**
   * 登録成功時にフォームをリセットし、エラー表示を解除する。
   */
  resetForm(): void {
    this.nameInput.value = '';
    this.iconSelect.value = 'other';
    this.errorEl.textContent = '';
    this.form.classList.remove('has-error');
    this.nameInput.focus();
  }

  /** 編集行の入力値を読み取り、onEdit へ渡す。 */
  private submitEdit(id: string, button: HTMLElement): void {
    const row = button.closest('.shop-row');
    if (!row) return;
    const nameInput = row.querySelector('.edit-name') as HTMLInputElement;
    const iconSelect = row.querySelector('.edit-icon') as HTMLSelectElement;
    const rawIconKey = iconSelect.value;
    this.handlers?.onEdit(id, {
      name: nameInput.value,
      iconKey: isIconKey(rawIconKey) ? rawIconKey : 'other',
    });
  }

  /** 要素が属する行の data-id を返す（無ければ null）。 */
  private rowId(el: HTMLElement): string | null {
    const row = el.closest('.shop-row');
    return row instanceof HTMLElement ? (row.dataset.id ?? null) : null;
  }

  /** 追加フォームの DOM を組み立てる。 */
  private buildForm(): HTMLFormElement {
    const form = document.createElement('form');
    form.className = 'add-shop-form';
    form.noValidate = true;

    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'shop-name';
    nameLabel.textContent = '店名';

    const nameInput = document.createElement('input');
    nameInput.id = 'shop-name';
    nameInput.type = 'text';
    nameInput.maxLength = 50;
    nameInput.placeholder = '例: 〇〇ラーメン';

    const iconLabel = document.createElement('label');
    iconLabel.htmlFor = 'shop-icon';
    iconLabel.textContent = 'カテゴリ';

    const iconSelect = document.createElement('select');
    iconSelect.id = 'shop-icon';
    for (const def of ICON_DEFS) {
      const option = document.createElement('option');
      option.value = def.key;
      option.textContent = `${def.emoji} ${def.label}`;
      iconSelect.appendChild(option);
    }
    iconSelect.value = 'other'; // 初期値を設定し未選択状態を作らない

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = '＋ 登録';

    const error = document.createElement('p');
    error.className = 'form-error';
    error.setAttribute('role', 'alert');

    form.append(nameLabel, nameInput, iconLabel, iconSelect, submit, error);
    return form;
  }

  /** 一覧の通常行を組み立てる。店名は textContent で安全に反映。 */
  private buildRow(shop: Shop): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'shop-row';
    li.dataset.id = shop.id;
    if (!shop.enabled) li.classList.add('is-disabled');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle-checkbox';
    checkbox.checked = shop.enabled;
    checkbox.setAttribute('aria-label', `${shop.name} をルーレット対象にする`);

    const icon = document.createElement('span');
    icon.className = 'shop-icon';
    icon.textContent = getIconDef(shop.iconKey).emoji;

    const name = document.createElement('span');
    name.className = 'shop-name';
    name.textContent = shop.name; // ユーザー入力。textContent で XSS を無害化

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-btn icon-btn';
    editBtn.textContent = '✎';
    editBtn.setAttribute('aria-label', `${shop.name} を編集`);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn icon-btn';
    deleteBtn.textContent = '🗑';
    deleteBtn.setAttribute('aria-label', `${shop.name} を削除`);

    li.append(checkbox, icon, name, editBtn, deleteBtn);
    return li;
  }

  /** 一覧の編集行（店名・アイコンの編集フォーム）を組み立てる。 */
  private buildEditRow(shop: Shop): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'shop-row is-editing';
    li.dataset.id = shop.id;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'edit-name';
    nameInput.maxLength = 50;
    nameInput.value = shop.name; // 現在値。value はパースされず XSS にならない
    nameInput.setAttribute('aria-label', '店名');

    const iconSelect = document.createElement('select');
    iconSelect.className = 'edit-icon';
    iconSelect.setAttribute('aria-label', 'カテゴリ');
    for (const def of ICON_DEFS) {
      const option = document.createElement('option');
      option.value = def.key;
      option.textContent = `${def.emoji} ${def.label}`;
      iconSelect.appendChild(option);
    }
    iconSelect.value = shop.iconKey;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'save-btn';
    saveBtn.textContent = '保存';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = 'キャンセル';

    const error = document.createElement('p');
    error.className = 'edit-error';
    error.setAttribute('role', 'alert');

    li.append(nameInput, iconSelect, saveBtn, cancelBtn, error);
    return li;
  }
}
