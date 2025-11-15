# Better Search and Highlight

## Overview
Better Search and Highlight is a Chrome extension that lets you search for and highlight text on any web page. It supports both exact text and regex matching, with optional case sensitivity, and provides smooth navigation between matches.

## Features
- Search and highlight text using exact or regex patterns
- Optional case-sensitive matching
- Smooth navigation between highlights
- Clear a specific set of highlights or all highlights on the page
- Restores original page content when highlights are removed

## Installation
1. Download or clone this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable Developer Mode (toggle in the top-right).
4. Click “Load unpacked” and select the project folder.
5. The extension will appear in your Chrome toolbar.

## Usage
1. Click the extension icon to open the popup.
2. Enter the text (or regex) to search for.
3. Toggle case sensitivity and regex options as needed.
4. Click “Highlight” to apply highlights on the current page.
5. Use the navigation controls in the popup to move between highlights.
6. Click “Remove Highlights” to revert the page to its original state.

## How It Works
- The extension injects a content script into pages you visit to scan text nodes and wrap matches in highlight elements.
- It tracks original DOM content to safely revert changes.
- Communication between the popup and the page is handled through Chrome’s messaging APIs.

## Permissions
- `activeTab` — to interact with the current page.
- `scripting` — to run the content script for highlighting.
- `storage` — reserved for storing preferences or future enhancements.

## Project Files
- `manifest.json` — Extension configuration, permissions, and content script registration.
- `src/pages/content.js` — The content script that performs search, highlighting, navigation, and cleanup on the page.
- Popup files (e.g., `popup.html` and assets) — Provide the UI to send actions like highlight, navigate, and clear.
- `icons/` — Extension icons used in the Chrome toolbar and store listing.

## Development
- Recommended: Node.js and npm for managing any build or tooling needs.
- Load the extension using the “Load unpacked” flow during development.
- Make changes and refresh the extension from `chrome://extensions` as needed.

## Troubleshooting
- If highlights do not appear, verify your pattern (especially when using regex) and page content.
- Some dynamic pages may re-render content; if highlights disappear, re-run the highlight action.
- Ensure Developer Mode is enabled and the extension is loaded without errors in `chrome://extensions`.

