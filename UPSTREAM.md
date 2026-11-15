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
| データベース名 `tango-drill` → `tango-lp`(`app/storage.js` の `DB_NAME`) | 授業版と同じ `hirano-soura.github.io` に置くと、IndexedDB がパスで分かれないため、同じブラウザで同じ単語帳を読み書きしてしまう(`Docs/22_Storage.md` §1) | `tests/app/storage.test.js` の「新LP版:」の 2 本(戻すと落ちる陽性対照つき) |

## 取り込まなかったコミット

| コミット | 理由 |
| --- | --- |
| (まだ無い) | |

## 未決定

- **新LP版の版の付け方。** 今は授業版の `0.24.0` のまま。授業版の版上げ(`core/version.js`・`package.json`・`Docs/53_Versions.md`)を cherry-pick すると毎回ぶつかるので、
  別系統の番号にするか、授業版の番号に従うかを、最初の cherry-pick か第3段(言語設定の層)の前に決める
- 書き出すファイル名(`tango-drill_backup_…json` など)とバックアップ形式の名前(`tango-drill-backup/v2`)は授業版のまま。
  形式の名前が同じなので、授業版のバックアップを新LP版で読み込める(項目37 第1段の移行に使う)
