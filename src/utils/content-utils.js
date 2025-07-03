
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
}

export function createSearchPattern(text, isRegex, isCaseSensitive) {
    if (isRegex) {
        return new RegExp(text, isCaseSensitive ? 'g' : 'gi');
    } else {
        const escapedText = escapeRegExp(text);
        return new RegExp(escapedText, isCaseSensitive ? 'g' : 'gi');
    }
}

export function processTextNode(node, pattern, color, highlightInfo, createHighlightSpan) {
    const text = node.nodeValue;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length === 0) return false;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach(match => {
        if (match.index > lastIndex) {
            fragment.appendChild(
                document.createTextNode(text.substring(lastIndex, match.index))
            );
        }

        const span = createHighlightSpan(match[0], color);
        fragment.appendChild(span);
        highlightInfo.elements.push(span);

        lastIndex = match.index + match[0].length;
    });

    if (lastIndex < text.length) {
        fragment.appendChild(
            document.createTextNode(text.substring(lastIndex))
        );
    }

    node.parentNode.replaceChild(fragment, node);
    return true;
}

export function createTextWalker() {
    return document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentNode;
                if (!parent ||
                    parent.nodeName === 'SCRIPT' ||
                    parent.nodeName === 'STYLE' ||
                    parent.nodeName === 'NOSCRIPT' ||
                    parent.classList?.contains('page-highlighter-highlight') ||
                    parent.isContentEditable) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
}