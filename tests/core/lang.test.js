// 言語ごとの設定(core/lang.js。学習ポータル 改善計画 項目37 第3段)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, DEFAULT_LANG, DEFAULT_LANG_ID, langOf, ALL_LANG_FIELDS } from '../../core/lang.js';

/** どの言語にもある語の項目(core/word.js の Word のうち、言語に固有でないもの) */
const COMMON = ['en', 'pos', 'ja', 'ex', 'exJa', 'note', 'kind', 'tags', 'exSrc'];

test('既定の言語は英語で、langOf で同じ設定を引ける', () => {
  assert.equal(DEFAULT_LANG_ID, 'en');
  assert.equal(DEFAULT_LANG, LANGS.en);
  assert.equal(langOf('en'), LANGS.en);
  // 知らない ID・プロトタイプの名前・空は null(既定へ黙って戻さない)
  for (const bad of ['xx', 'toString', '__proto__', '', null, undefined]) assert.equal(langOf(bad), null, String(bad));
});

test('どの言語も、全項目を宣言している(宣言の漏れを消費側で拾わない)', () => {
  for (const [id, l] of Object.entries(LANGS)) {
    assert.equal(l.id, id);
    for (const k of /** @type {const} */ (['name', 'htmlLang', 'dbName'])) assert.ok(l[k], `${id}.${k}`);
    assert.equal(typeof l.looksTerm, 'function', `${id}.looksTerm`);
    assert.ok(l.prompt === null || typeof l.prompt === 'string', `${id}.prompt`);
    assert.ok(l.speech.prefix && l.speech.regions.length && l.speech.addHint, `${id}.speech`);
    for (const r of l.speech.regions) assert.ok(r.startsWith(l.speech.prefix + '-') && r === r.toLowerCase(), `${id}.speech.regions ${r}`);
    for (const k of /** @type {const} */ (['articles', 'selectable', 'typing'])) assert.ok(k in l, `${id}.${k}`);
  }
});

test('簡易形式の列: 先頭が見出し語で、同じ項目が 2 度出ず、どの列も共通の項目かその言語に固有の項目か、取り込みで分ける列(virtual)', () => {
  for (const [id, l] of Object.entries(LANGS)) {
    const fields = l.columns.map((c) => c.field);
    assert.equal(fields[0], 'en', id);
    assert.equal(new Set(fields).size, fields.length, id);
    for (const c of l.columns) assert.ok(COMMON.includes(c.field) || l.fields.includes(c.field) || c.virtual === true, `${id}: ${c.field}`);
    for (const f of l.fields) assert.ok(!COMMON.includes(f), `${id}: 固有の項目 ${f} が共通の項目と重なる`);
  }
});

test('英語の列は授業版の simple/v1 と同じ並び(見出し語 | 品詞 | 意味 | 例文 | 例文の和訳 | 補足)', () => {
  assert.deepEqual(LANGS.en.columns.map((c) => c.label), ['見出し語', '品詞', '意味', '例文', '例文の和訳', '補足']);
  assert.deepEqual(LANGS.en.columns.map((c) => c.field), ['en', 'pos', 'ja', 'ex', 'exJa', 'note']);
});

test('データベース名は言語ごとに違い、授業版(tango-drill)とも違う。英語は第0段の tango-lp のまま', () => {
  const names = Object.values(LANGS).map((l) => l.dbName);
  assert.equal(new Set(names).size, names.length);
  assert.ok(!names.includes('tango-drill'));
  assert.equal(LANGS.en.dbName, 'tango-lp');
});

test('英語の見出し語の判定は授業版の looksEnglish と同じ(英字を含み、かな・漢字・全角を含まない)', () => {
  const t = LANGS.en.looksTerm;
  for (const ok of ['allocate', 'on behalf of', 'résumé', 'Fuß', 'A-1', 'prevent A from -ing']) assert.equal(t(ok), true, ok);
  for (const bad of ['', '請求書', 'secure 守る', '１２３', 'ＡＢＣ', '123', '---', '你好']) assert.equal(t(bad), false, bad);
});

test('中国語(見本)の見出し語の判定: 簡体字を通し、日本語の文(かな)と英字だけの行は通さない', () => {
  const t = LANGS.zh.looksTerm;
  for (const ok of ['你好', '学习', '图书馆']) assert.equal(t(ok), true, ok);
  for (const bad of ['', 'nǐ hǎo', 'こんにちは', '勉強する', 'hello']) assert.equal(t(bad), false, bad);
  // 陽性対照: 英語の判定では簡体字の見出し語を通さない(言語の設定を渡し忘れると中国語は取り込めない)
  assert.equal(LANGS.en.looksTerm('你好'), false);
});

test('画面で開ける言語は英語とドイツ語。中国語は見本だけ', () => {
  assert.deepEqual(Object.values(LANGS).filter((l) => l.selectable).map((l) => l.id), ['en', 'de']);
});

test('ドイツ語の列は「見出し語 | 品詞 | 性 | 変化 | 意味 | 例文 | 例文の和訳 | 補足」(改善計画 項目37「ドイツ語の欄」)', () => {
  assert.deepEqual(LANGS.de.columns.map((c) => c.label), ['見出し語', '品詞', '性', '変化', '意味', '例文', '例文の和訳', '補足']);
  assert.equal(LANGS.de.dbName, 'tango-lp-de');
  // 見出し語の判定: ウムラウトと ß だけの語も通し、日本語は通さない
  for (const ok of ['Fuß', 'Ärger', 'ß', 'sich freuen']) assert.equal(LANGS.de.looksTerm(ok), true, ok);
  for (const bad of ['足', 'Fuß 足', '']) assert.equal(LANGS.de.looksTerm(bad), false, bad);
});

test('ALL_LANG_FIELDS は全言語の固有の項目を重なりなく集める', () => {
  assert.deepEqual([...ALL_LANG_FIELDS].sort(), [...new Set(Object.values(LANGS).flatMap((l) => l.fields))].sort());
  assert.ok(ALL_LANG_FIELDS.includes('trans') && ALL_LANG_FIELDS.includes('reading'));
});
