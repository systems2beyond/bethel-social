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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {visitor.firstName} {visitor.lastName}
                            </h2>
                            <div className="flex gap-2 mt-2">
                                {visitor.isFirstTime && (
                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                                        First Time Visitor
                                    </span>
                                )}
                                <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full">
                                    {visitor.pipelineStage?.replace('_', ' ').toUpperCase() || 'NEW GUEST'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-zinc-800 px-6">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === tab.id
                                            ? 'text-purple-600 dark:text-purple-400'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                {/* Contact Information */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Contact Information</h3>
                                    <div className="space-y-2 text-sm">
                                        {visitor.email && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                                                <a href={`mailto:${visitor.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                    {visitor.email}
                                                </a>
                                            </div>
                                        )}
                                        {visitor.phone && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                                                <a href={`tel:${visitor.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                    {visitor.phone}
                                                </a>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">Source:</span>
                                            <span className="text-gray-900 dark:text-white capitalize">{visitor.source || 'Unknown'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">Created:</span>
                                            <span className="text-gray-900 dark:text-white">
                                                {visitor.createdAt?.toDate ? visitor.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Prayer Requests */}
                                {visitor.prayerRequests && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Prayer Requests</h3>
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                                            {visitor.prayerRequests}
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                {visitor.notes && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Notes</h3>
                                        <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                                            {visitor.notes}
                                        </div>
                                    </div>
                                )}

                                {/* Custom Fields */}
                                {visitor.customFields && Object.keys(visitor.customFields).length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Additional Information</h3>
                                        <div className="space-y-2 text-sm">
                                            {Object.entries(visitor.customFields).map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace('_', ' ')}:</span>
                                                    <span className="text-gray-900 dark:text-white">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Activity History</h3>
                                <ActivityTimeline personId={visitor.id} personType="visitor" />
                            </div>
                        )}

                        {activeTab === 'tags' && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Manage Tags</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Add or remove tags to categorize and organize this visitor.
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
