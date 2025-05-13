"use client";

import type { NextPage } from 'next';
import { useState, useEffect, useCallback } from 'react';
import { Search, Type, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const PopupPage: NextPage = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isRegexMode, setIsRegexMode] = useState<boolean>(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to send message to content script
  const performSearch = useCallback(() => {
    setError(null);
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      setIsLoading(true);
      setMatchCount(null); // Reset count before new search
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'SEARCH_TEXT', term: searchTerm, isRegex: isRegexMode },
            (response) => {
              setIsLoading(false);
              if (chrome.runtime.lastError) {
                console.error('Page Highlighter Error:', chrome.runtime.lastError.message);
                setError('Failed to communicate with page. Try reloading the page.');
                setMatchCount(0);
                return;
              }
              if (response && typeof response.count === 'number') {
                setMatchCount(response.count);
                if (response.count === 0 && searchTerm) {
                  // setError("No matches found."); // Optionally show "no matches"
                }
              } else {
                // setError("Unexpected response from page.");
                setMatchCount(0);
              }
            }
          );
        } else {
          setIsLoading(false);
          setError("Could not find active tab.");
        }
      });
    } else {
      // Fallback for development outside extension environment
      console.warn('chrome.tabs API not available. Search functionality disabled.');
      setError('Extension context not found. Run as an extension.');
      setMatchCount(0);
    }
  }, [searchTerm, isRegexMode]);

  const clearAllHighlights = useCallback(() => {
    setError(null);
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'CLEAR_HIGHLIGHTS' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('Page Highlighter Error:', chrome.runtime.lastError.message);
                setError('Failed to clear highlights.');
                return;
              }
              setMatchCount(0);
              // setSearchTerm(''); // Optionally clear search term
            }
          );
        }
      });
    }
  }, []);

  // Handle Enter key press in input field
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      performSearch();
    }
  };

  // Effect to listen for messages from content script (e.g., for future features)
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (message.type === 'HIGHLIGHT_COUNT_UPDATE') {
          setMatchCount(message.count);
        }
      };
      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-1 bg-background min-h-full flex flex-col">
        <Card className="w-full shadow-xl flex flex-col flex-grow">
          <CardHeader className="pb-4 pt-5">
            <CardTitle className="text-xl flex items-center">
              <Search className="mr-2 h-5 w-5 text-primary" />
              Page Highlighter
            </CardTitle>
            <CardDescription className="text-xs">
              Find text on this page. Highlights are yellow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 flex-grow">
            <div className="space-y-2">
              <Label htmlFor="searchTerm" className="text-sm font-medium">Search Term</Label>
              <Input
                id="searchTerm"
                type="text"
                placeholder="Enter text or /regex/"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="text-base"
                aria-label="Search Term"
              />
            </div>

            <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-secondary/30">
              <div className="flex items-center space-x-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="regexMode" className="text-sm cursor-pointer">
                  Regular Expression
                </Label>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch
                    id="regexMode"
                    checked={isRegexMode}
                    onCheckedChange={setIsRegexMode}
                    aria-label="Toggle Regular Expression Mode"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{isRegexMode ? 'Using Regex mode' : 'Using Exact match mode'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={performSearch} className="w-full" disabled={isLoading || !searchTerm}>
                <Search className="mr-2 h-4 w-4" />
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
               <Button onClick={clearAllHighlights} variant="outline" className="w-full" disabled={isLoading}>
                Clear Highlights
              </Button>
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="pt-4 pb-3 flex flex-col items-center space-y-1">
            {error && (
              <p className="text-xs text-destructive text-center w-full px-2">{error}</p>
            )}
            {matchCount !== null && !isLoading && !error && (
              <p className="text-sm text-foreground font-medium">
                Matches found: <span className="text-primary font-bold text-base">{matchCount}</span>
              </p>
            )}
            {isLoading && (
               <p className="text-sm text-muted-foreground">Loading matches...</p>
            )}
          </CardFooter>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default PopupPage;
