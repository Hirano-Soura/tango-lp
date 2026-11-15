// 取り込み形式(簡易形式・JSON)の解析と検証。ブラウザの API に触れない(INV-6)。
// 仕様は Docs/20_ImportFormat.md。版を足す・変えるときの手順は同 §1(INV-3)。

import { TRANS_VALUES, POS_CODE_OF_NAME } from './word.js';
import { DEFAULT_LANG, LANGS } from './lang.js';
import { readGender, readCase, readAux, readForms, splitArticle, splitCaseMark } from './inflection.js';

/** @typedef {import('./word.js').Word} Word */
/** @typedef {import('./lang.js').LangSpec} LangSpec */

/**
 * 1 行(簡易形式)または 1 項目(JSON)の解析結果。
 * word / error / skipped のうちちょうど 1 つを持つ。
 * @typedef {object} ParsedRow
 * @property {number} ref 簡易形式なら行番号、JSON なら語の通し番号(どちらも 1 始まり)
 * @property {string} raw 元の行(JSON なら項目を JSON に戻したもの)
 * @property {Word} [word] 読めた語
 * @property {string} [error] 語として読もうとしたが読めなかった理由
 * @property {string} [skipped] 語ではないと判断した理由(前置きの文・見出し行など)
 * @property {string[]} warnings 取り込みはするが知らせること
 */

/**
 * 入力全体の解析結果。fatal があれば rows は空。
 * @typedef {object} ParseResult
 * @property {string} format 読んだ版(SIMPLE_FORMAT / LEGACY_FORMAT / JSON の format 欄)
 * @property {ParsedRow[]} rows
 * @property {string[]} warnings 入力全体に関する注意
 * @property {string} [fatal] 入力全体が読めなかった理由
 */

/** 簡易形式の版。見出し行を持たないので、列の並びを変えるときは別の版として見分けられる形にする */
export const SIMPLE_FORMAT = 'simple/v1';
/** format 欄を持たない JSON。toeic-drill の単語データ(words / phrases)の形 */
export const LEGACY_FORMAT = 'toeic-drill';
/** 書き出すときに使う JSON の版 */
export const CURRENT_JSON_FORMAT = 'tango-drill/v1';
/** バックアップの版の頭(core/backup.js)。取り込みはこの版を読まず、バックアップの読み込みへ案内する */
export const BACKUP_FORMAT_PREFIX = 'tango-drill-backup/';

/**
 * 取り込み欄に灰色で見せ、「例を入れる」で入れる簡易形式の例(Docs/23_Screens.md §3)。
 * 全項目の行・途中までの行を 1 つずつ含める。どの行も語として読めることを tests/core/importFormat.test.js が確かめる。
 */
export const SIMPLE_EXAMPLE = [
  'allocate | 動(他) | 割り当てる | The manager allocated the budget. | 部長が予算を割り当てた。 | allocate A to B',
  'reimburse | 動(他) | 払い戻す',
  'itinerary | 名 | 旅程',
].join('\n');

/** JSON の版ごとの読み手。過去の版の読み手を消さない(INV-3) */
const JSON_READERS = /** @type {Record<string, (data: Record<string, unknown>, lang: LangSpec) => ParseResult>} */ ({
  'tango-drill/v1': readV1,
});

/** 読める版のすべて(INV-3 のテストがこの一覧と見本を突き合わせる) */
export const READABLE_FORMATS = Object.freeze([SIMPLE_FORMAT, LEGACY_FORMAT, ...Object.keys(JSON_READERS)]);

/** 語が持ってよい項目(言語に固有の項目は、言語の設定の fields を足す) */
const WORD_KEYS = ['en', 'pos', 'trans', 'ja', 'ex', 'exJa', 'note', 'kind', 'tags', 'exSrc'];
/** 見出し語(en)の別名。JSON の項目名として読む(新LP版。en は授業版との取り込みやすさのため内部名のまま残す) */
const TERM_ALIAS = 'term';
/** 文字列で持つ項目(en を除く) */
const TEXT_KEYS = /** @type {const} */ (['pos', 'trans', 'ja', 'ex', 'exJa', 'note', 'kind', 'exSrc']);
/** @type {readonly string[]} */
const TRANS = TRANS_VALUES;
const EX_SRC = ['self', 'ai', 'set'];

