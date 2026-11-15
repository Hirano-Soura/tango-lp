// 性・格支配・変化(名詞の複数形・動詞の三基本形・形容詞の比較)の読み書き。ブラウザの API に触れない(INV-6)。
// どの言語がこれらの項目を持つかは言語の設定(core/lang.js の fields・articles)が決め、ここは項目の種類ごとの規則だけを持つ
// (言語の ID を見ない。LC-2)。新LP版のドイツ語(学習ポータル 改善計画 項目37 第4a段)で使う。仕様は Docs/26_Languages.md §4。

/** @typedef {import('./word.js').Word} Word */

/** 性の値。pl は複数形でしか使わない名詞 */
export const GENDER_VALUES = /** @type {const} */ (['m', 'f', 'n', 'pl']);

/** 性の書き方(小文字にし、空白を除いたもの)→ 値 */
const GENDER_ALIASES = /** @type {Record<string, string>} */ ({
  m: 'm', 'm.': 'm', der: 'm', masc: 'm', 'masc.': 'm', maskulinum: 'm', 男: 'm', 男性: 'm', 男性名詞: 'm',
  f: 'f', 'f.': 'f', die: 'f', fem: 'f', 'fem.': 'f', femininum: 'f', 女: 'f', 女性: 'f', 女性名詞: 'f',
  n: 'n', 'n.': 'n', das: 'n', neut: 'n', 'neut.': 'n', neutrum: 'n', 中: 'n', 中性: 'n', 中性名詞: 'n',
  pl: 'pl', 'pl.': 'pl', plural: 'pl', 複: 'pl', 複数: 'pl', 複数形: 'pl',
});

/** 性ごとの定冠詞(表示と、見出し語の冠詞を性へ移すときに使う) */
export const ARTICLE = Object.freeze(/** @type {Record<string, string>} */ ({ m: 'der', f: 'die', n: 'das', pl: 'die' }));

/** 格支配の値(動詞の品詞の括弧に添える印。英語の自他と同じ置き方) */
export const CASE_VALUES = /** @type {const} */ (['4格', '3格', '3格4格', '2格', '自']);

/** 格支配の書き方(括弧の中身から空白と区切りを除き、小文字にしたもの)→ 値 */
const CASE_ALIASES = /** @type {Record<string, string>} */ ({
  '4格': '4格', '4': '4格', akk: '4格', 'akk.': '4格', akkusativ: '4格', a: '4格',
  '3格': '3格', '3': '3格', dat: '3格', 'dat.': '3格', dativ: '3格', d: '3格',
  '3格4格': '3格4格', '4格3格': '3格4格', '34格': '3格4格', '43格': '3格4格', '34': '3格4格', datakk: '3格4格', akkdat: '3格4格',
  '2格': '2格', '2': '2格', gen: '2格', 'gen.': '2格', genitiv: '2格',
  自: '自', 自動詞: '自', vi: '自', intr: '自', 'intr.': '自',
});

/** 完了の助動詞の書き方 → 値(不定形) */
const AUX_ALIASES = /** @type {Record<string, string>} */ ({
  hat: 'haben', haben: 'haben', ist: 'sein', sein: 'sein',
  'hat/ist': 'haben/sein', 'ist/hat': 'haben/sein', 'haben/sein': 'haben/sein', 'sein/haben': 'haben/sein',
});
/** 完了の助動詞の値 → 3 人称単数の形(表示用) */
const AUX_SHOW = /** @type {Record<string, string>} */ ({ haben: 'hat', sein: 'ist', 'haben/sein': 'hat/ist' });

/** 変化の欄の中の区切り(半角・全角のカンマと読点) */
const FORM_SEP = /\s*[,，、]\s*/;

/**
 * 性を読む。読めなければ undefined。
 * @param {string} s
 * @returns {string | undefined}
 */
export function readGender(s) {
  return GENDER_ALIASES[String(s ?? '').replace(/\s/g, '').toLowerCase()];
}

/**
 * 見出し語の頭の定冠詞(der Hund)を性へ移す。冠詞の表(言語の設定の articles)にある語で始まり、
 * その後ろが大文字で始まる 1 語のときだけ(「das heißt」のような句は冠詞と読まない)。
 * @param {string} term 空白を詰めた見出し語
 * @param {Readonly<Record<string, string>>} articles 冠詞 → 性
 * @returns {{ term: string, gender?: string }}
 */
