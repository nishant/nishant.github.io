import { closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { bracketMatching, indentUnit } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { useLatest } from '../../lib/useLatest';

export interface JsonEditorProps {
  /** The text to show. Pushing a different value than the editor holds replaces its content. */
  value: string;
  onChange: (text: string) => void;
  /** Accessible name for the editing area. */
  label?: string;
}

/** Touch devices get 16px so the browser does not zoom the page on focus. */
const coarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Colors come from the --nish-* tokens, so light and dark follow the theme without a reconfigure. */
const makeTheme = () =>
  EditorView.theme({
  '&': {
    height: 'min(60dvh, 32rem)',
    color: 'var(--nish-hi)',
    backgroundColor: 'var(--nish-surface)',
    border: '1px solid var(--nish-line)',
    borderRadius: 'var(--nish-radius-md, 8px)',
    fontSize: coarsePointer() ? '16px' : '13px',
  },
  '&.cm-focused': { outline: '2px solid var(--nish-focus)', outlineOffset: '2px' },
  '.cm-scroller': { fontFamily: 'var(--app-font, ui-monospace, monospace)', lineHeight: '1.5', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--nish-accent)', padding: '8px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--nish-accent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--nish-accent-soft)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--nish-hi) 4%, transparent)' },
  '.cm-gutters': {
    color: 'var(--nish-hi3)',
    backgroundColor: 'var(--nish-surface)',
    border: 'none',
    borderRight: '1px solid var(--nish-line)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--nish-hi2)' },
  '.cm-tooltip': {
    color: 'var(--nish-hi)',
    backgroundColor: 'var(--nish-elevated)',
    border: '1px solid var(--nish-line-strong)',
  },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--nish-loss)' },
  '.cm-lint-marker-error': { content: 'none' },
});

/** CodeMirror 6 JSON editor (lazy-loaded by JsonTab). */
export default function JsonEditor({ value, onChange, label = 'Raw JSON' }: JsonEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useLatest(onChange);

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          closeBrackets(),
          indentUnit.of('  '),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          json(),
          linter(jsonParseLinter()),
          lintGutter(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': label, autocapitalize: 'off', spellcheck: 'false' }),
          makeTheme(),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is created once; later `value` changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} />;
}
