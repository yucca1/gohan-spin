import type { Shop, CreateShopInput } from '../types/Shop';
import { ICON_DEFS, getIconDef, isIconKey } from '../icons/iconDefs';

/**
 * ShopListView が外部（main.ts）へ通知する操作ハンドラ。
 * 本フェーズは登録のみ。編集・削除・対象切替は後続機能で追加する。
 */
export interface ShopListHandlers {
  onCreate: (input: CreateShopInput) => void;
}

/**
 * お店の追加フォームと一覧（読み取り専用）を描画する UI レイヤー。
 *
 * 責務は DOM 描画と操作の受付のみ。バリデーションや永続化のロジックは持たず、
 * onCreate 経由で上位（ShopService）に委ねる。
 * ユーザー入力（店名）は textContent で反映し、XSS を防ぐ。
 */
export class ShopListView {
  private readonly form: HTMLFormElement;
  private readonly nameInput: HTMLInputElement;
  private readonly iconSelect: HTMLSelectElement;
  private readonly errorEl: HTMLParagraphElement;
  private readonly listEl: HTMLUListElement;

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
   * @param handlers 登録などの操作を受け取るコールバック群
   */
  bindEvents(handlers: ShopListHandlers): void {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      // option は ICON_DEFS から生成されるが、型安全のため型ガードで絞り込む
      const rawIconKey = this.iconSelect.value;
      handlers.onCreate({
        name: this.nameInput.value,
        iconKey: isIconKey(rawIconKey) ? rawIconKey : 'other',
      });
    });
  }

  /**
   * お店一覧を再描画する。DocumentFragment でまとめて挿入しリフローを抑える。
   *
   * @param shops 描画対象のお店一覧（カテゴリ順でソート済みを想定）
   */
  render(shops: Shop[]): void {
    const fragment = document.createDocumentFragment();
    for (const shop of shops) {
      fragment.appendChild(this.buildRow(shop));
    }
    this.listEl.replaceChildren(fragment);
  }

  /**
   * バリデーションエラーを表示する。
   *
   * @param message ユーザーへ表示する日本語のエラーメッセージ
   */
  showValidationError(message: string): void {
    this.errorEl.textContent = message;
    this.form.classList.add('has-error');
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

  /** 一覧の1行（読み取り専用）を組み立てる。店名は textContent で安全に反映。 */
  private buildRow(shop: Shop): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'shop-row';
    if (!shop.enabled) li.classList.add('is-disabled');

    const icon = document.createElement('span');
    icon.className = 'shop-icon';
    icon.textContent = getIconDef(shop.iconKey).emoji;

    const name = document.createElement('span');
    name.className = 'shop-name';
    name.textContent = shop.name; // ユーザー入力。textContent で XSS を無害化

    li.append(icon, name);
    return li;
  }
}
