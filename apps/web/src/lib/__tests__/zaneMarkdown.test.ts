import { describe, expect, it } from 'vitest';

import {
  normalizeLatexDelimiters,
  repairBoldBoundaries,
  repairListGlue,
  repairSpacedBold,
} from '@/lib/ai/zaneMarkdown';

describe('normalizeLatexDelimiters', () => {
  it('rewrites display and inline LaTeX delimiters to $ forms', () => {
    expect(normalizeLatexDelimiters('\\[x^2\\]')).toBe('$$x^2$$');
    expect(normalizeLatexDelimiters('\\(x^2\\)')).toBe('$x^2$');
  });

  it('leaves text without LaTeX delimiters untouched', () => {
    expect(normalizeLatexDelimiters('نص عادي بدون رياضيات')).toBe('نص عادي بدون رياضيات');
  });
});

describe('repairSpacedBold', () => {
  it('trims inner padding so Arabic spaced bold parses', () => {
    expect(repairSpacedBold('** نص عريض **')).toBe('**نص عريض**');
  });

  it('keeps already-tight bold intact', () => {
    expect(repairSpacedBold('ملاحظة:**النص المهم.**')).toBe('ملاحظة:**النص المهم.**');
  });

  it('never touches fenced code blocks', () => {
    const fenced = '```\na ** b ** c\n```';
    expect(repairSpacedBold(fenced)).toBe(fenced);
  });
});

describe('repairBoldBoundaries — glued `**` onto words (spec 012, item 2)', () => {
  it('spaces a bold opener glued to an Arabic word (owner smoke sentence)', () => {
    expect(repairBoldBoundaries('عايزه**متعدد الصفحات**؟')).toBe(
      'عايزه **متعدد الصفحات**؟',
    );
  });

  it('spaces both boundaries of a Latin bold span glued into Arabic', () => {
    expect(repairBoldBoundaries('أعمله**React**بدل الفانيلا')).toBe(
      'أعمله **React** بدل الفانيلا',
    );
  });

  it('leaves already-spaced bold untouched (no double spaces)', () => {
    expect(repairBoldBoundaries('عايزه **متعدد الصفحات**')).toBe(
      'عايزه **متعدد الصفحات**',
    );
    expect(repairBoldBoundaries('x **y** z')).toBe('x **y** z');
  });

  it('keeps punctuation attached to the bold span', () => {
    expect(repairBoldBoundaries('ملاحظة:**النص المهم.**')).toBe(
      'ملاحظة:**النص المهم.**',
    );
    expect(repairBoldBoundaries('كتب **شيئاً**.')).toBe('كتب **شيئاً**.');
    expect(repairBoldBoundaries('**done.**? then')).toBe('**done.**? then');
    expect(repairBoldBoundaries('سؤال **مهم؟**؟')).toBe('سؤال **مهم؟**؟');
  });

  it('never touches fenced code blocks', () => {
    const fenced = '```\na**b**c\n```';
    expect(repairBoldBoundaries(fenced)).toBe(fenced);
  });

  it('repairs multiple glued spans on one line', () => {
    expect(repairBoldBoundaries('عايزه**React**بدل الفانيلا**متعدد الصفحات**أو')).toBe(
      'عايزه **React** بدل الفانيلا **متعدد الصفحات** أو',
    );
  });
});

describe('repairBoldBoundaries — end-to-end with the real remark chain', () => {
  // AST-probe verified: current remark (CommonMark 0.31) parses glued
  // `عايزه**متعدد**` as strong — the defect is the MISSING SPACE in the DOM,
  // not broken parsing. Pin that the repair adds the space while keeping
  // the bold intact.
  it('adds the boundary space without disturbing the strong node', async () => {
    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkGfm = (await import('remark-gfm')).default;
    const remarkBreaks = (await import('remark-breaks')).default;
    const proc = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks);

    const raw = 'عايزه**متعدد الصفحات**بدل';
    const repaired = repairBoldBoundaries(raw);
    expect(repaired).toBe('عايزه **متعدد الصفحات** بدل');

    const countStrong = (text: string): number => {
      let count = 0;
      const visit = (node: { type: string; children?: Array<{ type: string; children?: Array<unknown> }> }) => {
        if (node.type === 'strong') count += 1;
        node.children?.forEach((child) => visit(child as { type: string; children?: Array<{ type: string; children?: Array<unknown> }> }));
      };
      visit(proc.parse(text) as { type: string; children?: Array<{ type: string; children?: Array<unknown> }> });
      return count;
    };
    expect(countStrong(raw)).toBe(1);
    expect(countStrong(repaired)).toBe(1);
  });
});

describe('repairListGlue — label glued to ordered marker', () => {
  it('splits `label:1. item` so the sequence parses as a list (round-12 proof: raw input is one paragraph)', () => {
    const raw = 'مرتبة:1. تحليل المشكلة\n2. تصميم الخوارزمية\n3. كتابة الكود\n4. الاختبار';
    const fixed = repairListGlue(raw);
    expect(fixed).toBe('مرتبة:\n\n1. تحليل المشكلة\n2. تصميم الخوارزمية\n3. كتابة الكود\n4. الاختبار');
  });

  it('works when the glued marker does not start at 1', () => {
    const fixed = repairListGlue('مرتبة:3. أولاً\n4. ثانياً');
    expect(fixed).toBe('مرتبة:\n\n3. أولاً\n4. ثانياً');
  });

  it('does not split when no numbered continuation follows (could be plain text)', () => {
    expect(repairListGlue('الدرجة:3. من 5')).toBe('الدرجة:3. من 5');
  });

  it('leaves table-like and URL-ish colons alone', () => {
    const line = 'https://example.com/page';
    expect(repairListGlue(line)).toBe(line);
  });
});

