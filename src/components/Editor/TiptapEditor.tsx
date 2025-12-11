'use client';

import React, { useEffect, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import ImageResize from 'tiptap-extension-resize-image';
import Highlight from '@tiptap/extension-highlight';
import DragHandle from 'tiptap-extension-global-drag-handle';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Highlighter } from 'lucide-react';

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

export const EditorToolbar = ({ editor, className = '' }: { editor: any, className?: string }) => {
    if (!editor) return null;

    // Force re-render on selection update to show active states
    const [, forceUpdate] = React.useState({});
    useEffect(() => {
        const handler = () => forceUpdate({});
        editor.on('transaction', handler);
        editor.on('selectionUpdate', handler);
        return () => {
            editor.off('transaction', handler);
            editor.off('selectionUpdate', handler);
        };
    }, [editor]);

    return (
        <div className={`flex items-center gap-1 border-b border-gray-100 dark:border-zinc-800 pb-2 mb-2 bg-white dark:bg-zinc-950 shadow-sm ${className}`}>
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
        </div>
    );
};

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({ content, onChange, placeholder = 'Start typing...', className = '', onAskAi, showToolbar = true, onEditorReady }, ref) => {
    const onAskAiRef = React.useRef(onAskAi);

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
                inline: false,
                allowBase64: true,
            }),
            Highlight.configure({ multicolor: true }),
            DragHandle.configure({
                width: 20,
                scrollTreshold: 100,
            }),
        ],
        content: content,
        editorProps: {
            attributes: {
                class: `prose dark:prose-invert max-w-none focus:outline-none min-h-[200px] ${className}`,
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
            onChange(editor.getHTML());
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
            // Only update if content is significantly different to avoid cursor jumps
            // Ideally we should compare JSON but HTML is what we have
            // For now, let's just trust the parent to manage content updates carefully
            // or use a more robust check if needed.
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 relative">
            {/* Toolbar */}
            {showToolbar && <EditorToolbar editor={editor} className="sticky top-0 z-50" />}
            <EditorContent editor={editor} />
        </div>
    );
});

TiptapEditor.displayName = 'TiptapEditor';

export default TiptapEditor;
