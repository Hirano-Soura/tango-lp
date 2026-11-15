// ドイツ語のデータ: 性・格支配・変化・語の鍵・依頼文 de/v1(学習ポータル 改善計画 項目37 第4a段)。
// 規則は core/inflection.js と Docs/26_Languages.md §4。英語の挙動が変わらないことは langLayer.test.js と授業版から引き継いだ検査が見る。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS } from '../../core/lang.js';
import { parseImport } from '../../core/importFormat.js';
import { planImport, confirmPlan, applyImport } from '../../core/importPlan.js';
import { aiPrompt, requestWords } from '../../core/aiPrompt.js';
import { keyOf } from '../../core/word.js';
import { formsText, headword, readForms, splitArticle, splitCaseMark, readGender } from '../../core/inflection.js';

/** @typedef {import('../../core/importFormat.js').ParseResult} ParseResult */
/** @typedef {import('../../core/word.js').Word} Word */

const DE = LANGS.de;
/** @param {ParseResult} r */
const words = (r) => r.rows.flatMap((x) => (x.word ? [x.word] : []));
/** @param {string} text */
const de = (text) => parseImport(text, DE);

// --- 性と語の鍵 ------------------------------------------------------------------

test('der See と die See は別の語として入る(性は語の鍵に入る)', () => {
  const plan = planImport([], de('See | 名 | der | Seen | 湖\nSee | 名 | die | - | 海'));
  assert.deepEqual(plan.rows.map((r) => r.action), ['add', 'add']);
  const book = applyImport([], confirmPlan(plan)).words;
  assert.deepEqual(book.map(keyOf), ['See|名|m', 'See|名|f']);
  assert.deepEqual(book.map((w) => [w.ja, w.plural]), [['湖', 'Seen'], ['海', '-']]);
});

test('陽性対照: 性を書かなければ、2 つの See は同じ語として重なる', () => {
  const plan = planImport([], de('See | 名 | | Seen | 湖\nSee | 名 | | - | 海'));
  assert.deepEqual(plan.rows.map((r) => r.action), ['add', 'duplicate']);
});

test('性の無い語(英語のすべての語)の鍵は授業版と同じ「見出し語|品詞」', () => {
  assert.equal(keyOf({ en: 'run', pos: '動(他)' }), 'run|動');
  assert.equal(keyOf({ en: 'Hund', pos: '名', gender: 'n' }), 'Hund|名|n');
});

test('性の書き方: der/die/das・m./f./n.・男/女/中・pl を読み、読めない値は捨てて知らせる', () => {
  for (const [s, g] of /** @type {const} */ ([['der', 'm'], ['DIE', 'f'], ['das', 'n'], ['m.', 'm'], ['f', 'f'], ['中', 'n'], ['女性', 'f'], ['pl', 'pl'], ['複数', 'pl']])) {
    assert.equal(readGender(s), g, s);
  }
  const r = de('Hund | 名 | x | Hunde | 犬');
  assert.deepEqual(words(r), [{ en: 'Hund', pos: '名', plural: 'Hunde', ja: '犬' }]);
  assert.match(r.rows[0].warnings.join(' / '), /性の値 x は使えない/);
});

test('見出し語の頭の冠詞は性へ移す。句(das heißt)と小文字で始まる語は冠詞と読まない', () => {
  assert.deepEqual(words(de('der Hund | 名 | | Hunde | 犬\ndie Eltern | 名 | pl | - | 両親')), [
    { en: 'Hund', pos: '名', gender: 'm', plural: 'Hunde', ja: '犬' },
    { en: 'Eltern', pos: '名', gender: 'pl', plural: '-', ja: '両親' },
  ]);
  assert.deepEqual(splitArticle('das heißt', DE.articles ?? {}), { term: 'das heißt' });
  assert.deepEqual(splitArticle('die Deutsche Bahn', DE.articles ?? {}), { term: 'die Deutsche Bahn' });
  // 冠詞と性の欄が食い違えば、性の欄を使って知らせる
  const r = de('das Haus | 名 | der | Häuser | 家');
  assert.equal(words(r)[0].gender, 'm');
  assert.match(r.rows[0].warnings.join(' / '), /冠詞と性\(m\)が食い違う/);
  // 陽性対照: 英語では冠詞を性へ移さない(英語は性を持たない)
  assert.deepEqual(words(parseImport('the Hague | 名 | ハーグ')), [{ en: 'the Hague', pos: '名', ja: 'ハーグ' }]);
});

