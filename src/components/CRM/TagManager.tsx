'use client';

import React, { useEffect, useState } from 'react';
import { PersonTag } from '@/types';
import { subscribeToTags, createTag, deleteTag, applyTagToPerson, removeTagFromPerson } from '@/lib/crm';
import { Tag, Plus, X, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface TagManagerProps {
    personId?: string;
    personType?: 'visitor' | 'member';
    currentTags?: string[];
    onTagsChange?: (tags: string[]) => void;
}

const PRESET_COLORS = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#6366F1', // indigo
    '#14B8A6', // teal
];

export default function TagManager({ personId, personType, currentTags = [], onTagsChange }: TagManagerProps) {
    const [allTags, setAllTags] = useState<PersonTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
    const { user } = useAuth();

    useEffect(() => {
        const unsubscribe = subscribeToTags((tags) => {
            setAllTags(tags);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateTag = async () => {
        if (!newTagName.trim() || !user) return;

        try {
            await createTag(newTagName.trim(), newTagColor, 'custom', user.uid);
            setNewTagName('');
            setNewTagColor(PRESET_COLORS[0]);
            setShowCreateForm(false);
        } catch (error) {
            console.error('Error creating tag:', error);
            alert('Failed to create tag');
        }
    };

    const handleToggleTag = async (tagName: string) => {
        if (!personId || !personType) return;

        try {
            if (currentTags.includes(tagName)) {
                await removeTagFromPerson(personId, personType, tagName, user?.uid);
                onTagsChange?.(currentTags.filter(t => t !== tagName));
            } else {
                await applyTagToPerson(personId, personType, tagName, user?.uid);
                onTagsChange?.([...currentTags, tagName]);
            }
        } catch (error) {
            console.error('Error toggling tag:', error);
            alert('Failed to update tag');
        }
    };

    const handleDeleteTag = async (tagId: string) => {
        if (!confirm('Delete this tag? It will be removed from all people.')) return;

        try {
            await deleteTag(tagId);
        } catch (error) {
            console.error('Error deleting tag:', error);
            alert('Failed to delete tag');
        }
    };

    if (loading) {
        return <div className="text-sm text-gray-500">Loading tags...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Tag List */}
            <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                    const isActive = currentTags.includes(tag.name);

                    return (
                        <div
                            key={tag.id}
                            className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isActive
                                    ? 'ring-2 ring-offset-1 shadow-sm'
                                    : 'opacity-60 hover:opacity-100'
                                }`}
                            style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                border: `1px solid ${tag.color}`
                            }}
                        >
                            <Tag className="w-3 h-3" />
                            <span>{tag.name}</span>

                            {personId && personType && (
                                <button
                                    onClick={() => handleToggleTag(tag.name)}
                                    className="ml-1 p-0.5 hover:bg-white/50 rounded transition-colors"
                                    title={isActive ? 'Remove tag' : 'Add tag'}
                                >
                                    {isActive ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                </button>
                            )}

                            {!personId && (
                                <button
                                    onClick={() => handleDeleteTag(tag.id)}
                                    className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                                    title="Delete tag"
                                >
                                    <Trash2 className="w-3 h-3 text-red-600" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Create New Tag Button */}
                {!showCreateForm && (
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 border-dashed border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-800 dark:hover:text-gray-200 transition-all"
                    >
                        <Plus className="w-3 h-3" />
                        <span>New Tag</span>
                    </button>
                )}
            </div>

            {/* Create Tag Form */}
            {showCreateForm && (
                <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-700">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="Tag name..."
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateTag();
                                if (e.key === 'Escape') setShowCreateForm(false);
                            }}
                            autoFocus
                        />

                        <div className="flex gap-1">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setNewTagColor(color)}
                                    className={`w-8 h-8 rounded-full transition-transform ${newTagColor === color ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleCreateTag}
                            disabled={!newTagName.trim()}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Tag
                        </button>
                        <button
                            onClick={() => {
                                setShowCreateForm(false);
                                setNewTagName('');
                            }}
                            className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
