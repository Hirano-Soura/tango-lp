// 言語ごとの設定(新LP版の多言語化の層。学習ポータル 改善計画 項目37 第3段)。ブラウザの API に触れない(INV-6)。
// 各言語は下の LANGS に「何をどう扱うか」を宣言する。消費側(取り込み・依頼文・読み上げ・画面)は
// 渡された設定の項目を引くだけにし、言語の ID を見て分岐しない(LC-2)。言語を足すときは、ここに 1 つ足す。
// 英語の宣言は授業版(tango-drill)の挙動と同じにする(UPSTREAM.md の取り込みの規則)。
// ドイツ語は第4a段(データ)・第4b段(画面)で足した。中国語は実装しない。宣言の形が英語専用になっていないことを確かめるための最小の見本。

/** ラテン文字(ウムラウトと ß を含む) */
const LATIN = /[A-Za-zÄÖÜäöüß]/;
/** かな(ひらがな・カタカナ) */
const KANA = /[぀-ヿ]/;
/** かな・漢字・全角記号(英語の見出し語に入らない文字) */
const JAPANESE = /[　-ヿ㐀-鿿豈-﫿＀-￯]/;
/** 漢字(CJK 統合漢字と拡張 A) */
const HAN = /[㐀-鿿]/;

/**
 * 簡易形式の 1 列。field は語の項目名(core/word.js の Word)。
 * virtual の列は語の項目ではなく、取り込みで内部の項目へ分ける(ドイツ語の「変化」→ plural など。core/inflection.js の readForms)。
 * @typedef {object} Column
 * @property {string} field
 * @property {string} label 依頼文・取り込みの説明に出す名前
 * @property {boolean} [virtual]
 */

/**
 * 1 言語の設定。
 * @typedef {object} LangSpec
 * @property {string} id 言語の ID(URL・バックアップに入れる値。BCP 47 の主言語)
 * @property {string} name 画面に出す名前(「見出し語(英語)」「英語の音声」)
 * @property {string} htmlLang 見出し語・例文の要素に付ける lang 属性(字形と読み上げのため)
 * @property {(s: string) => boolean} looksTerm その言語の見出し語として読めるか(前置きの文や日本語の行を見分ける)
 * @property {readonly Column[]} columns 簡易形式の列の並び。先頭は見出し語(en)
 * @property {readonly string[]} fields 言語に固有の語の項目(共通の en pos ja ex exJa note kind tags exSrc の外)
 * @property {string | null} prompt AI への依頼文の版(core/aiPrompt.js の PROMPTS の鍵)。依頼文を持たないなら null
 * @property {{ prefix: string, regions: readonly string[], addHint: string }} speech
 *   読み上げの声。prefix は使う声の言語タグの頭、regions は選ぶ順(小文字。ここに無い地域はこの後ろ)、
 *   addHint は端末に声を足すときの案内に出す名前
 * @property {string} dbName 端末内の保存先(IndexedDB)のデータベース名(app/storage.js)
 * @property {Readonly<Record<string, string>> | null} articles 見出し語の頭に書かれたら性へ移す冠詞(冠詞 → 性)。無ければ null
 * @property {boolean} selectable 画面で開ける言語か(URL の ?lang=。見本だけの言語は false)
 * @property {{ replace: Readonly<Record<string, string>>, buttons: readonly string[] } | null} typing
 *   入力の補助。replace は打った文字列の置き換え(「a:」→「ä」)、buttons は入力欄の下に出す文字のボタン。無ければ null
 * @property {string} example 取り込み欄に灰色で見せ、「例を入れる」で入れる簡易形式の例(どの行も注意なく語として読める。tests/core/lang.test.js)
 */

/** 英語の簡易形式の列(授業版の simple/v1 と同じ並び) */
const EN_COLUMNS = Object.freeze([
  { field: 'en', label: '見出し語' },
  { field: 'pos', label: '品詞' },
  { field: 'ja', label: '意味' },
  { field: 'ex', label: '例文' },
  { field: 'exJa', label: '例文の和訳' },
  { field: 'note', label: '補足' },
]);