/** 簡易形式の区切り(半角・全角の縦棒) */
const BAR = /[|｜]/;
/** 行頭の箇条書き記号・番号 */
const BULLET = /^(?:[-*+]\s+|[・•●◦▪]\s*|\d{1,3}\s*[.)．、]\s*|[(（]\d{1,3}[)）]\s*|[①-⑳]\s*)/;
/** Markdown の表の区切り行 */
const TABLE_RULE = /^[|｜]?\s*:?-{2,}:?\s*([|｜]\s*:?-{2,}:?\s*)*[|｜]?$/;
/** 区切りの無い行を見出し語とみなす語数の上限(仮) */
const MAX_BARE_WORDS = 6;
/** 見出し行の項目名。2 つ以上が並んだ行を見出し行として読み飛ばす */
const HEADER_LABELS = new Set([
  '見出し語', '英単語', '単語', '品詞', '日本語の意味', '意味', '訳', '英語の例文', '例文',
  '例文の和訳', '和訳', '補足', '備考', 'headword', 'word', 'pos', 'part of speech', 'meaning',
  'japanese', 'example', 'translation', 'note', 'en', 'ja', 'ex', 'exja',
]);
/** 品詞として読める値(1 字の略号か「〜句」を区切りで並べたもの) */
const POS_LIKE = /^(?:[名動形副前接代間冠助]|\S*句)(?:[\/・,、](?:[名動形副前接代間冠助]|\S*句))*$/;
/** 品詞の別名。区切り(/ ・ , 、)の間の 1 つずつを置き換える */
const POS_ALIASES = /** @type {Record<string, string>} */ ({
  noun: '名', n: '名',
  verb: '動', v: '動',
  adjective: '形', adj: '形',
  adverb: '副', adv: '副',
  preposition: '前', prep: '前',
  conjunction: '接', conj: '接',
  pronoun: '代', pron: '代',
  interjection: '間',
  phrase: '句',
  // 略さない日本語の名前(名詞・動詞 …)は word.js の表から
  ...POS_CODE_OF_NAME,
});

/**
 * 貼り付けられた文字列・読み込んだファイルの中身を解析する。保存はしない(INV-2)。
 * 先頭が波括弧の入力と、json の囲み(コードブロック)を含む入力は JSON としてその版の読み手で読む。
 * それ以外は簡易形式として読む。見出し語の判定・簡易形式の列・言語に固有の項目は、言語の設定(core/lang.js)に従う。
 * @param {string} text
 * @param {LangSpec} [lang] 既定は英語(授業版と同じ読み方)
 * @returns {ParseResult}
 */
export function parseImport(text, lang = DEFAULT_LANG) {
  const src = String(text ?? '').replace(/^\ufeff/, '');
  if (!src.trim()) return fatal(SIMPLE_FORMAT, '入力が空です');
  const json = extractJson(src);
  return json === null ? parseSimple(src, lang) : parseJson(json, lang);
}

/**
 * 入力から JSON 部分を取り出す。JSON でなければ null。
 * @param {string} src
 * @returns {string | null}
 */
