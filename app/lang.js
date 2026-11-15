// 画面が使う言語の設定(core/lang.js)。画面のどこからも、言語はここから引く(言語の ID を直書きしない。LC-2)。
// 言語は URL の ?lang= で選ぶ(学習ポータル 改善計画 項目37 第4b段。ハブのカードから言語ごとに開く)。
// 無い・知らない・画面で開けない(見本だけの)言語は既定の英語にする。最後に使った言語は覚えない。

import { DEFAULT_LANG, langOf } from '../core/lang.js';

/** @typedef {import('../core/lang.js').LangSpec} LangSpec */

/**
 * URL の検索部分(location.search)から言語を選ぶ。
 * @param {string} search
 * @returns {Readonly<LangSpec>}
 */
export function pickLang(search) {
  const l = langOf(new URLSearchParams(search).get('lang'));
  return l && l.selectable ? l : DEFAULT_LANG;
}

/** 今開いている単語帳の言語(Node で読み込んだとき、location が無ければ既定) */
export const LANG = pickLang(typeof location === 'undefined' ? '' : location.search);

/** 既定(英語)の単語帳か。見出しの言語名など、既定のときは授業版と同じ見た目にする所で使う */
export const IS_DEFAULT = LANG === DEFAULT_LANG;
