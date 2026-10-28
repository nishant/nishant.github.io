import type { Editor } from '@tiptap/react';
import { Button, DropdownMenu, IconButton, Input, MenuItem, Popover, ScrollRow, Tooltip, cn } from '@nish/ui';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactElement, type ReactNode, type RefObject } from 'react';

const SWATCHES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** Keeps the editor selection when a toolbar button is pressed. */
const keepFocus = (e: { preventDefault: () => void }): void => e.preventDefault();

/** The concrete color behind a design token, so saved notes do not depend on the theme. */
function tokenColor(n: number): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--nish-chart-${n}`).trim();
  return v || '#8b93ff';
}

/** Adds https:// to a bare address; only http, https and mailto are kept. Returns null for anything else. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

interface ToolProps {
  label: string;
  icon: ReactNode;
  fine: boolean;
  active?: boolean;
  onClick: () => void;
}

/** One toolbar icon button; a tooltip on fine pointers only (touch screens have no hover). */
function Tool({ label, icon, fine, active, onClick }: ToolProps): ReactElement {
  const button = (
    <IconButton label={label} active={active} onMouseDown={keepFocus} onClick={onClick}>
      {icon}
    </IconButton>
  );
  return fine ? (
    <Tooltip tip={label} focusable={false}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

interface UrlPopoverProps {
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  label: string;
  initial: string;
  onApply: (url: string) => void;
  onRemove?: () => void;
}

function UrlPopover({ anchor, onClose, label, initial, onApply, onRemove }: UrlPopoverProps): ReactElement | null {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const url = normalizeUrl(value);
    if (!url) {
      setError('Enter a full address, like https://example.com');
      return;
    }
    onApply(url);
    onClose();
  };
  return (
    <Popover open onOpenChange={(o) => !o && onClose()} anchor={anchor} width={288} aria-label={label}>
      <form onSubmit={submit} className="flex flex-col gap-2 p-1">
        <Input
          autoFocus
          type="url"
          inputMode="url"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          placeholder="https://example.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
        />
        {error && <p className="text-xs text-th-loss">{error}</p>}
        <div className="flex justify-end gap-2">
          {onRemove && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              Remove
            </Button>
          )}
          <Button size="sm" variant="primary" type="submit">
            Apply
          </Button>
        </div>
      </form>
    </Popover>
  );
}

interface SwatchPopoverProps {
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  label: string;
  /** Percent of the color kept (the rest is transparent). */
  alpha: number;
  onPick: (color: string) => void;
  onReset: () => void;
}

function SwatchPopover({ anchor, onClose, label, alpha, onPick, onReset }: SwatchPopoverProps): ReactElement | null {
  const mix = (c: string): string => (alpha < 100 ? `color-mix(in srgb, ${c} ${alpha}%, transparent)` : c);
  return (
    <Popover open onOpenChange={(o) => !o && onClose()} anchor={anchor} aria-label={label}>
      <div className="flex flex-col gap-2 p-1">
        <div className="grid grid-cols-4 gap-2">
          {SWATCHES.map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${label} ${n}`}
              onMouseDown={keepFocus}
              onClick={() => {
                onPick(mix(tokenColor(n)));
                onClose();
              }}
              className="size-9 rounded-md border border-th-line-strong pointer-coarse:size-11"
              style={{ background: mix(`var(--nish-chart-${n})`) }}
            />
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onMouseDown={keepFocus}
          onClick={() => {
            onReset();
            onClose();
          }}
        >
          Reset
        </Button>
      </div>
    </Popover>
  );
}

type Panel = 'link' | 'image' | 'color' | 'highlight';