function extractJson(src) {
  const t = src.trim();
  if (t.startsWith('{')) return t;
  // コードブロックのうち、言語名が json か、中身が波括弧で始まる最初のもの
  for (const m of src.matchAll(/^[ \t]*(```|~~~)[ \t]*(\w*)[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\1[ \t]*\r?$/gm)) {
    if (m[2].toLowerCase() === 'json' || m[3].trim().startsWith('{')) return m[3].trim();
  }
  return null;
}

// --- JSON ----------------------------------------------------------------------

/**
 * @param {string} text
 * @param {LangSpec} lang
 * @returns {ParseResult}
 */
function parseJson(text, lang) {
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return fatal('json', 'JSON として読めません: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!isObject(data)) return fatal('json', 'JSON の最上位が { } ではありません');
  if (!('format' in data)) return readLegacy(data, lang);
  const fmt = data.format;
  if (typeof fmt !== 'string') return fatal('json', 'format が文字列ではありません');
  const reader = JSON_READERS[fmt];
  if (reader) return reader(data, lang);
  // バックアップは記録ごと置き換える別の経路(Docs/22_Storage.md)。語の取り込みには使わない
  if (fmt.startsWith(BACKUP_FORMAT_PREFIX)) {
    return fatal(fmt, 'これはバックアップのファイルです。語の取り込みではなく、バックアップの読み込みを使ってください');
  }
  const m = /^tango-drill\/v(\d+)$/.exec(fmt);
  const newest = Math.max(...Object.keys(JSON_READERS).map((k) => Number(k.split('/v')[1])));
  if (m && Number(m[1]) > newest) {
    return fatal(fmt, `この版(${fmt})はこのアプリより新しいため読めません。アプリを更新してください`);
  }
  return fatal(fmt, `不明な形式です: ${fmt}`);
}

/**
 * tango-drill/v1: { "format": "tango-drill/v1", "words": [ 語, ... ] }
 * @param {Record<string, unknown>} data
 * @param {LangSpec} lang
 * @returns {ParseResult}
 */
function readV1(data, lang) {
  const format = 'tango-drill/v1';
  if (!Array.isArray(data.words)) return fatal(format, 'words が配列ではありません');
  // 空の単語帳を書き出したファイルも読めるよう、語 0 件は拒否せず警告にとどめる(INV-3)
  const warnings = unknownKeys(data, ['format', 'words']);
  if (data.words.length === 0) warnings.push('語が 1 つもありません');
  return { format, rows: data.words.map((item, i) => readItem(item, i + 1, lang)), warnings };
}

/**
 * toeic-drill の単語データ: { "words": [...], "phrases": [...] }(format 欄なし)。
 * phrases の語は kind を "phrase" にする。date / level / theme は使わない。
 * @param {Record<string, unknown>} data
 * @param {LangSpec} lang
 * @returns {ParseResult}
 */
function readLegacy(data, lang) {
  const format = LEGACY_FORMAT;
  const words = data.words === undefined ? [] : data.words;
  const phrases = data.phrases === undefined ? [] : data.phrases;
  if (!Array.isArray(words) || !Array.isArray(phrases)) {
    return fatal(format, 'words / phrases が配列ではありません');
  }
  if (data.words === undefined && data.phrases === undefined) {
    return fatal(format, 'format 欄が無く、words / phrases も無いため読めません');
  }
  const rows = words.map((item, i) => readItem(item, i + 1, lang));
  phrases.forEach((item, i) => {
    rows.push(readItem(isObject(item) ? { ...item, kind: 'phrase' } : item, words.length + i + 1, lang));
  });
  const warnings = unknownKeys(data, ['words', 'phrases', 'date', 'level', 'theme']);
  if (rows.length === 0) warnings.push('語が 1 つもありません');
  return { format, rows, warnings };
}

/**
 * @param {Record<string, unknown>} data
 * @param {string[]} known
 * @returns {string[]}
 */
function unknownKeys(data, known) {
  return Object.keys(data)
    .filter((k) => !known.includes(k))
    .map((k) => `未知の項目 ${k} を無視しました`);
}

/**
 * JSON の 1 項目を語として読む。バックアップの語(core/backup.js)も同じ規則で読む。
 * 見出し語は en、無ければ別名の term から読む。言語に固有の項目(言語の設定の fields)も文字列として読む。
 * @param {unknown} item
 * @param {number} ref
 * @param {LangSpec} [lang] 既定は英語
 * @returns {ParsedRow}
 */
export function readItem(item, ref, lang = DEFAULT_LANG) {
  const raw = JSON.stringify(item) ?? String(item);
  if (!isObject(item)) return { ref, raw, error: '語が { } ではありません', warnings: [] };
  // 言語に固有の項目と、取り込みで内部の項目へ分ける列(ドイツ語の forms)
  const extra = [...new Set([...lang.fields, ...lang.columns.map((c) => c.field)])].filter((k) => !WORD_KEYS.includes(k));
  const warnings = unknownKeys(item, [...WORD_KEYS, ...extra, TERM_ALIAS]);
  const term = typeof item.en === 'string' ? item.en : item.en === undefined ? item[TERM_ALIAS] : undefined;
  if (typeof term !== 'string') return { ref, raw, error: '見出し語(en)がありません', warnings };
  if (typeof item.en === 'string' && item[TERM_ALIAS] !== undefined && item[TERM_ALIAS] !== item.en) {
    warnings.push(`見出し語が en と ${TERM_ALIAS} の両方にあり食い違うため、en を使いました`);
  }
  /** @type {Record<string, string>} */
  const fields = { en: term };
  for (const k of [...TEXT_KEYS, ...extra]) {
    const v = item[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') fields[k] = v;
    else warnings.push(`${k} が文字列ではないため無視しました`);
  }
  /** @type {string[] | undefined} */
  let tags;
  if (Array.isArray(item.tags) && item.tags.every((t) => typeof t === 'string')) tags = item.tags;
  else if (item.tags !== undefined && item.tags !== null) warnings.push('tags が文字列の配列ではないため無視しました');
  return buildRow(fields, tags, ref, raw, warnings, lang);
}

// --- 簡易形式 --------------------------------------------------------------------

/**
 * 1 行 1 語。項目の並びは言語の設定の columns(英語は「見出し語 | 品詞 | 意味 | 例文 | 例文の和訳 | 補足」)。後ろの項目は省略できる。
 * @param {string} src
 * @param {LangSpec} lang
 * @returns {ParseResult}
 */
function parseSimple(src, lang) {
  /** @type {ParsedRow[]} */
  const rows = [];
  src.split(/\r\n|\r|\n/).forEach((line, i) => {
    const t = line.trim();
    // 空行・コードブロックの囲み・表の区切り行は、行として数えない
    if (!t || /^(```|~~~)/.test(t) || TABLE_RULE.test(t)) return;
    rows.push(readLine(t, i + 1, lang));
  });
  return { format: SIMPLE_FORMAT, rows, warnings: [] };
}

