import { cn } from '@nish/ui';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, type ReactElement } from 'react';
import { Toolbar } from './Toolbar';

export interface EditorProps {
  /** HTML shown when the editor mounts (later changes to it are ignored). */
  initialHtml: string;
  /** Called with the document HTML after every edit. */
  onChange: (html: string) => void;
  /** Called once the editor exists, and with null when it is destroyed. */
  onReady: (editor: TiptapEditor | null) => void;
  /** True on mouse-and-keyboard devices: tooltips and no autofocus on touch. */
  fine: boolean;
}

/** Reads ngx-editor's `<span style="background-color:...">` highlights as well as `<mark>`. */
export const HighlightCompat = Highlight.extend({
  parseHTML() {
    return [
      { tag: 'mark' },
      {
        tag: 'span',
        priority: 101,
        // Not consuming, so TextStyle/Color still parse the same span.
        consuming: false,
        getAttrs: (el) => {
          const bg = (el as HTMLElement).style.backgroundColor;
          return bg && bg !== 'transparent' && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(bg) ? null : false;
        },
      },
    ];
  },
});

/** Inline images (as ngx-editor stored them, inside a paragraph) that keep their width. */
export const ImageCompat = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('width'),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.width ? { width: attrs.width } : {}),
      },
    };
  },
});

const CONTENT_CLASS = cn(
  'min-h-[40dvh] px-4 py-3 text-base leading-relaxed text-th-hi outline-none sm:min-h-[50dvh]',
  '[&_p]:my-2 [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold',
  '[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-lg [&_h4]:font-semibold',
  '[&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:font-semibold [&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:font-semibold [&_h6]:text-th-hi2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li>p]:my-0',
  '[&_a]:text-th-accent [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-th-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-th-hi2',
  '[&_code]:rounded [&_code]:bg-th-ghost [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]',
  '[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-th-accent',
  // Old ngx-editor highlights are opaque pastel hex colours: keep dark text on them in either theme.
  '[&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_mark[style*="#"]]:text-[#111]!',
  '[&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0',
  '[&_p.is-editor-empty:first-child::before]:text-th-hi3 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
);

/** The rich text editor (Tiptap) with its toolbar: above the text on wide screens, pinned
 *  to the bottom of the sheet on phones, so it rides above the on-screen keyboard. */
export default function Editor({ initialHtml, onChange, onReady, fine }: EditorProps): ReactElement {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
      ImageCompat.configure({ inline: true, allowBase64: true }),
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
      TextStyle,
      Color,
      HighlightCompat.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Write something…' }),
    ],
    content: initialHtml,
    autofocus: fine ? 'end' : false,
    editorProps: {
      attributes: { class: CONTENT_CLASS, 'aria-label': 'Notes', role: 'textbox', 'aria-multiline': 'true' },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor]);

  if (!editor) return <div className="min-h-[40dvh]" aria-busy="true" />;

  return (
    <div className="flex flex-col max-sm:min-h-[calc(100dvh-15rem)] sm:min-h-full">
      <Toolbar
        editor={editor}
        fine={fine}
        className={cn(
          'sticky z-10 bg-th-surface border-th-line',
          'max-sm:order-last max-sm:bottom-[-1.25rem] max-sm:-mb-5 max-sm:border-t',
          'sm:top-0 sm:border-b',
        )}
      />
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}
