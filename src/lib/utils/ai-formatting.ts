/**
 * Formats AI response text (Markdown-like) into HTML with specific styling.
 * Handles bold, italic, headers (with highlighter style), and lists.
 */
export const formatAiResponse = (text: string, options?: { useButtons?: boolean }) => {
    // Strip <SEARCH> tags (multiline) so they don't show up as text
    const cleanText = text.replace(/<SEARCH>[\s\S]*?<\/SEARCH>/g, '');

    const lines = cleanText.split('\n');
    let html = '';
    let inList = false;

    // Placeholders map to mask complex items (like existing links) during regex pass
    const placeholders: string[] = [];
    const createPlaceholder = (content: string) => {
        placeholders.push(content);
        return `__LINK_PH_${placeholders.length - 1}__`;
    };

    // Helper to generate link HTML based on mode
    const createLink = (ref: string, text: string) => {
        if (options?.useButtons) {
            return `<button type="button" class="verse-link text-blue-600 dark:text-blue-400 font-medium px-1 rounded inline-block text-left" data-verse="${ref}">${text}</button>`;
        }
        return `<a href="verse://${ref}" class="verse-link text-blue-600 dark:text-blue-400 font-medium no-underline" data-verse="${ref}">${text}</a>`;
    };

    lines.forEach((line, index) => {
        let processedLine = line.trim();
        if (!processedLine) return;

        // Detect "Pseudo-Headers" (Lines that are just bold text)
        const isBoldHeader = /^\*\*(.*?)\*\*[:]?$/.test(processedLine);

        if (isBoldHeader) {
            const content = processedLine.replace(/^\*\*|\*\*[:]?$/g, '').trim();
            // Note: using explicit closing > for h3
            html += `<h3 class="font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2"><span class="w-1 h-4 bg-purple-500 rounded-full"></span>${content}</h3>`;
            return;
        }

        // Handle Bullet Points
        const isBullet = processedLine.startsWith('- ') || processedLine.startsWith('* ');
        if (isBullet) {
            if (!inList) {
                html += '<ul class="space-y-2 mb-4">';
                inList = true;
            }
            processedLine = processedLine.substring(2);
        } else if (inList) {
            html += '</ul>';
            inList = false;
        }

        // --- Link Handling with Masking ---
        try {
            // 1. Explicit Links: [[John 3:16]]
            processedLine = processedLine.replace(/\[\[(.*?)\]\]/g, (match, content) => {
                return createPlaceholder(createLink(content, content));
            });

            // 2. Natural Text Verses
            const verseRegex = /((?:[123]\s)?[A-Za-z]+\.?\s\d+(?::\d+)?(?:-\d+)?)/g;
            processedLine = processedLine.replace(verseRegex, (match) => {
                if (match.startsWith('__LINK_PH_')) return match;
                const cleanRef = match.replace(/\.$/, '');
                return createLink(cleanRef, match);
            });

            // 3. Restore Placeholders
            processedLine = processedLine.replace(/__LINK_PH_(\d+)__/g, (match, index) => {
                return placeholders[parseInt(index)] || match;
            });
        } catch (e) {
            console.error("Regex error", e);
        }

        // Bold & Italic
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>');
        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em class="italic text-gray-600 dark:text-gray-400">$1</em>');

        if (isBullet) {
            html += `<li class="text-gray-700 dark:text-gray-300 leading-relaxed pl-1"><span class="block">${processedLine}</span></li>`;
        } else {
            html += `<p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">${processedLine}</p>`;
        }
    });

    if (inList) {
        html += '</ul>';
    }

    return html;
};

/**
 * Strips internal tags like <SUGGEST_SUMMARY> from the content.
 */
export const cleanAiResponse = (content: string) => {
    return content
        .replace(/<SUGGEST_SUMMARY>/g, '')
        .replace(/<SEARCH>[\s\S]*?<\/SEARCH>/g, '') // Strip search tags
        .trim();
};
