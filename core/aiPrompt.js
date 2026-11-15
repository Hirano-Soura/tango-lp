// AI(ChatGPT・Claude・Gemini など)に単語カードを作ってもらう依頼文。ブラウザの API に触れない(INV-6)。
// 返答は利用者が追加タブの「まとめて取り込む」に貼り、確認表を経て入れる(INV-2)。送信はしない(INV-1)。
// 依頼文は簡易形式 simple/v1(Docs/20_ImportFormat.md §3)で答えさせる。規則は Docs/20_ImportFormat.md §6。

import { DEFAULT_LANG, LANGS } from './lang.js';

/** @typedef {import('./word.js').Word} Word */
/** @typedef {import('./lang.js').LangSpec} LangSpec */

/**
 * 英語の依頼文の版(言語の設定 core/lang.js の prompt が指す)。依頼文を変えたら上げる。版ごとの全文は tests/core/fixtures/ai/prompt_<版>*.txt に固定してあり、
 * 版を上げずに文面を変えるとテスト(tests/core/aiPrompt.test.js)が落ちる。
 * 返答の見本(tests/core/fixtures/ai/replies.json)はどの版への返答かを持つ。上げたら見本を新しい版で採り直す
 * (今の版への本物の見本の無い提供元はテストが todo にする。古い版の見本は、貼られうる入力として残す)。
 */
export const AI_PROMPT_VERSION = 'v2';

/**
 * 依頼文の版ごとの作り手。言語の設定の prompt がこの鍵を指す(消費側は言語の ID を見ない。LC-2)。
 * 過去の版の作り手は残さない(返答の見本だけを貼られうる入力として残す)。
 * @type {Readonly<Record<string, (words: readonly string[], examples: boolean) => string>>}
 */
export const PROMPTS = Object.freeze({ [AI_PROMPT_VERSION]: promptV2, 'de/v1': promptDeV1 });

/**
 * @typedef {object} AiPromptOptions
 * @property {boolean} [examples] 例文と和訳も作ってもらう(既定: true)
 * @property {LangSpec} [lang] 語の言語(既定: 英語)。言語の設定の prompt の版で作る
 */

/**
 * 依頼する語の一覧を、貼られた文から取り出す。1 行 1 語。空行・重複と、その言語の見出し語として読めない行
 * (見出し語と同じ判定。言語の設定の looksTerm。英語は英字を含み、かな・漢字・全角文字を含まない)は除く。
 * @param {string} text
 * @param {LangSpec} [lang] 既定は英語
 * @returns {{ words: string[], ignored: string[] }}
 */
export function requestWords(text, lang = DEFAULT_LANG) {
  /** @type {string[]} */
  const words = [];
  /** @type {string[]} */
  const ignored = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const w = line.replace(/\s+/g, ' ').trim();
    if (!w) continue;
    if (!lang.looksTerm(w)) ignored.push(w);
    else if (!words.includes(w)) words.push(w);
  }
  return { words, ignored };
}

/**
 * 依頼文を作る。語が無いか、言語が依頼文を持たない(言語の設定の prompt が null)なら空文字。
 * @param {readonly string[]} words
 * @param {AiPromptOptions} [opts]
 * @returns {string}
 */
export function aiPrompt(words, opts = {}) {
  const make = PROMPTS[(opts.lang ?? DEFAULT_LANG).prompt ?? ''];
  if (!words.length || !make) return '';
  return make(words, opts.examples ?? true);
}

/**
 * 英語の依頼文 v2(授業版と同じ全文。tests/core/fixtures/ai/prompt_v2*.txt)。
 * @param {readonly string[]} words
 * @param {boolean} examples
 * @returns {string}
 */
function promptV2(words, examples) {
  const cols = examples ? '見出し語 | 品詞 | 意味 | 例文 | 例文の和訳 | 補足' : '見出し語 | 品詞 | 意味 | | | 補足';
  const lines = [
    '次の英単語・英語表現について、TOEIC の学習用に単語カードを作ってください。',
    '',
    '【答え方】',
    '- 全体を 1 つのコードブロック(```)に入れてください。コードブロックの外には何も書かないでください。',
    `- 1 行に 1 語。各行は「${cols}」の順に、半角の縦棒「|」で区切ってください。`,
    '- 見出し行・表の区切り線・番号は付けないでください。項目の中には「|」を使わないでください。',
    '- 見出し語: 一覧のとおりの綴りで書いてください。',
    '- 品詞: 名・動・形・副・前・接 のどれか。複数なら「名/動」のように書きます。2 語以上の表現は「動詞句」「前置詞句」などと書きます。',
    `- ${TRANS_RULE}複数の品詞を持つ語は「名/動(他)」のように最後に添えます。「動詞句」などの 2 語以上の表現には添えません。`,
    '- 意味: 日本語で短く。意味が複数あれば「、」で区切ります。',
    '  品詞が複数ある語と、自他で意味が変わる動詞は、「(名)見積もり ／ (動)見積もる」「(他)取り戻す ／ (自)回復する」のように「 ／ 」で分け、それぞれの頭に品詞か自他を半角かっこで付けます。',
  ];
  if (examples) {
    lines.push(
      '- 例文: TOEIC に出そうな短い英文を 1 つ。',
      '- 例文の和訳: 例文の日本語訳。',
    );
  } else {
    lines.push('- 例文と例文の和訳は空欄にしてください(区切りの「|」は残します)。');
  }
  lines.push(
    '- 補足: よく使う形・類義語など。自動詞は、続ける前置詞(dispose of など)も書きます。無ければ空欄にしてください。',
    '',
    '【語の一覧】',
    ...words,
  );
  return lines.join('\n');
}

