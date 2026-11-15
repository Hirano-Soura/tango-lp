// 言語ごとの単語帳(学習ポータル 改善計画 項目37 第4b段): 言語の選び方・言語ごとの保存先・バックアップの言語・
// 1 語の追加と編集・言語ごとのお知らせ。IndexedDB は fake-indexeddb で代える。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openStorage } from '../../app/storage.js';
import { pickLang, LANG } from '../../app/lang.js';
import { LANGS, DEFAULT_LANG } from '../../core/lang.js';
import { toBackup, backupText, parseBackup } from '../../core/backup.js';
import { emptyBook, addOneWord, editWord } from '../../core/book.js';
import { NOTICES, noticesFor } from '../../core/notices.js';

/** @typedef {import('../../core/book.js').Book} Book */

const TODAY = '2026-11-15';
const NOW = '2026-11-15T09:00:00.000Z';
const DE = LANGS.de;

/** @returns {Book} */
const germanBook = () => {
  const r = addOneWord(emptyBook(), { en: 'Hund', pos: '名', gender: 'm', forms: 'Hunde', ja: '犬' }, TODAY, DE);
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.book;
};

// --- 言語の選び方 -----------------------------------------------------------------

test('?lang= で言語を選ぶ。無い・知らない・見本だけの言語は英語', () => {
  assert.equal(pickLang('?lang=de'), DE);
  assert.equal(pickLang('?lang=en'), LANGS.en);
  for (const s of ['', '?lang=', '?lang=xx', '?lang=zh', '?lang=DE', '?foo=de']) assert.equal(pickLang(s), DEFAULT_LANG, s);
  // Node で読み込んだとき(location が無い)は英語
  assert.equal(LANG, DEFAULT_LANG);
});

// --- 1 語の追加と編集 --------------------------------------------------------------

test('ドイツ語の 1 語の追加: 性・変化(forms)を取り込みと同じ読み手で分け、鍵に性が入る', () => {
  const b = germanBook();
  assert.deepEqual(b.words, [{ en: 'Hund', pos: '名', gender: 'm', plural: 'Hunde', ja: '犬' }]);
  assert.deepEqual(Object.keys(b.added), ['Hund|名|m']);
  // 性の違う同じ綴りは別の語として足せる。性まで同じなら足さない(INV-4)
  const r2 = addOneWord(b, { en: 'Hund', pos: '名', gender: 'f', ja: 'x' }, TODAY, DE);
  assert.ok(r2.ok);
  assert.equal(addOneWord(b, { en: 'Hund', pos: '名', gender: 'der' }, TODAY, DE).ok, false);
  // 陽性対照: 言語を渡さない(英語で読む)と、性と変化は未知の項目として捨てる
  const en = addOneWord(emptyBook(), { en: 'Hund', pos: '名', gender: 'm', forms: 'Hunde', ja: '犬' }, TODAY);
  assert.ok(en.ok);
  assert.deepEqual(en.ok && en.book.words, [{ en: 'Hund', pos: '名', ja: '犬' }]);
});

test('ドイツ語の編集: 変化を書き換えると分けた項目が入れ替わり、性を変えると鍵と記録が移る', () => {
  const b = germanBook();
  const r = editWord(b, 'Hund|名|m', { en: 'Hund', pos: '名', gender: 'n', forms: 'Hünde', ja: '犬' }, DE);
  assert.ok(r.ok, r.ok ? '' : r.error);
  assert.deepEqual(r.ok && r.book.words, [{ en: 'Hund', pos: '名', gender: 'n', plural: 'Hünde', ja: '犬' }]);
  assert.equal(r.ok && r.key, 'Hund|名|n');
  assert.deepEqual(r.ok && Object.keys(r.book.added), ['Hund|名|n']);
  // 動詞: 格支配と三基本形
  const v = addOneWord(emptyBook(), { en: 'fahren', pos: '動', case: '4格', forms: 'fährt, fuhr, hat gefahren', ja: '運転する' }, TODAY, DE);
  assert.deepEqual(v.ok && v.book.words, [{ en: 'fahren', pos: '動', case: '4格', pres3: 'fährt', past: 'fuhr', aux: 'haben', pp: 'gefahren', ja: '運転する' }]);
});

// --- バックアップの言語 -------------------------------------------------------------

test('バックアップ: 英語の書き出しは授業版と同じ形(lang 欄なし)。ドイツ語は lang 欄を持ち、読み直すと性・変化が残る', () => {
  assert.equal('lang' in toBackup(emptyBook(), NOW), false);
  const b = germanBook();
  const text = backupText(b, NOW, DE);
  assert.equal(JSON.parse(text).lang, 'de');
  const r = parseBackup(text, { today: TODAY, lang: DE });
  assert.equal(r.fatal, undefined);
  assert.deepEqual(r.book?.words, b.words);
  assert.deepEqual(r.warnings, []);
});

test('バックアップ: 別の言語の単語帳のファイルは読まない(英語 → ドイツ語、ドイツ語 → 英語のどちらも)', () => {
  const de = backupText(germanBook(), NOW, DE);
  assert.match(parseBackup(de, { today: TODAY }).fatal ?? '', /ドイツ語の単語帳のバックアップです。英語の単語帳には読み込めません/);
  const en = backupText(emptyBook(), NOW);
  assert.match(parseBackup(en, { today: TODAY, lang: DE }).fatal ?? '', /英語の単語帳のバックアップです。ドイツ語の単語帳には読み込めません/);
  // 知らない言語のファイルも読まない
  assert.match(parseBackup(de.replace('"lang": "de"', '"lang": "xx"'), { today: TODAY, lang: DE }).fatal ?? '', /xxの単語帳のバックアップ/);
});

// --- 言語ごとの保存先 ---------------------------------------------------------------

test('保存: ドイツ語の単語帳は英語と別のデータベース(tango-lp-de)に置き、開き直しても性・変化が残る', async () => {
  const factory = new IDBFactory();
  const de = await openStorage(factory, { lang: DE, now: () => NOW });
  await de.save(germanBook());
  de.close();
  const names = (await factory.databases()).map((d) => d.name).sort();
  assert.deepEqual(names, ['tango-lp-de']);
  const again = await openStorage(factory, { lang: DE, now: () => NOW });
  assert.deepEqual((await again.load(TODAY)).book.words, germanBook().words);
  again.close();
  // 英語の単語帳は空のまま
  const en = await openStorage(factory, { now: () => NOW });
  assert.deepEqual((await en.load(TODAY)).book.words, []);
  en.close();
});

test('保存の陽性対照: 英語の単語帳を同じデータベース名で開くと、ドイツ語の単語帳が見え(言語が違うので読めない)', async () => {
  const factory = new IDBFactory();
  const de = await openStorage(factory, { lang: DE, now: () => NOW });
  await de.save(germanBook());
  de.close();
  const en = await openStorage(factory, { name: DE.dbName, now: () => NOW });
  await assert.rejects(() => en.load(TODAY), /ドイツ語の単語帳のバックアップです/);
  en.close();
});

// --- お知らせ ---------------------------------------------------------------------

test('お知らせ: 自他のお知らせは英語の単語帳にだけ出す', () => {
  assert.deepEqual(noticesFor(NOTICES, LANGS.en), [...NOTICES]);
  const de = noticesFor(NOTICES, DE).map((n) => n.id);
  assert.ok(!de.includes('2026-10-07-trans'));
  assert.ok(de.includes('2026-10-07-speech'));
});
