import sanitizeHtml from 'sanitize-html';

/**
 * Blog bodies now arrive as HTML from the Tiptap editor, which means they are
 * attacker-controlled markup that other users will render. Sanitising happens
 * here, on the way in, so the database only ever holds markup that is already
 * safe: the frontend renders stored content directly, and any client-side
 * cleaning could be skipped by talking to the API instead.
 *
 * The allowlist matches what the editor can actually produce. Anything else —
 * script, style, iframe, event handlers, javascript: URLs — is dropped.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'mark',
    'code',
    'pre',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'hr',
    'a',
    'img',
    'sub',
    'sup',
    'div',
    'span',
    'label',
    'input',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    // Tiptap marks alignment and task lists with these.
    '*': ['style', 'class', 'data-type', 'data-checked'],
    input: ['type', 'checked', 'disabled'],
  },
  // Only these schemes may appear in href/src; this is what stops
  // javascript: and data: payloads from surviving.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowedStyles: {
    '*': {
      'text-align': [/^left$|^right$|^center$|^justify$/],
    },
  },
  transformTags: {
    // A link written by one user is opened by another, so it never gets to
    // reach back into this tab.
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
  },
};

export function sanitizeBlogContent(html: string) {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * A listing needs plain words, not markup: the excerpt is cut from the text
 * content so a post starting with a heading does not produce "<h2>Title…".
 */
export function htmlToPlainText(html: string) {
  // Block boundaries become spaces first: stripping tags directly would turn
  // "<h2>Heading</h2><p>Body" into "HeadingBody".
  const spaced = html.replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>|<br\s*\/?>/gi, ' ');
  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });

  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
