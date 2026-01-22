'use client';

// @ts-nocheck
console.log('[CursorDebug] CustomCollaborationCursor.ts - Top of file');
try {
    console.log('[CursorDebug] Importing Extension from @tiptap/core');
} catch (e) {
    console.error('[CursorDebug] Error during top-level execution:', e);
}
import { Extension } from '@tiptap/core';
import type { Awareness } from 'y-protocols/awareness';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import * as Y from 'yjs';
import * as math from 'lib0/math';
import {
    absolutePositionToRelativePosition,
    relativePositionToAbsolutePosition
} from 'y-prosemirror';

// helper functions from y-prosemirror/src/lib.js
// Manual helper removed

// Manual helper removed

const yCursorPluginKey = new PluginKey('yjs-cursor')

// SAFE LOOKUP for y-sync plugin
const getSyncPluginState = (state: any) => {
    // Try to find the plugin by string key starting with 'y-sync'
    const plugin = state.plugins.find((p: any) => p.spec.key && p.spec.key.key === 'y-sync') ||
        state.plugins.find((p: any) => p.key && p.key.startsWith('y-sync$'));

    if (plugin) {
        return plugin.getState(state);
    }

    // DEBUG: If not found, log all keys to see what we are dealing with
    console.warn('[CursorDebug] y-sync not found. Available keys:', state.plugins.map((p: any) => p.key || p.spec.key?.key));
    return null;
}

export interface CustomCollaborationCursorOptions {
    awareness: Awareness | null;
    user: {
        name: string;
        color: string;
    } | null;
}

