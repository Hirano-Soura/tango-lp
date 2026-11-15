// ドイツ語の単語帳(?lang=de。学習ポータル 改善計画 項目37 第4b段)を画面で通す。
// 言語ごとの規則そのもの(性・変化の読み方、保存先とバックアップの言語)は tests/core/german.test.js と tests/app/langBook.test.js が見る。
// ここでは、画面がドイツ語の設定で開き、英語の単語帳と混ざらないことを見る。
import { test, expect } from '@playwright/test';
import { storedBook, tab, fits, openAddFolds, openAllFolds } from './helpers.js';
import { LANGS } from '../../core/lang.js';

/** @typedef {import('@playwright/test').Page} Page */

const DE = '/?lang=de';

/**
 * 1 語の欄でドイツ語の名詞を足す。
 * @param {Page} page
 */
async function addHund(page) {
  await page.getByLabel('見出し語(ドイツ語)').fill('Hund');
  await page.getByLabel('品詞').fill('名');
  await page.getByLabel('性', { exact: true }).selectOption({ label: 'der' });
  await page.getByLabel('変化').fill('Hunde');
  await page.getByLabel('意味').fill('犬');
  await page.getByLabel('例文', { exact: true }).fill('Der Hund schläft im Garten.');
  await page.getByLabel('例文の和訳').fill('その犬は庭で眠っている。');
  await page.getByRole('button', { name: '追加する' }).click();
  await expect(page.locator('#add-msg')).toContainText('「Hund」を追加しました');
}

test('ドイツ語: 追加 → 学習 → 記録 → 編集 → 削除 → 元に戻す', async ({ page }) => {
  await page.goto(DE);
  await expect(page.locator('header h1')).toContainText('(ドイツ語)');
  await expect(page).toHaveTitle(/\(ドイツ語\)/);
  await expect(tab(page, '追加')).toHaveAttribute('aria-selected', 'true');
  await openAddFolds(page);
  // 英語の自他の欄は出さず、性・変化・格支配の欄を出す
  await expect(page.locator('#add-form').getByLabel('自他')).toHaveCount(0);
  await expect(page.locator('#add-form').getByLabel('格支配')).toHaveCount(1);

  // 追加
  await addHund(page);
  let book = await storedBook(page);
  expect(book.words).toEqual([{ en: 'Hund', pos: '名', gender: 'm', plural: 'Hunde', ja: '犬', ex: 'Der Hund schläft im Garten.', exJa: 'その犬は庭で眠っている。', exSrc: 'self' }]);

  // 学習: 見出し語は冠詞を付けて出す。1 語でも内蔵語彙で 4 択になる
  await tab(page, '学習').click();
  await page.getByRole('button', { name: '始める' }).click();
  await expect(page.locator('.stem')).toHaveText('der Hund');
  await expect(page.locator('.stem')).toHaveAttribute('lang', 'de');
  await expect(page.locator('.q .pos')).toContainText('Hunde');
  await page.getByRole('button', { name: 'わかる', exact: true }).click();
  await page.getByRole('button', { name: '犬', exact: true }).click();
  await expect(page.locator('.fb')).toContainText('正解');

  // 記録
  await tab(page, '記録').click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('der Hund');

  // 編集: 変化を書き換える(今の値は「変化」の欄に簡易形式の書き方で入っている)
  await tab(page, '単語帳').click();
  const row = page.locator('li.word', { hasText: 'Hund' });
  await expect(row).toContainText('der Hund');
  await expect(row).toContainText('名 · Hunde');
  await row.getByRole('button', { name: '編集' }).click();
  const edit = page.locator('#edit-form');
  await expect(edit.getByLabel('変化')).toHaveValue('Hunde');
  await expect(edit.getByLabel('性', { exact: true })).toHaveValue('m');
  await edit.getByLabel('意味').fill('犬、イヌ');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.locator('#edit-panel')).toHaveCount(0);
  book = await storedBook(page);
  expect(book.words[0]).toMatchObject({ en: 'Hund', gender: 'm', plural: 'Hunde', ja: '犬、イヌ' });

  // 削除 → 元に戻す(記録も性の入った鍵のまま戻る)
  await row.getByRole('button', { name: '削除' }).click();
  await expect(page.locator('li.word')).toHaveCount(0);
  await page.locator('#toast').getByRole('button', { name: '元に戻す' }).click();
  await expect(page.locator('li.word', { hasText: 'Hund' })).toHaveCount(1);
  book = await storedBook(page);
  expect(book.records.hist['Hund|名|m']).toEqual([1]);

  // 開き直しても残る
  await page.reload();
  await expect(tab(page, '学習')).toHaveAttribute('aria-selected', 'true');
});

