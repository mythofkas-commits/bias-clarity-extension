/**
 * Utility to make text spans clickable
 */

function createClickableSpan(text, spanStart, spanEnd, type, explanation) {
  const span = document.createElement('span');
  span.textContent = text.substring(spanStart, spanEnd);
  span.className = `clarifier-span clarifier-${type.toLowerCase()}`;
  span.dataset.type = type;
  span.dataset.start = spanStart;
  span.dataset.end = spanEnd;
  
  if (explanation) {
    span.dataset.explanation = explanation;
    span.title = explanation;
  }

  span.style.cursor = 'pointer';
  span.style.borderBottom = '2px dotted';
  
  // Color coding
  if (type === 'HEDGE') {
    span.style.borderColor = '#FFA500';
  } else if (type === 'INTENSIFIER') {
    span.style.borderColor = '#FF4444';
  } else if (type === 'AMBIGUOUS') {
    span.style.borderColor = '#9966FF';
  } else if (type.includes('CORRELATION') || type.includes('ANECDOTE') || type.includes('PART')) {
    span.style.borderColor = '#FF6B6B';
    span.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
  }

  return span;
}

function highlightSpans(containerElement, text, spans, type) {
  if (!spans || spans.length === 0) return;

  // Sort spans by start position
  const sortedSpans = [...spans].sort((a, b) => a.span[0] - b.span[0]);

  let lastIndex = 0;
  const fragment = document.createDocumentFragment();

  sortedSpans.forEach(item => {
    const [start, end] = item.span;
    
    // Add text before the span
    if (start > lastIndex) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, start)));
    }

    // Add highlighted span
    const spanElement = createClickableSpan(
      text,
      start,
      end,
      item.type || type,
      item.explanation
    );
    fragment.appendChild(spanElement);

    lastIndex = end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  containerElement.innerHTML = '';
  containerElement.appendChild(fragment);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createClickableSpan, highlightSpans };
}