/** @type {Readonly<Record<string, Readonly<LangSpec>>>} */
export const LANGS = Object.freeze({
  en: Object.freeze({
    id: 'en',
    name: '英語',
    htmlLang: 'en',
    // 英字を含み、かな・漢字・全角文字を含まない(授業版の looksEnglish と同じ)
    looksTerm: (/** @type {string} */ s) => !!s && /[A-Za-z]/.test(s) && !JAPANESE.test(s),
    columns: EN_COLUMNS,
    fields: Object.freeze(['trans']),
    prompt: 'v2',
    // TOEIC の音声に合わせて米国を先にする(授業版の REGIONS)
    speech: Object.freeze({
      prefix: 'en',
      regions: Object.freeze(['en-us', 'en-gb', 'en-ca', 'en-au', 'en-nz', 'en-ie']),
      addHint: '英語(米国)',
    }),
    dbName: 'tango-lp',
    articles: null,
    selectable: true,
    typing: null,
    // 授業版の SIMPLE_EXAMPLE と同じ(core/importFormat.js はこれを SIMPLE_EXAMPLE として出す)
    example: [
      'allocate | 動(他) | 割り当てる | The manager allocated the budget. | 部長が予算を割り当てた。 | allocate A to B',
      'reimburse | 動(他) | 払い戻す',
      'itinerary | 名 | 旅程',
    ].join('\n'),
  }),
  de: Object.freeze({
    id: 'de',
    name: 'ドイツ語',
    htmlLang: 'de',
    // ラテン文字(ä ö ü ß を含む)を含み、かな・漢字・全角文字を含まない
    looksTerm: (/** @type {string} */ s) => !!s && LATIN.test(s) && !JAPANESE.test(s),
    // 文法の情報は「性」と「変化」の 2 列に畳む(列が 8 を超えると AI が列をずらしやすい。改善計画 項目37「ドイツ語の欄」)
    columns: Object.freeze([
      { field: 'en', label: '見出し語' },
      { field: 'pos', label: '品詞' },
      { field: 'gender', label: '性' },
      { field: 'forms', label: '変化', virtual: true },
      { field: 'ja', label: '意味' },
      { field: 'ex', label: '例文' },
      { field: 'exJa', label: '例文の和訳' },
      { field: 'note', label: '補足' },
    ]),
    fields: Object.freeze(['gender', 'case', 'plural', 'pres3', 'past', 'aux', 'pp', 'comp', 'sup']),
    prompt: 'de/v1',
    speech: Object.freeze({ prefix: 'de', regions: Object.freeze(['de-de', 'de-at', 'de-ch']), addHint: 'ドイツ語(ドイツ)' }),
    dbName: 'tango-lp-de',
    articles: Object.freeze({ der: 'm', die: 'f', das: 'n' }),
    selectable: true,
    // german-drill と同じ記法(a: o: u: → ä ö ü)
    typing: Object.freeze({
      replace: Object.freeze({ 'a:': 'ä', 'o:': 'ö', 'u:': 'ü', 'A:': 'Ä', 'O:': 'Ö', 'U:': 'Ü' }),
      buttons: Object.freeze(['ä', 'ö', 'ü', 'ß']),
    }),
    example: [
      'fahren | 動(自) | | fährt, fuhr, ist gefahren | (乗り物で)行く | Wir fahren nach Berlin. | 私たちはベルリンへ行く。 | 4格をとると「運転する」',
      'Hund | 名 | der | Hunde | 犬',
      'groß | 形 | | größer, am größten | 大きい',
    ].join('\n'),
  }),
  zh: Object.freeze({
    id: 'zh',
    name: '中国語',
    htmlLang: 'zh-CN',
    // 漢字を含み、かなを含まない(簡体字の見出し語。日本語の文はかなで見分ける)
    looksTerm: (/** @type {string} */ s) => !!s && HAN.test(s) && !KANA.test(s),
    columns: Object.freeze([
      { field: 'en', label: '見出し語' },
      { field: 'reading', label: '読み' },
      { field: 'pos', label: '品詞' },
      { field: 'ja', label: '意味' },
      { field: 'ex', label: '例文' },
      { field: 'exJa', label: '例文の和訳' },
      { field: 'note', label: '補足' },
    ]),
    fields: Object.freeze(['reading']),
    prompt: null,
    speech: Object.freeze({ prefix: 'zh', regions: Object.freeze(['zh-cn']), addHint: '中国語(簡体字、中国)' }),
    dbName: 'tango-lp-zh',
    articles: null,
    selectable: false,
    typing: null,
    example: '你好 | nǐ hǎo | 間 | こんにちは',
  }),
});

/** 何も指定しないときの言語。授業版と同じ挙動になる */
export const DEFAULT_LANG_ID = 'en';

/** 何も指定しないときの言語の設定 */
export const DEFAULT_LANG = LANGS[DEFAULT_LANG_ID];

/**
 * ID から言語の設定を引く。知らない ID は null(呼ぶ側が既定に戻すか、知らせるかを決める)。
 * @param {string | null | undefined} id
 * @returns {Readonly<LangSpec> | null}
 */
export function langOf(id) {
  return typeof id === 'string' && Object.hasOwn(LANGS, id) ? LANGS[id] : null;
}

/**
 * 言語に固有の項目を、全言語について集めたもの(確認表で空欄を埋める項目の一覧などに使う)。
 * 英語の語はこれらのうち trans しか持たないので、英語の挙動は変わらない。
 * @type {readonly string[]}
 */
export const ALL_LANG_FIELDS = Object.freeze([...new Set(Object.values(LANGS).flatMap((l) => l.fields))]);
