import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/popup.scss';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Toast } from '../components/ui/toast';

function Popup() {
  const [searchText, setSearchText] = React.useState('');
  const [highlightColor, setHighlightColor] = React.useState('#ffeb3b');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRegex, setIsRegex] = React.useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = React.useState(false);
  const [highlights, setHighlights] = React.useState([]);

  // Version number - increment with every change
  const VERSION = "1.0.9";

  React.useEffect(() => {
    // Get existing highlights
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, { action: 'get-highlights' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
        if (response?.highlights) {
          // Keep only the last 5 highlights
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
        Toast.error('No active tab found');
        return;
      }

      // First check if we can communicate with the content script
      chrome.tabs.sendMessage(tab.id, { action: 'ping' }, response => {
        if (chrome.runtime.lastError) {
          // Content script not ready, inject it manually
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            // Now try highlighting after script is injected
            sendHighlightMessage(tab.id, text);
          }).catch(err => {
            Toast.error('Failed to inject content script');
            console.error(err);
          });
        } else {
          // Content script is ready, send highlight message
          sendHighlightMessage(tab.id, text);
        }
      });
    } catch (error) {
      Toast.error('Failed to highlight text');
      console.error(error);
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
        Toast.error('Failed to communicate with the page');
        console.error(chrome.runtime.lastError);
        return;
      }
      if (response?.success) {
        Toast.success(`Highlighted ${response.count} matches!`);
        // Add the new highlight to the list, keeping only the last 5
        const newHighlight = {
          id: Date.now(),
          text,
          color: highlightColor,
          count: response.count
        };
        setHighlights(prev => [...prev.slice(-4), newHighlight]);
        if (text === searchText) {
          setSearchText(''); // Only clear if it matches the input
        }
      } else {
        Toast.error('No matches found');
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
      <div className="popup">
        <div className="popup__container">
          {/* Header with title and version */}
          <div className="popup__header">
            <h3 className="popup__header-title">
              Search Highlighter
            </h3>
            <span className="popup__header-version">
              v{VERSION}
            </span>
          </div>

                      <div className="popup__input-row">
            <Input
                type="text"
                placeholder={isRegex ? "Enter regex pattern..." : "Enter text to highlight..."}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchText && !isLoading) {
                    handleHighlight();
                  }
                }}
                style={{
                  borderColor: '#B0BEC5',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '13px',
                  color: '#444444'
                }}
            />
            <Input
                type="color"
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                style={{ borderColor: '#B0BEC5' }}
            />
          </div>

                      <div className="popup__checkbox-row">
            <label className="popup__checkbox-label">
              <input
                  style={{
                    borderColor: '#B0BEC5',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '13px',
                    color: '#444444'
                  }}
                  type="checkbox"
                  checked={isRegex}
                  onChange={(e) => setIsRegex(e.target.checked)}
              />
              <span>Regex</span>
            </label>

            <label className="popup__checkbox-label">
              <input
                  style={{
                    borderColor: '#B0BEC5',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '13px',
                    color: '#444444'
                  }}
                  type="checkbox"
                  checked={isCaseSensitive}
                  onChange={(e) => setIsCaseSensitive(e.target.checked)}
              />
              <span>Case sensitive</span>
            </label>
          </div>

          <Button
              onClick={() => handleHighlight()}
              className="popup__highlight-button"
              disabled={!searchText || isLoading}
          >
            {isLoading ? (
                <span className="spinner">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Highlighting...
                </span>
            ) : (
                'Highlight'
            )}
          </Button>

          {highlights.length > 0 && (
              <div className="popup__highlights">
                <div className="popup__highlights-list">
                  {highlights.map((highlight, index) => (
                      <div
                          key={highlight.id}
                          className="popup__highlight-item"
                          style={{
                            backgroundColor: highlight.color + '20',
                            borderColor: '#CFD8DC'
                          }}
                      >
                        <button
                            onClick={() => handleHighlight(highlight.text)}
                            className="popup__highlight-item-text"
                        >
                          {highlight.text}
                        </button>
                        <span className="popup__highlight-item-count">{highlight.count} Hits</span>
                        {(index === highlights.length-1) && <Button
                            size="sm"
                            onClick={() => removeHighlight(highlight.id)}
                            className="popup__highlight-item-remove"
                        >
                          Remove
                        </Button>}
                      </div>
                  ))}
                </div>
              </div>
          )}
        </div>
      </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<Popup />);
