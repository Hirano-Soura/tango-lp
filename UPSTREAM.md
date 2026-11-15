# UPSTREAM — 授業版(tango-drill)との同期台帳

このリポジトリ `tango-lp` は、授業版 `tango-drill` を**履歴ごと** fork した個人用の単語帳(新LP版)である。
新LP版は多言語(英語・ドイツ語。中国語は見本だけ)に広げ、授業版は先生への引き継ぎに向けて独立に進む。
計画と段の正本は学習ポータル(LearningPortal)の `改善計画.md` 項目37。ここは**同期の記録だけ**を持つ。

## リモート

| 名前 | 指す先 | 使い方 |
| --- | --- | --- |
| `origin` | `https://github.com/Hirano-Soura/tango-lp` | 新LP版の push 先。`main` が GitHub Pages の公開版 |
| `upstream` | `https://github.com/Hirano-Soura/tango-drill` | 授業版。**fetch だけ**。push 先は `no_push` にしてあり、誤って授業版へ push できない |

clone し直したときは `git remote add upstream https://github.com/Hirano-Soura/tango-drill` と
`git remote set-url --push upstream no_push` をやり直す。

## 同期点

**最後に取り込んだ授業版のコミット: `2f8d166fbc58bdb8a8ef0e6397de6cbea491e017`**(`0.24.0` の後。2026-11-15 に fork した時点)

未取り込みのコミットを見るときは、次を実行する。

```bash
git fetch upstream && git log 2f8d166fbc58bdb8a8ef0e6397de6cbea491e017..upstream/main --oneline
```

## 取り込みの規則

- **授業版のバグ修正は必ず取り込む**(fork 元のバグは同じ形でここにもある)。仕様の改善は選んで取り込む
- 取り込みは `git cherry-pick` で行い、取り込んだら上の同期点を書き換える
- 取り込みやすさを保つため、**英語を既定にしたときの挙動を授業版と同じに保つ**。項目名 `en` は改名しない
- 新LP版の良い仕様は、授業版の `BRANCHING.md` の運用(ブランチ → PR)で提案する

## 授業版から変えたところ

| 変更 | 理由 | 検査 |
| --- | --- | --- |
| 言語ごとの設定の層 `core/lang.js` を足し、取り込み(`core/importFormat.js`)・確認表(`core/importPlan.js`)・依頼文(`core/aiPrompt.js`)・読み上げ(`core/speech.js`)・画面(`app/`。`app/lang.js` の `LANG` から引く)を言語の設定を引く形にした。授業版と同じ名前の関数は英語の宣言を引く形で残した(`Docs/26_Languages.md`) | 多言語化(学習ポータル 項目37 第3段)。英語の挙動は授業版と同じに保つ | `tests/core/lang.test.js`・`tests/core/langLayer.test.js`(英語を明示しても既定と同じ・中国語の見本・陽性対照)・`tests/app/lang.test.js`(画面に言語の決め打ちが無い。陽性対照つき)。授業版から引き継いだ検査はすべてそのまま通る |
| ドイツ語: `core/inflection.js`(性・格支配・変化)・語の鍵に性(`core/word.js` の `keyOf`。性の無い語は授業版と同じ)・依頼文 `de/v1`・`?lang=de`(`app/lang.js`)・言語ごとのデータベース・バックアップの `lang` 欄(`core/backup.js`)・入力欄と表示(`app/wordForm.js`)・お知らせの `requires`(`core/notices.js`) | 学習ポータル 項目37 第4a・4b段 | `tests/core/german.test.js`・`tests/app/langBook.test.js`・`tests/e2e/german.spec.js`(陽性対照つき)。英語の検査はそのまま通る |
| 版の系統: `0.24.0` の後を授業版と別に数える(`0.25.0` から) | 授業版の版上げは `feat` のコミットの中にあり、どちらの系統にしても取り込みで版の行は衝突する。新LP版の変更を版で区別できる方を選んだ | `tests/core/version.test.js`(3 か所の一致) |
| データベース名 `tango-drill` → `tango-lp`(`app/storage.js` の `DB_NAME`。名前の正は `core/lang.js` の `dbName`) | 授業版と同じ `hirano-soura.github.io` に置くと、IndexedDB がパスで分かれないため、同じブラウザで同じ単語帳を読み書きしてしまう(`Docs/22_Storage.md` §1) | `tests/app/storage.test.js` の「新LP版:」の 2 本(戻すと落ちる陽性対照つき) |

## 取り込まなかったコミット

| コミット | 理由 |
| --- | --- |
| (まだ無い) | |

## 未決定

- (決めた: 2026-11-15)新LP版の版は授業版と別の系統で数える(`0.25.0` から。`Docs/53_Versions.md` §1)。
  取り込みで版の 3 か所(`core/version.js`・`package.json` と `package-lock.json`・`Docs/53_Versions.md`)がぶつかったら新LP版の値を残し、新LP版の規則で上げ直す
- 書き出すファイル名(`tango-drill_backup_…json` など)とバックアップ形式の名前(`tango-drill-backup/v2`)は授業版のまま。
  形式の名前が同じなので、授業版のバックアップを新LP版で読み込める(項目37 第1段の移行に使う)
