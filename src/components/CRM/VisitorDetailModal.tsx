'use client';

import React, { useState } from 'react';
import { Visitor } from '@/types';
import { X, User, Clock, Tag as TagIcon } from 'lucide-react';
import ActivityTimeline from './ActivityTimeline';
import TagManager from './TagManager';
import { motion, AnimatePresence } from 'framer-motion';

interface VisitorDetailModalProps {
    visitor: Visitor | null;
    onClose: () => void;
}

type TabType = 'profile' | 'activity' | 'tags';

export default function VisitorDetailModal({ visitor, onClose }: VisitorDetailModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('profile');

    if (!visitor) return null;

    const tabs: { id: TabType; label: string; icon: React.ComponentType<any> }[] = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'activity', label: 'Activity', icon: Clock },
        { id: 'tags', label: 'Tags', icon: TagIcon }
    ];

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between p-4 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300">
                                {visitor.firstName?.[0]}{visitor.lastName?.[0]}
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-100">
                                    {visitor.firstName} {visitor.lastName}
                                </h2>
                                <div className="flex gap-1.5 mt-1">
                                    {visitor.isFirstTime && (
                                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-semibold rounded uppercase">
                                            New
                                        </span>
                                    )}
                                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-medium rounded">
                                        {visitor.pipelineStage?.replace('_', ' ').toUpperCase() || 'NEW GUEST'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 px-4 pt-2 border-b border-zinc-800">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative rounded-t-md ${activeTab === tab.id
                                            ? 'text-blue-400 bg-zinc-800/50'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {activeTab === 'profile' && (
                            <div className="space-y-4">
                                {/* Contact Information */}
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Contact</h3>
                                    <div className="space-y-1.5 text-sm">
                                        {visitor.email && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-zinc-500">Email</span>
                                                <a href={`mailto:${visitor.email}`} className="text-blue-400 hover:text-blue-300 text-sm">
                                                    {visitor.email}
                                                </a>
                                            </div>
                                        )}
                                        {visitor.phone && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-zinc-500">Phone</span>
                                                <a href={`tel:${visitor.phone}`} className="text-blue-400 hover:text-blue-300 text-sm">
                                                    {visitor.phone}
                                                </a>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-500">Source</span>
                                            <span className="text-zinc-200 capitalize text-sm">{visitor.source || 'Direct'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-500">Added</span>
                                            <span className="text-zinc-200 text-sm">
                                                {visitor.createdAt?.toDate ? visitor.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Prayer Requests */}
                                {visitor.prayerRequests && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Prayer Request</h3>
                                        <p className="text-sm text-zinc-300">{visitor.prayerRequests}</p>
                                    </div>
                                )}

                                {/* Notes */}
                                {visitor.notes && (
                                    <div className="bg-zinc-800/50 rounded-lg p-3">
                                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Notes</h3>
                                        <p className="text-sm text-zinc-300">{visitor.notes}</p>
                                    </div>
                                )}

                                {/* Custom Fields */}
                                {visitor.customFields && Object.keys(visitor.customFields).length > 0 && (
                                    <div className="bg-zinc-800/50 rounded-lg p-3">
                                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Additional Info</h3>
                                        <div className="space-y-1.5 text-sm">
                                            {Object.entries(visitor.customFields).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center">
                                                    <span className="text-zinc-500 capitalize">{key.replace('_', ' ')}</span>
                                                    <span className="text-zinc-200">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div>
                                <ActivityTimeline personId={visitor.id} personType="visitor" />
                            </div>
                        )}

                        {activeTab === 'tags' && (
                            <div>
                                <p className="text-xs text-zinc-500 mb-3">
                                    Add tags to categorize this visitor
                                </p>
                                <TagManager
                                    personId={visitor.id}
                                    personType="visitor"
                                    currentTags={visitor.tags || []}
                                />
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
