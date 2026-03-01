const { linkify, escapeHtml } = require('../src/utils/linkify');

describe('escapeHtml', () => {
  test('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  test('escapes angle brackets', () => {
    expect(escapeHtml('<div>hello</div>')).toBe('&lt;div&gt;hello&lt;/div&gt;');
  });

  test('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  test('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  test('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  test('escapes all special characters together', () => {
    expect(escapeHtml('<b>"Tom & Jerry\'s"</b>')).toBe(
      '&lt;b&gt;&quot;Tom &amp; Jerry&#039;s&quot;&lt;/b&gt;'
    );
  });
});

describe('linkify', () => {
  test('returns plain text unchanged', () => {
    expect(linkify('hello world')).toBe('hello world');
  });

  test('converts http URL to clickable link', () => {
    expect(linkify('visit http://example.com today')).toBe(
      'visit <a href="http://example.com" target="_blank" rel="noopener noreferrer" class="message-link">http://example.com</a> today'
    );
  });

  test('converts https URL to clickable link', () => {
    expect(linkify('check https://example.com/page')).toBe(
      'check <a href="https://example.com/page" target="_blank" rel="noopener noreferrer" class="message-link">https://example.com/page</a>'
    );
  });

  test('handles URL with path, query, and fragment', () => {
    expect(linkify('see https://example.com/path?q=1&r=2#section')).toBe(
      'see <a href="https://example.com/path?q=1&amp;r=2#section" target="_blank" rel="noopener noreferrer" class="message-link">https://example.com/path?q=1&amp;r=2#section</a>'
    );
  });

  test('handles multiple URLs in one message', () => {
    const result = linkify('visit https://a.com and https://b.com');
    expect(result).toBe(
      'visit <a href="https://a.com" target="_blank" rel="noopener noreferrer" class="message-link">https://a.com</a> and <a href="https://b.com" target="_blank" rel="noopener noreferrer" class="message-link">https://b.com</a>'
    );
  });

  test('escapes HTML to prevent XSS injection', () => {
    const result = linkify('<script>alert("xss")</script>');
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  test('escapes HTML but still linkifies URLs', () => {
    const result = linkify('<b>bold</b> https://example.com');
    expect(result).toBe(
      '&lt;b&gt;bold&lt;/b&gt; <a href="https://example.com" target="_blank" rel="noopener noreferrer" class="message-link">https://example.com</a>'
    );
  });

  test('prevents XSS via malicious href injection', () => {
    const result = linkify('click <a href="javascript:alert(1)">here</a>');
    expect(result).not.toContain('<a href');
    expect(result).toContain('&lt;a');
  });

  test('handles URL at start of message', () => {
    expect(linkify('https://example.com is great')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="message-link">https://example.com</a> is great'
    );
  });

  test('handles URL at end of message', () => {
    expect(linkify('go to https://example.com')).toBe(
      'go to <a href="https://example.com" target="_blank" rel="noopener noreferrer" class="message-link">https://example.com</a>'
    );
  });

  test('handles message that is only a URL', () => {
    expect(linkify('https://example.com')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="message-link">https://example.com</a>'
    );
  });

  test('does not linkify non-http protocols', () => {
    expect(linkify('ftp://files.example.com')).toBe('ftp://files.example.com');
  });

  test('handles URL with port number', () => {
    expect(linkify('http://localhost:3000/test')).toBe(
      '<a href="http://localhost:3000/test" target="_blank" rel="noopener noreferrer" class="message-link">http://localhost:3000/test</a>'
    );
  });

  test('handles empty string', () => {
    expect(linkify('')).toBe('');
  });
});
