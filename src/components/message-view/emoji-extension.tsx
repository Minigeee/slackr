import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Node, nodePasteRule } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, {
  SuggestionOptions,
  SuggestionProps,
} from '@tiptap/suggestion';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { emojiSearch } from '@/utils/emoji';
import data, { EmojiData } from '@emoji-mart/data';
import emojiRegex from 'emoji-regex';
import tippy, { Instance, Props as TippyProps } from 'tippy.js';
import { Emoji } from '../emoji';

const _emojiRegex = emojiRegex();

/** Emoji ids */
const _data = Object.keys(data.emojis);

/** Max number of rows shown at once */
const MAX_ROWS = 30;

// Track if emoji suggester is open
let isEmojiSuggesterOpen = false;
export const getIsEmojiSuggesterOpen = () => isEmojiSuggesterOpen;

////////////////////////////////////////////////////////////
const EmojiSuggestionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  SuggestionProps<EmojiData>
>((props, ref) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const fixScroll = (idx: number) => {
    if (viewportRef.current) {
      const itemHeight = 36; // Fixed height for each item
      if (
        viewportRef.current.scrollTop + viewportRef.current.clientHeight <
        (idx + 1) * itemHeight
      ) {
        viewportRef.current.scrollTo({
          top: (idx + 1) * itemHeight - viewportRef.current.clientHeight + 4,
        });
      } else if (viewportRef.current.scrollTop > idx * itemHeight) {
        viewportRef.current.scrollTo({ top: idx * itemHeight });
      }
    }
  };

  const upHandler = () => {
    const idx =
      (selectedIndex + props.items.length - (selectedIndex < 0 ? 0 : 1)) %
      props.items.length;
    setSelectedIndex(idx);
    fixScroll(idx);
  };

  const downHandler = () => {
    const idx = (selectedIndex + 1) % props.items.length;
    setSelectedIndex(idx);
    fixScroll(idx);
  };

  const enterHandler = () => {
    if (selectedIndex >= 0) selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className='relative rounded-md border bg-popover text-popover-foreground shadow-md min-w-[200px]'>
      <ScrollArea className='h-[200px] p-1'>
        <div className='space-y-0.5'>
          {props.items.length ? (
            <>
              {props.items.map((emoji, i) => (
                <Button
                  key={emoji.id}
                  variant='ghost'
                  className={cn(
                    'w-full justify-start px-2 py-1 text-sm',
                    selectedIndex === i && 'bg-accent',
                  )}
                  onClick={() => selectItem(i)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className='flex items-center gap-2'>
                    <Emoji id={emoji.id} size='1rem' />
                    <span className='font-medium'>:{emoji.id}:</span>
                  </div>
                </Button>
              ))}
              {props.items.length >= MAX_ROWS && (
                <p className='px-2 py-1 text-xs text-muted-foreground'>
                  Continue typing to view more...
                </p>
              )}
            </>
          ) : (
            <p className='p-2 text-sm text-muted-foreground'>No results</p>
          )}
        </div>
        <ScrollBar orientation='vertical' />
      </ScrollArea>
    </div>
  );
});

EmojiSuggestionList.displayName = 'EmojiSuggestionList';

// Cache of search results
let _searchCache: Record<string, string[]> = {};

////////////////////////////////////////////////////////////
const EmojiSuggestor: Omit<SuggestionOptions<EmojiData>, 'editor'> = {
  char: ':',

  items: async ({ editor, query }) => {
    query = query.toLocaleLowerCase();

    // Check if a prev query exists
    const prev =
      query.length > 1 ? _searchCache[query.slice(0, -1)] : undefined;

    // Get search results
    const results =
      query.length > 0
        ? _searchCache[query] ||
          (prev || _data).filter((x) => x.includes(query))
        : _data;

    // Save results
    _searchCache[query] = results;

    // Filter out undefined values and ensure type safety
    const emojiResults = results
      .slice(0, MAX_ROWS)
      .map((x) => emojiSearch.get(x))
      .filter((x): x is EmojiData => x !== undefined);

    return emojiResults;
  },

  render: () => {
    let component: ReactRenderer<any>;
    let popup: Instance<TippyProps>[] | null = null;

    return {
      onStart: (props) => {
        // Reset cache
        _searchCache = {};
        isEmojiSuggesterOpen = true;

        component = new ReactRenderer(EmojiSuggestionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: () => props.clientRect?.() || new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: () => props.clientRect?.() || new DOMRect(),
        });
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          isEmojiSuggesterOpen = false;
          return true;
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        popup?.[0]?.destroy();
        component.destroy();
        isEmojiSuggesterOpen = false;
      },
    };
  },

  command: ({ editor, range, props }) => {
    // increase range.to by one when the next node is of type "text"
    // and starts with a space character
    const nodeAfter = editor.view.state.selection.$to.nodeAfter;
    const overrideSpace = nodeAfter?.text?.startsWith(' ');

    if (overrideSpace) {
      range.to += 1;
    }

    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        {
          type: 'emojis',
          attrs: {
            'emoji-id': props.id,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .run();

    window.getSelection()?.collapseToEnd();
    isEmojiSuggesterOpen = false;
  },
};

////////////////////////////////////////////////////////////
export const Emojis = Node.create({
  name: 'emojis',

  priority: 1000,

  addAttributes() {
    return {
      'emoji-id': {
        default: '',
      },
      'data-emoji-set': {
        default: 'native',
      },
    };
  },

  addOptions() {
    return {
      suggestion: EmojiSuggestor,
    };
  },

  group: 'inline',
  inline: true,
  selectable: false,

  addPasteRules() {
    return [
      nodePasteRule({
        find: _emojiRegex,
        type: this.type,
        getAttributes: (match) => {
          const emoji = emojiSearch.get(match[0]);
          return { 'emoji-id': emoji?.id || '' };
        },
      }),
      nodePasteRule({
        find: /:(\w+):/g,
        type: this.type,
        getAttributes: (match) => {
          // Ensure match[1] exists before passing to emojiSearch
          const emojiId = match[1];
          if (!emojiId) return null;

          const emoji = emojiSearch.get(emojiId);
          return emoji ? { 'emoji-id': emojiId } : null;
        },
      }),
    ];
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as { 'emoji-id'?: string };

    // Construct attrs
    const finalAttrs = {
      ...HTMLAttributes,
      class: 'emoji font-emoji',
      ['data-type']: 'emojis',
    };

    const emoji = attrs['emoji-id'] ? emojiSearch.get(attrs['emoji-id']) : null;
    const native = emoji?.skins[0]?.native;

    return ['span', finalAttrs, native || ''];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