export const CustomCollaborationCursor = Extension.create<CustomCollaborationCursorOptions>({
    name: 'customCollaborationCursor',

    addOptions() {
        console.log('[CursorDebug] CustomCollaborationCursor: addOptions called');
        return {
            awareness: null,
            user: null,
        };
    },

    addProseMirrorPlugins() {
        const { awareness, user } = this.options;

        console.log('[CursorDebug] addProseMirrorPlugins called', {
            hasAwareness: !!awareness,
            hasUser: !!user,
            userName: user?.name
        });

        if (!awareness || !user) {
            console.warn('[CursorDebug] Missing awareness or user options. Returning empty plugins.');
            return [];
        }

        // Set local awareness state
        awareness.setLocalStateField('user', {
            name: user.name,
            color: user.color,
        });

        // Inline definition of the plugin
        return [
            new Plugin({
                key: yCursorPluginKey,
                state: {
                    init(_, state) {
                        console.log('[CursorDebug] Plugin Init. Checking for y-sync...');
                        const ySyncFound = !!getSyncPluginState(state);
                        console.log(`[CursorDebug] y-sync found: ${ySyncFound}`);
                        return createDecorations(state, awareness, user);
                    },
                    apply(tr, prevState, _oldState, newState) {
                        const ystate = getSyncPluginState(newState);
                        const yCursorState = tr.getMeta(yCursorPluginKey);

                        if (yCursorState && yCursorState.awarenessUpdated) {
                            console.log('[CursorDebug] apply: awarenessUpdated triggered');
                        }

                        if (
                            (ystate && ystate.isChangeOrigin) ||
                            (yCursorState && yCursorState.awarenessUpdated)
                        ) {
                            return createDecorations(newState, awareness, user);
                        }
                        return prevState.map(tr.mapping, tr.doc);
                    }
                },
                props: {
                    decorations: (state) => {
                        return yCursorPluginKey.getState(state);
                    }
                },
                view: (view) => {
                    const awarenessListener = () => {
                        if ((view as any).docView) {
                            // @ts-ignore
                            view.dispatch(view.state.tr.setMeta(yCursorPluginKey, { awarenessUpdated: true }));
                        }
                    };

                    const updateCursorInfo = () => {
                        const ystate = getSyncPluginState(view.state);
                        if (!ystate) {
                            console.warn('[CursorDebug] updateCursorInfo: y-sync state not found');
                            return;
                        }

                        const current = awareness!.getLocalState() || {};
                        const hasFocus = view.hasFocus();

                        // LOG: State check
                        console.log('[CursorDebug] updateCursorInfo called', {
                            hasFocus,
                            selectionAnchor: view.state.selection.anchor,
                            selectionHead: view.state.selection.head,
                            yType: ystate.type?.constructor?.name || 'unknown'
                        });

                        if (hasFocus) {
                            const selection = view.state.selection;

                            try {
                                if (!ystate.binding) {
                                    console.warn('[CursorDebug] ystate.binding is missing. Falling back to naive resolution.');
                                    const anchor = Y.createRelativePositionFromTypeIndex(ystate.type, selection.anchor);
                                    const head = Y.createRelativePositionFromTypeIndex(ystate.type, selection.head);
                                    updateLocalCursor(anchor, head);
                                } else {
                                    const anchor = absolutePositionToRelativePosition(selection.anchor, ystate.type, ystate.binding.mapping);
                                    const head = absolutePositionToRelativePosition(selection.head, ystate.type, ystate.binding.mapping);
                                    updateLocalCursor(anchor, head);
                                }

                                function updateLocalCursor(anchor: any, head: any) {
                                    const prevCursor = current.cursor;
                                    const isDifferent = !prevCursor ||
                                        !Y.compareRelativePositions(Y.createRelativePositionFromJSON(prevCursor.anchor), anchor) ||
                                        !Y.compareRelativePositions(Y.createRelativePositionFromJSON(prevCursor.head), head);

                                    if (isDifferent) {
                                        console.log('[CursorDebug] Updating Local Cursor:', { anchor, head });
                                        awareness!.setLocalStateField('cursor', { anchor, head });

                                        // LOG: Verification immediately after set
                                        const verified = awareness!.getLocalState();
                                        console.log('[CursorDebug] Local Awareness State AFTER update:', {
                                            hasCursor: !!verified?.cursor,
                                            keys: Object.keys(verified || {})
                                        });
                                    }
                                }
                            } catch (err) {
                                console.error('[CursorDebug] Error creating relative positions:', err);
                            }
                        } else if (current.cursor != null) {
                            console.log('[CursorDebug] focusout - keeping cursor in awareness for debugging');
                        }
                    };

                    awareness.on('change', awarenessListener);
                    view.dom.addEventListener('focusin', updateCursorInfo);
                    view.dom.addEventListener('focusout', updateCursorInfo);

                    return {
                        update: updateCursorInfo,
                        destroy: () => {
                            view.dom.removeEventListener('focusin', updateCursorInfo);
                            view.dom.removeEventListener('focusout', updateCursorInfo);
                            awareness.off('change', awarenessListener);
                            awareness.setLocalStateField('cursor', null);
                        }
                    };
                }
            })
        ];
    },
});

