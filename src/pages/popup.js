import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tailwind.css';
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
          color: highlightColor
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
    <div className="p-4 w-96 bg-white/80 backdrop-blur-sm">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
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
            className="flex-1 rounded-[3px] border border-gray-200"
          />
          <Input
            type="color"
            value={highlightColor}
            onChange={(e) => setHighlightColor(e.target.value)}
            className="w-10 h-10 p-1 rounded-[3px] border border-gray-200 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between px-1">
          <label className="flex items-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
              className="rounded-[3px] border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span>Regex</span>
          </label>

          <label className="flex items-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isCaseSensitive}
              onChange={(e) => setIsCaseSensitive(e.target.checked)}
              className="rounded-[3px] border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span>Case sensitive</span>
          </label>
        </div>

        <Button 
          onClick={() => handleHighlight()}
          className="w-full font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-[3px] shadow-sm transition-colors"
          disabled={!searchText || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {highlights.map((highlight) => (
                <div 
                  key={highlight.id}
                  className="flex items-center justify-between p-2 border rounded-[3px] group hover:bg-gray-50"
                  style={{ backgroundColor: highlight.color + '20' }}
                >
                  <button
                    onClick={() => handleHighlight(highlight.text)}
                    className="text-sm truncate flex-1 mr-2 text-left hover:text-blue-600"
                  >
                    {highlight.text}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHighlight(highlight.id)}
                    className="rounded-[3px] opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                  >
                    Remove
                  </Button>
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