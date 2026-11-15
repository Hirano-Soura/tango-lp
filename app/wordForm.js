// 1 語の入力欄(追加と編集で共用)と、語の見出しの表示。
// 言語に固有の欄(英語の自他・ドイツ語の性と格支配と変化)は、言語の設定(app/lang.js の LANG)が宣言したものだけを出す。

import { esc, field, splitTags } from './dom.js';
import { isPhrase, TRANS_VALUES, TRANS_LABEL, KIND_NAMES } from '../core/word.js';
import { GENDER_VALUES, CASE_VALUES, ARTICLE, formsText, headword } from '../core/inflection.js';
import { LANG } from './lang.js';

/** @typedef {import('../core/word.js').Word} Word */
/** @typedef {import('../core/book.js').WordInput} WordInput */

/** 品詞の入力候補(自由に書いてもよい。取り込みと同じ規則で正規化する) */
const POS_HINTS = ['名', '動', '形', '副', '前', '接', '代', '動/名', '動詞句', '前置詞句', '名詞句'];

/** 自他の選択肢の表示(値は trans の値のまま) */
const TRANS_OPTION = /** @type {Record<string, string>} */ ({ vt: '他動詞(vt)', vi: '自動詞(vi)', 'vt/vi': '両用(vt/vi)' });

/** 性の選択肢の表示(値は gender の値のまま) */
const GENDER_OPTION = /** @type {Record<string, string>} */ ({ pl: 'die(複数形のみ)' });

/** 言語が宣言した項目か */
const has = (/** @type {string} */ k) => LANG.fields.includes(k);
/** 言語の簡易形式に「変化」の列があるか(ドイツ語) */
const hasForms = LANG.columns.some((c) => c.field === 'forms');

/**
 * 入力欄の HTML。name 属性は WordInput の項目名と同じ。ラベルは for で結ぶ
 * (textarea をラベルで囲むと、入力中の文までラベルの名前に含まれてしまう)。
 * @param {Partial<Word>} [w] 編集なら今の値
 * @param {string} [prefix] id の頭(1 つの画面に入力欄を 2 組置くときに分ける)
 * @returns {string}
 */
