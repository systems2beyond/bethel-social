'use client';
import TurndownService from 'turndown';
import { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { PulpitSession } from '@/types';
import { Play, Pause, Type, Scaling, FlipHorizontal } from 'lucide-react';
import { useBible } from '@/context/BibleContext';

interface TeleprompterViewProps {
    session: PulpitSession;
}

export default function TeleprompterView({ session }: TeleprompterViewProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(2); // 1-10
    const [fontSize, setFontSize] = useState(16); // px
    const [isMirrored, setIsMirrored] = useState(false);
    const { openBible } = useBible();

    // Initialize Turndown service once with custom rule for verse links
    const turndownService = useMemo(() => {
        const service = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            bulletListMarker: '-'
        });
        // Disable escaping so that user-typed markdown in Tiptap (preserved as text in HTML)
        // remains valid markdown (e.g. "**bold**", "## Header")
        service.escape = (str) => str;

        // CRITICAL: Custom rule for verse:// links to prevent spacing issues in markdown output
        // This handles <a href="verse://...">text</a> and produces clean [text](verse://...) without spaces
        // IMPORTANT: Regenerate URL from display text to handle malformed original URLs
        service.addRule('verseLinks', {
            filter: (node) => {
                if (node.nodeName !== 'A') return false;
                const href = node.getAttribute('href') || '';
                return href.startsWith('verse://') || href.startsWith('bible://') || href.startsWith('bible-ref://');
            },
            replacement: (_content, node) => {
                const element = node as HTMLAnchorElement;
                const text = element.textContent?.trim() || '';
                // Regenerate URL from display text to ensure numbered book prefixes are included
                // This fixes malformed URLs like "verse://Kings+1:11" when text is "1 Kings 1:11"
                const cleanUrl = `bible://${text.replace(/\s+/g, '+')}`;
                return `[${text}](${cleanUrl})`;
            }
        });

        return service;
    }, []);

    // Convert HTML notes to Markdown safely and process Bible refs
    const notesContent = useMemo(() => {
        if (!session.sermonNotes) return "_No notes provided for this session._";
        let markdown = "";
        try {
            markdown = turndownService.turndown(session.sermonNotes);
        } catch (e) {
            console.error("Error converting notes to markdown:", e);
            markdown = session.sermonNotes;
        }

        // 1. Fix headers that might be missing the required blank line before them
        markdown = markdown.replace(/([^\n])\n?(#{1,6}\s)/g, '$1\n\n$2');

        // 2. COMPREHENSIVE verse link cleanup - handles ALL spacing variations
        // Pattern: [ text ] ( url ) with any amount of whitespace anywhere
        // This is the ONLY regex needed for verse links - handles all cases
        markdown = markdown.replace(
            /\[\s*([^\]]+?)\s*\]\s*\(\s*((?:bible|verse|bible-ref):\/\/[^)\s]+)\s*\)/gi,
            (_match, linkText, url) => {
                const cleanText = linkText.trim();
                const cleanUrl = url.trim().replace(/\s+/g, '+');
                return `[${cleanText}](${cleanUrl})`;
            }
        );

        // 3. Separate consecutive Bible links (no space between them)
        markdown = markdown.replace(
            /\]\(((?:bible|verse|bible-ref):\/\/[^\)]+)\)\[/gi,
            ']($1) • ['
        );

        // 4. Auto-link plain Bible references NOT already in markdown links
        // Uses negative lookbehind/lookahead to avoid double-wrapping
        const bibleRegex = /(?<!\[)\b((?:[123]\s)?[A-Z][a-z]+)\s+(\d+):(\d+)(?:-(\d+))?\b(?!\]|\))/g;

        markdown = markdown.replace(bibleRegex, (match, _book, _chap, _verse, _endVerse) => {
            const cleanRef = match.trim();
            return `[${cleanRef}](bible://${cleanRef.replace(/\s+/g, '+')})`;
        });

        return markdown;
    }, [session.sermonNotes, turndownService]);

    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Auto-scroll logic
    useEffect(() => {
        if (!isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return;
        }

        const scroll = () => {
            if (containerRef.current) {
                const step = scrollSpeed * 0.5;
                containerRef.current.scrollTop += step;

                if (
                    containerRef.current.scrollTop + containerRef.current.clientHeight >=
                    containerRef.current.scrollHeight
                ) {
                    setIsPlaying(false);
                    return;
                }
            }
            animationFrameRef.current = requestAnimationFrame(scroll);
        };

        animationFrameRef.current = requestAnimationFrame(scroll);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, scrollSpeed]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                setIsPlaying(prev => !prev);
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                setScrollSpeed(prev => Math.min(prev + 1, 10));
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                setScrollSpeed(prev => Math.max(prev - 1, 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Memoize components to prevents re-renders on touch/scroll which kills the tap event
    const markdownComponents = useMemo(() => ({
        h1: ({ node, ...props }: any) => <h1 className="text-yellow-400 font-bold mb-[0.25em] mt-[0.5em] text-[1.4em]" {...props} />,
        h2: ({ node, ...props }: any) => <h2 className="text-yellow-300 font-semibold mb-[0.2em] mt-[0.4em] text-[1.2em]" {...props} />,
        h3: ({ node, ...props }: any) => <h3 className="text-yellow-200 font-medium mb-[0.15em] mt-[0.3em] text-[1.1em]" {...props} />,
        p: ({ node, ...props }: any) => <p className="mb-[0.4em] leading-[1.5]" {...props} />,
        ul: ({ node, ...props }: any) => <ul className="list-disc pl-[1.5em] mb-[0.4em] space-y-[0.15em] marker:text-yellow-500" {...props} />,
        ol: ({ node, ...props }: any) => <ol className="list-decimal pl-[1.5em] mb-[0.4em] space-y-[0.15em] marker:text-yellow-500" {...props} />,
        li: ({ node, ...props }: any) => <li className="pl-[0.25em]" {...props} />,
        strong: ({ node, ...props }: any) => <strong className="text-yellow-100 font-bold" {...props} />,
        em: ({ node, ...props }: any) => <em className="text-zinc-300 italic" {...props} />,
        blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-yellow-500/50 pl-[0.5em] py-[0.15em] my-[0.4em] bg-yellow-500/5 rounded-r italic" {...props} />,
        a: ({ node, href, children, ...props }: any) => {
            const isBibleLink = href?.startsWith('bible://') || href?.startsWith('verse://') || href?.startsWith('bible-ref://');

            const handleBibleClick = (e: React.MouseEvent | React.TouchEvent) => {
                e.preventDefault();
                e.stopPropagation();
                // Parse back the reference if needed
                // href is bible://1+John+3:16 or verse://John+3:16
                const protoPattern = /^(bible|verse|bible-ref):\/\//;
                const refString = decodeURIComponent(href!.replace(protoPattern, '')).replace(/\+/g, ' ');

                // Try matching with optional numbered book prefix
                let match = refString.match(/((?:[123]\s)?[A-Z][a-z]+)\s+(\d+):(\d+)(?:-(\d+))?/);

                if (match) {
                    let [_, book, chapter, verse, endVerse] = match;

                    // Known Bible books with numeric prefixes
                    const numberedBooks = ['Samuel', 'Kings', 'Chronicles', 'Corinthians', 'Thessalonians', 'Timothy', 'Peter', 'John'];

                    // If the book doesn't have a prefix but should (e.g., "Kings" instead of "1 Kings")
                    // Check if it's a numbered book that's missing its prefix
                    if (!book.match(/^[123]\s/) && numberedBooks.some(nb => book === nb)) {
                        // Default to "1 " prefix for these books
                        book = `1 ${book}`;
                    }

                    openBible({
                        book,
                        chapter: parseInt(chapter),
                        verse: parseInt(verse),
                        endVerse: endVerse ? parseInt(endVerse) : undefined
                    });
                }
            };

            if (isBibleLink) {
                return (
                    <button
                        onClick={handleBibleClick}
                        onTouchEnd={handleBibleClick}
                        style={{ touchAction: 'manipulation' }}
                        className="text-blue-400 underline decoration-blue-400/30 active:text-blue-200 active:bg-blue-500/30 transition-colors inline-block mx-1 font-medium bg-blue-500/10 px-2 rounded cursor-pointer select-none touch-manipulation tap-highlight-transparent"
                        title="Open in Bible Reader"
                    >
                        {children}
                    </button>
                );
            }
            return <a href={href} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
        }
    }), [openBible]);

    return (
        <div className="flex flex-col h-full bg-black text-white relative overflow-hidden">
            {/* Controls Overlay (Hover to see) */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        title="Spacebar to Play/Pause"
                    >
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>

                    <div className="flex items-center gap-2">
                        <Scaling size={20} className="text-zinc-400" />
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={scrollSpeed}
                            onChange={(e) => setScrollSpeed(Number(e.target.value))}
                            className="w-24 accent-white"
                            title="Scroll Speed (Arrow Up/Down)"
                        />
                        <span className="text-sm font-mono w-4">{scrollSpeed}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Type size={20} className="text-zinc-400" />
                        <input
                            type="range"
                            min="16"
                            max="96"
                            value={fontSize}
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            className="w-24 accent-white"
                        />
                        <span className="text-sm font-mono w-8">{fontSize}px</span>
                    </div>

                    <button
                        onClick={() => setIsMirrored(!isMirrored)}
                        className={`p-2 rounded-full transition-colors ${isMirrored ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}
                        title="Mirror Mode for Reflection Teleprompters"
                    >
                        <FlipHorizontal size={20} />
                    </button>
                </div>

                <div className="text-zinc-400 text-sm font-mono">
                    PROMPTER ACTIVE
                </div>
            </div>

            {/* Scroll Area */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-y-auto px-16 py-32 scrollbar-none transform ${isMirrored ? 'scale-x-[-1]' : ''}`}
                style={{
                    scrollBehavior: 'auto',
                    fontSize: `${fontSize}px` // Base font size for entire teleprompter
                }}
                onWheel={() => isPlaying && setIsPlaying(false)}
                onTouchStart={() => isPlaying && setIsPlaying(false)}
                onMouseDown={() => isPlaying && setIsPlaying(false)}
            >
                <div className="max-w-4xl mx-auto font-sans leading-relaxed transition-all duration-200">
                    <h1 className="font-bold mb-[0.5em] text-yellow-400 text-[1.3em]">
                        {session.sermonTitle}
                    </h1>

                    <div className="prose prose-invert max-w-none text-[1em]">
                        <ReactMarkdown
                            urlTransform={(url) => url} // Allow Custom Protocols (bible://)
                            components={markdownComponents}
                        >
                            {notesContent}
                        </ReactMarkdown>
                    </div>

                    {/* Buffer space at bottom */}
                    <div className="h-[50vh]"></div>
                </div>
            </div>

            {/* Status Indicator (Playback) */}
            <div className="absolute top-4 right-4 pointer-events-none">
                {isPlaying && (
                    <div className="flex items-center gap-2 bg-red-600/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-bold tracking-wider">SCROLLING</span>
                    </div>
                )}
            </div>
        </div>
    );
}
