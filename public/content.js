'use strict';

let currentHighlights = [];
let matchCount = 0;

// Listener for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SEARCH_TEXT') {
    clearHighlights();
    if (request.term) {
      matchCount = highlightTextOnPage(request.term, request.isRegex);
    } else {
      matchCount = 0;
    }
    sendResponse({ count: matchCount });
    return true; // Indicates async response
  } else if (request.type === 'CLEAR_HIGHLIGHTS') {
    clearHighlights();
    sendResponse({ count: 0 });
    return true;
  }
});

function clearHighlights() {
  while (currentHighlights.length) {
    const highlightSpan = currentHighlights.pop();
    if (highlightSpan && highlightSpan.parentNode) {
      const parent = highlightSpan.parentNode;
      parent.replaceChild(document.createTextNode(highlightSpan.textContent || ''), highlightSpan);
      parent.normalize(); // Merges adjacent text nodes
    }
  }
  matchCount = 0;
}

function highlightTextOnPage(searchTerm, isRegex) {
  let internalMatchCount = 0;
  const searchText = searchTerm.trim();
  if (searchText === '') {
    return 0;
  }

  let regex;
  try {
    if (isRegex) {
      regex = new RegExp(searchText, 'gi');
    } else {
      const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escapedSearchText, 'gi');
    }
  } catch (e) {
    console.error('Page Highlighter: Invalid RegExp', e);
    return 0;
  }

  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.nodeValue.trim() === '' || 
            node.parentElement.nodeName === 'SCRIPT' ||
            node.parentElement.nodeName === 'STYLE' ||
            node.parentElement.classList.contains('page-highlighter-match')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Test if the node's content matches the regex
        regex.lastIndex = 0; // Reset lastIndex before test
        if (regex.test(node.nodeValue)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  const nodesToProcess = [];
  while (treeWalker.nextNode()) {
    nodesToProcess.push(treeWalker.currentNode);
  }

  nodesToProcess.forEach((textNode) => {
    const textContent = textNode.nodeValue;
    let match;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();
    regex.lastIndex = 0; // Reset for each node

    while ((match = regex.exec(textContent)) !== null) {
      internalMatchCount++;
      // Text before match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(textContent.substring(lastIndex, match.index)));
      }
      // Highlighted match
      const span = document.createElement('span');
      span.className = 'page-highlighter-match';
      span.textContent = match[0];
      fragment.appendChild(span);
      currentHighlights.push(span); // Add to list for clearing
      lastIndex = regex.lastIndex;
      
      // Break if regex is not global and we found one match (though we use 'g' always)
      if (!regex.global) break; 
    }

    // Text after last match
    if (lastIndex < textContent.length) {
      fragment.appendChild(document.createTextNode(textContent.substring(lastIndex)));
    }

    if (fragment.childNodes.length > 0 && textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
  
  return internalMatchCount;
}

// Inject CSS for highlighting - though manifest V3 prefers CSS files
// This dynamic injection is an alternative if the CSS file approach has issues.
// For now, we rely on manifest.json content_scripts.css
// function injectStyles() { ... }
// injectStyles();
