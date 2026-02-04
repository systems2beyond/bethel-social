'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Paperclip, FileText } from 'lucide-react';
import { FirestoreUser } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface TaskAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipient: FirestoreUser | null;
}

export function TaskAssignmentModal({ isOpen, onClose, recipient }: TaskAssignmentModalProps) {
    const { user, userData } = useAuth();
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [userScrolls, setUserScrolls] = useState<{ id: string, title?: string }[]>([]);
    const [selectedScrollId, setSelectedScrollId] = useState<string>('none');

    // Fetch user's scrolls when modal opens
    React.useEffect(() => {
        if (isOpen && user) {
            const fetchScrolls = async () => {
                try {
                    const q = query(
                        collection(db, 'scrolls'),
                        where('authorId', '==', user.uid),
                        where('status', '==', 'active')
                    );
                    const snap = await getDocs(q);
                    setUserScrolls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                } catch (e) { console.error(e); }
            };
            fetchScrolls();
        }
    }, [isOpen, user]);

    const handleSendTask = async () => {
        if (!user || !recipient || !taskTitle.trim()) return;
        setLoading(true);

        try {
            // 1. Find or Create Conversation (Same logic as QuickMessage)
            let conversationId: string;
            const q = query(
                collection(db, 'direct_messages'),
                where('participants', 'array-contains', user.uid)
            );
            const snapshot = await getDocs(q);
            const existingConv = snapshot.docs.find(doc => doc.data().participants.includes(recipient.uid));

            if (existingConv) {
                conversationId = existingConv.id;
            } else {
                const newConv = await addDoc(collection(db, 'direct_messages'), {
                    participants: [user.uid, recipient.uid],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastMessageTimestamp: serverTimestamp(),
                    lastMessageAuthorId: user.uid,
                    lastMessage: `Assigned Task: ${taskTitle}`
                });
                conversationId = newConv.id;
            }

            // 2. Construct Message Content
            let content = `**Task Assigned**: ${taskTitle}\n\n${taskDescription}`;
            if (dueDate) content += `\n\n**Due Date**: ${dueDate}`;

            // 3. Attachments Logic
            let attachments = [];
            if (selectedScrollId !== 'none') {
                const scroll = userScrolls.find(s => s.id === selectedScrollId);
                if (scroll) {
                    content += `\n\n[Attached Scroll: ${scroll.title || 'Untitled'}](/bible?scrollId=${scroll.id})`;
                    attachments.push({
                        type: 'scroll',
                        id: scroll.id,
                        title: scroll.title || 'Untitled Scroll',
                        url: `/bible?scrollId=${scroll.id}`
                    });

                    // Ideally, we should also grant permissions to this user for the scroll if it's private.
                    // Implementation of permission sharing is separate, but good to note.
                }
            }

            // 4. Send Message
            await addDoc(collection(db, 'direct_messages', conversationId, 'messages'), {
                conversationId,
                author: {
                    id: user.uid,
                    name: userData?.displayName || user.displayName || 'Admin',
                    avatarUrl: user.photoURL
                },
                content: content,
                type: 'task_assignment', // Specialized type for rendering differently if needed
                metadata: {
                    taskTitle,
                    dueDate,
                    attachments
                },
                timestamp: Date.now()
            });

            // 5. Update Conversation
            await updateDoc(doc(db, 'direct_messages', conversationId), {
                lastMessage: `Assigned Task: ${taskTitle}`,
                lastMessageTimestamp: Date.now(),
                lastMessageAuthorId: user.uid,
                updatedAt: serverTimestamp(),
                readBy: [user.uid]
            });

            setTaskTitle('');
            setTaskDescription('');
            setDueDate('');
            setSelectedScrollId('none');
            onClose();
            alert('Task assigned successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to assign task.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Assign Task to {recipient?.displayName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Task Title</Label>
                        <Input
                            placeholder="e.g. Prepare Worship Song List"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Description (Instructions)</Label>
                        <Textarea
                            placeholder="Details about the task..."
                            rows={3}
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Due Date</Label>
                            <Input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Attach Scroll (optional)</Label>
                            <Select value={selectedScrollId} onValueChange={setSelectedScrollId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a scroll" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Attachment</SelectItem>
                                    {userScrolls.map(scroll => (
                                        <SelectItem key={scroll.id} value={scroll.id}>
                                            <div className="flex items-center">
                                                <FileText className="w-3 h-3 mr-2 text-blue-500" />
                                                <span className="truncate max-w-[150px]">{scroll.title || 'Untitled'}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSendTask} disabled={!taskTitle.trim() || loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Paperclip className="w-4 h-4 mr-2" />}
                        Assign Task
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
