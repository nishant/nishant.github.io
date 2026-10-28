import { describe, expect, it } from 'vitest';
import { isSafeUrl } from '../../components/LinkGrid';

describe('isSafeUrl', () => {
  it('rejects obfuscated script schemes', () => {
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false);
    expect(isSafeUrl('\u0001javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });
  it('allows http, https, mailto and bare addresses', () => {
    expect(isSafeUrl('https://a.com')).toBe(true);
    expect(isSafeUrl('mailto:a@b.c')).toBe(true);
    expect(isSafeUrl('example.com/x')).toBe(true);
  });
});

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { HighlightCompat, ImageCompat } from './Editor';

describe('ngx-editor round trip', () => {
  const load = (html: string): string =>
    new Editor({
      extensions: [StarterKit, TextStyle, HighlightCompat.configure({ multicolor: true }), ImageCompat.configure({ inline: true, allowBase64: true })],
      content: html,
    }).getHTML();

  it('keeps background-color spans', () => {
    expect(load('<p><span style="background-color:#fef2c0;">hi</span></p>')).toMatch(/background-color|fef2c0|254, 242, 192/i);
  });
  it('keeps inline image width inside its paragraph', () => {
    const out = load('<p>a <img src="data:image/png;base64,AAAA" width="120"> b</p>');
    expect(out).toContain('width="120"');
    expect(out.match(/<p>/g)?.length).toBe(1);
  });
});