export function splitArticle(term, articles) {
  const m = /^(\S+)\s+(\p{Lu}\S*)$/u.exec(term);
  const g = m ? articles[m[1].toLowerCase()] : undefined;
  return m && g ? { term: m[2], gender: g } : { term };
}

/**
 * 品詞の欄から格支配の印を取り出す。「動(4格)」「動(3格4格)」の括弧だけを読む(英語の splitTransMark と同じ考え)。
 * 取り出したあとの品詞に「動」が無ければ印とみなさない。括弧の中身が格支配でないもの(「名(可算)」など)は残す。
 * @param {string} pos 前後の空白を落とした品詞(空でもよい)
 * @returns {{ pos: string, case?: string }}
 */
export function splitCaseMark(pos) {
  if (!pos) return { pos };
  /** @type {string | undefined} */
  let found;
  let rest = pos.replace(/[（(]([^）)]*)[）)]/g, (m, /** @type {string} */ inner) => {
    const c = readCase(inner);
    if (!c) return m;
    found = c;
    return '';
  });
  rest = rest.trim();
  if (!found || !rest.includes('動')) return { pos };
  return { pos: rest, case: found };
}

/**
 * 格支配を読む。読めなければ undefined。
 * @param {string} s
 * @returns {string | undefined}
 */
export function readCase(s) {
  return CASE_ALIASES[String(s ?? '').replace(/[\s・,、+＋/]/g, '').toLowerCase()];
}

/**
 * 変化の欄(1 つの文字列)を、形から内部の項目へ分ける。
 * - 3 つに区切れて、3 つ目が完了の助動詞で始まる → 動詞(pres3・past・aux・pp)。分離動詞は「kommt an」のまま
 * - 2 つに区切れて、2 つ目が「am 」で始まる → 形容詞(comp・sup)
 * - 区切りが無く、名詞(品詞に「名」があるか、性がある)→ 複数形(plural)。複数形の無い名詞は「-」
 * どれにも当たらなければ何も返さず、warning で知らせる。
 * @param {string} s
 * @param {{ noun: boolean }} ctx 名詞か(品詞に「名」がある、または性がある)
 * @returns {{ fields: Record<string, string>, warning?: string }}
 */
export function readForms(s, ctx) {
  const t = String(s ?? '').trim();
  if (!t) return { fields: {} };
  const parts = t.split(FORM_SEP).filter(Boolean);
  if (parts.length === 3) {
    const m = /^(\S+)\s+(.+)$/.exec(parts[2]);
    const aux = m ? AUX_ALIASES[m[1].toLowerCase()] : undefined;
    if (m && aux) return { fields: { pres3: parts[0], past: parts[1], aux, pp: m[2] } };
  }
  if (parts.length === 2 && /^am\s/.test(parts[1])) return { fields: { comp: parts[0], sup: parts[1] } };
  if (parts.length === 1 && ctx.noun) return { fields: { plural: parts[0] } };
  return { fields: {}, warning: `変化「${t}」の形が読めないため無視しました(名詞は複数形、動詞は「fährt, fuhr, ist gefahren」、形容詞は「größer, am größten」)` };
}

/**
 * 完了の助動詞を読む(hat / ist / haben / sein)。読めなければ undefined。
 * @param {string} s
 * @returns {string | undefined}
 */
export function readAux(s) {
  return AUX_ALIASES[String(s ?? '').replace(/\s/g, '').toLowerCase()];
}

/**
 * 変化の表示(簡易形式の「変化」の欄と同じ書き方)。変化の項目が無ければ空。
 * @param {Partial<Word>} w
 * @returns {string}
 */
export function formsText(w) {
  if (w.pres3 || w.past || w.pp) {
    const aux = w.aux ? (AUX_SHOW[w.aux] ?? w.aux) + ' ' : '';
    return [w.pres3 ?? '', w.past ?? '', aux + (w.pp ?? '')].join(', ');
  }
  if (w.comp || w.sup) return [w.comp ?? '', w.sup ?? ''].join(', ');
  return w.plural ?? '';
}

/**
 * 冠詞を付けた見出し語(性のある名詞は「der Hund」。性の無い語は見出し語のまま)。
 * @param {Pick<Word, 'en' | 'gender'>} w
 * @returns {string}
 */
export function headword(w) {
  const a = w.gender ? ARTICLE[w.gender] : undefined;
  return a ? `${a} ${w.en}` : w.en;
}
