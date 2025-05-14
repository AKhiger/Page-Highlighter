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

function normalizeNode(node) {
  // Merge adjacent text nodes and normalize spaces
  if (node.parentNode) {
    node.parentNode.normalize();
  }
  return node;
}

function preserveWhitespace(element) {
  if (!element || !element.parentNode) return null;
  
  const text = element.textContent;
  const prevSibling = element.previousSibling;
  const nextSibling = element.nextSibling;
  
  // Create text node with the content
  const textNode = document.createTextNode(text);
  
  // Add spaces if needed
  if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && 
      !prevSibling.textContent.endsWith(' ') && !text.startsWith(' ')) {
    element.parentNode.insertBefore(document.createTextNode(' '), element);
  }
  
  element.parentNode.replaceChild(textNode, element);
  
  if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && 
      !nextSibling.textContent.startsWith(' ') && !text.endsWith(' ')) {
    element.parentNode.insertBefore(document.createTextNode(' '), nextSibling);
  }

  // Normalize the parent to merge adjacent text nodes
  normalizeNode(textNode.parentNode);
  return textNode;
}

function clearAllHighlights() {
  highlights.forEach(highlight => {
    highlight.elements.forEach(element => {
      preserveWhitespace(element);
    });
  });
  
  // Normalize the entire document body to clean up text nodes
  normalizeNode(document.body);
  
  highlights.clear();
  highlightId = 0;
}

function processTextNode(node, pattern, color, highlightInfo) {
  // Normalize the node's parent first to ensure clean text nodes
  normalizeNode(node.parentNode);
  
  // Use the original text value
  const originalText = node.nodeValue;
  // Create a normalized version for matching if needed
  const text = pattern.flags.includes('i') ? originalText : normalizeWhitespace(originalText);
  const matches = Array.from(text.matchAll(pattern));
  
  if (matches.length === 0) return false;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  matches.forEach(match => {
    // Use original text for creating text nodes
    if (match.index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(originalText.substring(lastIndex, match.index))
      );
    }

    // Create and add the highlighted span with original matched text
    const span = createHighlightSpan(originalText.substring(match.index, match.index + match[0].length), color);
    fragment.appendChild(span);
    highlightInfo.elements.push(span);

    lastIndex = match.index + match[0].length;
  });

  // Add remaining text after the last match
  if (lastIndex < originalText.length) {
    fragment.appendChild(
      document.createTextNode(originalText.substring(lastIndex))
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
    preserveWhitespace(element);
  });

  // Normalize the document after removing highlights
  normalizeNode(document.body);
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
        removeHighlight(request.id);
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