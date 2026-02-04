'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { FirestoreUser } from '@/types';

interface QuickMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipient: FirestoreUser | null;
}

export function QuickMessageModal({ isOpen, onClose, recipient }: QuickMessageModalProps) {
    const { user, userData } = useAuth();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!user || !recipient || !message.trim()) return;
        setSending(true);

        try {
            // 1. Find or Create Conversation
            let conversationId: string;

            // Check for existing conversation
            const q = query(
                collection(db, 'direct_messages'),
                where('participants', 'array-contains', user.uid)
            );
            const snapshot = await getDocs(q);
            const existingConv = snapshot.docs.find(doc => {
                const data = doc.data();
                return data.participants.includes(recipient.uid);
            });

            if (existingConv) {
                conversationId = existingConv.id;
            } else {
                // Create new
                const newConv = await addDoc(collection(db, 'direct_messages'), {
                    participants: [user.uid, recipient.uid],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastMessageTimestamp: serverTimestamp(),
                    lastMessageAuthorId: user.uid,
                    lastMessage: 'Started a conversation'
                });
                conversationId = newConv.id;
            }

            // 2. Add Message
            const msgRef = await addDoc(collection(db, 'direct_messages', conversationId, 'messages'), {
                conversationId,
                author: {
                    id: user.uid,
                    name: userData?.displayName || user.displayName || 'Admin',
                    avatarUrl: user.photoURL
                },
                content: message,
                type: 'text',
                timestamp: Date.now()
            });

            // 3. Update Conversation Meta
            await updateDoc(doc(db, 'direct_messages', conversationId), {
                lastMessage: message,
                lastMessageTimestamp: Date.now(),
                lastMessageAuthorId: user.uid,
                updatedAt: serverTimestamp(),
                readBy: [user.uid] // Mark read for sender, unread for recipient
            });

            setMessage('');
            onClose();
            alert('Message sent!');
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message.');
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Message {recipient?.displayName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Textarea
                        placeholder="Type your message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
                    <Button onClick={handleSend} disabled={!message.trim() || sending} className="bg-blue-600 hover:bg-blue-700">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        Send
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
