// Background service worker that routes find requests to the content script.
// Injects the content script if needed, then sends the highlight request.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'find') return; // ignore other messages

  const query = msg.query || msg.text || '';
  const color = msg.color || '#ffeb3b';
  const isRegex = !!msg.isRegex;
  const isCaseSensitive = !!msg.isCaseSensitive;

  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab) {
      sendResponse({ success: false, error: 'No active tab' });
      return;
    }

    const tabId = tab.id;

    // Try to ping the content script first
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, function (resp) {
      if (chrome.runtime.lastError) {
        // Content script not present; inject it then send highlight message
        chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, function () {
          // After injection, send the highlight message
          chrome.tabs.sendMessage(
            tabId,
            { action: 'highlight', text: query, color, isRegex, isCaseSensitive },
            function (resp2) {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse(resp2);
              }
            }
          );
        });
      } else {
        // Content script is active; send highlight message
        chrome.tabs.sendMessage(
          tabId,
          { action: 'highlight', text: query, color, isRegex, isCaseSensitive },
          function (resp2) {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse(resp2);
            }
          }
        );
      }
    });
  });

  // Keep the message channel open for async response
  return true;
});
