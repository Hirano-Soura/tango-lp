// 言語の設定(core/lang.js)を引く消費側: 取り込み・確認表・依頼文・読み上げ(学習ポータル 改善計画 項目37 第3段)。
// 1) 英語を明示しても既定(授業版と同じ)と同じ結果になる  2) 中国語の最小見本(簡体字＋ピンイン)が取り込める
// 3) 言語の設定を渡し忘れると中国語は取り込めない(陽性対照)、を確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LANGS } from '../../core/lang.js';
import { parseImport } from '../../core/importFormat.js';
import { planImport, confirmPlan, applyImport } from '../../core/importPlan.js';
import { aiPrompt, requestWords, PROMPTS, AI_PROMPT_VERSION } from '../../core/aiPrompt.js';
import { langVoices, englishVoices, pickVoice, remoteLangCount, remoteEnglishCount } from '../../core/speech.js';

/** @typedef {import('../../core/importFormat.js').ParseResult} ParseResult */
/** @typedef {import('../../core/word.js').Word} Word */

const importDir = new URL('./fixtures/import/', import.meta.url);
/** @param {URL} dir */
const filesIn = (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => new URL(d.name, dir));

/** @param {ParseResult} r */
const words = (r) => r.rows.flatMap((x) => (x.word ? [x.word] : []));

// --- 1) 英語は既定と同じ ------------------------------------------------------------

test('英語を明示した取り込みは、既定(授業版と同じ読み方)とすべての見本で同じ結果になる', () => {
  const files = [...filesIn(importDir), ...filesIn(new URL('broken/', importDir))];
  assert.ok(files.length >= 10, `見本が少ない: ${files.length}`);
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.deepEqual(parseImport(text, LANGS.en), parseImport(text), f.pathname);
  }
});

test('英語を明示した依頼文・依頼する語は既定と同じ(依頼文の全文は aiPrompt.test.js が固定の版と照合する)', () => {
  const ws = ['allocate', 'on behalf of'];
  for (const examples of [true, false]) assert.equal(aiPrompt(ws, { examples, lang: LANGS.en }), aiPrompt(ws, { examples }));
  const pasted = 'allocate\n請求書\n你好\nallocate';
  assert.deepEqual(requestWords(pasted, LANGS.en), requestWords(pasted));
  assert.equal(LANGS.en.prompt, AI_PROMPT_VERSION);
});

// --- 2) 中国語の最小見本 ------------------------------------------------------------

const ZH = [
  '见出し語 | 読み | 品詞 | 意味',
  '你好 | nǐ hǎo | 間 | こんにちは | 你好，老师。 | 先生、こんにちは。',
  '学习 | xuéxí | 動 | 学ぶ',
  '图书馆',
  'これは前置きの文です。',
].join('\n');

test('中国語(見本): 簡体字の見出し語と読み(ピンイン)を、言語の設定の列の並びで取り込む', () => {
  const r = parseImport(ZH, LANGS.zh);
  assert.deepEqual(words(r), [
    { en: '你好', reading: 'nǐ hǎo', pos: '間', ja: 'こんにちは', ex: '你好，老师。', exJa: '先生、こんにちは。' },
    { en: '学习', reading: 'xuéxí', pos: '動', ja: '学ぶ' },
    { en: '图书馆' },
  ]);
  // 見出し行(1 行目。先頭は中国語の字形の「见」でも、「読み」「品詞」「意味」が並ぶ)と、かなを含む前置きの文は語にしない
  assert.equal(r.rows.find((x) => x.ref === 5)?.skipped, '中国語の見出し語ではありません(前置きの文など)');
  assert.equal(r.rows.filter((x) => x.error !== undefined).length, 0);
});

test('中国語(見本)の陽性対照: 言語の設定を渡さない(英語で読む)と、簡体字の行は 1 語も取り込めない', () => {
  assert.deepEqual(words(parseImport(ZH)), []);
});

test('中国語(見本): JSON でも読みを読み、確認表で空欄の読みを埋める', () => {
  const json = (/** @type {object[]} */ ws) => JSON.stringify({ format: 'tango-drill/v1', words: ws });
  const first = parseImport(json([{ en: '学习', pos: '動', ja: '学ぶ' }]), LANGS.zh);
  const book = applyImport([], confirmPlan(planImport([], first))).words;
  assert.deepEqual(book, [{ en: '学习', pos: '動', ja: '学ぶ' }]);
  const again = planImport(book, parseImport(json([{ en: '学习', pos: '動', reading: 'xuéxí' }]), LANGS.zh));
  assert.equal(again.rows[0].action, 'merge');
  assert.deepEqual(again.rows[0].fills, ['reading']);
  assert.deepEqual(applyImport(book, confirmPlan(again)).words, [{ en: '学习', pos: '動', ja: '学ぶ', reading: 'xuéxí' }]);
});

