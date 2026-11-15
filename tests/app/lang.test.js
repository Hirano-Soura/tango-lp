// 画面の側に言語の決め打ちを残さない(学習ポータル 改善計画 項目37 第3段。LC-2)。
// 画面は言語の設定を app/lang.js の LANG からだけ引く。lang 属性の値・「英語」の文言・core/lang.js の直接の読み込みを、
// app/ のコード(注釈を除く)から探す。見つけ方そのものが働くことは、わざと決め打ちを入れた文で確かめる(陽性対照)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** @param {string} dir @returns {string[]} */
const jsFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? jsFiles(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : []);

/**
 * 言語の決め打ち。注釈の行(// と * で始まる行)は見ない。
 * @param {string} text
 * @param {boolean} isLangModule 言語を選ぶ場所(app/lang.js)か
 * @returns {string[]}
 */
export function hardcodedLang(text, isLangModule) {
  /** @type {string[]} */
  const found = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    const at = `${i + 1}: ${t}`;
    if (/\blang=["'][A-Za-z]{2,3}(-[A-Za-z]+)?["']/.test(t)) found.push(`lang 属性の値を直書き ${at}`);
    if (/英語|English/.test(t)) found.push(`言語の名前を直書き ${at}`);
    if (!isLangModule && /from ['"][./]*core\/lang\.js['"]/.test(t)) found.push(`core/lang.js を直接読む(app/lang.js の LANG を使う) ${at}`);
  });
  return found;
}

test('陽性対照: 決め打ちを入れた文は見つかり、注釈の中と LANG から引いた形は見つからない', () => {
  const bad = [
    `const a = \`<span lang="en">\${w}</span>\`;`,
    `const b = '見出し語(英語)';`,
    `import { LANGS } from '../core/lang.js';`,
  ].join('\n');
  assert.equal(hardcodedLang(bad, false).length, 3);
  assert.equal(hardcodedLang(`import { DEFAULT_LANG } from '../core/lang.js';`, true).length, 0);
  const ok = [
    `// 英語の lang="en" は注釈なら書いてよい`,
    ` * 英語(既定)`,
    `const a = \`<span lang="\${LANG.htmlLang}">\${w}</span>\`;`,
    `const b = \`見出し語(\${LANG.name})\`;`,
    `import { LANG } from './lang.js';`,
  ].join('\n');
  assert.deepEqual(hardcodedLang(ok, false), []);
});

test('app/ のコードに言語の決め打ちが無い(言語は app/lang.js の LANG から引く)', () => {
  const files = jsFiles(join(root, 'app'));
  assert.ok(files.length >= 15, `app/ のファイルが少ない: ${files.length}`);
  const found = files.flatMap((f) => {
    const rel = relative(root, f).split(sep).join('/');
    return hardcodedLang(readFileSync(f, 'utf8'), rel === 'app/lang.js').map((m) => `${rel}:${m}`);
  });
  assert.deepEqual(found, []);
});