/**
 * @param {string} line 前後の空白を落とした 1 行
 * @param {number} ref
 * @param {LangSpec} lang
 * @returns {ParsedRow}
 */
function readLine(line, ref, lang) {
  const raw = line;
  // 先頭と末尾の縦棒(Markdown の表の行)は項目を持たないので落とす
  let body = line.replace(/^[|｜]/, '').replace(/\s*[|｜]\s*$/, '');
  body = body.replace(BULLET, '');
  const sep = BAR.test(body) ? /\s*[|｜]\s*/ : body.includes('\t') ? /\s*\t\s*/ : null;
  const cells = (sep ? body.split(sep) : [body]).map(stripMarkup);

  if (isHeader(cells)) return { ref, raw, skipped: '見出し行', warnings: [] };
  const en = cells[0];
  if (!sep) {
    // 区切りの無い行は「見出し語だけの行」か「前置きの文」のどちらか
    if (!lang.looksTerm(en)) return { ref, raw, skipped: `${lang.name}の見出し語ではありません(前置きの文など)`, warnings: [] };
    const n = collapse(en).split(' ').length;
    if (/[:!?]/.test(en) || (/\.$/.test(en) && n > 2) || n > MAX_BARE_WORDS) {
      return { ref, raw, skipped: '文のように見えます(前置きの文など)', warnings: [] };
    }
  }
  const cols = lang.columns;
  if (cells.length > cols.length) return { ref, raw, error: `項目が多すぎます(${cells.length} 個。${cols.length} 個まで)`, warnings: [] };
  /** @type {Record<string, string>} */
  const fields = { en };
  cols.forEach((c, i) => {
    if (i > 0 && cells[i]) fields[c.field] = cells[i];
  });
  return buildRow(fields, undefined, ref, raw, [], lang);
}

