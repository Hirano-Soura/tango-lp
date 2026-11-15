// 読み上げの規則(Docs/24_Speech.md): どの音声で読むかと、何を読むか。
// ブラウザの音声の一覧は画面の側(app/speech.js)が取り、ここは渡された一覧から選ぶだけにする(INV-6)。
// INV-1: 端末内の音声(localService が true)だけを選ぶ。インターネット経由の音声は、読む文(単語・例文)を外部へ送るので選ばない。
// どの言語の声を、どの地域の順で選ぶかは言語の設定(core/lang.js の speech)が決める。既定は英語(授業版と同じ)。

import { DEFAULT_LANG, LANGS } from './lang.js';

/** @typedef {import('./lang.js').LangSpec} LangSpec */

/**
 * 音声の一覧の 1 件。ブラウザの SpeechSynthesisVoice のうち、選ぶのに使う項目だけ。
 * @typedef {object} VoiceLike
 * @property {string} name
 * @property {string} lang BCP 47 の言語タグ。Android の Chrome は en_US のように下線で区切る
 * @property {boolean} localService 端末内の音声か(false はインターネット経由)
 * @property {string} voiceURI
 */

/** 読み上げの速さの選択肢(値は SpeechSynthesisUtterance の rate)。既定は ふつう */
/** @type {readonly [number, string][]} */
export const RATES = Object.freeze([[0.7, 'ゆっくり'], [0.9, 'ふつう'], [1.1, 'はやい']]);
export const DEFAULT_RATE = 0.9;

/**
 * 保存してある速さを、選択肢の値にそろえる。選択肢に無い値(手で書き換えた値・選択肢を変える前の値)は既定にする
 * (画面の選択と、実際に読む速さをずらさないため)。
 * @param {unknown} rate
 * @returns {number}
 */
export function rateOf(rate) {
  return RATES.some(([r]) => r === rate) ? /** @type {number} */ (rate) : DEFAULT_RATE;
}

/**
 * 言語タグをそろえる(下線をハイフンに、小文字に)。
 * @param {string} lang
 * @returns {string}
 */
export function normLang(lang) {
  return String(lang ?? '').replace(/_/g, '-').toLowerCase();
}

/**
 * その言語の音声か(言語タグの頭が言語の設定の speech.prefix)。
 * @param {VoiceLike} v
 * @param {LangSpec} [lang] 既定は英語
 * @returns {boolean}
 */
export function isLangVoice(v, lang = DEFAULT_LANG) {
  const t = normLang(v.lang);
  return t === lang.speech.prefix || t.startsWith(lang.speech.prefix + '-');
}

/**
 * 英語の音声か(授業版と同じ名前で残す。言語を選べる処理は isLangVoice を使う)。
 * @param {VoiceLike} v
 * @returns {boolean}
 */
export function isEnglish(v) {
  return isLangVoice(v, LANGS.en);
}

/**
 * 選ぶ順位。地域の並びは言語の設定の speech.regions(英語は TOEIC の音声に合わせて米国が先)。ここに無い地域はこの後ろ。
 * @param {VoiceLike} v
 * @param {LangSpec} lang
 * @returns {number}
 */
function rank(v, lang) {
  const regions = lang.speech.regions;
  const i = regions.indexOf(normLang(v.lang));
  // 端末内の高品質版(macOS・iOS の Enhanced / Premium など)を同じ地域の中で先にする
  const quality = /enhanced|premium|natural|neural/i.test(v.name) ? 0 : 1;
  return (i < 0 ? regions.length : i) * 2 + quality;
}

/**
 * 使ってよいその言語の音声を、選ぶ順に並べる。インターネット経由の音声は入れない(INV-1)。
 * 同じ順位のものは一覧の順を保つ。
 * @template {VoiceLike} V
 * @param {readonly V[]} voices
 * @param {LangSpec} [lang] 既定は英語
 * @returns {V[]}
 */
export function langVoices(voices, lang = DEFAULT_LANG) {
  return voices
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.localService === true && isLangVoice(v, lang))
    .sort((a, b) => rank(a.v, lang) - rank(b.v, lang) || a.i - b.i)
    .map(({ v }) => v);
}

/**
 * 使ってよい英語の音声(授業版と同じ名前で残す)。
 * @template {VoiceLike} V
 * @param {readonly V[]} voices
 * @returns {V[]}
 */
export function englishVoices(voices) {
  return langVoices(voices, LANGS.en);
}

/**
 * インターネット経由のその言語の音声の数(使わない理由を画面で知らせるため)。
 * @param {readonly VoiceLike[]} voices
 * @param {LangSpec} [lang] 既定は英語
 * @returns {number}
 */
export function remoteLangCount(voices, lang = DEFAULT_LANG) {
  return voices.filter((v) => v.localService !== true && isLangVoice(v, lang)).length;
}

/**
 * インターネット経由の英語の音声の数(授業版と同じ名前で残す)。
 * @param {readonly VoiceLike[]} voices
 * @returns {number}
 */
export function remoteEnglishCount(voices) {
  return remoteLangCount(voices, LANGS.en);
}

/**
 * 読み上げに使う音声。選んである音声(voiceURI)が使えるその言語の音声にあればそれ、無ければ並びの先頭。
 * 使える音声が無ければ null(そのときは読まない。言語だけを指定して読ませると、ブラウザがインターネット経由の音声を選ぶことがある)。
 * @template {VoiceLike} V
 * @param {readonly V[]} voices
 * @param {string} [chosen] 設定で選んだ音声の voiceURI。空なら自動
 * @param {LangSpec} [lang] 既定は英語
 * @returns {V | null}
 */
export function pickVoice(voices, chosen = '', lang = DEFAULT_LANG) {
  const list = langVoices(voices, lang);
  return (chosen && list.find((v) => v.voiceURI === chosen)) || list[0] || null;
}

/**
 * 見出し語から読む文を作る。句表現の目印(A・B・~・-ing など)は、そのまま読むと
 * 「エー」「チルダ」「マイナス」になるので、読まないか、読める語に置き換える。言い換えが「/」で並ぶときは最初だけを読む。
 * @param {string} en
 * @returns {string}
 */
export function speechText(en) {
  let s = String(en ?? '').split(/\s+\/\s+/)[0];
  s = s.replace(/(^|\s)(?:[~\u301c\uff5e]|-)ing\b/g, '$1doing')
    .replace(/[~\u301c\uff5e\u2026]/g, ' ')
    .replace(/[()\uff08\uff09[\]]/g, ' ')
    .replace(/\bsb\b/g, 'somebody')
    .replace(/\bsth\b/g, 'something');
  // 目印の A・B(先頭の語は冠詞などの A かもしれないので残す)。所有の A's も読まない
  const words = s.split(/\s+/).filter(Boolean);
  const kept = words.filter((w, i) => i === 0 || !/^[AB](['’]s)?[,.;]?$/.test(w));
  return kept.join(' ').trim();
}
