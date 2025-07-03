import {
  normalizeWhitespace,
  createSearchPattern,
  processTextNode,
  createTextWalker
} from '../utils/content-utils.js';

const highlights = new Map();
let highlightId = 0;

function createHighlightSpan(text, color) {
  const span = document.createElement('span');
  span.style.backgroundColor = color;
  span.className = 'page-highlighter-highlight';
  span.textContent = text;
  return span;
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

function highlightText(text, color, isRegex, isCaseSensitive) {
  const id = ++highlightId;
  const searchText = isRegex ? text : normalizeWhitespace(text);

  let pattern;
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

  const treeWalker = createTextWalker();

  try {
    const textNodes = [];
    let node;
    while (node = treeWalker.nextNode()) {
      if (!isRegex) {
        node.nodeValue = normalizeWhitespace(node.nodeValue);
      }
      textNodes.push(node);
    }

    textNodes.forEach(node => {
      processTextNode(node, pattern, color, highlightInfo, createHighlightSpan);
    });

    if (highlightInfo.elements.length > 0) {
      highlights.set(id, highlightInfo);
    }
  } catch (error) {
    console.error('Error while highlighting:', error);
    return { elements: [], error: error.message };
  }

  return highlightInfo;
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch (request.action) {
      case 'ping':
        sendResponse({ success: true });
        break;

      case 'highlight':
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
  return true;
});