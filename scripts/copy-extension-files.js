const fs = require('fs-extra');
const path = require('path');

async function copyExtensionFiles() {
    const srcDir = path.join(__dirname, '../src');
    const outDir = path.join(__dirname, '../out');
    const distDir = path.join(__dirname, '../dist');

    // Clean dist directory
    await fs.emptyDir(distDir);

    // Copy DevTools files
    await fs.copy(
        path.join(srcDir, 'devtools/devtools.html'),
        path.join(distDir, 'devtools.html')
    );
    await fs.copy(
        path.join(srcDir, 'devtools/panel.html'),
        path.join(distDir, 'panel.html')
    );

    // Copy built JavaScript files
    const jsFiles = ['devtools.js', 'panel.js'];
    for (const file of jsFiles) {
        if (await fs.pathExists(path.join(distDir, file))) {
            // These files are already in dist from webpack
            continue;
        }
    }

    // Create basic content.js if it doesn't exist
    const contentJsPath = path.join(distDir, 'content.js');
    if (!await fs.pathExists(contentJsPath)) {
        const contentJs = `
// Content script for Page Highlighter
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page Highlighter content script loaded');
});

// Function to highlight text
function highlightText(text, color = 'yellow') {
    const regex = new RegExp(text, 'gi');
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.match(regex)) {
            const span = document.createElement('span');
            span.style.backgroundColor = color;
            span.textContent = node.nodeValue;
            node.parentNode.replaceChild(span, node);
        }
    }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'highlight') {
        highlightText(request.text, request.color);
        sendResponse({ success: true });
    }
});`;
        await fs.writeFile(contentJsPath, contentJs);
    }

    // Create basic content.css if it doesn't exist
    const contentCssPath = path.join(distDir, 'content.css');
    if (!await fs.pathExists(contentCssPath)) {
        const contentCss = `
.page-highlighter-highlight {
    background-color: yellow;
    transition: background-color 0.3s ease;
}

.page-highlighter-highlight:hover {
    background-color: #ffeb3b;
}`;
        await fs.writeFile(contentCssPath, contentCss);
    }

    // Copy static assets
    if (await fs.pathExists(path.join(outDir, 'icons'))) {
        await fs.copy(
            path.join(outDir, 'icons'),
            path.join(distDir, 'icons')
        );
    }

    // Copy and modify manifest
    const manifest = await fs.readJson(path.join(outDir, 'manifest.json'));
    await fs.writeJson(path.join(distDir, 'manifest.json'), manifest, { spaces: 2 });

    // Copy index.html for popup
    await fs.copy(
        path.join(outDir, 'index.html'),
        path.join(distDir, 'index.html')
    );

    // Copy necessary assets from _next without the underscore
    const nextDir = path.join(outDir, '_next');
    const assetsDir = path.join(distDir, 'assets');
    await fs.ensureDir(assetsDir);

    // Copy static assets from _next
    if (await fs.pathExists(path.join(nextDir, 'static'))) {
        await fs.copy(
            path.join(nextDir, 'static'),
            path.join(assetsDir, 'static')
        );
    }

    // Update paths in HTML files to use new assets location
    const htmlFiles = ['index.html', 'panel.html'];
    for (const htmlFile of htmlFiles) {
        const filePath = path.join(distDir, htmlFile);
        if (await fs.pathExists(filePath)) {
            let content = await fs.readFile(filePath, 'utf8');
            content = content.replace(/\/_next\//g, '/assets/');
            await fs.writeFile(filePath, content);
        }
    }

    console.log('Extension files copied successfully to dist directory');
}

copyExtensionFiles().catch(console.error);