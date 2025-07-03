
// Store original nodes before highlighting, keyed by search pattern
const originalNodes = new Map();
const highlights = new Map();
let highlightId = 0;
let currentSearchPattern = null;

// Store original nodes before highlighting
function storeOriginalNodes(searchPattern, textNodes) {
  if (!originalNodes.has(searchPattern)) {
    originalNodes.set(searchPattern, []);
  }

  const nodeBackups = originalNodes.get(searchPattern);

  textNodes.forEach(textNode => {
    const parent = textNode.parentNode;
    if (parent) {
      nodeBackups.push({
        parent: parent,
        originalHTML: parent.innerHTML,
        originalTextContent: parent.textContent
      });
    }
  });
}

// Revert highlights for a specific search pattern
function revertHighlights(searchPattern) {
  if (!originalNodes.has(searchPattern)) {
    return;
  }

  const nodeBackups = originalNodes.get(searchPattern);

  // Group backups by parent to avoid duplicate restorations
  const parentMap = new Map();
  nodeBackups.forEach(backup => {
    if (!parentMap.has(backup.parent)) {
      parentMap.set(backup.parent, backup);
    }
  });

  // Restore original state of all modified nodes
  parentMap.forEach(({ parent, originalHTML }) => {
    if (parent && parent.parentNode) {
      parent.innerHTML = originalHTML;
    }
  });

  // Clean up stored data for this pattern
  originalNodes.delete(searchPattern);
}

// Revert all highlights
function revertAllHighlights() {
  originalNodes.forEach((_, pattern) => {
    revertHighlights(pattern);
  });
  originalNodes.clear();
  highlights.clear();
  highlightId = 0;
  currentSearchPattern = null;
}

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
  revertAllHighlights();
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

  // Create search pattern key for storage
  const searchPatternKey = `${searchText}_${isRegex}_${isCaseSensitive}`;

  // Revert previous highlights if we have a different search pattern
  if (currentSearchPattern && currentSearchPattern !== searchPatternKey) {
    revertHighlights(currentSearchPattern);
  }

  // Update current search pattern
  currentSearchPattern = searchPatternKey;

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
    elements: [],
    searchPatternKey
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
              parent.classList?.contains(pattern) ||
              parent.classList?.contains(searchText) ||
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
    const nodesToModify = [];
    let node;

    while (node = treeWalker.nextNode()) {
      textNodes.push(node);

      // Check if this node will be modified
      if (pattern.test(node.nodeValue)) {
        nodesToModify.push(node);
        // Reset regex lastIndex after test
        pattern.lastIndex = 0;
      }
    }

    // Store original nodes before highlighting
    if (nodesToModify.length > 0) {
      storeOriginalNodes(searchPatternKey, nodesToModify);
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

  // Revert the highlights for this search pattern
  if (highlight.searchPatternKey) {
    revertHighlights(highlight.searchPatternKey);
  }

  highlights.delete(id);

  // Clear current search pattern if this was the current one
  if (currentSearchPattern === highlight.searchPatternKey) {
    currentSearchPattern = null;
  }
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