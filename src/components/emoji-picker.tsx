import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { emojiSearch } from '@/utils/emoji';
import data, { EmojiData } from '@emoji-mart/data';
import { throttle } from 'lodash';
import { Emoji } from "./emoji";
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { SearchBar } from './ui/search-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '@/lib/utils';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import {
  Smile,
  Dog,
  Apple,
  Dumbbell,
  Car,
  Lightbulb,
  Hash,
  Flag,
} from 'lucide-react';

/** Max number of rows shown at once */
const MAX_ROWS = 30;

/** Skin tone options */
const SKIN_TONES = [
  { value: '0', label: 'Default', color: '#ffc93a' },
  { value: '1', label: 'Light', color: '#ffdab7' },
  { value: '2', label: 'Medium-Light', color: '#e7b98f' },
  { value: '3', label: 'Medium', color: '#c88c61' },
  { value: '4', label: 'Medium-Dark', color: '#a46134' },
  { value: '5', label: 'Dark', color: '#5d4437' },
] as const;

// Precompute category positions and row indices
const CATEGORY_POSITIONS = (() => {
  const positions: Record<string, { index: number; row: number }> = {};
  let currentIndex = 0;
  let currentRow = 0;

  data.categories.forEach((category) => {
    positions[category.id] = {
      index: currentIndex,
      row: currentRow,
    };
    currentIndex += category.emojis.length + 1; // +1 for category header
    currentRow += Math.ceil((category.emojis.length + 1) / 8);
  });

  return positions;
})();

/** Get category icon */
function getCategoryIcon(category: string, className?: string) {
  const props = { className: cn('h-4 w-4', className) };
  
  switch (category) {
    case 'people': return <Smile {...props} />;
    case 'nature': return <Dog {...props} />;
    case 'foods': return <Apple {...props} />;
    case 'activity': return <Dumbbell {...props} />;
    case 'places': return <Car {...props} />;
    case 'objects': return <Lightbulb {...props} />;
    case 'symbols': return <Hash {...props} />;
    case 'flags': return <Flag {...props} />;
    default: return null;
  }
}

/** Get category label */
function getCategoryLabel(category: string) {
  switch (category) {
    case 'people': return 'Smileys & People';
    case 'nature': return 'Animals & Nature';
    case 'foods': return 'Food & Drink';
    case 'activity': return 'Activities';
    case 'places': return 'Travel & Places';
    case 'objects': return 'Objects';
    case 'symbols': return 'Symbols';
    case 'flags': return 'Flags';
    default: return category;
  }
}

interface EmojiButtonProps {
  id: string;
  skin?: number;
  size: number;
  setHovered?: (id: string) => void;
  onClick?: () => void;
}

function EmojiButton({ id, skin, size, setHovered, onClick }: EmojiButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-[38px] w-[38px] p-1.5',
        'hover:bg-accent hover:text-accent-foreground'
      )}
      onMouseEnter={() => setHovered?.(id)}
      onClick={onClick}
    >
      <Emoji id={id} skin={skin} size={`${size}px`} />
    </Button>
  );
}

interface EmojiPickerProps {
  /** Size of each emoji in pixels */
  emojiSize?: number;
  /** Number of emojis per row */
  emojisPerRow?: number;
  /** Callback when an emoji is selected */
  onSelect?: (emoji: EmojiData) => void;
}