/**
 * 項目を囲む Markdown の強調・コード記号を落とす。
 * @param {string} s
 * @returns {string}
 */
function stripMarkup(s) {
  let t = s.trim();
  for (const m of ['**', '__', '`']) {
    if (t.length > 2 * m.length && t.startsWith(m) && t.endsWith(m)) t = t.slice(m.length, -m.length).trim();
  }
  return t;
}

/**
 * 見出し行か。項目名が 2 つ以上並び、2 つ目の項目が空でも品詞(POS_LIKE)でもない行
 * (`meaning | 名 | 意味` のような本物の語を見出し行と取り違えないため)。
 * @param {string[]} cells
 * @returns {boolean}
 */
function isHeader(cells) {
  /** @param {string} s */
  const key = (s) => s.replace(/[（(][^）)]*[）)]/g, '').trim().toLowerCase();
  const labels = cells.filter((c) => HEADER_LABELS.has(key(c))).length;
  const second = key(cells[1] ?? '');
  return labels >= 2 && second !== '' && !POS_LIKE.test(normalizePos(second));
}

// --- 共通 ----------------------------------------------------------------------

/**
 * 読み出した項目を検証して 1 語にする。見出し語の不備だけを error にし、
 * 他の項目の不備はその項目を捨てて warnings に残す(1 項目のために語ごと落とさない)。
 * @param {Record<string, string>} fields
 * @param {string[] | undefined} tags
 * @param {number} ref
 * @param {string} raw
 * @param {string[]} warnings
 * @param {LangSpec} lang
 * @returns {ParsedRow}
 */
function buildRow(fields, tags, ref, raw, warnings, lang) {
  const en = collapse(fields.en);
  if (!en) return { ref, raw, error: '見出し語が空です', warnings };
  if (!lang.looksTerm(en)) return { ref, raw, error: `見出し語が${lang.name}ではありません: ${en}`, warnings };

  /** @param {string} k */
  const pick = (k) => (fields[k] === undefined ? '' : fields[k].trim());

  /** @type {Word} */
  const word = { en };
  // 自他(trans)は、言語の設定が宣言したときだけ読む(英語)
  const hasTrans = lang.fields.includes('trans');
  // 品詞に添えた自他の印(「動(他)」「他動詞」など。簡易形式で自他を書く唯一の場所)は trans に移す
  const marked = hasTrans ? splitTransMark(pick('pos')) : { pos: pick('pos') };
  // 格支配(case)も同じく、宣言した言語だけが品詞の括弧から読む(ドイツ語の「動(4格)」)
  const caseMarked = lang.fields.includes('case') ? splitCaseMark(marked.pos) : { pos: marked.pos };
  if (caseMarked.pos) word.pos = normalizePos(caseMarked.pos);
  for (const k of /** @type {const} */ (['ja', 'ex', 'exJa', 'note'])) {
    const v = pick(k);
    if (v) word[k] = v;
  }
  // 言語に固有の文字列の項目(自他を除く。中国語の見本の読み reading など)
  const own = /** @type {Record<string, string>} */ (/** @type {unknown} */ (word));
  for (const k of lang.fields) {
    if (k === 'trans') continue;
    const v = pick(k);
    if (v) own[k] = v;
  }
  const trans = pick('trans');
  let given = '';
  if (trans && !hasTrans) {
    warnings.push(`trans(自他)は${lang.name}の語には使わないため無視しました`);
  } else if (trans) {
    const t = trans.toLowerCase().replace(/\s/g, '');
    const v = t === 'vi/vt' ? 'vt/vi' : t;
    if (TRANS.includes(v)) given = v;
    else warnings.push(`trans の値 ${trans} は使えないため無視しました(vt / vi / vt/vi)`);
  }
  // trans の欄が品詞の印より先(欄は意図して選んだ値のため)。食い違えば知らせる
  if (given && marked.trans && given !== marked.trans) {
    warnings.push(`品詞に添えた自他(${marked.trans})は trans の値 ${given} と食い違うため、trans の値を使いました`);
  }
  if (given || marked.trans) word.trans = given || marked.trans;
  readInflection(word, own, pick('forms'), caseMarked.case, lang, warnings);
  if (word.exJa && !word.ex) {
    warnings.push('例文の無い和訳(exJa)は無視しました');
    delete word.exJa;
  }
  const kind = pick('kind');
  if (kind && kind !== 'phrase') warnings.push(`kind の値 ${kind} は使えないため無視しました(phrase のみ)`);
  if (kind === 'phrase' || (word.pos && word.pos.includes('句'))) word.kind = 'phrase';
  const exSrc = pick('exSrc');
  if (exSrc && isExSrc(exSrc)) {
    if (word.ex) word.exSrc = exSrc;
    else warnings.push('例文の無い出どころ(exSrc)は無視しました');
  } else if (exSrc) {
    warnings.push(`exSrc の値 ${exSrc} は使えないため無視しました(self / ai / set)`);
  }
  const cleanTags = [...new Set((tags || []).map((t) => t.trim()).filter(Boolean))];
  if (cleanTags.length) word.tags = cleanTags;
  return { ref, raw, word, warnings };
}

