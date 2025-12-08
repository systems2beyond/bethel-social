import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatTextWithLinks(text: string) {
    if (!text) return null;

    // Regex to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text.split(urlRegex).map((part, i) => {
        if (part.match(urlRegex)) {
            let displayUrl = part;
            try {
                const urlObj = new URL(part);
                // Shorten the URL for display
                displayUrl = urlObj.hostname + (urlObj.pathname.length > 1 ? urlObj.pathname.substring(0, 15) + '...' : '');
                displayUrl = displayUrl.replace(/^www\./, '');
            } catch (e) {
                // If URL parsing fails, just truncate the string
                displayUrl = part.length > 30 ? part.substring(0, 27) + '...' : part;
            }

            return (
                <a 
                    key= { i }
            href = { part }
            target = "_blank"
            rel = "noopener noreferrer"
            className = "text-blue-600 hover:underline break-all"
            onClick = {(e) => e.stopPropagation()
        }
                >
            { displayUrl }
            </a>
            );
}
return <span key={ i }> { part } </span>;
    });
}
