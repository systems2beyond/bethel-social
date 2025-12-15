/**
 * Formats AI response text (Markdown-like) into HTML with specific styling.
 * Handles bold, italic, headers (with highlighter style), and lists.
 */
export const formatAiResponse = (text: string) => {
    // Strip <SEARCH> tags (multiline) so they don't show up as text
    const cleanText = text.replace(/<SEARCH>[\s\S]*?<\/SEARCH>/g, '');

    const lines = cleanText.split('\n');
    let html = '';
    let inList = false;

    lines.forEach((line, index) => {
        let processedLine = line.trim();
        if (!processedLine) return;

        // Detect "Pseudo-Headers" (Lines that are just bold text)
        const isBoldHeader = /^\*\*(.*?)\*\*[:]?$/.test(processedLine);

        if (isBoldHeader) {
            const headerText = processedLine.replace(/^\*\*/, '').replace(/\*\*[:]?$/, '');
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3 class="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md inline-block mt-6 mb-2 text-purple-900 dark:text-purple-100 font-bold">${headerText}</h3>`;
            return;
        }

        // --- Formatting Steps ---

        // Bold
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // --- Link Handling with Masking ---
        // We use a placeholder to protect generated links from subsequent regex passes.
        const placeholders: string[] = [];
        const createPlaceholder = (content: string) => {
            placeholders.push(content);
            return `__LINK_PH_${placeholders.length - 1}__`;
        };

        // 1. Explicit Links: [[John 3:16]] or [[Psalm 23]]
        processedLine = processedLine.replace(/\[\[(.*?)\]\]/g, (match, content) => {
            const linkHtml = `<a href="verse://${content}" class="verse-link text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium bg-blue-50 dark:bg-blue-900/20 px-1 rounded no-underline" data-verse="${content}">${content}</a>`;
            return createPlaceholder(linkHtml);
        });

        // 2. Natural Text Verses (Fallback): "John 3:16"
        // Regex matches Book Chapter:Verse or Book Chapter (e.g. Psalm 23)
        const verseRegex = /((?:[123]\s)?[A-Za-z]+\.?\s\d+(?::\d+)?(?:-\d+)?)/g;
        processedLine = processedLine.replace(verseRegex, (match) => {
            // If we accidentally matched a placeholder, ignore it (though regex structure shouldn't match __LINK...)
            if (match.startsWith('__LINK_PH_')) return match;

            const cleanRef = match.replace(/\.$/, '');
            const linkHtml = `<a href="verse://${cleanRef}" class="verse-link text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium no-underline" data-verse="${cleanRef}">${match}</a>`;
            return linkHtml; // No need to mask this one as it's the last pass for links
        });

        // 3. Restore Placeholders
        processedLine = processedLine.replace(/__LINK_PH_(\d+)__/g, (match, index) => {
            return placeholders[parseInt(index)] || match;
        });

        // --- End Link Handling ---

        // Headers
        if (processedLine.startsWith('### ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3 class="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md inline-block mt-6 mb-2 text-purple-900 dark:text-purple-100 font-bold">${processedLine.substring(4)}</h3>`;
        } else if (processedLine.startsWith('## ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h2 class="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md inline-block mt-6 mb-2 text-purple-900 dark:text-purple-100 font-bold text-lg">${processedLine.substring(3)}</h2>`;
        } else if (processedLine.startsWith('# ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h1 class="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md inline-block mt-6 mb-2 text-purple-900 dark:text-purple-100 font-bold text-xl">${processedLine.substring(2)}</h1>`;
        }
        // List Items
        else if (processedLine.startsWith('* ') || processedLine.startsWith('- ')) {
            if (!inList) { html += '<ul class="mb-4 pl-5 list-disc">'; inList = true; }
            html += `<li class="mb-1">${processedLine.substring(2)}</li>`;
        }
        // Regular Text
        else {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<p class="mb-3 leading-relaxed">${processedLine}</p>`;
        }
    });

    if (inList) { html += '</ul>'; }

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
