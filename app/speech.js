// 読み上げ(Web Speech API の音声合成)。ブラウザの音声合成に触れるのはこのファイルだけ(doc_audit.py の INV-1 が見る)。
// どの音声で読むか・何を読むかは core/speech.js が決める。端末内の音声だけを使い、単語や例文を外部へ送らない(INV-1)。
// 規則とブラウザ・OS ごとの違いは Docs/24_Speech.md。

import { langVoices, pickVoice, remoteLangCount, normLang, rateOf } from '../core/speech.js';
import { LANG } from './lang.js';

/** @typedef {import('./storage.js').Settings} Settings */

/** 音声合成の本体。Android の Firefox など、持たないブラウザでは null */
const synth = typeof globalThis.speechSynthesis === 'object' && globalThis.speechSynthesis !== null
  && typeof globalThis.SpeechSynthesisUtterance === 'function' ? globalThis.speechSynthesis : null;

/** 一覧は非同期で届くことがある(Chrome は最初の呼び出しで読み込みを始め、届くと voiceschanged を出す) */
const all = () => (synth ? synth.getVoices() : []);
all();

/** このブラウザが読み上げを持つか */
export const supported = synth !== null;

/** 使ってよい、単語帳の言語(app/lang.js)の音声(選ぶ順) */
export const voices = () => langVoices(all(), LANG);

/** インターネット経由のため使わない、単語帳の言語の音声の数 */
export const remoteCount = () => remoteLangCount(all(), LANG);

/**
 * 今の設定で読める音声があるか。
 * @param {Settings} settings
 */
export const canSpeak = (settings) => pickVoice(all(), settings.speechVoice, LANG) !== null;

/**
 * 音声の一覧が届いたら呼ぶ。
 * @param {() => void} cb
 */
export function onVoicesChanged(cb) {
  synth?.addEventListener('voiceschanged', cb);
}

/**
 * 読み上げる。前の読み上げは止める。使える音声が無ければ読まずに false を返す
 * (言語だけを指定して読ませると、ブラウザがインターネット経由の音声を選ぶことがあるため。INV-1)。
 * @param {string} text
 * @param {Settings} settings
 * @returns {boolean}
 */
export function speak(text, settings) {
  if (!synth || !text) return false;
  const v = pickVoice(all(), settings.speechVoice, LANG);
  if (!v) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = normLang(v.lang).replace(/-([a-z]+)$/, (_, r) => '-' + r.toUpperCase());
  u.rate = rateOf(settings.speechRate);
  synth.cancel();
  synth.speak(u);
  return true;
}

/** 読み上げを止める */
export function stop() {
  synth?.cancel();
}
