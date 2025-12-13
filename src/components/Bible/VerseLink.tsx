'use client';

import React from 'react';
import { useBible } from '@/context/BibleContext';
import { cn } from '@/lib/utils';

interface VerseLinkProps {
    text: string;
    className?: string;
}

export default function VerseLink({ text, className }: VerseLinkProps) {
    const { openBible } = useBible();

    // Regex to find Bible references (e.g., "John 3:16", "1 Cor 13:4-7", "Genesis 1:1")
    // Improved regex to catch more cases
    const verseRegex = /((?:[123]\s)?[A-Z][a-z]+\.?\s\d+:\d+(?:-\d+)?)/g;

    const parts = text.split(verseRegex);

    return (
        <span className={className}>
            {parts.map((part, i) => {
                if (part.match(verseRegex)) {
                    // Simple parser for "Book Chapter:Verse"
                    const match = part.match(/((?:[123]\s)?[A-Z][a-z]+\.?)\s(\d+):(\d+)/);

                    return (
                        <span
                            key={i}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (match) {
                                    openBible({
                                        book: match[1].trim(),
                                        chapter: parseInt(match[2]),
                                        verse: parseInt(match[3])
                                    });
                                } else {
                                    // Fallback if regex match fails but split worked (unlikely)
                                    openBible();
                                }
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                            title="Open in Bible"
                        >
                            {part}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
}
