// T-6: AI の実際の返答を見本として取り込めること。見本の台帳は fixtures/ai/replies.json。
// 見本を足すときは、依頼文(core/aiPrompt.js)を画面で作って AI に渡し、返答を「そのまま」ファイルに保存して台帳に行を足す
// (手で整えると、寛容な解析を確かめる見本にならない)。手順は Docs/20_ImportFormat.md §6。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseImport } from '../../core/importFormat.js';
import { planImport } from '../../core/importPlan.js';
import { isVerb, posParts } from '../../core/word.js';
import { LANGS, langOf } from '../../core/lang.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'ai');

/**
 * @typedef {object} ReplyEntry
 * @property {string} file 返答をそのまま保存したファイル
 * @property {string} provider ChatGPT / Claude / Gemini
 * @property {string} model
 * @property {string} via どの経路で採ったか(アプリ・API・CLI など)
 * @property {string} [standIn] 本物の見本の代わりに置いたものなら、その理由(完了には数えない)
 * @property {string} date 採った日
 * @property {string} promptVersion どの版の依頼文への返答か
 * @property {boolean} examples 例文も頼んだか
 * @property {string[]} words 頼んだ語
 * @property {string} [lang] 語の言語(core/lang.js の ID。無ければ英語)。新LP版でドイツ語を足した
 */

/** @type {ReplyEntry[]} */
const REPLIES = JSON.parse(readFileSync(join(dir, 'replies.json'), 'utf8'));

/** T-6 の完了条件が求める提供元 */
const REQUIRED = ['ChatGPT', 'Claude', 'Gemini'];

for (const e of REPLIES) {
  test(`${e.provider}(${e.model}・${e.via})の返答を、頼んだ語だけの確認表にできる: ${e.file}`, () => {
    const text = readFileSync(join(dir, e.file), 'utf8');
    const lang = langOf(e.lang ?? 'en');
    assert.ok(lang, `知らない言語 ${e.lang}`);
    const parsed = parseImport(text, lang);
    assert.equal(parsed.fatal, undefined);
    const plan = planImport([], parsed, { exSrc: 'ai' });
    assert.deepEqual(plan.rows.filter((r) => r.action === 'error').map((r) => r.raw), [], '読めない行');
    // 頼んだ語がちょうど「足す」行になる(前置きの文を語として拾わない・語を落とさない)
    assert.deepEqual(plan.rows.filter((r) => r.action === 'add').map((r) => r.word?.en), e.words);
    for (const r of plan.rows.filter((x) => x.action === 'add')) {
      const w = /** @type {import('../../core/word.js').Word} */ (r.word);
      assert.ok(w.pos, `${w.en}: 品詞が無い`);
      assert.ok(w.ja, `${w.en}: 意味が無い`);
      if (e.examples) {
        assert.ok(w.ex && w.exJa, `${w.en}: 例文か和訳が無い`);
        assert.equal(w.exSrc, 'ai');
      }
      // v2 からの依頼文は、動詞の品詞に自他を添えさせる(読み手は splitTransMark)。自他を持つ言語(英語)だけ
      if (e.promptVersion !== 'v1' && lang.fields.includes('trans') && isVerb(w)) assert.ok(w.trans, `${w.en}: 自他が無い`);
      // ドイツ語の依頼文は、名詞に性、動詞に格支配と三基本形を書かせる(どれを確かめるかは言語の設定の fields で決まる)
      if (lang.fields.includes('gender') && posParts(w).includes('名')) assert.ok(w.gender, `${w.en}: 性が無い`);
      if (lang.fields.includes('case') && isVerb(w)) assert.ok(w.case, `${w.en}: 格支配が無い`);
      if (lang.fields.includes('pp') && isVerb(w)) assert.ok(w.pres3 && w.past && w.aux && w.pp, `${w.en}: 三基本形が無い`);
    }
  });
}

test('台帳の行は実在する見本と、固定した全文のある依頼文の版を指す', () => {
  for (const e of REPLIES) {
    assert.ok(REQUIRED.includes(e.provider), e.provider);
    assert.ok(readFileSync(join(dir, e.file), 'utf8').length > 0, e.file);
    // 過去の版への返答も、読めることを確かめる見本として残す(貼られうる入力のため。INV-3 と同じ考え)
    assert.ok(existsSync(join(dir, `prompt_${e.promptVersion.replace('/', '_')}.txt`)), `${e.file} の依頼文の版 ${e.promptVersion} の全文が無い`);
  }
});

// 今の版の依頼文への本物の見本(代用でないもの)の無い提供元は todo として出す(通ったように見せない。UV-1)。
// 依頼文を持つ言語ごとに(英語は v2、ドイツ語は de/v1)
for (const ver of Object.values(LANGS).flatMap((l) => (l.prompt ? [l.prompt] : []))) {
  for (const p of REQUIRED.filter((x) => !REPLIES.some((e) => e.provider === x && !e.standIn && e.promptVersion === ver))) {
    test(`${p} の、今の依頼文(${ver})への実際の返答の見本がまだ無い`, { todo: '見本を採って fixtures/ai/replies.json に足す' }, () => {
      assert.fail(`${p} の見本が無い`);
    });
  }
}
