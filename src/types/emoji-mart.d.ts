declare module '@emoji-mart/data' {
  export interface EmojiSkin {
    unified: string;
    native: string;
    src?: string;
    shortcodes?: string;
    x?: number;
    y?: number;
  }

  export interface EmojiData {
    id: string;
    name: string;
    emoticons?: string[];
    keywords: string[];
    skins: EmojiSkin[];
    version: number;
    search?: string;
  }

  export interface Category {
    id: string;
    emojis: string[];
  }

  export interface SheetData {
    rows: number;
    cols: number;
  }

  const data: {
    categories: Category[];
    emojis: Record<string, EmojiData>;
    aliases: Record<string, string>;
    natives: Record<string, string>;
    sheet: SheetData;
  };

  export default data;
}
