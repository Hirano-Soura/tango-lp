// 画面が使う言語の設定(core/lang.js)。画面のどこからも、言語はここから引く(言語の ID を直書きしない。LC-2)。
// 学習ポータル 改善計画 項目37 第3段では英語(既定)だけ。第4b段で URL の ?lang= から選ぶ形にする(選び方の正はこのファイル)。

import { DEFAULT_LANG } from '../core/lang.js';

/** 今開いている単語帳の言語 */
export const LANG = DEFAULT_LANG;