export function EmojiPicker({
  emojiSize = 24,
  emojisPerRow = 8,
  onSelect,
}: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [skin, setSkin] = useState('0');
  const [activeCategory, setActiveCategory] = useState(data.categories[0]?.id || '');
  const [hovered, setHovered] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Get the currently hovered emoji
  const hoveredEmoji = useMemo(() => 
    hovered ? emojiSearch.get(hovered) : null
  , [hovered]);

  // Get all emojis to display
  const emojis = useMemo(() => {
    if (search) {
      const query = search.toLowerCase().replace(/\s+/g, '_');
      return Object.values(data.emojis)
        .filter(emoji => 
          emoji.id.includes(query) ||
          emoji.keywords.some(kw => kw.includes(query)) ||
          emoji.name.toLowerCase().replace(/\s+/g, '_').includes(query)
        )
        .slice(0, MAX_ROWS)
        .map(emoji => emoji.id);
    }

    return data.categories.flatMap((category) => [
      `category-${category.id}`,
      ...category.emojis
    ]);
  }, [search]);

  // Calculate number of columns and rows
  const numColumns = emojisPerRow;
  const numRows = Math.ceil(emojis.length / numColumns);

  // Create virtualizer
  const rowVirtualizer = useVirtualizer({
    count: numRows,
    getScrollElement: () => {
      const viewport = containerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      return viewport as HTMLElement | null;
    },
    estimateSize: useCallback(() => 38, []), // Height of each row
    overscan: 5,
  });

  // Handle scroll to update active category
  const handleScroll = useCallback(() => {
    if (!containerRef.current || search) return;
    
    const viewport = containerRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const scrollTop = viewport.scrollTop;
    const rowHeight = 38; // Same as estimateSize
    const currentRow = Math.floor(scrollTop / rowHeight);

    // Find the category that contains this row
    let bestCategory = data.categories[0]?.id;
    for (const category of data.categories) {
      const position = CATEGORY_POSITIONS[category.id];
      if (position && position.row <= currentRow) {
        bestCategory = category.id;
      } else {
        break;
      }
    }

    if (bestCategory) {
      setActiveCategory(bestCategory);
    }
  }, [search]);

  // Throttle scroll updates
  const throttledScroll = useMemo(
    () => throttle(() => setIsScrolling(true), 150, { leading: true, trailing: false }),
    []
  );

  // Handle scroll events
  const onScroll = useCallback(() => {
    throttledScroll();
    handleScroll();
  }, [throttledScroll, handleScroll]);

  // Handle scroll end
  useEffect(() => {
    if (!isScrolling) return;

    const timer = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [isScrolling]);

  // Handle category change
  const handleCategoryChange = useCallback((categoryId: string) => {
    if (!containerRef.current || search) return;
    
    const viewport = containerRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const position = CATEGORY_POSITIONS[categoryId];
    if (!position) return;

    // Get category index for extra offset
    const categoryIndex = data.categories.findIndex(c => c.id === categoryId);
    const extraOffset = categoryIndex * 35;

    setActiveCategory(categoryId);
    setIsScrolling(true);

    viewport.scrollTo({
      top: position.row * 38 + extraOffset,
    });
  }, [search]);

  return (
    <div className="flex w-[352px] flex-col gap-4">
      <div className="flex gap-2 w-full">
        <div className="flex-grow">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search emojis..."
          />
        </div>
        <Select value={skin} onValueChange={setSkin}>
          <SelectTrigger className="w-[60px]">
            <SelectValue>
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: SKIN_TONES[parseInt(skin) ?? 0]?.color }}
              />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SKIN_TONES.map((tone) => (
              <SelectItem key={tone.value} value={tone.value}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: tone.color }}
                  />
                  <span>{tone.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeCategory} onValueChange={handleCategoryChange}>
        <TabsList className="grid w-full grid-cols-8">
          {data.categories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="px-2 py-1.5"
              title={getCategoryLabel(category.id)}
            >
              {getCategoryIcon(category.id)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ScrollArea
        ref={containerRef}
        className="h-[350px]"
        onScrollCapture={onScroll}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
            const rowStart = virtualRow.index * numColumns;
            const rowEmojis = emojis.slice(rowStart, rowStart + numColumns);

            return (
              <div
                key={virtualRow.index}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  'absolute top-0 left-0 right-0 grid grid-cols-8 gap-0.5 px-1',
                  'will-change-transform'
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {rowEmojis.map((id) => {
                  // Check if this is a category marker
                  if (id.startsWith('category-')) {
                    const categoryId = id.replace('category-', '');
                    return (
                      <div
                        key={id}
                        data-category={categoryId}
                        className="col-span-8 px-2 py-1 text-sm font-medium text-foreground/70"
                      >
                        {getCategoryLabel(categoryId)}
                      </div>
                    );
                  }

                  return (
                    <EmojiButton
                      key={id}
                      id={id}
                      skin={parseInt(skin) + 1}
                      size={emojiSize}
                      setHovered={setHovered}
                      onClick={() => {
                        const emoji = emojiSearch.get(id);
                        if (emoji) onSelect?.(emoji);
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex h-[48px] items-center gap-2 border-t pt-3">
        {hoveredEmoji ? (
          <>
            <Emoji id={hoveredEmoji.id} skin={parseInt(skin) + 1} size="32px" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{hoveredEmoji.name}</span>
              <span className="text-xs text-muted-foreground">:{hoveredEmoji.id}:</span>
            </div>
          </>
        ) : (
          <>
            <Emoji id="grinning" skin={parseInt(skin) + 1} size="32px" />
            <span className="text-sm text-muted-foreground">
              Pick an emoji...
            </span>
          </>
        )}
      </div>
    </div>
  );
}