/**
 * 性・格支配・変化を読みそろえる(ドイツ語。どの項目を読むかは言語の設定の fields・articles・columns で決まる)。
 * 読めない値は捨てて warnings に残す(1 項目のために語ごと落とさない)。
 * @param {Word} word 読んでいる語(見出し語の冠詞を性へ移すときに en を書き換える)
 * @param {Record<string, string>} own word を項目名で引くための同じオブジェクト
 * @param {string} forms 「変化」の欄(無ければ空)
 * @param {string | undefined} marked 品詞の括弧から読んだ格支配
 * @param {LangSpec} lang
 * @param {string[]} warnings
 */
function readInflection(word, own, forms, marked, lang, warnings) {
  const has = (/** @type {string} */ k) => lang.fields.includes(k);
  if (has('gender') && own.gender) {
    const g = readGender(own.gender);
    if (g) own.gender = g;
    else {
      warnings.push(`性の値 ${own.gender} は使えないため無視しました(der / die / das / pl)`);
      delete own.gender;
    }
  }
  if (lang.articles) {
    const a = splitArticle(word.en, lang.articles);
    if (a.gender) {
      word.en = a.term;
      if (!own.gender) own.gender = a.gender;
      else if (own.gender !== a.gender) warnings.push(`見出し語の冠詞と性(${own.gender})が食い違うため、性の欄を使いました`);
    }
  }
  if (has('case')) {
    if (own.case) {
      const c = readCase(own.case);
      if (c) own.case = c;
      else {
        warnings.push(`格支配の値 ${own.case} は使えないため無視しました(4格 / 3格 / 3格4格 / 2格 / 自)`);
        delete own.case;
      }
    }
    if (marked && own.case && marked !== own.case) {
      warnings.push(`品詞に添えた格支配(${marked})は case の値 ${own.case} と食い違うため、case の値を使いました`);
    } else if (marked) own.case = marked;
  }
  if (forms && lang.columns.some((c) => c.field === 'forms')) {
    const noun = String(word.pos ?? '').split(/[\/・,、]/).some((p) => p.replace(/[（(][^）)]*[）)]/g, '').trim() === '名') || !!own.gender;
    const r = readForms(forms, { noun });
    if (r.warning) warnings.push(r.warning);
    for (const [k, v] of Object.entries(r.fields)) if (has(k) && !own[k]) own[k] = v;
  }
  if (has('aux') && own.aux) {
    const x = readAux(own.aux);
    if (x) own.aux = x;
    else {
      warnings.push(`完了の助動詞 ${own.aux} は使えないため無視しました(haben / sein)`);
      delete own.aux;
    }
  }
}

