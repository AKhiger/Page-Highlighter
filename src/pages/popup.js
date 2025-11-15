import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/popup.scss';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Toast } from '../components/ui/toast';

// Utility function to query the active tab
function queryActiveTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, callback);
}

// Utility function to send message to the active tab
function sendMessageToActiveTab(message, callback) {
    queryActiveTab(([tab]) => {
        if (!tab) return;
        chrome.tabs.sendMessage(tab.id, message, callback);
    });
}

function handleNav(direction, currentNavIdx, setCurrentNavIdx, highlight, isCountActive) {
    if (!isCountActive) return;
    let nextIdx =
        direction === "prev"
            ? (currentNavIdx - 1 + highlight.count) % highlight.count
            : (currentNavIdx + 1) % highlight.count;
    setCurrentNavIdx(nextIdx);
    sendMessageToActiveTab({
        action: "scroll-highlight",
        index: nextIdx,
    });
}

function Popup() {
    const [searchText, setSearchText] = React.useState('');
    const [highlightColor, setHighlightColor] = React.useState('#ffeb3b');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isRegex, setIsRegex] = React.useState(false);
    const [isCaseSensitive, setIsCaseSensitive] = React.useState(false);
    const [highlights, setHighlights] = React.useState([]);
    const [currentNavIdx, setCurrentNavIdx] = React.useState(0);

    React.useEffect(() => {
        // Load saved color from storage
        chrome.storage.sync.get(['highlightColor'], (result) => {
            if (result.highlightColor) {
                setHighlightColor(result.highlightColor);
            }
        });

        // Get existing highlights
        sendMessageToActiveTab({ action: 'get-highlights' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            if (response?.highlights) {
                // Keep only the last 5 highlights

                setHighlights(response.highlights.slice(-5));
            }
        });
    }, []);

    // Whenever the latest highlight or its count changes, reset nav idx to 0
    React.useEffect(() => {
        if (highlights.length > 0) setCurrentNavIdx(highlights[highlights.length - 1]?.scrollIdx || 0);
    }, [highlights, highlights.length && highlights[highlights.length - 1]?.count]);

    const handleHighlight = async (text = searchText) => {
        if (!text) return;

        setIsLoading(true);
        try {
            const [tab] = await new Promise(resolve => queryActiveTab(resolve));
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

    const sendHighlightMessage = (tabId, text, isRedo = false) => {
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
                if(!isRedo){
                    Toast.success(`Highlighted ${response.count} matches!`);
                    // Add the new highlight to the list, keeping only the last 5
                    const newHighlight = {
                        id: Date.now(),
                        text,
                        color: highlightColor,
                        count: response.count,
                        isRegex: response.isRegex, isCaseSensitive: response.isCaseSensitive
                    };
                    setHighlights(prev => [...prev.slice(-4), newHighlight]);
                    setCurrentNavIdx(0);
                }

                // Scroll to the first highlight
                if (response.count >= 0) {
                    sendMessageToActiveTab({
                        action: "scroll-highlight",
                        index: currentNavIdx,
                    });
                }
                if (text === searchText) {
                    setSearchText(''); // Only clear if it matches the input
                }
            } else {
                Toast.error('No matches found');
            }
        });
    };

    const removeHighlight = (id) => {
        queryActiveTab(([tab]) => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'remove-highlight',
                id
            }, () => {
                setHighlights(prev => {
                    let searches = prev.filter(h => h.id !== id)
                    const lastSearch = searches[searches.length - 1]

                    // Only update state and re-highlight if there are remaining highlights
                    if (lastSearch) {
                        setIsRegex(lastSearch.isRegex)
                        setIsCaseSensitive(lastSearch.isCaseSensitive)
                        setCurrentNavIdx(0)
                        sendHighlightMessage(tab.id, lastSearch.text, true)
                    }

                    return searches;
                });
            });
        });
    };

    return (
        <div className="popup">
            <div className="popup__container">
                <div className="popup__input-row popup__input-row--stretch">
                    <Input
                        type="text"
                        className="popup__input-text"
                        placeholder={isRegex ? "Enter regex pattern..." : "Enter text to highlight..."}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchText && !isLoading) {
                                handleHighlight();
                            }
                        }}
                    />

                    <Input
                        type="color"
                        className="popup__input-color"
                        value={highlightColor}
                        onChange={(e) => {
                            const newColor = e.target.value;
                            setHighlightColor(newColor);
                            // Save color to storage
                            chrome.storage.sync.set({ highlightColor: newColor });
                        }}
                    />
                </div>

                <div className="popup__checkbox-row">
                    <label className="popup__checkbox-label">
                        <input
                            className="popup__input-checkbox"
                            type="checkbox"
                            checked={isRegex}
                            onChange={(e) => setIsRegex(e.target.checked)}
                        />
                        <span>Regex</span>
                    </label>

                    <label className="popup__checkbox-label">
                        <input
                            className="popup__input-checkbox"
                            type="checkbox"
                            checked={isCaseSensitive}
                            onChange={(e) => setIsCaseSensitive(e.target.checked)}
                        />
                        <span>Case sensitive</span>
                    </label>
                </div>

                {highlights.length > 0 && (
                    <div className="popup__highlights">
                        <div className="popup__highlights-list">
                            {highlights.map((highlight, index) => {
                                const isActive = index === highlights.length - 1;
                                const isCountActive = isActive && highlight.count > 0;
                                return (
                                    <div
                                        key={highlight.id}
                                        className="popup__highlight-item"
                                        style={{
                                            backgroundColor: highlight.color + "20",
                                            borderColor: "#CFD8DC",
                                        }}
                                    >
                                        <span
                                            className="popup__highlight-item-text"
                                        >
                                            {highlight.text}
                                        </span>
                                        <span className="popup__highlight-item-count">
                                            {highlight.count} Hits
                                        </span>
                                        {isActive && (
                                            <span className="popup__nav-controls">
                                                <button
                                                    aria-label="Previous match"
                                                    className="popup__nav-btn"
                                                    onClick={() =>
                                                        handleNav(
                                                            "prev",
                                                            currentNavIdx,
                                                            setCurrentNavIdx,
                                                            highlight,
                                                            isCountActive
                                                        )
                                                    }
                                                    disabled={!isCountActive}
                                                >
                                                    ↑
                                                </button>
                                                <span className="popup__nav-position">
                                                    {isCountActive ? `${currentNavIdx + 1} / ${highlight.count}` : "—"}
                                                </span>
                                                <button
                                                    aria-label="Next match"
                                                    className="popup__nav-btn"
                                                    onClick={() =>
                                                        handleNav(
                                                            "next",
                                                            currentNavIdx,
                                                            setCurrentNavIdx,
                                                            highlight,
                                                            isCountActive
                                                        )
                                                    }
                                                    disabled={!isCountActive}
                                                >
                                                    ↓
                                                </button>
                                            </span>
                                        )}
                                        {isActive && (
                                            <Button
                                                size="sm"
                                                onClick={() => removeHighlight(highlight.id)}
                                                className="popup__highlight-item-remove"
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<Popup />);