/**
 * ドイツ語の依頼文 de/v1(新LP版。学習ポータル 改善計画 項目37「AI への依頼文(ドイツ語)」が草案。全文は tests/core/fixtures/ai/prompt_de_v1*.txt)。
 * 列の並びはドイツ語の設定の columns から作る(取り込みの列と食い違わないように)。
 * @param {readonly string[]} words
 * @param {boolean} examples
 * @returns {string}
 */
function promptDeV1(words, examples) {
  const labels = LANGS.de.columns.map((c) => (!examples && (c.field === 'ex' || c.field === 'exJa') ? '' : c.label));
  // 空欄にさせる列は名前を書かず、区切りだけを残す(英語の v2 の「見出し語 | 品詞 | 意味 | | | 補足」と同じ書き方)
  const cols = labels.join(' | ').replace(/ {2,}/g, ' ');
  const lines = [
    '次のドイツ語の単語・表現について、ドイツ語学習(初級〜中級)用の単語カードを作ってください。',
    '',
    '【答え方】',
    '- 全体を 1 つのコードブロック(```)に入れてください。コードブロックの外には何も書かないでください。',
    `- 1 行に 1 語。各行は「${cols}」の順に、半角の縦棒「|」で区切ってください。`,
    '- 見出し行・表の区切り線・番号は付けないでください。項目の中には「|」を使わないでください。',
    '- ä ö ü ß はそのまま書いてください(ae・oe・ue・ss に置き換えないでください)。',
    '- 見出し語: 一覧のとおりの綴りで書いてください。名詞に冠詞は付けません(冠詞は「性」に書きます)。再帰動詞は「sich freuen」のように sich を付けます。',
    '- 品詞: 名・動・形・副・前・接・代・間 のどれか。複数なら「形/副」のように書きます。2 語以上の表現は「動詞句」「前置詞句」などと書きます。',
    '- 動詞は、品詞の後ろに目的語の格を半角かっこで添えてください。4格の目的語をとるなら「動(4格)」、3格なら「動(3格)」、両方なら「動(3格4格)」、目的語をとらないなら「動(自)」です。',
    '- 性: 名詞だけ書きます。der・die・das のどれか。複数形でしか使わない名詞は「pl」。名詞以外は空欄にしてください。',
    '- 変化:',
    '  - 名詞は、冠詞なしの複数形(例: Hunde)。複数形が無ければ「-」。',
    '  - 動詞は「3人称単数現在, 過去基本形, 完了の助動詞 過去分詞」(例: fährt, fuhr, ist gefahren)。分離動詞は分かれた形で書きます(例: kommt an, kam an, ist angekommen)。',
    '  - 形容詞は「比較級, 最上級」(例: größer, am größten)。比較しない語は空欄。',
    '  - それ以外の品詞は空欄。',
    '- 意味: 日本語で短く。意味が複数あれば「、」で区切ります。品詞が複数ある語は「(形)速い ／ (副)速く」のように「 ／ 」で分け、それぞれの頭に品詞を半角かっこで付けます。',
  ];
  if (examples) {
    lines.push('- 例文: 初級〜中級の短いドイツ語の文を 1 つ。', '- 例文の和訳: 例文の日本語訳。');
  } else {
    lines.push('- 例文と例文の和訳は空欄にしてください(区切りの「|」は残します)。');
  }
  lines.push(
    '- 補足: 前置詞との結び付き(auf + 4格 warten など)、男性弱変化名詞の 2 格(des Studenten など)、よく使う形。無ければ空欄にしてください。',
    '',
    '【語の一覧】',
    ...words,
  );
  return lines.join('\n');
}

/** 品詞に自他を添える書き方(依頼文 v2 と自他を補う依頼文で同じ文を使う。読み手は importFormat.js の splitTransMark) */
const TRANS_RULE = '動詞は、品詞の後ろに自他を半角かっこで添えてください。他動詞(目的語を直接とる)は「動(他)」、自動詞(目的語を直接とらない)は「動(自)」、どちらにも使うなら「動(自他)」です。';

/**
 * 単語帳にある動詞のうち、自他の無い語に自他を補ってもらう依頼文(既存の語への遡及。Docs/20_ImportFormat.md §6)。
 * 見出し語と品詞をそのまま書き写させ、品詞の後ろに自他だけを添えさせる。返答は「見出し語 | 品詞(自他)」の
 * 2 列の簡易形式になり、確認表では既存の語に当たって自他の空欄だけを埋める(merge。INV-2)。語が無ければ空文字。
 * 版は依頼文と同じ AI_PROMPT_VERSION で固定する(tests/core/fixtures/ai/trans_<版>.txt)。
 * @param {readonly Pick<Word, 'en' | 'pos'>[]} words
 * @returns {string}
 */
export function transPrompt(words) {
  if (!words.length) return '';
  return [
    '次の英語の動詞について、他動詞か自動詞かを教えてください。TOEIC の学習用の単語カードに書き足します。',
    '',
    '【答え方】',
    '- 全体を 1 つのコードブロック(```)に入れてください。コードブロックの外には何も書かないでください。',
    '- 1 行に 1 語。各行は「見出し語 | 品詞」の順に、半角の縦棒「|」で区切ってください。',
    '- 見出し行・表の区切り線・番号は付けないでください。',
    '- 見出し語と品詞は、一覧のとおりに書き写してください(品詞を変えないでください)。',
    `- ${TRANS_RULE}「名/動」のように品詞が複数なら「名/動(他)」のように最後に添えます。`,
    '',
    '【語の一覧】',
    ...words.map((w) => `${w.en} | ${w.pos ?? ''}`),
  ].join('\n');
}
