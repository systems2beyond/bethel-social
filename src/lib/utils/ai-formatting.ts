
/**
 * Formats AI response text (Markdown-like) into HTML with specific styling.
 * Handles bold, italic, headers (with highlighter style), and lists.
 */
export const formatAiResponse = (text: string) => {
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    // Shared Header Style
    const headerStyle = "background-color: rgba(168, 85, 247, 0.15); padding: 4px 8px; border-radius: 6px; display: inline-block; margin-top: 24px; margin-bottom: 8px; color: #9333ea; font-weight: 600;";

    lines.forEach((line, index) => {
        let processedLine = line.trim();
        if (!processedLine) return;

        // Detect "Pseudo-Headers" (Lines that are just bold text)
        // e.g. "**Title**" or "**Title:**"
        const isBoldHeader = /^\*\*(.*?)\*\*[:]?$/.test(processedLine);

        if (isBoldHeader) {
            const headerText = processedLine.replace(/^\*\*/, '').replace(/\*\*[:]?$/, '');
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3 style="${headerStyle}">${headerText}</h3>`;
            return;
        }

        // Bold
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Headers (Highlighter Style + Spacing)
        if (processedLine.startsWith('### ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3 style="${headerStyle}">${processedLine.substring(4)}</h3>`;
        } else if (processedLine.startsWith('## ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h2 style="${headerStyle} font-size: 1.2em;">${processedLine.substring(3)}</h2>`;
        } else if (processedLine.startsWith('# ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h1 style="${headerStyle} font-size: 1.4em;">${processedLine.substring(2)}</h1>`;
        }
        // List Items
        else if (processedLine.startsWith('* ') || processedLine.startsWith('- ')) {
            if (!inList) { html += '<ul style="margin-bottom: 16px; padding-left: 20px;">'; inList = true; }
            html += `<li style="margin-bottom: 4px;">${processedLine.substring(2)}</li>`;
        }
        // Regular Text
        else {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<p style="margin-bottom: 12px; line-height: 1.6;">${processedLine}</p>`;
        }
    });

    if (inList) { html += '</ul>'; }

    return html;
};

/**
 * Strips internal tags like <SUGGEST_SUMMARY> from the content.
 */
export const cleanAiResponse = (content: string) => {
    return content.replace(/<SUGGEST_SUMMARY>/g, '').trim();
};
