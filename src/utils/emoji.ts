import data, { EmojiData } from '@emoji-mart/data';
import emojiRegex from 'emoji-regex';

/** Regex used to detect native emojis */
const _emojiRegex = emojiRegex();

/** Type for emoji search options */
interface SearchOptions {
  maxResults?: number;
  caller?: string;
}

////////////////////////////////////////////////////////////
let _nativeToId: Record<string, string> | null = null;
let Pool: EmojiData[] | null = null;

export const emojiSearch = {
  SHORTCODES_REGEX: /^(?:\:([^\:]+)\:)(?:\:skin-tone-(\d)\:)?$/,

  get: (emojiId: string): EmojiData | undefined => {
    // Construct native to id if needed
    if (!_nativeToId) {
      _nativeToId = {};
      for (const emoji of Object.values(data.emojis)) {
        for (const skin of emoji.skins) {
          if (skin.native) _nativeToId[skin.native] = emoji.id;
        }
      }
    }

    const fromAliases = data.aliases[emojiId];
    const fromNative = _nativeToId[emojiId];

    return data.emojis[emojiId] || 
           (fromAliases ? data.emojis[fromAliases] : undefined) ||
           (fromNative ? data.emojis[fromNative] : undefined);
  },

  reset: () => {
    Pool = null;
  },

  search: (value: string, { maxResults = 90, caller }: SearchOptions = {}): EmojiData[] | undefined => {
    if (!value || !value.trim().length) return undefined;

    const values = value
      .toLowerCase()
      .replace(/(\w)-/, '$1 ')
      .split(/[\s|,]+/)
      .filter((word: string, i: number, words: string[]) => {
        return word.trim() && words.indexOf(word) === i;
      });

    if (!values.length) return undefined;

    let pool = Pool || (Pool = Object.values(data.emojis));
    let results: EmojiData[] = [];
    let scores: Record<string, number> = {};

    for (const value of values) {
      if (!pool.length) break;

      results = [];
      scores = {};

      for (const emoji of pool) {
        if (!emoji.search) continue;
        const score = emoji.search.indexOf(`,${value}`);
        if (score === -1) continue;

        results.push(emoji);
        scores[emoji.id] = (scores[emoji.id] || 0) + (emoji.id === value ? 0 : score + 1);
      }

      pool = results;
    }

    if (results.length < 2) {
      return results;
    }

    results.sort((a: EmojiData, b: EmojiData) => {
      const aScore = scores[a.id] || 0;
      const bScore = scores[b.id] || 0;

      if (aScore === bScore) {
        return a.id.localeCompare(b.id);
      }

      return aScore - bScore;
    });

    if (results.length > maxResults) {
      results = results.slice(0, maxResults);
    }

    return results;
  },
};

/** Renders all native emojis in a string so that they are displayed with the right font */
export function renderNativeEmojis(str: string): string {
  return str.replaceAll(_emojiRegex, (match) => {
    const emoji = emojiSearch.get(match);
    return emoji
      ? `<span class="emoji" data-type="emojis" emoji-id="${emoji.id}" data-emoji-set="native">${match}</span>`
      : match;
  });
}