/** 品詞に括弧で添えた自他の印(括弧の中身から空白を除き、小文字にしたもの)→ trans */
const TRANS_MARKS = /** @type {Record<string, string>} */ ({
  '他': 'vt', '他動詞': 'vt', vt: 'vt', 'v.t.': 'vt',
  '自': 'vi', '自動詞': 'vi', vi: 'vi', 'v.i.': 'vi',
  '自他': 'vt/vi', '他自': 'vt/vi', '他/自': 'vt/vi', '自/他': 'vt/vi', '他・自': 'vt/vi', '自・他': 'vt/vi',
  'vt/vi': 'vt/vi', 'vi/vt': 'vt/vi',
});
/**
 * 品詞の欄から自他の印を取り出す。「動(他)」「名/動(自他)」の括弧だけを読む。
 * 取り出したあとの品詞の文字列に「動」が無ければ(「名(他)」など)、自他の印とはみなさずにそのまま返す(「動詞句(他)」は読む)。
 * 括弧の中身が自他の印でないもの(「名(可算)」など)は残す。
 * 単独の「他動詞」「vt」は品詞「動」に置き換えない。語の鍵(INV-4)は括弧書きを落として作るので、括弧の印を外しても鍵は変わらないが、
 * 単独の語を置き換えると鍵が変わり、保存してある単語帳で「run|他動詞」と「run|動」が 1 つの鍵に重なって開けなくなる(INV-3)。
 * @param {string} pos 前後の空白を落とした品詞(空でもよい)
 * @returns {{ pos: string, trans?: string }}
 */
export function splitTransMark(pos) {
  if (!pos) return { pos };
  /** @type {Set<string>} */
  const found = new Set();
  let rest = pos.replace(/[（(]([^）)]*)[）)]/g, (m, /** @type {string} */ inner) => {
    const t = TRANS_MARKS[inner.replace(/\s/g, '').toLowerCase()];
    if (!t) return m;
    found.add(t);
    return '';
  });
  rest = rest.trim();
  if (!found.size || !rest.includes('動')) return { pos };
  const trans = found.has('vt/vi') || (found.has('vt') && found.has('vi')) ? 'vt/vi' : [...found][0];
  return { pos: rest, trans };
}

/**
 * 品詞の別名(noun / 名詞 など)を 1 字の略号に揃える。句(動詞句など)や括弧書きはそのまま残す。
 * @param {string} pos
 * @returns {string}
 */
export function normalizePos(pos) {
  return pos.replace(/[^\/・,、]+/g, (tok) => {
    const k = tok.trim().toLowerCase().replace(/\.$/, '');
    return POS_ALIASES[k] ?? tok.trim();
  });
}

/**
 * @param {string} v
 * @returns {v is 'self' | 'ai' | 'set'}
 */
function isExSrc(v) {
  return EX_SRC.includes(v);
}

/**
 * 英語の見出し語として読めるか(英字を含み、かな・漢字・全角文字を含まない)。判定の本体は英語の設定(core/lang.js)の looksTerm。
 * 授業版と同じ名前で残す(授業版からの取り込みで呼び出し側がぶつからないように)。言語を選べる処理は言語の設定の looksTerm を引く。
 * @param {string | undefined} s
 * @returns {boolean}
 */
export function looksEnglish(s) {
  return !!s && LANGS.en.looksTerm(s);
}

/**
 * @param {string} s
 * @returns {string}
 */
function collapse(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * @param {string} format
 * @param {string} message
 * @returns {ParseResult}
 */
function fatal(format, message) {
  return { format, rows: [], warnings: [], fatal: message };
}
