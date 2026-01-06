import React, { useState } from 'react';
import { Share2, X, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import UserInvitationGrid, { PublicUser } from '../Meeting/UserInvitationGrid';

interface ShareScrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    scrollId?: string; // ID of the scroll/collaboration session
    currentContent?: string; // HTML content for preview
    onShareComplete?: (scrollId: string) => void;
}

export default function ShareScrollModal({ isOpen, onClose, title = "Share Scroll", scrollId, currentContent, onShareComplete }: ShareScrollModalProps) {
    const { user, userData } = useAuth();
    const [selectedUsers, setSelectedUsers] = useState<PublicUser[]>([]);
    const [sendingInvites, setSendingInvites] = useState(false);
    const [message, setMessage] = useState('');

    const handleShare = async () => {
        if (!user || selectedUsers.length === 0) return;

        setSendingInvites(true);
        try {
            // Generate a unique ID if one isn't provided (e.g. for a new ad-hoc share)
            // But realistically, we should pass the ID from the parent.
            // If scrollId is missing, we might assume it's a private note being shared for the first time?
            // For now, let's assume scrollId is passed or we generate a generic one.
            const targetResourceId = scrollId || `shared-note-${user.uid}-${Date.now()}`;

            const promises = selectedUsers.map(recipient => {
                return addDoc(collection(db, 'invitations'), {
                    toUserId: recipient.uid,
                    fromUser: {
                        uid: user.uid,
                        displayName: userData?.displayName || user.displayName || 'Unknown',
                        photoURL: userData?.photoURL || user.photoURL
                    },
                    type: 'scroll',
                    resourceId: targetResourceId,
                    title: title || 'Untitled Scroll',
                    previewContent: currentContent || '', // Snapshot for preview
                    message: message.trim(), // Optional private message
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await Promise.all(promises);
            alert(`Invites sent to ${selectedUsers.length} users!`);

            if (onShareComplete) {
                onShareComplete(targetResourceId);
            }

            onClose();
            setSelectedUsers([]);
            setMessage('');
        } catch (error) {
            console.error("Error sending invites:", error);
            alert("Failed to send invites. Please try again.");
        } finally {
            setSendingInvites(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="absolute inset-0 z-[60000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                    onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-black/80 backdrop-blur-3xl rounded-3xl shadow-2xl w-full max-w-md border border-white/10 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-cyan-400" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                                    {title}
                                </span>
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-gray-400 mb-6 font-medium">
                                Select users to invite to this fellowship scroll.
                            </p>

                            <UserInvitationGrid
                                selectedUsers={selectedUsers}
                                onSelectionChange={setSelectedUsers}
                            />

                            {/* Message Input */}
                            <div className="mt-6">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                    <MessageSquare className="w-3 h-3" />
                                    Add a Message (Optional)
                                </label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none transition-colors"
                                    rows={3}
                                    placeholder="Hey, check out these notes..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>

                            <div className="mt-8">
                                <button
                                    onClick={handleShare}
                                    disabled={selectedUsers.length === 0 || sendingInvites}
                                    className="w-full py-3 bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 border border-white/10"
                                >
                                    {sendingInvites ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Share2 className="w-4 h-4" />
                                            Send Invites ({selectedUsers.length})
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