test('ウムラウトと ß を含む語がそのまま入り、ae・ss に化けない', () => {
  const r = de('Fuß | 名 | der | Füße | 足 | Mein Fuß tut weh. | 足が痛い。\nMädchen | 名 | das | - | 少女\nüben | 動(4格) | | übt, übte, hat geübt | 練習する');
  assert.deepEqual(words(r).map((w) => [w.en, w.plural ?? w.pp ?? '']), [['Fuß', 'Füße'], ['Mädchen', '-'], ['üben', 'geübt']]);
  assert.ok(!JSON.stringify(words(r)).match(/Fuss|Maedchen|ueben|Fuesse/));
  // 依頼する語の判定も ä ö ü ß を通す
  assert.deepEqual(requestWords('Fuß\nÄrger\n足', DE), { words: ['Fuß', 'Ärger'], ignored: ['足'] });
});

// --- 変化と格支配 ----------------------------------------------------------------

test('変化の欄から、複数形・三基本形と完了の助動詞・比較級と最上級を読む', () => {
  const r = de([
    'Hund | 名 | der | Hunde | 犬',
    'fahren | 動(自) | | fährt, fuhr, ist gefahren | 行く',
    'ankommen | 動(自) | | kommt an, kam an, ist angekommen | 到着する',
    'sich freuen | 動(自) | | freut sich, freute sich, hat sich gefreut | 喜ぶ',
    'schwimmen | 動(自) | | schwimmt, schwamm, ist/hat geschwommen | 泳ぐ',
    'groß | 形 | | größer, am größten | 大きい',
  ].join('\n'));
  assert.deepEqual(words(r).map((w) => ({ en: w.en, plural: w.plural, pres3: w.pres3, past: w.past, aux: w.aux, pp: w.pp, comp: w.comp, sup: w.sup })), [
    { en: 'Hund', plural: 'Hunde', pres3: undefined, past: undefined, aux: undefined, pp: undefined, comp: undefined, sup: undefined },
    { en: 'fahren', plural: undefined, pres3: 'fährt', past: 'fuhr', aux: 'sein', pp: 'gefahren', comp: undefined, sup: undefined },
    { en: 'ankommen', plural: undefined, pres3: 'kommt an', past: 'kam an', aux: 'sein', pp: 'angekommen', comp: undefined, sup: undefined },
    { en: 'sich freuen', plural: undefined, pres3: 'freut sich', past: 'freute sich', aux: 'haben', pp: 'sich gefreut', comp: undefined, sup: undefined },
    { en: 'schwimmen', plural: undefined, pres3: 'schwimmt', past: 'schwamm', aux: 'haben/sein', pp: 'geschwommen', comp: undefined, sup: undefined },
    { en: 'groß', plural: undefined, pres3: undefined, past: undefined, aux: undefined, pp: undefined, comp: 'größer', sup: 'am größten' },
  ]);
  assert.equal(r.rows.flatMap((x) => x.warnings).length, 0);
});

test('変化の表示は簡易形式の書き方に戻る(読んで書き戻しても同じ)', () => {
  for (const [pos, forms] of [['名', 'Hunde'], ['動', 'fährt, fuhr, ist gefahren'], ['動', 'kommt an, kam an, ist angekommen'], ['形', 'größer, am größten'], ['動', 'schwimmt, schwamm, hat/ist geschwommen']]) {
    const w = words(de(`x | ${pos} | | ${forms} | 意味`))[0];
    assert.equal(formsText(w), forms, forms);
  }
  assert.equal(formsText({ en: 'run' }), '');
  assert.equal(headword({ en: 'Hund', gender: 'm' }), 'der Hund');
  assert.equal(headword({ en: 'Eltern', gender: 'pl' }), 'die Eltern');
  assert.equal(headword({ en: 'run' }), 'run');
});

