import React, { useState } from 'react';
import { Share2, X, Loader2 } from 'lucide-react';
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
}

export default function ShareScrollModal({ isOpen, onClose, title = "Share Scroll", scrollId, currentContent }: ShareScrollModalProps) {
    const { user, userData } = useAuth();
    const [selectedUsers, setSelectedUsers] = useState<PublicUser[]>([]);
    const [sendingInvites, setSendingInvites] = useState(false);

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
                    status: 'pending',
                    createdAt: serverTimestamp()
                });
            });

            await Promise.all(promises);
            alert(`Invites sent to ${selectedUsers.length} users!`);
            onClose();
            setSelectedUsers([]);
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
                <div className="absolute inset-0 z-[60000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
                    onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-xl w-full max-w-md border border-indigo-100 dark:border-indigo-900 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Share2 className="w-4 h-4 text-indigo-500" />
                                {title}
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Select users to invite to this fellowship scroll. They will receive a notification to join.
                            </p>

                            <UserInvitationGrid
                                selectedUsers={selectedUsers}
                                onSelectionChange={setSelectedUsers}
                            />

                            <div className="mt-6">
                                <button
                                    onClick={handleShare}
                                    disabled={selectedUsers.length === 0 || sendingInvites}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                >
                                    {sendingInvites ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending Invites...
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