test('言語に固有の項目は、その言語でだけ読む(英語の JSON の reading は未知の項目、中国語の自他は無視)', () => {
  const en = parseImport('{"format":"tango-drill/v1","words":[{"en":"run","pos":"動","reading":"ran"}]}');
  assert.deepEqual(words(en), [{ en: 'run', pos: '動' }]);
  assert.match(en.rows[0].warnings.join(' / '), /未知の項目 reading/);
  // 品詞に添えた自他の印は英語の設定だけが読む。中国語では品詞の括弧書きとして残る(鍵は括弧を落とすので変わらない)
  const zh = parseImport('学习 | xuéxí | 動(他) | 学ぶ', LANGS.zh);
  assert.deepEqual(words(zh), [{ en: '学习', reading: 'xuéxí', pos: '動(他)', ja: '学ぶ' }]);
  const zhTrans = parseImport('{"format":"tango-drill/v1","words":[{"en":"学习","trans":"vt"}]}', LANGS.zh);
  assert.deepEqual(words(zhTrans), [{ en: '学习' }]);
  assert.match(zhTrans.rows[0].warnings.join(' / '), /trans\(自他\)は中国語の語には使わない/);
  // 陽性対照: 同じ品詞の欄を英語で読むと、自他が trans に移る
  assert.deepEqual(words(parseImport('run | 動(他) | 走らせる')), [{ en: 'run', pos: '動', trans: 'vt', ja: '走らせる' }]);
});

test('簡易形式の項目の数の上限は、言語の設定の列の数(英語 6・中国語 7)', () => {
  const line = (/** @type {number} */ n, /** @type {string} */ head) => [head, ...Array.from({ length: n - 1 }, (_, i) => `c${i}`)].join(' | ');
  assert.equal(words(parseImport(line(6, 'run'))).length, 1);
  assert.match(parseImport(line(7, 'run')).rows[0].error ?? '', /7 個。6 個まで/);
  assert.equal(words(parseImport(line(7, '学习'), LANGS.zh)).length, 1);
  assert.match(parseImport(line(8, '学习'), LANGS.zh).rows[0].error ?? '', /8 個。7 個まで/);
});

test('JSON の見出し語は en の別名 term でも読む。両方あって食い違えば en を使い、知らせる', () => {
  const r = parseImport('{"format":"tango-drill/v1","words":[{"term":"allocate","pos":"動"},{"en":"run","term":"walk"},{"term":3}]}');
  assert.deepEqual(words(r), [{ en: 'allocate', pos: '動' }, { en: 'run' }]);
  assert.deepEqual(r.rows[0].warnings, []);
  assert.match(r.rows[1].warnings.join(' / '), /en と term の両方にあり食い違う/);
  assert.equal(r.rows[2].error, '見出し語(en)がありません');
});

// --- 依頼文 ---------------------------------------------------------------------

test('依頼文: 言語の設定が指す版の作り手で作る。依頼文を持たない言語(中国語の見本)は空', () => {
  for (const l of Object.values(LANGS)) {
    if (l.prompt !== null) assert.ok(PROMPTS[l.prompt], `${l.id} の依頼文 ${l.prompt} の作り手が無い`);
  }
  assert.equal(aiPrompt(['你好'], { lang: LANGS.zh }), '');
  assert.notEqual(aiPrompt(['allocate'], { lang: LANGS.en }), '');
  // 依頼する語の判定も言語の設定に従う
  assert.deepEqual(requestWords('你好\nhello\n你好', LANGS.zh), { words: ['你好'], ignored: ['hello'] });
});

// --- 読み上げ -------------------------------------------------------------------

/**
 * @param {string} name
 * @param {string} lang
 * @param {boolean} localService
 */
const v = (name, lang, localService) => ({ name, lang, localService, voiceURI: `uri:${name}` });
const VOICES = [
  v('Zira', 'en-US', true),
  v('Yaoyao Online', 'zh-CN', false),
  v('Hanhan', 'zh_TW', true),
  v('Huihui', 'zh-CN', true),
  v('Haruka', 'ja-JP', true),
];

test('読み上げ: 言語の設定の声(言語タグの頭と地域の順)から、端末内の声だけを選ぶ', () => {
  assert.deepEqual(langVoices(VOICES, LANGS.zh).map((x) => x.name), ['Huihui', 'Hanhan']);
  assert.equal(pickVoice(VOICES, '', LANGS.zh)?.name, 'Huihui');
  assert.equal(pickVoice(VOICES, 'uri:Hanhan', LANGS.zh)?.name, 'Hanhan');
  // 英語の声を選んであっても、中国語では使わない
  assert.equal(pickVoice(VOICES, 'uri:Zira', LANGS.zh)?.name, 'Huihui');
  assert.equal(remoteLangCount(VOICES, LANGS.zh), 1);
  // 英語を明示しても既定と同じ。陽性対照: 既定(英語)では中国語の声を選ばない
  assert.deepEqual(langVoices(VOICES, LANGS.en), englishVoices(VOICES));
  assert.deepEqual(langVoices(VOICES).map((x) => x.name), ['Zira']);
  assert.equal(remoteLangCount(VOICES, LANGS.en), remoteEnglishCount(VOICES));
});