describe('repairListGlue — bare label line before N≠1 list', () => {
  it('inserts the blank line a non-1 list needs to start', () => {
    expect(repairListGlue('غير مرتبة:\n3. أولاً\n4. ثانياً')).toBe('غير مرتبة:\n\n3. أولاً\n4. ثانياً');
  });

  it('keeps a 1-starting list tight (it already interrupts the paragraph)', () => {
    expect(repairListGlue('مرتبة:\n1. أولاً\n2. ثانياً')).toBe('مرتبة:\n1. أولاً\n2. ثانياً');
  });
});

describe('repairListGlue — glued hyphen bullet', () => {
  it('pads `-**Bold**` so the line becomes a list item (round-12 proof: raw input is a paragraph)', () => {
    expect(repairListGlue('-**Bold Text** — نص عريض')).toBe('- **Bold Text** — نص عريض');
    expect(repairListGlue('-Bold Text — نص عريض')).toBe('- Bold Text — نص عريض');
  });

  it('leaves horizontal rules, negative numbers, blockquote-ish arrows and spaced bullets alone', () => {
    expect(repairListGlue('---')).toBe('---');
    expect(repairListGlue('-5 درجات')).toBe('-5 درجات');
    expect(repairListGlue('-> متابعة')).toBe('-> متابعة');
    expect(repairListGlue('- [x] مهمة منجزة')).toBe('- [x] مهمة منجزة');
  });

  it('never touches fenced code blocks', () => {
    const fenced = '```\n-negative\n```';
    expect(repairListGlue(fenced)).toBe(fenced);
  });
});

describe('repairListGlue — bare task markers', () => {
  it('restores the hyphen on line-leading bare task items (round-13 screenshot: `[x]` glued as literal text)', () => {
    expect(repairListGlue('[x] مهمة مكتملة')).toBe('- [x] مهمة مكتملة');
    expect(repairListGlue('[ ] مهمة معلقة')).toBe('- [ ] مهمة معلقة');
    expect(repairListGlue('[X] done')).toBe('- [X] done');
  });

  it('keeps already-valid task items and non-task brackets untouched', () => {
    expect(repairListGlue('- [x] مهمة منجزة')).toBe('- [x] مهمة منجزة');
    expect(repairListGlue('[x]بلا مسافة')).toBe('[x]بلا مسافة');
    expect(repairListGlue('انظر [1] للمرجع')).toBe('انظر [1] للمرجع');
  });
});

describe('repairListGlue — end-to-end with the real remark chain', () => {
  it('produces an ordered list AST for the round-12 failing input', async () => {
    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkGfm = (await import('remark-gfm')).default;
    const remarkBreaks = (await import('remark-breaks')).default;
    const proc = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks);

    const raw = 'مرتبة:1. تحليل المشكلة\n2. تصميم الخوارزمية\n3. كتابة الكود\n4. الاختبار';
    const before = proc.parse(raw);
    expect(before.children.map((n) => n.type)).toEqual(['paragraph']);

    const after = proc.parse(repairListGlue(raw));
    expect(after.children.map((n) => n.type)).toEqual(['paragraph', 'list']);
  });
});

describe('HeavyLatexRenderer — bidi isolation (round 13)', () => {
  // The owner's screenshot showed `E = mc^2` mirrored to `²mc = E`: katex
  // 0.16 ships no direction rule of its own, so the math inherited the
  // Arabic bubble's rtl. Pin the isolation here — no DOM needed.
  it('renders math inside a dir="ltr" span', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: HeavyLatexRenderer } = await import(
      '@/components/HeavyLatexRenderer'
    );

    const html = renderToStaticMarkup(
      React.createElement(HeavyLatexRenderer, { text: '$E = mc^2$' }),
    );
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('katex');
  });
});

describe('react-markdown v10 hands `start` to the ol component', () => {
  // The live DOM check for this was environment-blocked (flaky headless),
  // so pin the integration point here: our ol override can only seed the
  // CSS counter if react-markdown actually forwards the list's start.
  it('forwards start for a list beginning at N ≠ 1 and omits it at 1', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: ReactMarkdown } = await import('react-markdown');

    const starts: Array<number | string | undefined> = [];
    const components = {
      ol: (props: { start?: number; children?: React.ReactNode }) => {
        starts.push(props.start);
        return React.createElement('ol', null, props.children);
      },
    };

    renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        { remarkPlugins: [(await import('remark-gfm')).default], components },
        '3. أولاً\n4. ثانياً',
      ),
    );
    expect(starts).toEqual([3]);

    starts.length = 0;
    renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        { remarkPlugins: [(await import('remark-gfm')).default], components },
        '1. أولاً\n2. ثانياً',
      ),
    );
    expect(starts).toEqual([undefined]);
  });
});