export function wordFields(w = {}, prefix = 'w') {
  const v = (/** @type {keyof Word} */ k) => esc(w[k] ?? '');
  const id = (/** @type {string} */ name) => `${prefix}-${name}`;
  const lab = (/** @type {string} */ name, /** @type {string} */ text) => `<label for="${id(name)}">${text}</label>`;
  /**
   * @param {string} name
   * @param {string} cur
   * @param {readonly string[]} values
   * @param {(v: string) => string} show
   */
  const select = (name, cur, values, show) => `<select id="${id(name)}" name="${name}">
        ${['', ...values].map((t) => `<option value="${t}"${cur === t ? ' selected' : ''}>${t ? esc(show(t)) : '—'}</option>`).join('')}
      </select>`;
  const typing = LANG.typing ? ' data-typing' : '';
  // 品詞の横に置く選択(英語は自他、ドイツ語は性)
  const side = has('trans')
    ? `<div class="f">${lab('trans', '自他')}${select('trans', w.trans ?? '', TRANS_VALUES, (t) => TRANS_OPTION[t])}</div>`
    : has('gender')
      ? `<div class="f">${lab('gender', '性')}${select('gender', w.gender ?? '', GENDER_VALUES, (g) => GENDER_OPTION[g] ?? ARTICLE[g])}</div>`
      : '';
  const hints = [
    has('trans') ? '動詞は「自他」を選びます。品詞に「動(他)」「動(自)」「動(自他)」と書いても同じです。' : '',
    has('gender') ? '名詞は「性」を選びます(見出し語に冠詞は付けません)。' : '',
  ].filter(Boolean).join('');
  const inflection = hasForms || has('case') ? `
    <div class="two">
      ${hasForms ? `<div class="f">${lab('forms', '変化')}<input id="${id('forms')}" name="forms" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${LANG.htmlLang}"${typing} value="${esc(formsText(w))}" placeholder="Hunde / fährt, fuhr, ist gefahren"></div>` : ''}
      ${has('case') ? `<div class="f">${lab('case', '格支配')}${select('case', w.case ?? '', CASE_VALUES, (c) => c)}</div>` : ''}
    </div>
    <p class="hint">変化は、名詞なら複数形(無ければ「-」)、動詞なら「3人称単数現在, 過去基本形, 完了の助動詞 過去分詞」、形容詞なら「比較級, 最上級」で書きます。格支配は動詞の目的語の格です。</p>` : '';
  return `
    <div class="f">${lab('en', `見出し語(${LANG.name})`)}<input id="${id('en')}" name="en" required autocomplete="off" autocapitalize="off" spellcheck="false"${typing} value="${v('en')}"></div>
    <div class="two">
      <div class="f">${lab('pos', '品詞')}<input id="${id('pos')}" name="pos" list="pos-hints" autocomplete="off" value="${v('pos')}" placeholder="名 / 動 / 形 …"></div>
      ${side}
    </div>
    ${hints ? `<p class="hint">${hints}</p>` : ''}${inflection}
    <datalist id="pos-hints">${POS_HINTS.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
    <div class="f">${lab('ja', '意味')}<input id="${id('ja')}" name="ja" autocomplete="off" value="${v('ja')}"></div>
    <div class="f">${lab('ex', '例文')}<textarea id="${id('ex')}" name="ex" rows="2" lang="${LANG.htmlLang}"${typing}>${v('ex')}</textarea></div>
    <div class="f">${lab('exJa', '例文の和訳')}<textarea id="${id('exJa')}" name="exJa" rows="2">${v('exJa')}</textarea></div>
    <p class="hint">例文を消すと、和訳と例文の出どころも消えます。</p>
    <div class="f">${lab('note', '補足')}<input id="${id('note')}" name="note" autocomplete="off"${typing} value="${v('note')}"></div>
    <div class="f">${lab('tags', 'タグ(読点・カンマ区切り)')}<input id="${id('tags')}" name="tags" autocomplete="off" value="${esc((w.tags ?? []).join('、'))}"></div>
    ${typingButtons()}`;
}

/**
 * 入力欄から 1 語を読む。正規化(品詞の別名・性の書き方・変化の分け方など)は core 側で行う。
 * 言語が持たない欄は画面に無いので空文字になり、core が「項目が無い」として扱う。
 * @param {HTMLFormElement} form
 * @returns {WordInput}
 */
export function readWordFields(form) {
  return {
    en: field(form, 'en'),
    pos: field(form, 'pos'),
    trans: field(form, 'trans'),
    gender: field(form, 'gender'),
    case: field(form, 'case'),
    forms: field(form, 'forms'),
    ja: field(form, 'ja'),
    ex: field(form, 'ex'),
    exJa: field(form, 'exJa'),
    note: field(form, 'note'),
    tags: splitTags(field(form, 'tags')),
  };
}

/**
 * 見出し語の表示(性のある名詞は冠詞を付けて「der Hund」)。esc 済み。
 * @param {Pick<Word, 'en' | 'gender'>} w
 * @returns {string}
 */
export function headHtml(w) {
  return esc(headword(w));
}

/**
 * 語の種別・品詞・自他の短い表示。ドイツ語は品詞の後ろに格支配を、最後に変化を添える(「動(4格) · fährt, fuhr, ist gefahren」)。
 * @param {Word} w
 * @returns {string}
 */
export function posLine(w) {
  const ph = isPhrase(w);
  const forms = formsText(w);
  return `<span class="kind${ph ? ' ph' : ''}">${ph ? KIND_NAMES.phrase : KIND_NAMES.word}</span> ${esc(w.pos || '品詞なし')}${w.case ? `(${esc(w.case)})` : ''}${transBadge(w)}`
    + (forms ? ` · <span class="forms" lang="${LANG.htmlLang}">${esc(forms)}</span>` : '');
}

/**
 * 動詞の自他の印(既存アプリと同じ 他 / 自 / 他自。色で分け、説明を title に持たせる)。自他が無ければ空。
 * @param {Pick<Word, 'trans'>} w
 * @returns {string}
 */
export function transBadge(w) {
  const t = w.trans ? TRANS_LABEL[w.trans] : undefined;
  if (!t) return '';
  const cls = w.trans === 'vt/vi' ? 'both' : w.trans;
  return ` <span class="tr ${cls}" title="${esc(t.title)}">${t.mark}</span>`;
}

/**
 * 意味の表示。半角かっこの品詞・自他のラベル((名)(動)(他)(自)など。依頼文 v2 が付けさせる)を小さな印にする。
 * 利用者の入力なので、先に esc を通す(ラベルの文字は esc で変わらない)。
 * @param {string | undefined} ja
 * @returns {string}
 */
export function jaHtml(ja) {
  return esc(ja ?? '').replace(/\((名|動|形|副|前|接|自|他)\)/g, '<span class="jl">$1</span>');
}

// --- 入力の補助(ドイツ語の「a:」→「ä」と ß などのボタン。言語の設定の typing) -------------------------------

/**
 * 文字のボタンの列。言語が入力の補助を持たなければ空。
 * @returns {string}
 */
export function typingButtons() {
  if (!LANG.typing) return '';
  return `<div class="typing" role="group" aria-label="文字を入れる">${LANG.typing.buttons
    .map((c) => `<button type="button" data-type-char="${esc(c)}" aria-label="${esc(c)} を入れる">${esc(c)}</button>`).join('')}
    <span class="hint">「a:」「o:」「u:」と打つと ä ö ü になります</span></div>`;
}

/** 補助を付けた画面の根(描き直しても同じ要素なので、1 回だけ付ける) */
const bound = new WeakSet();
/** 最後に触った、補助の対象の入力欄(ボタンはそこへ入れる) */
let lastField = /** @type {HTMLInputElement | HTMLTextAreaElement | null} */ (null);

/**
 * data-typing の入力欄に、打った文字列の置き換えと、文字のボタンを効かせる。言語が補助を持たなければ何もしない。
 * @param {HTMLElement} root
 */
export function bindTyping(root) {
  const t = LANG.typing;
  if (!t || bound.has(root)) return;
  bound.add(root);
  const isField = (/** @type {EventTarget | null} */ el) =>
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.dataset.typing !== undefined ? el : null;
  root.addEventListener('focusin', (e) => {
    const el = isField(e.target);
    if (el) lastField = el;
  });
  root.addEventListener('input', (e) => {
    const el = isField(e.target);
    if (!el || /** @type {InputEvent} */ (e).isComposing) return;
    const caret = el.selectionStart ?? el.value.length;
    let before = el.value.slice(0, caret);
    let after = el.value.slice(caret);
    for (const [from, to] of Object.entries(t.replace)) {
      before = before.split(from).join(to);
      after = after.split(from).join(to);
    }
    if (before + after === el.value) return;
    el.value = before + after;
    el.setSelectionRange(before.length, before.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // ボタンを押しても入力欄のフォーカスを奪わない(押した位置に入れる)
  root.addEventListener('mousedown', (e) => {
    if (e.target instanceof Element && e.target.closest('[data-type-char]')) e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-type-char]') : null;
    if (!(b instanceof HTMLElement)) return;
    const el = lastField && root.contains(lastField) ? lastField : isField(root.querySelector('[data-typing]'));
    if (!el) return;
    const c = b.dataset.typeChar ?? '';
    const s = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? s;
    el.value = el.value.slice(0, s) + c + el.value.slice(end);
    el.focus();
    el.setSelectionRange(s + c.length, s + c.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
