import { cn } from '@/lib/utils';
import { emojiSearch } from '@/utils/emoji';
import data, { EmojiData } from '@emoji-mart/data';

type EmojiProps = {
  fallback?: string;
  id: string;
  native?: string;
  shortcodes?: string;
  size?: string | number;
  set?: string;
  skin?: number;
  emoji?: EmojiData;

  spritesheet?: string;
  getImageURL?: (set: string, id: string) => string;
  getSpritesheetURL?: (set: string) => string;
};

////////////////////////////////////////////////////////////
// From emoji-mart
export function Emoji(props: EmojiProps) {
  let { id, skin, emoji } = props;
  const set = props.set || 'native';

  if (props.shortcodes) {
    const matches = props.shortcodes.match(emojiSearch.SHORTCODES_REGEX);

    if (matches) {
      id = matches[1] || '';

      if (matches[2]) {
        skin = parseInt(matches[2]);
      }
    }
  }

  emoji ||= emojiSearch.get(id || props.native || '');
  if (!emoji) return <>{props.fallback || null}</>;

  const emojiSkin =
    skin !== undefined && skin <= emoji.skins.length
      ? emoji.skins[skin - 1]
      : emoji.skins[0];

  const imageSrc =
    emojiSkin?.src ||
    (set != 'native' && !props.spritesheet
      ? typeof props.getImageURL === 'function'
        ? props.getImageURL(set, emojiSkin?.unified || '')
        : `https://cdn.jsdelivr.net/npm/emoji-datasource-${set}@14.0.0/img/${set}/64/${emojiSkin?.unified}.png`
      : undefined);

  const spritesheetSrc =
    typeof props.getSpritesheetURL === 'function'
      ? props.getSpritesheetURL(set)
      : `https://cdn.jsdelivr.net/npm/emoji-datasource-${set}@14.0.0/img/${set}/sheets-256/64.png`;

  return (
    <span data-type='emojis' emoji-id={id} data-emoji-set={set}>
      {imageSrc ? (
        <img
          style={{
            maxWidth: props.size || '1em',
            maxHeight: props.size || '1em',
            display: 'inline-block',
            verticalAlign: 'middle',
          }}
          alt={emojiSkin?.native || emojiSkin?.shortcodes}
          src={imageSrc}
          loading='lazy'
        />
      ) : set == 'native' ? (
        <span
          className={cn('font-emoji inline-block align-middle')}
          style={{
            fontSize: props.size,
            lineHeight: 1,
          }}
        >
          {emojiSkin?.native}
        </span>
      ) : (
        <span
          style={{
            display: 'inline-block',
            verticalAlign: 'middle',
            width: props.size,
            height: props.size,
            backgroundImage: `url(${spritesheetSrc})`,
            backgroundSize: `${100 * data.sheet.cols}% ${
              100 * data.sheet.rows
            }%`,
            backgroundPosition: `${
              (100 / (data.sheet.cols - 1)) * (emojiSkin?.x || 0)
            }% ${(100 / (data.sheet.rows - 1)) * (emojiSkin?.y || 0)}%`,
          }}
        ></span>
      )}
    </span>
  );
}
