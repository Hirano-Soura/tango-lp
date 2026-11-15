# 言語ごとの設定(新LP版)

新LP版は、言語ごとの違いを `core/lang.js` の `LANGS` に**宣言**し、取り込み・依頼文・読み上げ・画面は宣言の項目を引くだけにする。
消費側は言語の ID を見て分岐しない。言語を足すときは `LANGS` に 1 つ足す。
段と計画の正は学習ポータル(LearningPortal)の `改善計画.md` 項目37。ここは**今の仕組み**だけを持つ。

## 1. 宣言する項目

| 項目 | 意味 | 英語 | 中国語(見本) |
| --- | --- | --- | --- |
| `id` | 言語の ID(BCP 47 の主言語) | `en` | `zh` |
| `name` | 画面に出す名前(「見出し語(英語)」「英語の音声」) | 英語 | 中国語 |
| `htmlLang` | 見出し語・例文の要素の `lang` 属性 | `en` | `zh-CN` |
| `looksTerm` | 見出し語として読めるか(前置きの文・日本語の行を見分ける) | 英字を含み、かな・漢字・全角を含まない | 漢字を含み、かなを含まない |
| `columns` | 簡易形式の列の並び(先頭は見出し語 `en`) | 見出し語・品詞・意味・例文・例文の和訳・補足 | 見出し語・読み・品詞・意味・例文・例文の和訳・補足 |
| `fields` | 言語に固有の語の項目 | `trans`(自他) | `reading`(読み) |
| `prompt` | AI への依頼文の版(`core/aiPrompt.js` の `PROMPTS` の鍵)。無ければ `null` | `v2` | `null` |
| `speech` | 読み上げの声の言語タグの頭・地域の順・声を足す案内の名前 | `en`・米国が先 | `zh`・`zh-cn` |
| `dbName` | 端末内の保存先のデータベース名 | `tango-lp` | `tango-lp-zh` |

- **英語の宣言は授業版と同じ挙動にする**(`UPSTREAM.md` の取り込みの規則)。英語を明示しても既定と同じ結果になることを
  `tests/core/langLayer.test.js` が取り込みの全見本・依頼文・読み上げで確かめる
- 中国語は実装しない。宣言の形が英語専用になっていないことを確かめる最小の見本(簡体字＋ピンイン)で、取り込めることを同じ検査が確かめる
- 項目名 `en` は改名しない(内部名。改名すると授業版からの取り込みが毎回衝突する)。JSON では別名 `term` でも見出し語を読む
  ([20_ImportFormat.md](20_ImportFormat.md) §2)

## 2. 消費側の引き方

| 消費側 | 引くもの |
| --- | --- |
| 取り込み(`core/importFormat.js` の `parseImport(text, lang)`・`readItem(item, ref, lang)`) | `looksTerm`・`columns`・`fields`(自他の印は `fields` に `trans` がある言語だけが読む) |
| 確認表(`core/importPlan.js`) | 全言語の `fields`(`ALL_LANG_FIELDS`)を、空欄を埋める・食い違いを調べる項目に足す |
| 依頼文(`core/aiPrompt.js` の `aiPrompt(words, { lang })`・`requestWords(text, lang)`) | `prompt`・`looksTerm` |
| 読み上げ(`core/speech.js` の `langVoices`・`pickVoice(voices, chosen, lang)`・`remoteLangCount`) | `speech` |
| 画面(`app/`) | `app/lang.js` の `LANG` からだけ引く。`lang` 属性の値・言語の名前・`core/lang.js` の直接の読み込みを `app/` に書かないことを `tests/app/lang.test.js` が確かめる(陽性対照つき) |
| 保存(`app/storage.js`) | `dbName` |

- 授業版と同じ名前の関数(`looksEnglish`・`englishVoices`・`remoteEnglishCount`・`isEnglish`)は、英語の宣言を引く形で残す(授業版の検査をそのまま通すため)
- 引数を省くと英語(`DEFAULT_LANG`)。画面は今は英語だけを開く(`app/lang.js`)

## 3. まだ言語を引いていないところ

次は英語の決め打ちのまま残っている。ドイツ語の画面(項目37 第4b段)で、言語の宣言から引く形へ直す。

- `core/book.js` の 1 語の追加・編集(`addOneWord`・`editWord`)と `core/backup.js` のバックアップの読み込みは、英語で読む
  (バックアップに言語を持たせるのと一緒に直す)
- 自他(`trans`)の画面(入力欄・印・通知・自他を補う依頼文 `transPrompt`)は、言語の `fields` を見ずに出す
- 読む文の作り方(`core/speech.js` の `speechText`。`A`・`-ing`・`sb` の扱い)は英語の規則
- Q&A タブの文面(自他の説明・取り込みの列の説明)は英語の単語帳の説明
