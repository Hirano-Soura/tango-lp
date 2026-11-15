# 言語ごとの設定(新LP版)

新LP版は、言語ごとの違いを `core/lang.js` の `LANGS` に**宣言**し、取り込み・依頼文・読み上げ・画面は宣言の項目を引くだけにする。
消費側は言語の ID を見て分岐しない。言語を足すときは `LANGS` に 1 つ足す。
段と計画の正は学習ポータル(LearningPortal)の `改善計画.md` 項目37。ここは**今の仕組み**だけを持つ。

## 1. 宣言する項目

| 項目 | 意味 | 英語 | ドイツ語 | 中国語(見本) |
| --- | --- | --- | --- | --- |
| `id` | 言語の ID(BCP 47 の主言語。URL の `?lang=` とバックアップの `lang` 欄の値) | `en` | `de` | `zh` |
| `name` | 画面に出す名前(「見出し語(英語)」「英語の音声」) | 英語 | ドイツ語 | 中国語 |
| `htmlLang` | 見出し語・例文の要素の `lang` 属性 | `en` | `de` | `zh-CN` |
| `looksTerm` | 見出し語として読めるか(前置きの文・日本語の行を見分ける) | 英字を含み、かな・漢字・全角を含まない | 英字か ä ö ü ß を含み、かな・漢字・全角を含まない | 漢字を含み、かなを含まない |
| `columns` | 簡易形式の列の並び(先頭は見出し語 `en`。`virtual` の列は取り込みで内部の項目へ分ける) | 見出し語・品詞・意味・例文・例文の和訳・補足 | 見出し語・品詞・性・変化(`virtual`)・意味・例文・例文の和訳・補足 | 見出し語・読み・品詞・意味・例文・例文の和訳・補足 |
| `fields` | 言語に固有の語の項目 | `trans`(自他) | `gender` `case` `plural` `pres3` `past` `aux` `pp` `comp` `sup`(§4) | `reading`(読み) |
| `prompt` | AI への依頼文の版(`core/aiPrompt.js` の `PROMPTS` の鍵)。無ければ `null` | `v2` | `de/v1` | `null` |
| `speech` | 読み上げの声の言語タグの頭・地域の順・声を足す案内の名前 | `en`・米国が先 | `de`・ドイツ・オーストリア・スイスの順 | `zh`・`zh-cn` |
| `dbName` | 端末内の保存先のデータベース名 | `tango-lp` | `tango-lp-de` | `tango-lp-zh` |
| `articles` | 見出し語の頭に書かれたら性へ移す冠詞 | なし | `der` `die` `das` | なし |
| `selectable` | 画面で開けるか(`?lang=`) | 開ける(既定) | 開ける | 開けない |
| `typing` | 入力の補助(打った文字列の置き換えと、文字のボタン) | なし | `a:` `o:` `u:` → ä ö ü(大文字も)・ä ö ü ß のボタン | なし |
| `example` | 取り込み欄の例 | 授業版の例と同じ | 動詞・名詞・形容詞 1 語ずつ | 1 語 |

- **英語の宣言は授業版と同じ挙動にする**(`UPSTREAM.md` の取り込みの規則)。英語を明示しても既定と同じ結果になることを
  `tests/core/langLayer.test.js` が取り込みの全見本・依頼文・読み上げで確かめる。授業版から引き継いだ検査もすべてそのまま通る
- 中国語は実装しない。宣言の形が英語専用になっていないことを確かめる最小の見本(簡体字＋ピンイン)で、取り込めることを同じ検査が確かめる
- 項目名 `en` は改名しない(内部名。改名すると授業版からの取り込みが毎回衝突する)。JSON では別名 `term` でも見出し語を読む
  ([20_ImportFormat.md](20_ImportFormat.md) §2)

## 2. 消費側の引き方

| 消費側 | 引くもの |
| --- | --- |
| 取り込み(`core/importFormat.js` の `parseImport(text, lang)`・`readItem(item, ref, lang)`) | `looksTerm`・`columns`・`fields`・`articles`(自他の印は `fields` に `trans`、格支配の印は `case` がある言語だけが読む) |
| 確認表(`core/importPlan.js`) | 全言語の `fields`(`ALL_LANG_FIELDS`)を、空欄を埋める・食い違いを調べる項目に足す |
| 1 語の追加・編集(`core/book.js` の `addOneWord`・`editWord` の `lang`) | 取り込みと同じ読み手 |
| バックアップ(`core/backup.js` の `toBackup`・`backupText`・`parseBackup` / `readBackup` の `lang`) | `id`(§3) |
| 依頼文(`core/aiPrompt.js` の `aiPrompt(words, { lang })`・`requestWords(text, lang)`) | `prompt`・`looksTerm`・`columns`(ドイツ語の依頼文の列は `columns` から作る) |
| 読み上げ(`core/speech.js` の `langVoices`・`pickVoice(voices, chosen, lang)`・`remoteLangCount`) | `speech` |
| お知らせ(`core/notices.js` の `noticesFor`) | `fields`(お知らせの `requires`。自他のお知らせは英語だけ) |
| 画面(`app/`) | `app/lang.js` の `LANG` からだけ引く(§3)。`lang` 属性の値・言語の名前・`core/lang.js` の直接の読み込みを `app/` に書かないことを `tests/app/lang.test.js` が確かめる(陽性対照つき) |
| 保存(`app/storage.js`) | `dbName`・`id` |

