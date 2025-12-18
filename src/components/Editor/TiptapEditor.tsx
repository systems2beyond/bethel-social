'use client';

import React, { useEffect, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import ExtensionBubbleMenu from '@tiptap/extension-bubble-menu';
import ExtensionFloatingMenu from '@tiptap/extension-floating-menu';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import ImageResize from 'tiptap-extension-resize-image';
import Highlight from '@tiptap/extension-highlight';
import DragHandle from 'tiptap-extension-global-drag-handle';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Quote, Highlighter, Sparkles, FileText, Sticker, Maximize2, Minimize2 } from 'lucide-react';
import { StickerPopover } from './StickerPopover';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { cn } from '@/lib/utils';

interface TiptapEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    onAskAi?: (query: string, autoSend?: boolean) => void;
    showToolbar?: boolean;
    onEditorReady?: (editor: any) => void;
    onLinkClick?: (url: string) => void;
    collaborationId?: string;
    user?: { name: string; color: string; };
}

// ... (skipping unchanged parts) ...



export interface TiptapEditorRef {
    insertContent: (content: string) => void;
}

export const EditorToolbar = ({ editor, className = '', onTogglePaperStyle, isPaperStyleActive, onInsertSticker, onInsert }: { editor: any, className?: string, onTogglePaperStyle?: () => void, isPaperStyleActive?: boolean, onInsertSticker?: (url: string) => void, onInsert?: (text: string) => void }) => {
    const [isStickerOpen, setIsStickerOpen] = React.useState(false);
    const stickerButtonRef = React.useRef<HTMLButtonElement>(null);
    const [, forceUpdate] = React.useState({});
    useEffect(() => {
        if (!editor) return;
        const handler = () => forceUpdate({});
        editor.on('transaction', handler);
        editor.on('selectionUpdate', handler);
        return () => {
            editor.off('transaction', handler);
            editor.off('selectionUpdate', handler);
        };
    }, [editor]);

    if (!editor) return null;

    return (
        <div className={cn("flex items-center justify-center gap-1 border-b border-gray-100 dark:border-zinc-800 pb-2 mb-2 bg-white dark:bg-zinc-950 shadow-sm", className)}>
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('underline') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Underline"
            >
                <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('highlight') ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}
                title="Highlight"
            >
                <Highlighter className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Heading 1"
            >
                <Heading1 className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Heading 2"
            >
                <Heading2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bulletList') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Bullet List"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('orderedList') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Ordered List"
            >
                <ListOrdered className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('blockquote') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Blockquote"
            >
                <Quote className="w-4 h-4" />
            </button>
            {onTogglePaperStyle && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                    <button
                        onClick={onTogglePaperStyle}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${isPaperStyleActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-gray-500'}`}
                        title="Toggle Lined Paper"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                </>
            )}
            {onInsertSticker && (
                <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                    <div className="relative">
                        <button
                            ref={stickerButtonRef}
                            onClick={() => setIsStickerOpen(!isStickerOpen)}
                            className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${isStickerOpen ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'text-gray-500'}`}
                            title="Add Sticker"
                        >
                            <Sticker className="w-4 h-4" />
                        </button>
                        {isStickerOpen && (
                            <StickerPopover
                                onInsert={(url) => {
                                    onInsertSticker(url);
                                    setIsStickerOpen(false);
                                }}
                                onClose={() => setIsStickerOpen(false)}
                                triggerRef={stickerButtonRef}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const CustomLink = Link.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            class: {
                default: 'verse-link text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium hover:text-blue-800 dark:hover:text-blue-300 transition-colors',
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => ({
                    class: attributes.class,
                }),
            },
            'data-verse': {
                default: null,
                parseHTML: element => element.getAttribute('data-verse'),
                renderHTML: attributes => ({
                    'data-verse': attributes['data-verse'],
                }),
            }
        };
    },
    addOptions() {
        return {
            ...this.parent?.(),
            openOnClick: false,
            autolink: true,
            protocols: ['http', 'https', 'mailto', 'verse'],
            validate: (href: string) => /^https?:\/\//.test(href) || href.startsWith('verse://'),
        } as any;
    },
});

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({ content, onChange, placeholder, className = '', onAskAi, showToolbar = true, onEditorReady, onLinkClick, collaborationId, user }, ref) => {
    const onAskAiRef = React.useRef(onAskAi);
    const onLinkClickRef = React.useRef(onLinkClick);
    const [isPaperStyle, setIsPaperStyle] = React.useState(false);

    useEffect(() => {
        onAskAiRef.current = onAskAi;
        onLinkClickRef.current = onLinkClick;
    }, [onAskAi, onLinkClick]);

    // Collaboration Logic: Use useMemo for stable Y.Doc instance across renders
    const yDoc = React.useMemo(() => {
        return collaborationId ? new Y.Doc() : null;
    }, [collaborationId]);

    const [provider, setProvider] = React.useState<any>(null);

    // Manage Provider lifecycle
    useEffect(() => {
        if (!yDoc || !collaborationId) return;
        const signalingServers = [
            'wss://signaling.yjs.dev',
            'wss://y-webrtc-signaling-eu.herokuapp.com',
            'wss://y-webrtc-signaling-us.herokuapp.com'
        ];
        console.log('[Tiptap] Initializing Provider for:', collaborationId, 'with signaling:', signalingServers);

        // Use public signaling servers for WebrtcProvider
        // Removed heroku servers as they are often down/unreliable
        const newProvider = new WebrtcProvider(collaborationId, yDoc, {
            signaling: signalingServers
        });

        // Add user awareness
        if (user) {
            newProvider.awareness.setLocalStateField('user', {
                name: user.name,
                color: user.color,
            });
        }

        setProvider(newProvider);

        return () => {
            console.log('[Tiptap] Destroying provider');
            newProvider.destroy();
            setProvider(null);
        }
    }, [yDoc, collaborationId, user]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: collaborationId ? false : undefined, // Disable history if collab is active (Yjs handles it)
                codeBlock: false, // We might want our own code block later
                link: false, // Disable default Link extension from StarterKit
            } as any),
            Placeholder.configure({
                placeholder: placeholder || 'Write something amazing...',
            }),
            ImageResize,
            Highlight,
            DragHandle,
            // Underline removed (Duplicate),

            CustomLink.configure({
                openOnClick: false,
            }),
            // Conditionally add collaboration extensions
            ...(collaborationId && yDoc && provider ? [
                Collaboration.configure({
                    document: yDoc,
                }),
                CollaborationCursor.configure({
                    provider: provider,
                    user: user || { name: 'Anonymous', color: '#f783ac' },
                }),
            ] : []),
            ExtensionBubbleMenu.configure({
                pluginKey: 'bubbleMenu',
            }),
            ExtensionFloatingMenu.configure({
                pluginKey: 'floatingMenu',
            }),
        ],
        content: collaborationId ? undefined : content,
        editorProps: {
            attributes: {
                class: cn('prose dark:prose-invert max-w-none focus:outline-none min-h-[150px]', isPaperStyle ? 'paper-lines px-6 py-4' : '', className),
            },
            handleClick: (view, pos, event) => {
                const attrs = view.state.doc.resolve(pos).marks().find(m => m.type.name === 'link')?.attrs;
                if (attrs && onLinkClick) {
                    onLinkClick(attrs.href);
                    return true;
                }
                return false;
            },
            handleKeyDown: (view, event) => {
                if (event.key === 'Enter') {
                    const { state } = view;
                    const { selection } = state;
                    const { $from } = selection;
                    const currentLineText = $from.parent.textContent;

                    if (onAskAiRef.current) {
                        const match = currentLineText.match(/^\s*@(matt|matthew)(?:\s+(.+))?$/i);
                        if (match) {
                            const query = match[2] || '';
                            const start = $from.start();
                            const end = $from.end();
                            view.dispatch(state.tr.delete(start, end));
                            onAskAiRef.current(query);
                            return true;
                        }
                    }
                }
                return false;
            }
        },
        editable: true,
        onUpdate: ({ editor }) => {
            if (!collaborationId) onChange(editor.getHTML());
        },
        onCreate: ({ editor }) => {
            if (onEditorReady) {
                onEditorReady(editor);
            }
        }
    }, [collaborationId, yDoc, provider]); // Re-create editor if these change

    useImperativeHandle(ref, () => ({
        insertContent: (content: string) => {
            if (editor) {
                editor.commands.insertContent(content);
                editor.commands.focus();
            }
        }
    }));

    useEffect(() => {
        if (editor && content && !collaborationId && editor.getHTML() !== content) {
            editor.commands.setContent(content);
        }
    }, [content, editor, collaborationId]);

    // Native Click Listener
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleNativeClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a') || target.closest('.verse-link');

            if (link) {
                const href = link.getAttribute('href');
                const dataVerse = link.getAttribute('data-verse');
                const isVerseLink = (href && href.startsWith('verse://')) || !!dataVerse;

                if (isVerseLink && onLinkClickRef.current) {
                    const uri = (href && href.startsWith('verse://')) ? href : `verse://${dataVerse}`;
                    onLinkClickRef.current(uri);
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        };

        container.addEventListener('click', handleNativeClick, { capture: true });
        return () => {
            container.removeEventListener('click', handleNativeClick, { capture: true });
        };
    }, []);

    if (!editor) {
        return null;
    }

    return (
        <div ref={containerRef} className="flex flex-col gap-2 relative bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm p-4 min-h-[700px]">
            {showToolbar && <EditorToolbar
                editor={editor}
                className="sticky top-0 z-50"
                onTogglePaperStyle={() => setIsPaperStyle(!isPaperStyle)}
                isPaperStyleActive={isPaperStyle}
                onInsertSticker={(url) => {
                    if (editor) {
                        editor.chain().focus().setImage({ src: url }).run();
                    }
                }}
            />}

            {editor && (
                <BubbleMenu editor={editor} className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg">
                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}><Bold className="w-4 h-4" /></button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}><Italic className="w-4 h-4" /></button>
                    <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('underline') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}><UnderlineIcon className="w-4 h-4" /></button>
                    <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('highlight') ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-600 dark:text-gray-300'}`}><Highlighter className="w-4 h-4" /></button>
                    {onAskAi && (
                        <>
                            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                            <button
                                onClick={() => {
                                    const selection = editor.state.selection;
                                    const text = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                                    if (text) onAskAi(`Simplify this text:\n"${text}"`, true);
                                }}
                                className="p-1.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                                title="Simplify"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    const selection = editor.state.selection;
                                    const text = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                                    if (text) onAskAi(`Expand on this text:\n"${text}"`, true);
                                }}
                                className="p-1.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                                title="Expand / Elaborate"
                            >
                                <Maximize2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    const selection = editor.state.selection;
                                    const text = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                                    if (text) onAskAi(`${text}\n\n`, false);
                                }}
                                className="p-1.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                                title="Ask AI about this"
                            >
                                <Sparkles className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </BubbleMenu>
            )}

            <EditorContent editor={editor} />
        </div>
    );
});

TiptapEditor.displayName = 'TiptapEditor';
export default TiptapEditor;