test('形の読めない変化・名詞でない語の 1 語だけの変化は捨てて知らせる', () => {
  assert.match(readForms('fährt, fuhr', { noun: false }).warning ?? '', /形が読めない/);
  assert.match(readForms('Hunde', { noun: false }).warning ?? '', /形が読めない/);
  assert.deepEqual(readForms('Hunde', { noun: true }).fields, { plural: 'Hunde' });
  const r = de('schnell | 形 | | schneller | 速い');
  assert.deepEqual(words(r), [{ en: 'schnell', pos: '形', ja: '速い' }]);
  assert.equal(r.rows[0].warnings.length, 1);
});

test('品詞の括弧の格支配を case へ移す(動詞だけ)。英語の設定では読まない(陽性対照)', () => {
  assert.deepEqual(splitCaseMark('動(4格)'), { pos: '動', case: '4格' });
  assert.deepEqual(splitCaseMark('動(3格・4格)'), { pos: '動', case: '3格4格' });
  assert.deepEqual(splitCaseMark('動(Akk)'), { pos: '動', case: '4格' });
  assert.deepEqual(splitCaseMark('名(4格)'), { pos: '名(4格)' });
  const w = words(de('helfen | 動(3格) | | hilft, half, hat geholfen | 助ける'))[0];
  assert.equal(w.pos, '動');
  assert.equal(w.case, '3格');
  assert.equal(keyOf(w), 'helfen|動');
  assert.deepEqual(words(parseImport('helfen | 動(3格) | 助ける')), [{ en: 'helfen', pos: '動(3格)', ja: '助ける' }]);
  // ドイツ語は自他(trans)を持たないので、「動(他)」は品詞の括弧書きとして残る
  assert.deepEqual(words(de('lesen | 動(他) | | liest, las, hat gelesen | 読む')).map((x) => [x.pos, x.trans]), [['動(他)', undefined]]);
});

test('JSON: 性・変化(forms)・格支配を読み、見出し語の別名 term も読む', () => {
  const r = de(JSON.stringify({ format: 'tango-drill/v1', words: [
    { term: 'Hund', pos: '名', gender: 'der', forms: 'Hunde', ja: '犬' },
    { en: 'fahren', pos: '動', case: 'akk', pres3: 'fährt', past: 'fuhr', aux: 'ist', pp: 'gefahren' },
  ] }));
  assert.deepEqual(words(r), [
    { en: 'Hund', pos: '名', gender: 'm', plural: 'Hunde', ja: '犬' },
    { en: 'fahren', pos: '動', case: '4格', pres3: 'fährt', past: 'fuhr', aux: 'sein', pp: 'gefahren' },
  ]);
});

test('確認表: 同じ語(性まで同じ)の空いた変化だけを埋める', () => {
  const book = applyImport([], confirmPlan(planImport([], de('Hund | 名 | der | | 犬')))).words;
  const again = planImport(book, de('Hund | 名 | der | Hunde |'));
  assert.equal(again.rows[0].action, 'merge');
  assert.deepEqual(again.rows[0].fills, ['plural']);
  assert.deepEqual(applyImport(book, confirmPlan(again)).words, [{ en: 'Hund', pos: '名', gender: 'm', ja: '犬', plural: 'Hunde' }]);
});

// --- 依頼文 de/v1 -----------------------------------------------------------------

const PINNED = ['Hund', 'See', 'fahren', 'ankommen', 'sich freuen', 'groß', 'Eltern', 'warten'];
/** @param {string} f */
const fixture = (f) => readFileSync(new URL('./fixtures/ai/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');

test('依頼文 de/v1 の文面は固定してある(文面を変えたら版を上げ、新しい版の全文を足す)', () => {
  assert.equal(DE.prompt, 'de/v1');
  assert.equal(aiPrompt(PINNED, { lang: DE }), fixture('prompt_de_v1.txt'));
  assert.equal(aiPrompt(PINNED, { lang: DE, examples: false }), fixture('prompt_de_v1_noex.txt'));
});

test('依頼文 de/v1 の列の並びは、ドイツ語の取り込みの列と同じ(見出し行として読み飛ばされる)', () => {
  for (const examples of [true, false]) {
    const cols = /** @type {RegExpExecArray} */ (/「(見出し語 \|[^」]*)」/.exec(aiPrompt(['x'], { lang: DE, examples })))[1];
    assert.equal(cols.split('|').length, DE.columns.length);
    assert.equal(de(cols).rows[0].skipped, '見出し行');
  }
});