function createDecorations(state: any, awareness: any, _currentUser: any) {
    const ystate = getSyncPluginState(state);
    // DEBUG: Check y-sync plugin state
    if (!ystate) {
        console.warn('[CursorDebug] y-sync plugin state NOT FOUND!');
        return DecorationSet.create(state.doc, []);
    }

    const y = ystate.doc;
    const decorations: any[] = [];

    // Check if snapshot active or something
    if (
        ystate.snapshot != null || ystate.prevSnapshot != null ||
        (ystate.binding && ystate.binding.mapping.size === 0)
    ) {
        return DecorationSet.create(state.doc, []);
    }

    const states = awareness.getStates();
    const activeCursors = Array.from(states.values()).filter((s: any) => s.cursor != null).length;

    // Reduce log noise: only log if we have > 1 user (ourselves) or if it's been a while (optional)
    // For now, let's log the count to be sure.
    console.log(`[CursorDebug] Creating Decorations. LocalID: ${y.clientID}, Total States: ${states.size}, Active Cursors: ${activeCursors}`);

    states.forEach((aw: any, clientId: number) => {
        // ALWAYS LOG keys for every client to see what's being propagated
        console.log(`[CursorDebug] Client ${clientId} state keys:`, Object.keys(aw));

        if (clientId === y.clientID) {
            return;
        }

        if (aw.cursor != null) {
            const user = aw.user || {};
            const color = user.color || '#ffa500';
            const name = user.name || `User: ${clientId}`;

            // DEBUG: Log awareness entry processing
            console.log(`[CursorDebug] Processing Client ${clientId} (LocalID: ${y.clientID}). Name: ${name}, HasCursor: ${!!aw.cursor}`);

            let anchor: number | null = null;
            let head: number | null = null;

            try {
                console.log(`[CursorDebug] Resolving positions for ${name}:`, aw.cursor);
                // We attempt to resolve position using Yjs directly if possible
                if (aw.cursor.anchor && aw.cursor.head) {
                    const anchorRel = Y.createRelativePositionFromJSON(aw.cursor.anchor);
                    const headRel = Y.createRelativePositionFromJSON(aw.cursor.head);

                    // We need to map this to absolute position in the current doc
                    // mapping from binding is CRITICAL for ProseMirror

                    if (!ystate.binding) {
                        console.warn('[CursorDebug] ystate.binding missing in createDecorations. Using naive fallback.');
                        const anchorPos = Y.createAbsolutePositionFromRelativePosition(anchorRel, y);
                        const headPos = Y.createAbsolutePositionFromRelativePosition(headRel, y);
                        if (anchorPos && headPos) {
                            anchor = anchorPos.index;
                            head = headPos.index;
                        }
                    } else {
                        anchor = relativePositionToAbsolutePosition(y, ystate.type, anchorRel, ystate.binding.mapping);
                        head = relativePositionToAbsolutePosition(y, ystate.type, headRel, ystate.binding.mapping);
                    }

                    if (anchor !== null && head !== null) {
                        console.log(`[CursorDebug] Positions resolved for ${name}:`, {
                            anchor,
                            head,
                            expectedType: ystate.type?.constructor?.name,
                            usingBinding: !!ystate.binding
                        });
                    } else {
                        console.warn(`[CursorDebug] Position resolution failed for ${name}. anchor: ${anchor}, head: ${head}`);
                    }
                }
            } catch (e) {
                console.error(`[CursorDebug] Error resolving positions for ${name}:`, e);
            }

            if (anchor !== null && head !== null) {
                const maxsize = state.doc.content.size - 1; // Simplified max size check
                anchor = Math.min(Math.max(anchor, 0), maxsize);
                head = Math.min(Math.max(head, 0), maxsize); // Ensure within bounds

                // Cursor Widget
                decorations.push(
                    Decoration.widget(head, () => {
                        const cursor = document.createElement('span');
                        cursor.classList.add('collaboration-cursor__caret');
                        cursor.style.borderLeft = `2px solid ${color}`;
                        cursor.style.marginLeft = '-1px';
                        cursor.style.marginRight = '-1px';
                        cursor.style.position = 'relative';
                        cursor.style.pointerEvents = 'none';

                        const label = document.createElement('div');
                        label.classList.add('collaboration-cursor__label');
                        label.style.position = 'absolute';
                        label.style.top = '-1.4em';
                        label.style.left = '-1px';
                        label.style.fontSize = '12px';
                        label.style.fontWeight = '600';
                        label.style.lineHeight = '1';
                        label.style.padding = '2px 6px';
                        label.style.borderRadius = '3px 3px 3px 0';
                        label.style.backgroundColor = color;
                        label.style.color = '#fff';
                        label.style.whiteSpace = 'nowrap';
                        label.style.userSelect = 'none';
                        label.style.pointerEvents = 'none';
                        label.textContent = name;

                        cursor.appendChild(label);
                        return cursor;
                    }, {
                        key: clientId + '',
                        side: 10
                    })
                );

                // Selection
                const from = Math.min(anchor, head);
                const to = Math.max(anchor, head);

                decorations.push(
                    Decoration.inline(from, to, {
                        style: `background-color: ${color}33`,
                        class: 'collaboration-selection'
                    }, {
                        inclusiveEnd: true,
                        inclusiveStart: false
                    })
                );
            }
        }
    });

    return DecorationSet.create(state.doc, decorations);
}

export default CustomCollaborationCursor;
