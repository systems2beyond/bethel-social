'use client';

import React, { useEffect, forwardRef, useImperativeHandle } from 'react';
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
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Quote, Highlighter, Sparkles, FileText, Sticker } from 'lucide-react';
import { StickerPopover } from './StickerPopover';

interface TiptapEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    onAskAi?: (query: string) => void;
    showToolbar?: boolean;
    onEditorReady?: (editor: any) => void;
}

export interface TiptapEditorRef {
    insertContent: (content: string) => void;
}

import { cn } from '@/lib/utils';

export const EditorToolbar = ({ editor, className = '', onTogglePaperStyle, isPaperStyleActive, onInsertSticker }: { editor: any, className?: string, onTogglePaperStyle?: () => void, isPaperStyleActive?: boolean, onInsertSticker?: (url: string) => void }) => {
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
        <div className={cn("flex items-center gap-1 border-b border-gray-100 dark:border-zinc-800 pb-2 mb-2 bg-white dark:bg-zinc-950 shadow-sm", className)}>
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

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({ content, onChange, placeholder = 'Start typing...', className = '', onAskAi, showToolbar = true, onEditorReady }, ref) => {
    const onAskAiRef = React.useRef(onAskAi);
    const [isPaperStyle, setIsPaperStyle] = React.useState(false);

    useEffect(() => {
        onAskAiRef.current = onAskAi;
    }, [onAskAi]);

    useEffect(() => {
        console.log('TiptapEditor Mounted. Extensions:', [StarterKit, Placeholder, Highlight, DragHandle]);
        console.log('Rendering TiptapEditor V2 with Highlight Button');
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: placeholder,
            }),
            ImageResize.configure({
                inline: true,
                allowBase64: true,
            }),
            Highlight.configure({ multicolor: true }),
            DragHandle.configure({
                width: 20,
                scrollTreshold: 100,
            }),
            ExtensionBubbleMenu.configure({
                pluginKey: 'bubbleMenu',
            }),
            ExtensionFloatingMenu.configure({
                pluginKey: 'floatingMenu',
            }),
        ],
        content: content,
        editorProps: {
            attributes: {
                class: `prose dark:prose-invert max-w-none focus:outline-none min-h-[800px] ${isPaperStyle ? 'paper-lines px-6 py-4' : ''} ${className}`,
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
        onUpdate: ({ editor }) => {
            console.log('[Tiptap] Content updated. Length:', editor.getText().length);
            onChange(editor.getHTML());
        },
        onSelectionUpdate: ({ editor }) => {
            const { from, to } = editor.state.selection;
            console.log(`[Tiptap] Selection updated: ${from} to ${to}`);
        },
        onCreate: ({ editor }) => {
            if (onEditorReady) {
                onEditorReady(editor);
            }
        }
    });

    useImperativeHandle(ref, () => ({
        insertContent: (content: string) => {
            if (editor) {
                editor.commands.insertContent(content);
                editor.commands.focus();
            }
        }
    }));

    useEffect(() => {
        if (editor && content && editor.getHTML() !== content) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 relative">
            {/* Toolbar */}
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

            {/* Bubble Menu (Selected Text) */}
            {editor && (
                <BubbleMenu editor={editor} className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg">
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Bold className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Italic className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('underline') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <UnderlineIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('highlight') ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Highlighter className="w-4 h-4" />
                    </button>
                    {onAskAi && (
                        <>
                            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                            <button
                                onClick={() => {
                                    const selection = editor.state.selection;
                                    const text = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                                    if (text) onAskAi(text);
                                }}
                                className="p-1.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                                title="Ask AI"
                            >
                                <Sparkles className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </BubbleMenu>
            )}

            {/* Floating Menu (Empty Line) */}
            {editor && (
                <FloatingMenu editor={editor} className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg">
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 1 }) ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Heading1 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 2 }) ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Heading2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bulletList') ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('orderedList') ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <ListOrdered className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('blockquote') ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Quote className="w-4 h-4" />
                    </button>
                </FloatingMenu>
            )}

            <EditorContent editor={editor} />
        </div>
    );
});

TiptapEditor.displayName = 'TiptapEditor';

export default TiptapEditor;