test('ドイツ語と英語の単語帳は、同じブラウザでも混ざらない', async ({ page }) => {
  await page.goto(DE);
  await openAddFolds(page);
  await addHund(page);
  // 英語の単語帳は空のまま(追加タブから始まる)
  await page.goto('/');
  await expect(page.locator('header h1')).not.toContainText('ドイツ語');
  await expect(tab(page, '追加')).toHaveAttribute('aria-selected', 'true');
  expect((await storedBook(page)).words).toEqual([]);
  // ドイツ語に戻ると語がある
  await page.goto(DE);
  await expect(tab(page, '学習')).toHaveAttribute('aria-selected', 'true');
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).sort());
  expect(dbs).toEqual(['tango-lp', 'tango-lp-de']);
});

test('ドイツ語: 例を取り込むと性・変化・格支配が入り、単語帳に「der Hund」「fährt, fuhr, ist gefahren」と出る', async ({ page }) => {
  await page.goto(DE);
  await openAddFolds(page);
  await expect(page.locator('#import-panel')).toContainText('見出し語 | 品詞 | 性 | 変化 | 意味 | 例文 | 例文の和訳 | 補足');
  await page.getByRole('button', { name: '例を入れる' }).click();
  await expect(page.getByLabel('貼り付ける内容')).toHaveValue(LANGS.de.example);
  await page.getByRole('button', { name: '確認表を作る' }).click();
  await expect(page.locator('#plan li.prow .act')).toHaveText(['足す', '足す', '足す']);
  await fits(page, '確認表');
  await page.getByRole('button', { name: '確定して取り込む' }).click();
  await expect(page.locator('#toast')).toContainText('追加 3 語');
  const words = (await storedBook(page)).words;
  expect(words.map((/** @type {{ en: string }} */ w) => w.en)).toEqual(['fahren', 'Hund', 'groß']);
  expect(words[0]).toMatchObject({ pos: '動', case: '自', pres3: 'fährt', past: 'fuhr', aux: 'sein', pp: 'gefahren' });
  await tab(page, '単語帳').click();
  await expect(page.locator('li.word', { hasText: 'fahren' })).toContainText('動(自) · fährt, fuhr, ist gefahren');
  await expect(page.locator('li.word', { hasText: 'Hund' })).toContainText('der Hund');
  await expect(page.locator('li.word', { hasText: 'groß' })).toContainText('größer, am größten');
  await openAllFolds(page);
  await fits(page, '単語帳');
});

test('ドイツ語の入力の補助: 「u:」は ü になり、ß のボタンは触っていた欄の打っている位置に入る', async ({ page }) => {
  await page.goto(DE);
  await openAddFolds(page);
  const en = page.getByLabel('見出し語(ドイツ語)');
  await en.pressSequentially('Mu:ll');
  await expect(en).toHaveValue('Müll');
  await en.fill('Fu');
  await page.locator('#add-form').getByRole('button', { name: 'ß を入れる' }).click();
  await expect(en).toHaveValue('Fuß');
  await expect(en).toBeFocused();
  // 意味(日本語)の欄は補助の対象にしない
  await page.getByLabel('意味').fill('a:');
  await expect(page.getByLabel('意味')).toHaveValue('a:');
  await fits(page, '追加');
});

test('ドイツ語: 自他のお知らせと自他の Q&A は出さない(通知タブに赤い点が付かない)', async ({ page }) => {
  await page.goto(DE);
  await expect(tab(page, '通知').locator('.dot')).toHaveCount(0);
  await tab(page, '通知').click();
  await expect(page.locator('#content')).not.toContainText('他動詞');
  await tab(page, 'Q&A').click();
  await openAllFolds(page);
  await expect(page.locator('#content')).not.toContainText('品詞の横の「他」「自」');
  await expect(page.locator('#content')).toContainText('ドイツ語の音声');
});
