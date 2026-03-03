function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function linkify(text) {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>'
  );
  return linked.replace(
    /(^|\s)(@\w+)/g,
    '$1<span class="mention-highlight">$2</span>'
  );
}

module.exports = { linkify, escapeHtml };
