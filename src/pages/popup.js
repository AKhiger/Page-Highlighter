import React from 'react';
import { createRoot } from 'react-dom/client';
import './popup.css';

function Popup() {
  const [searchText, setSearchText] = React.useState('');
  const [highlightColor, setHighlightColor] = React.useState('#ffeb3b');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRegex, setIsRegex] = React.useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = React.useState(false);
  const [highlights, setHighlights] = React.useState([]);

  const VERSION = "1.0.7";

  React.useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, { action: 'get-highlights' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
        if (response?.highlights) {
          setHighlights(response.highlights.slice(-5));
        }
      });
    });
  }, []);

  const handleHighlight = async (text = searchText) => {
    if (!text) return;

    setIsLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        console.error('No active tab found');
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'ping' }, response => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            sendHighlightMessage(tab.id, text);
          }).catch(err => {
            console.error('Failed to inject content script', err);
          });
        } else {
          sendHighlightMessage(tab.id, text);
        }
      });
    } catch (error) {
      console.error('Failed to highlight text', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendHighlightMessage = (tabId, text) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'highlight',
      text,
      color: highlightColor,
      isRegex,
      isCaseSensitive
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to communicate with the page', chrome.runtime.lastError);
        return;
      }
      if (response?.success) {
        console.log(`Highlighted ${response.count} matches!`);
        const newHighlight = {
          id: Date.now(),
          text,
          color: highlightColor,
          count: response.count
        };
        setHighlights(prev => [...prev.slice(-4), newHighlight]);
        if (text === searchText) {
          setSearchText('');
        }
      } else {
        console.log('No matches found');
      }
    });
  };

  const removeHighlight = (id) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'remove-highlight',
        id
      }, () => {
        setHighlights(prev => prev.filter(h => h.id !== id));
      });
    });
  };

  return (
      <div className="popup-container">
        <div className="input-row">
          <input
              type="text"
              className="text-input"
              placeholder={isRegex ? "Enter regex pattern..." : "Enter text to highlight..."}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchText && !isLoading) {
                  handleHighlight();
                }
              }}
          />
          <input
              type="color"
              className="color-input"
              value={highlightColor}
              onChange={(e) => setHighlightColor(e.target.value)}
          />
        </div>

        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
                type="checkbox"
                checked={isRegex}
                onChange={(e) => setIsRegex(e.target.checked)}
            />
            <span>Regex</span>
          </label>

          <label className="checkbox-label">
            <input
                type="checkbox"
                checked={isCaseSensitive}
                onChange={(e) => setIsCaseSensitive(e.target.checked)}
            />
            <span>Case sensitive</span>
          </label>
        </div>

        <button
            className="highlight-button"
            onClick={() => handleHighlight()}
            disabled={!searchText || isLoading}
        >
          {isLoading ? (
              <span className="loading-content">
            <svg className="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Highlighting...
          </span>
          ) : (
              'Highlight'
          )}
        </button>

        {highlights.length > 0 && (
            <div className="highlights-container">
              <div className="highlights-list">
                {highlights.map((highlight) => (
                    <div
                        key={highlight.id}
                        className="highlight-item"
                        style={{ backgroundColor: highlight.color + '20' }}
                    >
                      <button
                          className="highlight-text-button"
                          onClick={() => handleHighlight(highlight.text)}
                      >
                        {highlight.text}
                      </button>
                      <span className="hits-count">{highlight.count} Hits</span>
                      <button
                          className="remove-button"
                          onClick={() => removeHighlight(highlight.id)}
                      >
                        Remove
                      </button>
                    </div>
                ))}
              </div>
            </div>
        )}
      </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<Popup />);