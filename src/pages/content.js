
// Store original nodes before highlighting, keyed by search pattern
const originalNodes = new Map();
const highlights = new Map();
let highlightId = 0;
let currentSearchPattern = null;
let scrollIdx = 1

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
    scrollIdx = 1
    console.log('2 [Page Highlighter] Reverting all highlights', highlights);
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

// Helpers extracted for clarity and reuse
function normalizeOrKeep(text, isRegex) {
  return isRegex ? text : normalizeWhitespace(text);
}

function buildSearchPatternKey(searchText, isRegex, isCaseSensitive) {
  return `${searchText}_${isRegex}_${isCaseSensitive}`;
}

function tryCreatePattern(searchText, isRegex, isCaseSensitive) {
  try {
    return { pattern: createSearchPattern(searchText, isRegex, isCaseSensitive) };
  } catch (e) {
    return { error: 'Invalid regex pattern' };
  }
}

function createTextTreeWalker(pattern, searchText) {
  return document.createTreeWalker(
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
}

function collectTextNodes(treeWalker, pattern) {
  const textNodes = [];
  const nodesToModify = [];
  let node;
  while (node = treeWalker.nextNode()) {
    textNodes.push(node);
    if (pattern.test(node.nodeValue)) {
      nodesToModify.push(node);
      // Reset regex lastIndex after test
      pattern.lastIndex = 0;
    }
  }
  return { textNodes, nodesToModify };
}

function applyHighlightsToNodes(textNodes, pattern, color, highlightInfo) {
  textNodes.forEach(node => {
    processTextNode(node, pattern, color, highlightInfo);
  });
}

function highlightText(text, color, isRegex, isCaseSensitive, scrollIdx = 1) {
  const id = ++highlightId;


  // Normalize the search text and build key
  const searchText = normalizeOrKeep(text, isRegex);
  const searchPatternKey = buildSearchPatternKey(searchText, isRegex, isCaseSensitive);

  // Revert previous highlights if we have a different search pattern
  if (currentSearchPattern && currentSearchPattern !== searchPatternKey) {
    revertHighlights(currentSearchPattern);
  }
  currentSearchPattern = searchPatternKey;

  // Create pattern
  const { pattern, error } = tryCreatePattern(searchText, isRegex, isCaseSensitive);
  if (error) {
    console.error('Invalid regex pattern:', error);
    return { elements: [], error };
  }

  const highlightInfo = {
    id,
    text: searchText,
    color,
    elements: [],
    searchPatternKey,
      scrollIdx
  };

  // Walk DOM and collect nodes
  try {
    const treeWalker = createTextTreeWalker(pattern, searchText);
    const { textNodes, nodesToModify } = collectTextNodes(treeWalker, pattern);

    // Store original nodes before highlighting
    if (nodesToModify.length > 0) {
      storeOriginalNodes(searchPatternKey, nodesToModify);
    }

    // Apply highlights
    applyHighlightsToNodes(textNodes, pattern, color, highlightInfo);

    // Notify if any highlights were found
    if (highlightInfo.elements.length > 0) {
      highlights.set(id, highlightInfo);
      try {
        chrome.runtime.sendMessage({
          action: 'highlight-added',
          highlight: {
            id,
            text: searchText,
            color,
            count: highlightInfo.elements.length, scrollIdx: highlightInfo.scrollIdx,
          }
        });
      } catch (err) {
        console.error('Failed to send highlight-added message:', err);
      }
    }
  } catch (err) {
    console.error('Error while highlighting:', err);
    return { elements: [], error: err.message };
  }

  return highlightInfo;
}
function clearCurrentHighlightMark() {
    document.querySelectorAll('.page-highlighter-current').forEach(el => {
        el.classList.remove('page-highlighter-current');
    });
}

function scrollToHighlight(index, currentHighlights) {
    console.log('[Page Highlighter] scrollToHighlight called', { index, currentHighlights });
    if (!currentHighlights.length) return;

    if (index < 0) index = currentHighlights.length - 1;
    if (index >= currentHighlights.length) index = 0;
    // currentHighlightIndex = index;

    clearCurrentHighlightMark();

    const el = currentHighlights[index];
    console.log('[Page Highlighter] Scrolling to highlight:', el);
    if (el) {
        el.classList.add('page-highlighter-current');
        el.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }
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

    console.log('[Page Highlighter] Message received from background:', request );
  try {
    switch (request.action) {
      case 'ping':
        sendResponse({ success: true });
        break;

      case 'highlight':
        // Clear previous highlights before adding new ones
        //clearAllHighlights();

         highlight = highlightText(
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
            count: highlight.elements.length,
              elements: highlight.elements,
              isRegex: request.isRegex, isCaseSensitive: request.isCaseSensitive
          });
        }
        break;

      case 'scroll-highlight': {
        // Highlight navigation from popup arrow buttons
        const index = Number(request.index);
          let currentHighlights = highlights.get(highlightId) ? highlights.get(highlightId).elements : [];
          console.log(" currentHighlights ", currentHighlights)
        if (
          Array.isArray(currentHighlights) &&
          currentHighlights.length > 0
        ) {
          // Accept wraparound scrolling (like in popup UI)
          let scrollIdx = index;
          if (scrollIdx < 0) scrollIdx = currentHighlights.length - 1;
          if (scrollIdx >= currentHighlights.length) scrollIdx = 0;
          // currentHighlightIndex = scrollIdx;
          console.log('[Page Highlighter] Scrolling to highlight:', scrollIdx);
          scrollToHighlight(scrollIdx, currentHighlights);
          highlights.get(highlightId).scrollIdx = scrollIdx;

        }
        sendResponse?.({ success: true });
        break;
      }

      case 'get-highlights':
          console.log('[Page Highlighter] get-highlights received', highlights.values());
        const highlightsList = Array.from(highlights.values()).map(h => ({
          id: h.id,
          text: h.text,
          color: h.color, count: h.elements.length, elements:h.elements, scrollIdx: h.scrollIdx
        }));
          console.log(" highlightsList ", highlightsList)
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