- 授業版と同じ名前の関数(`looksEnglish`・`englishVoices`・`remoteEnglishCount`・`isEnglish`・`SIMPLE_EXAMPLE`)は、英語の宣言を引く形で残す(授業版の検査をそのまま通すため)
- 引数を省くと英語(`DEFAULT_LANG`)

## 3. 言語の選び方と、言語ごとの単語帳

- URL の `?lang=de` でドイツ語の単語帳を開く(`app/lang.js` の `pickLang`)。無い・知らない・`selectable` でない言語は英語。最後に使った言語は覚えない
  (ハブのカードから言語ごとに開く)
- **単語帳は言語ごとに別のデータベース**(`dbName`)に置く。設定(読み上げの声・既読のお知らせ)も同じデータベースにあるので、言語ごとに分かれる
- **バックアップは言語を持つ。** 英語以外の単語帳は書き出すファイルに `"lang": "de"` を書き、ファイル名にも言語を入れる(`tango-drill_backup_de_<日付>.json`)。
  英語のファイルは授業版と同じ形のまま(`lang` 欄なし = 英語)。**別の言語の単語帳のファイルは読み込まない**(語の読み方も鍵も違うため)。
  形式の名前は `tango-drill-backup/v2` のまま(授業版の将来の版と番号がぶつからないよう、新LP版では版を上げずに省ける欄として足した)
- 英語以外の単語帳は、見出しとタブの名前に言語を出す(「単語ドリル(ドイツ語)」)。英語は授業版と同じ見た目
- 画面の通し確認は `tests/e2e/german.spec.js`(追加 → 学習 → 記録 → 編集 → 削除 → 元に戻す・英語と混ざらない・取り込み・入力の補助・自他のお知らせを出さない)

## 4. ドイツ語の項目(`core/inflection.js`)

| 項目 | 値 | 読み方 |
| --- | --- | --- |
| `gender`(性) | `m` `f` `n` `pl`(複数形でしか使わない名詞) | `der/die/das`・`m./f./n.`・`男/女/中`・`pl`・`複数` を読む。見出し語に `der Hund` と書かれたら冠詞を性へ移す(冠詞の後ろが大文字の 1 語のときだけ)。**語の鍵に入る**(`keyOf` が `Hund\|名\|m`。性の無い語の鍵は授業版と同じ) |
| `case`(格支配) | `4格` `3格` `3格4格` `2格` `自` | 品詞の括弧(`動(4格)`)から読む。英語の自他と同じ置き方で、括弧は鍵に入らない |
| `plural` | 冠詞なしの複数形。無ければ `-` | 「変化」の列が 1 つの値で、名詞(品詞に `名` があるか性がある)のとき |
| `pres3` `past` `aux` `pp` | 3 人称単数現在・過去基本形・完了の助動詞(`haben` `sein` `haben/sein`)・過去分詞 | 「変化」の列が 3 つに区切れ、3 つ目が `hat` / `ist` で始まるとき。分離動詞は `kommt an` のまま |
| `comp` `sup` | 比較級・最上級(`am größten`) | 「変化」の列が 2 つに区切れ、2 つ目が `am ` で始まるとき |

- 形の読めない「変化」は捨てて知らせる(語ごとは落とさない)
- 表示は、名詞を `der Hund`、品詞の欄を `名 · Hunde` / `動(4格) · fährt, fuhr, ist gefahren` の形にする(`headword`・`formsText`)
- 依頼文 `de/v1` の全文は `tests/core/fixtures/ai/prompt_de_v1*.txt` に固定してある。返答の見本は代用 1 件(`claude_de_v1_session.txt`)だけで、
  ChatGPT・Claude・Gemini の本物の見本はまだ無い(検査が todo として出す)

## 5. まだ言語を引いていないところ

- 読む文の作り方(`core/speech.js` の `speechText`。`A`・`-ing`・`sb` の扱い)は英語の規則のまま。ドイツ語の見出し語は冠詞を付けて読む
- Q&A タブの文面のうち、自他の 2 問は英語の単語帳にだけ出す。残り(取り込みの列の説明など)は英語の単語帳の説明のまま
- 4 択の誤答に使う内蔵語彙は英語の 495 語(選択肢は日本語の意味なので機能する)
- 性・変化を AI に補わせる依頼文(英語の `transPrompt` に当たるもの)は、項目37 第4c段で作る
