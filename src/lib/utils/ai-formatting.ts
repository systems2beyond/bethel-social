/**
 * Formats AI response text (Markdown-like) into HTML with specific styling.
 * Handles bold, italic, headers (with highlighter style), and lists.
 */
// Redefine to strip at start
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
        // e.g. "**Title**" or "**Title:**"
        const isBoldHeader = /^\*\*(.*?)\*\*[:]?$/.test(processedLine);

        if (isBoldHeader) {
            const headerText = processedLine.replace(/^\*\*/, '').replace(/\*\*[:]?$/, '');
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3 class="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md inline-block mt-6 mb-2 text-purple-900 dark:text-purple-100 font-bold">${headerText}</h3>`;
            return;
        }

        // Bold
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Bible Verses (e.g. "John 3:16", "1 Cor 13:4")
        // Wrap in a span that we can target with a click handler in the parent
        const verseRegex = /((?:[123]\s)?[A-Z][a-z]+\.?\s\d+:\d+(?:-\d+)?)/g;
        processedLine = processedLine.replace(verseRegex, (match) => {
            // Clean up the match for the data attribute (remove periods, extra spaces)
            const cleanRef = match.replace(/\.$/, '');
            return `<span class="verse-link text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium" data-verse="${cleanRef}">${match}</span>`;
        });

        // Headers (Highlighter Style + Spacing)
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
        .replace(/<SEARCH>[\s\S]*?<\/SEARCH>/g, '') // Strip search tags (multiline)
        .trim();
};
