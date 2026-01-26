'use client';

import React, { useEffect, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
console.log('[Tiptap] TiptapEditor.tsx - File evaluated');
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
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Quote, Highlighter, Sparkles, FileText, Sticker, Maximize2, Minimize2, MessageSquare } from 'lucide-react';
import { StickerPopover } from './StickerPopover';
import Collaboration from '@tiptap/extension-collaboration';
import { CustomCollaborationCursor } from './CustomCollaborationCursor';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { cn } from '@/lib/utils';
import { uploadMedia } from '@/lib/storage';

interface TiptapEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    onAskAi?: (query: string, autoSend?: boolean) => void;
    showToolbar?: boolean;
    onEditorReady?: (editor: any) => void;
    onLinkClick?: (href: string) => void;
    authReady?: boolean;
    collaborationId?: string;
    user?: { name: string; color: string; uid?: string };
    onAwarenessUpdate?: (users: { name: string; color: string; uid?: string }[]) => void;
    debugLabel?: string;

    // NEW: Optional collaboration features (all backward compatible)
    enableComments?: boolean;
    onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
    onYDocReady?: (yDoc: Y.Doc) => void;
    onAddComment?: (snapshot?: { from: number; to: number; text: string }) => void;
    onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void;
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('underline') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Underline"
            >
                <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('highlight') ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}
                title="Highlight"
            >
                <Highlighter className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Heading 1"
            >
                <Heading1 className="w-4 h-4" />
            </button>
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Heading 2"
            >
                <Heading2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bulletList') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Bullet List"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('orderedList') ? 'bg-gray-100 dark:bg-zinc-800 text-blue-600' : 'text-gray-500'}`}
                title="Ordered List"
            >
                <ListOrdered className="w-4 h-4" />
            </button>
            <button
                onMouseDown={(e) => e.preventDefault()}
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

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({ content, onChange, placeholder, className = '', onAskAi, showToolbar = true, onEditorReady, onLinkClick, authReady = true, collaborationId, user, onAwarenessUpdate, debugLabel, enableComments, onSelectionChange, onYDocReady, onAddComment, onStatusChange }, ref) => {
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

    // STABILITY FIX: Memoize user object to prevent infinite re-connection loops if parent passes new object reference
    const stableUser = React.useMemo(() => {
        return user ? { name: user.name, color: user.color, uid: user.uid } : null;
    }, [user?.name, user?.color, user?.uid]);

    const [provider, setProvider] = React.useState<any>(null);
    // TIMING FIX: Track when provider is FULLY ready (connected + awareness initialized)
    const [isProviderReady, setIsProviderReady] = React.useState(false);

    // NEW: Notify parent when yDoc is ready for collaboration features (comments, suggestions)
    useEffect(() => {
        if (yDoc && onYDocReady && isProviderReady) {
            onYDocReady(yDoc);
        }
    }, [yDoc, onYDocReady, isProviderReady]);

    // DEBUG: Monitor extension loading conditions
    useEffect(() => {
        if (collaborationId) {
            console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Extension Condition Check:`, {
                collaborationId,
                isProviderReady,
                hasProvider: !!provider,
                hasAwareness: !!provider?.awareness,
                hasUser: !!stableUser,
                userName: stableUser?.name,
                fullCondition: !!(collaborationId && isProviderReady && provider?.awareness && stableUser)
            });
        }
    }, [collaborationId, isProviderReady, provider, stableUser, debugLabel]);

    // Manage Provider lifecycle
    useEffect(() => {
        // Strict Auth Check: Must have doc, ID, AND user, AND authReady to generate token
        if (!yDoc || !collaborationId || !stableUser || !authReady) {
            console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] initProvider skipped:`, { hasYDoc: !!yDoc, hasId: !!collaborationId, id: collaborationId, hasUser: !!stableUser, authReady });
            return;
        }

        let activeProvider: HocuspocusProvider | null = null;
        let isMounted = true;
        let connectionTimeout: NodeJS.Timeout | null = null;

        const initProvider = async () => {
            console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] initProvider started for:`, collaborationId);
            try {
                // 1. Fetch Secure Token
                const { functions, auth } = await import('@/lib/firebase');

                if (!auth.currentUser) {
                    console.error('[Tiptap] Error: SDK auth.currentUser is missing, but React user prop is present.');
                    throw new Error('Firebase SDK not authenticated');
                }

                // FORCE REFRESH: Ensure we have a valid, non-expired token before call
                console.log('[Tiptap] Forcing token refresh...');
                const idToken = await auth.currentUser.getIdToken(true);

                const { httpsCallable } = await import('firebase/functions');
                const generateToken = httpsCallable(functions, 'generateTiptapToken');
                console.log('[Tiptap] Calling generateTiptapToken for user:', auth.currentUser.uid);

                // Add 30s timeout to fail fast (increased from 10s for reliability)
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Token generation timed out after 30s')), 30000)
                );

                const result = await Promise.race([
                    generateToken({ documentName: collaborationId, auth_token: idToken }),
                    timeoutPromise
                ]) as { data: { token: string } };

                const token = result.data.token;

                if (!isMounted) return;

                console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] initProvider: Attempting to connect to:`, {
                    url: 'wss://bethel-collab-503876827928.us-central1.run.app',
                    name: collaborationId,
                    hasToken: !!token
                });

                // 2. Connect with Token using HocuspocusProvider
                // UPDATED: Using Self-Hosted Collaboration Server
                const newProvider = new HocuspocusProvider({
                    url: 'wss://bethel-collab-503876827928.us-central1.run.app',
                    name: collaborationId,
                    token: token,
                    document: yDoc,
                    onConnect: () => {
                        const cid = newProvider.awareness?.clientID;
                        console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Provider CONNECTED. ClientID: ${cid}`);
                        setIsProviderReady(true);
                        if (onStatusChange) onStatusChange('connected');
                    },
                    onDisconnect: (data) => {
                        console.warn(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Provider DISCONNECTED:`, data);
                        setIsProviderReady(false);
                        if (onStatusChange) onStatusChange('disconnected');
                    },
                    onStatus: ({ status }) => {
                        console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Provider status changed:`, status);
                    }
                });

                // CRITICAL FIX: CollaborationCursor accesses `provider.awareness.doc` internally.
                // The Awareness class from y-protocols stores the Y.Doc reference.
                // If HocuspocusProvider doesn't properly initialize this, we must patch it.
                if (newProvider.awareness && !newProvider.awareness.doc) {
                    console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Patching awareness.doc (was undefined)`);
                    (newProvider.awareness as any).doc = yDoc;
                }

                // ALSO: Alias provider.doc for compatibility with older code paths
                try {
                    Object.defineProperty(newProvider, 'doc', {
                        get: () => yDoc,
                        configurable: true,
                        enumerable: true
                    });
                } catch (e) {
                    console.warn('[Tiptap] Failed to define .doc property on provider:', e);
                    (newProvider as any).doc = yDoc;
                }

                console.log('[Tiptap] HocuspocusProvider initialized. Inspecting provider:', {
                    hasDocument: !!newProvider.document,
                    hasDocAlias: !!(newProvider as any).doc,
                    hasAwarenessDoc: !!(newProvider.awareness?.doc),
                    awareness: !!newProvider.awareness,
                    providerKeys: Object.keys(newProvider)
                });

                // Add 5s timeout for connection fallback
                // Hocuspocus uses 'sync' event, but we can also check internal state or assume not synced if timeout hits
                // We'll rely on the fact that if 'sync' event hasn't fired, we are not synced.
                connectionTimeout = setTimeout(() => {
                    if (isMounted) {
                        console.warn(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Connection timed out (5s). Fallback to local content.`);
                        // Fix CRASH: Ensure editor exists and is not destroyed before checking isEmpty
                        if (content && editor && !editor.isDestroyed && editor.isEmpty) {
                            console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Fallback: Injecting local content.`);
                            editor.commands.setContent(content);
                        }
                    }
                }, 5000);

                const handleSynced = () => {
                    if (connectionTimeout) clearTimeout(connectionTimeout);
                    console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Synced event received. Clearing fallback timeout.`);
                };

                newProvider.on('status', (event: { status: string }) => {
                    console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Provider connection status:`, event.status);
                });

                newProvider.on('disconnect', (event: any) => {
                    console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Provider DISCONNECTED. Reason:`, event);
                    if (event.code === 4401) {
                        console.error('[Tiptap] Auth Failed: Unauthorized (4401). Check Secret/Token.');
                    }
                });

                newProvider.on('authenticationFailed', (data: any) => {
                    console.error(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Authentication FAILED explicitly:`, data);
                });

                newProvider.on('authenticated', () => {
                    console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Authentication SUCCESS.`);
                    // Force start sync
                    newProvider.sendStateless(JSON.stringify({ type: 'initial-sync-request' })); // Just a ping
                });

                // TIMING FIX: Mark provider ready ONLY after connection is established
                // This ensures awareness.doc is fully initialized before CollaborationCursor uses it
                newProvider.on('connect', () => {
                    console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Provider CONNECTED. Setting isProviderReady=true`);
                    if (isMounted) {
                        setIsProviderReady(true);
                    }
                });

                // Hocuspocus uses 'synced' for the event
                newProvider.on('synced', handleSynced);

                // Add user awareness
                if (stableUser && newProvider.awareness) {
                    newProvider.awareness.setLocalStateField('user', {
                        name: stableUser.name,
                        color: stableUser.color,
                        uid: stableUser.uid
                    });
                }

                // Monitor Awareness Changes
                let lastAwarenessUpdate = 0;
                let animationFrameId: number;

                const handleAwarenessUpdate = () => {
                    // Throttling updates to max once per 500ms or using rAF to prevent render thrashing
                    const now = Date.now();
                    const processUpdate = () => {
                        if (!newProvider.awareness) return;
                        const states = newProvider.awareness.getStates();
                        const users = Array.from(states.values()).map((s: any) => s.user).filter(Boolean);
                        console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Awareness Update. Users count: ${users.length}`, users);
                        if (onAwarenessUpdate) {
                            onAwarenessUpdate(users);
                        }
                    };

                    if (now - lastAwarenessUpdate > 1000) {
                        lastAwarenessUpdate = now;
                        processUpdate();
                    } else {
                        // Schedule a trailing update
                        cancelAnimationFrame(animationFrameId);
                        animationFrameId = requestAnimationFrame(() => {
                            processUpdate();
                        });
                    }
                };

                if (newProvider.awareness) {
                    newProvider.awareness.on('change', handleAwarenessUpdate);
                }

                activeProvider = newProvider;
                setProvider(newProvider);

            } catch (err: any) {
                if (!isMounted) return;
                console.error('[Tiptap] Failed to init provider:', err);
                if (err.message && err.message.includes('timed out')) {
                    console.log('[Tiptap] Retrying connection in 3s...');
                    setTimeout(() => {
                        if (isMounted) initProvider();
                    }, 3000);
                }
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !activeProvider && collaborationId && authReady) {
                console.log('[Tiptap] Tab visible, reconnecting...');
                initProvider();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        initProvider();

        return () => {
            console.log('[Tiptap] Destroying provider');
            isMounted = false;
            document.removeEventListener('visibilitychange', onVisibilityChange);

            if (connectionTimeout) clearTimeout(connectionTimeout);

            if (activeProvider) {
                activeProvider.disconnect();
                activeProvider.destroy();
            }
            setProvider(null);
            setIsProviderReady(false); // Reset ready state on cleanup
        }
    }, [yDoc, collaborationId, stableUser, authReady]);



    // Extension Configuration with Debug Logging
    const extensions = useMemo(() => {
        console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] useMemo: Evaluating extensions. CollabId: ${collaborationId}, Provider: ${!!provider}, User: ${!!stableUser}, yDoc: ${!!yDoc}`);

        const exts = [
            StarterKit.configure({
                history: collaborationId ? false : true,
                undoRedo: collaborationId ? false : true, // Some versions use this key
                codeBlock: false,
                link: false,
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
            ExtensionBubbleMenu.configure({
                pluginKey: 'bubbleMenu',
            }),
            ExtensionFloatingMenu.configure({
                pluginKey: 'floatingMenu',
            }),
        ];

        // Collaboration Extensions
        if (collaborationId && yDoc) {
            console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Enabling Collaboration Extension.`);
            exts.push(Collaboration.configure({
                document: yDoc,
            }));

            // Cursor Logic with Granular Logging
            if (provider && stableUser) {
                console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Adding CustomCollaborationCursor! Provider: YES, User: YES`);
                exts.push(CustomCollaborationCursor.configure({
                    awareness: provider.awareness,
                    user: stableUser,
                }));
            } else {
                console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Skipping CustomCollaborationCursor. Provider: ${!!provider}, User: ${!!stableUser}`);
            }
        }

        console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] CustomCollaborationCursor check:`, {
            exists: !!CustomCollaborationCursor,
            type: typeof CustomCollaborationCursor,
            name: (CustomCollaborationCursor as any)?.name,
            options: (CustomCollaborationCursor as any)?.options
        });

        console.log(`[Tiptap${debugLabel ? `-${debugLabel}` : ''}] Final extensions list:`, exts.map(e => (e as any).name));
        return exts;
    }, [collaborationId, yDoc, provider, stableUser, placeholder, debugLabel]);

    const editor = useEditor({
        extensions,
        // CRITICAL FIX: Do NOT pass content if collaboration is active. 
        // Passing content + Collaboration extension causes Tiptap to crash with "TextSelection endpoint" error.
        // We must seed the content MANUALLY after the provider is synced.
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
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        const { schema } = view.state;
                        const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });

                        // Upload to Firebase Storage
                        uploadMedia(file, 'notes/images').then((url) => {
                            const node = schema.nodes.image.create({ src: url });
                            const transaction = view.state.tr.insert(coordinates?.pos || view.state.selection.from, node);
                            view.dispatch(transaction);
                        }).catch(err => {
                            console.error('Failed to upload dropped image', err);
                        });

                        return true; // handled
                    }
                }
                return false;
            },
            handlePaste: (view, event, slice) => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => item.type.startsWith('image/'));

                if (imageItem) {
                    const file = imageItem.getAsFile();
                    if (file) {
                        // Upload to Firebase Storage
                        uploadMedia(file, 'notes/images').then((url) => {
                            const node = view.state.schema.nodes.image.create({ src: url });
                            const transaction = view.state.tr.replaceSelectionWith(node);
                            view.dispatch(transaction);
                        }).catch(err => {
                            console.error('Failed to upload pasted image', err);
                        });
                        return true; // handled
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
        },
        // NEW: Track selection changes for comments feature
        onSelectionUpdate: ({ editor }) => {
            if (enableComments && onSelectionChange) {
                const { from, to } = editor.state.selection;
                // Only update if selection is valid (not collapsed)
                if (from !== to) {
                    const text = editor.state.doc.textBetween(from, to, ' ');
                    console.log(`[Tiptap-DEBUG] onSelectionUpdate: Valid Selection`, { from, to, text: text.substring(0, 30) });
                    onSelectionChange({ from, to, text });
                } else {
                    // We don't necessarily want to clear it IMMEDIATELY because focus might be shifting
                    // But we log it for debug
                    console.log(`[Tiptap-DEBUG] onSelectionUpdate: Collapsed Selection (not clearing yet)`);
                    // onSelectionChange(null); // Let the parent decide when to clear or keep it
                }
            }
        }
        // Collaboration extensions are conditionally added to this list in `extensions` useMemo.
        // We MUST verify extensions list in useMemo doesn't have both History and Collaboration.
    }, [extensions, collaborationId, yDoc, provider, isProviderReady]); // Re-create editor if these change

    // Phase 3: Content Seeding Logic
    // If we are connecting to a new Yjs session (empty doc), we manually inject the initial content.
    useEffect(() => {
        // DEBUG: Trace Seeding Prerequisites
        if (collaborationId) {
            console.log('[Tiptap] Seeding Check:', {
                hasEditor: !!editor,
                hasProvider: !!provider,
                hasContent: !!content,
                contentLength: content?.length,
                hasYDoc: !!yDoc
            });
        }

        if (!editor || !provider || !collaborationId || !yDoc) return; // Removed !content check to allow empty/default sync logs

        const handleSynced = (event: any) => {
            // HocuspocusProvider does not have a 'synced' property, relying on the event itself
            if (true) {
                const fragment = yDoc.getXmlFragment('default');
                const fragmentContent = fragment.toJSON();
                console.log('[Tiptap DEBUG] Provider Synced.', {
                    collabId: collaborationId,
                    localContentLength: content?.length || 0,
                    remoteFragment: fragmentContent,
                    remoteLength: fragment.length
                });

                // Check if remote is "effectively empty"
                // Tiptap default empty node is often: "<p></p>" which might be represented as [{type: 'paragraph'}] or similar in Yjs XML
                // We check for: 0 blocks OR 1 block with 0 children OR 1 block with 1 empty text child
                const firstBlock = fragment.length > 0 ? fragment.get(0) : null;
                let isRemoteEmpty = fragment.length === 0;

                if (!isRemoteEmpty && fragment.length === 1 && firstBlock) {
                    if (firstBlock.length === 0) {
                        isRemoteEmpty = true;
                    } else if (firstBlock.length === 1) {
                        // TS Fix: Treat as any to access .get() safely (Y.XmlElement has .get, Y.XmlText does not)
                        const block = firstBlock as any;
                        if (block.get) {
                            const firstChild = block.get(0);
                            // Check if child is empty (e.g. empty Y.XmlText has length 0)
                            if (firstChild && firstChild.length === 0) {
                                isRemoteEmpty = true;
                            }
                        }
                    }
                }

                // Extra Debug Logging
                if (content && isRemoteEmpty) {
                    console.log('[Tiptap DEBUG] SEEDING: Injecting content into empty Yjs doc...');
                    try {
                        // FORCE UPDATE: Using object format as required by Tiptap types
                        editor.commands.setContent(content, { emitUpdate: true });
                        console.log('[Tiptap DEBUG] Seeding command fired.');
                    } catch (e) {
                        console.error('[Tiptap DEBUG] Seeding FAILED:', e);
                    }
                } else {
                    console.log('[Tiptap DEBUG] Seeding SKIPPED. Reason:', !content ? 'No Local Content' : 'Remote Not Empty');
                }
            }
        };



        // Use 'synced' event for Hocuspocus
        provider.on('synced', handleSynced);

        return () => {
            provider.off('synced', handleSynced);
        }
    }, [editor, provider, collaborationId, content, yDoc]);

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
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}><Bold className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}><Italic className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('underline') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-300'}`}><UnderlineIcon className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${editor.isActive('highlight') ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-600 dark:text-gray-300'}`}><Highlighter className="w-4 h-4" /></button>
                    {onAskAi && (
                        <>
                            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                            <button
                                onMouseDown={(e) => e.preventDefault()}
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
                                onMouseDown={(e) => e.preventDefault()}
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
                                onMouseDown={(e) => e.preventDefault()}
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
                    {onAddComment && (
                        <>
                            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={() => {
                                    const { from, to } = editor.state.selection;
                                    const text = editor.state.doc.textBetween(from, to, ' ');
                                    console.log('[Tiptap-DEBUG] Comment button clicked. Selection snapshot:', { from, to, text });

                                    // Focus back to ensure selection is visible (though preventDefault should have handled it)
                                    editor.chain().focus().run();

                                    // Pass current snapshot directly to circumvent state delays
                                    if (from !== to) {
                                        (onAddComment as any)({ from, to, text });
                                    } else {
                                        console.warn('[Tiptap-DEBUG] Comment button clicked but selection is collapsed.');
                                        onAddComment(); // Fallback to original empty call
                                    }
                                }}
                                className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                title="Add Comment"
                            >
                                <MessageSquare className="w-4 h-4" />
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