/** Formatting toolbar for the notes editor: one horizontally scrolling row of icon buttons. */
export function Toolbar({ editor, fine, className }: { editor: Editor; fine: boolean; className?: string }): ReactElement {
  const linkRef = useRef<HTMLSpanElement>(null);
  const imageRef = useRef<HTMLSpanElement>(null);
  const colorRef = useRef<HTMLSpanElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = (): void => setPanel(null);
  const run = () => editor.chain().focus();

  const headingLevel = LEVELS.find((l) => editor.isActive('heading', { level: l }));
  const align = (['left', 'center', 'right', 'justify'] as const).find((a) => editor.isActive({ textAlign: a }));
  const AlignIcon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[align ?? 'left'];

  return (
    <div className={cn('shrink-0', className)}>
      <ScrollRow label="Formatting" className="gap-0.5 px-2 py-1">
        <Tool label="Bold" fine={fine} icon={<Bold size={18} />} active={editor.isActive('bold')} onClick={() => run().toggleBold().run()} />
        <Tool label="Italic" fine={fine} icon={<Italic size={18} />} active={editor.isActive('italic')} onClick={() => run().toggleItalic().run()} />
        <Tool label="Underline" fine={fine} icon={<Underline size={18} />} active={editor.isActive('underline')} onClick={() => run().toggleUnderline().run()} />
        <Tool label="Strikethrough" fine={fine} icon={<Strikethrough size={18} />} active={editor.isActive('strike')} onClick={() => run().toggleStrike().run()} />
        <Tool label="Inline code" fine={fine} icon={<Code size={18} />} active={editor.isActive('code')} onClick={() => run().toggleCode().run()} />
        <Tool label="Quote" fine={fine} icon={<Quote size={18} />} active={editor.isActive('blockquote')} onClick={() => run().toggleBlockquote().run()} />
        <Tool label="Numbered list" fine={fine} icon={<ListOrdered size={18} />} active={editor.isActive('orderedList')} onClick={() => run().toggleOrderedList().run()} />
        <Tool label="Bullet list" fine={fine} icon={<List size={18} />} active={editor.isActive('bulletList')} onClick={() => run().toggleBulletList().run()} />

        <DropdownMenu
          aria-label="Heading"
          sheetBelow="sm"
          sheetTitle="Heading"
          trigger={
            <IconButton label="Heading" active={headingLevel !== undefined} onMouseDown={keepFocus}>
              <Heading size={18} />
            </IconButton>
          }
        >
          <MenuItem active={headingLevel === undefined} onSelect={() => run().setParagraph().run()}>
            Paragraph
          </MenuItem>
          {LEVELS.map((level) => (
            <MenuItem key={level} active={headingLevel === level} onSelect={() => run().setHeading({ level }).run()}>
              Heading {level}
            </MenuItem>
          ))}
        </DropdownMenu>

        <span ref={linkRef} className="inline-flex">
          <Tool label="Link" fine={fine} icon={<LinkIcon size={18} />} active={editor.isActive('link')} onClick={() => setPanel('link')} />
        </span>
        <span ref={imageRef} className="inline-flex">
          <Tool label="Image" fine={fine} icon={<ImageIcon size={18} />} onClick={() => setPanel('image')} />
        </span>
        <span ref={colorRef} className="inline-flex">
          <Tool
            label="Text color"
            fine={fine}
            icon={<Palette size={18} />}
            active={Boolean(editor.getAttributes('textStyle').color)}
            onClick={() => setPanel('color')}
          />
        </span>
        <span ref={highlightRef} className="inline-flex">
          <Tool label="Highlight" fine={fine} icon={<Highlighter size={18} />} active={editor.isActive('highlight')} onClick={() => setPanel('highlight')} />
        </span>

        <DropdownMenu
          aria-label="Align"
          sheetBelow="sm"
          sheetTitle="Align"
          trigger={
            <IconButton label="Align" active={align !== undefined && align !== 'left'} onMouseDown={keepFocus}>
              <AlignIcon size={18} />
            </IconButton>
          }
        >
          <MenuItem icon={<AlignLeft size={14} />} active={align === 'left'} onSelect={() => run().setTextAlign('left').run()}>
            Left
          </MenuItem>
          <MenuItem icon={<AlignCenter size={14} />} active={align === 'center'} onSelect={() => run().setTextAlign('center').run()}>
            Center
          </MenuItem>
          <MenuItem icon={<AlignRight size={14} />} active={align === 'right'} onSelect={() => run().setTextAlign('right').run()}>
            Right
          </MenuItem>
          <MenuItem icon={<AlignJustify size={14} />} active={align === 'justify'} onSelect={() => run().setTextAlign('justify').run()}>
            Justify
          </MenuItem>
        </DropdownMenu>
      </ScrollRow>

      {panel === 'link' && (
        <UrlPopover
          anchor={linkRef}
          onClose={close}
          label="Link address"
          initial={(editor.getAttributes('link').href as string | undefined) ?? ''}
          onApply={(url) => {
            if (editor.state.selection.empty && !editor.isActive('link')) {
              run()
                .insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] })
                .run();
            } else {
              run().extendMarkRange('link').setLink({ href: url }).run();
            }
          }}
          onRemove={editor.isActive('link') ? () => run().extendMarkRange('link').unsetLink().run() : undefined}
        />
      )}
      {panel === 'image' && (
        <UrlPopover anchor={imageRef} onClose={close} label="Image address" initial="" onApply={(url) => run().setImage({ src: url }).run()} />
      )}
      {panel === 'color' && (
        <SwatchPopover
          anchor={colorRef}
          onClose={close}
          label="Text color"
          alpha={100}
          onPick={(c) => run().setColor(c).run()}
          onReset={() => run().unsetColor().run()}
        />
      )}
      {panel === 'highlight' && (
        <SwatchPopover
          anchor={highlightRef}
          onClose={close}
          label="Highlight"
          alpha={30}
          onPick={(c) => run().setHighlight({ color: c }).run()}
          onReset={() => run().unsetHighlight().run()}
        />
      )}
    </div>
  );
}
