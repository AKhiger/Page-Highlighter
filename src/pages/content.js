const highlights = new Map();
let highlightId = 0;

function createHighlightSpan(text, color) {
  const span = document.createElement('span');
  span.style.backgroundColor = color;
  span.className = 'page-highlighter-highlight';
  span.textContent = text;
  return span;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearAllHighlights() {
  highlights.forEach(highlight => {
    highlight.elements.forEach(element => {
      if (element && element.parentNode) {
        const text = element.textContent;
        const textNode = document.createTextNode(text);
        element.parentNode.replaceChild(textNode, element);
      }
    });
  });
  highlights.clear();
  highlightId = 0;
}

function processTextNode(node, pattern, color, highlightInfo) {
  const text = node.nodeValue;
  const matches = Array.from(text.matchAll(pattern));
  
  if (matches.length === 0) return false;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  matches.forEach(match => {
    // Add text before the match
    if (match.index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(text.substring(lastIndex, match.index))
      );
    }

    // Create and add the highlighted span
    const span = createHighlightSpan(match[0], color);
    fragment.appendChild(span);
    highlightInfo.elements.push(span);

    lastIndex = match.index + match[0].length;
  });

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    fragment.appendChild(
      document.createTextNode(text.substring(lastIndex))
    );
  }

  node.parentNode.replaceChild(fragment, node);
  return true;
}

function createSearchPattern(text, isRegex, isCaseSensitive) {
  if (isRegex) {
    return new RegExp(text, isCaseSensitive ? 'g' : 'gi');
  } else {
    // For non-regex search, just escape special characters but don't add word boundaries
    const escapedText = escapeRegExp(text);
    return new RegExp(escapedText, isCaseSensitive ? 'g' : 'gi');
  }
}

function normalizeWhitespace(text) {
  // Replace multiple whitespace characters with a single space and trim
  return text.replace(/\s+/g, ' ').trim();
}

function highlightText(text, color, isRegex, isCaseSensitive) {
  const id = ++highlightId;
  let pattern;
  
  // Normalize the search text if it's not a regex
  const searchText = isRegex ? text : normalizeWhitespace(text);
  
  try {
    pattern = createSearchPattern(searchText, isRegex, isCaseSensitive);
  } catch (error) {
    console.error('Invalid regex pattern:', error);
    return { elements: [], error: 'Invalid regex pattern' };
  }

  const highlightInfo = {
    id,
    text: searchText,
    color,
    elements: []
  };

  // Get all text nodes in the document
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script, style tags and existing highlights
        const parent = node.parentNode;
        if (!parent || 
            parent.nodeName === 'SCRIPT' || 
            parent.nodeName === 'STYLE' || 
            parent.nodeName === 'NOSCRIPT' ||
            parent.classList?.contains('page-highlighter-highlight') ||
            parent.isContentEditable) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  try {
    // Process all text nodes in a single pass
    const textNodes = [];
    let node;
    while (node = treeWalker.nextNode()) {
      // Normalize whitespace in the text node if not using regex
      if (!isRegex) {
        node.nodeValue = normalizeWhitespace(node.nodeValue);
      }
      textNodes.push(node);
    }

    // Process each text node
    textNodes.forEach(node => {
      processTextNode(node, pattern, color, highlightInfo);
    });

    if (highlightInfo.elements.length > 0) {
      highlights.set(id, highlightInfo);
      try {
        chrome.runtime.sendMessage({
          action: 'highlight-added',
          highlight: {
            id,
            text: searchText,
            color,
            count: highlightInfo.elements.length
          }
        });
      } catch (error) {
        console.error('Failed to send highlight-added message:', error);
      }
    }
  } catch (error) {
    console.error('Error while highlighting:', error);
    return { elements: [], error: error.message };
  }

  return highlightInfo;
}

function removeHighlight(id) {
  const highlight = highlights.get(id);
  if (!highlight) return;

  highlight.elements.forEach(element => {
    if (element && element.parentNode) {
      const text = element.textContent;
      const textNode = document.createTextNode(text);
      element.parentNode.replaceChild(textNode, element);
    }
  });

  highlights.delete(id);
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch (request.action) {
      case 'ping':
        sendResponse({ success: true });
        break;

      case 'highlight':
        // Clear previous highlights before adding new ones
        clearAllHighlights();
        
        const highlight = highlightText(
          request.text,
          request.color,
          request.isRegex,
          request.isCaseSensitive
        );
        if (highlight.error) {
          sendResponse({ success: false, error: highlight.error });
        } else {
          sendResponse({ 
            success: highlight.elements.length > 0,
            count: highlight.elements.length
          });
        }
        break;

      case 'get-highlights':
        const highlightsList = Array.from(highlights.values()).map(h => ({
          id: h.id,
          text: h.text,
          color: h.color
        }));
        sendResponse({ highlights: highlightsList });
        break;

      case 'remove-highlight':
        //removeHighlight(request.id);
        clearAllHighlights();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({ error: error.message });
  }
  return true; // Keep the message channel open for async response
}); 