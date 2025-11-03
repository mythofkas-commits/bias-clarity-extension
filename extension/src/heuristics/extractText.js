/**
 * Extract main text content from the current page
 */
function extractText() {
  // Remove script, style, and other non-content elements
  const unwantedSelectors = 'script, style, noscript, iframe, nav, header, footer, aside, .advertisement, .ad, .comments';
  const unwanted = document.querySelectorAll(unwantedSelectors);
  unwanted.forEach(el => el.remove());

  // Try to find the main article content
  let mainContent = null;
  
  // Try common article selectors
  const articleSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '#content'
  ];

  for (const selector of articleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.length > 500) {
      mainContent = element;
      break;
    }
  }

  // Fallback to body if no main content found
  if (!mainContent) {
    mainContent = document.body;
  }

  // Extract and clean text
  let text = mainContent.textContent || '';
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Limit length to prevent overwhelming the backend
  const MAX_LENGTH = 120000;
  if (text.length > MAX_LENGTH) {
    text = text.substring(0, MAX_LENGTH);
  }

  return text;
}

// Export for use in content script or panel
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractText };
}
