'use client';

import React, { useState, useEffect } from 'react';
import { Ministry, MinistryRole } from '@/types';
import { Loader2, Plus, Trash2, X, Users } from 'lucide-react';

interface MinistryModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry?: Ministry | null;
    onSave: (ministry: Partial<Ministry>) => Promise<void>;
}

export function MinistryModal({ isOpen, onClose, ministry, onSave }: MinistryModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Ministry>>({
        name: '',
        description: '',
        color: '#3b82f6',
        icon: 'Users',
        roles: [],
        active: true,
    });

    // Reset form when ministry changes
    useEffect(() => {
        if (ministry) {
            setFormData({
                ...ministry,
            });
        } else {
            setFormData({
                name: '',
                description: '',
                color: '#3b82f6',
                icon: 'Users',
                roles: [],
                active: true,
            });
        }
    }, [ministry, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save ministry');
        } finally {
            setLoading(false);
        }
    };

    const addRole = () => {
        const newRole: MinistryRole = {
            id: crypto.randomUUID(),
            name: '',
            requiresBackgroundCheck: false,
        };
        setFormData(prev => ({
            ...prev,
            roles: [...(prev.roles || []), newRole]
        }));
    };

    const updateRole = (index: number, updates: Partial<MinistryRole>) => {
        const newRoles = [...(formData.roles || [])];
        newRoles[index] = { ...newRoles[index], ...updates };
        setFormData(prev => ({ ...prev, roles: newRoles }));
    };

    const removeRole = (index: number) => {
        const newRoles = [...(formData.roles || [])];
        newRoles.splice(index, 1);
        setFormData(prev => ({ ...prev, roles: newRoles }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        {ministry ? 'Edit Ministry' : 'Create New Ministry'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">

                    {/* Name and Color */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Ministry Name
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Worship Team"
                                className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Color
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                    className="w-12 h-10 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={formData.color}
                                    onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                    placeholder="#3b82f6"
                                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe this ministry..."
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Roles */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Roles & Positions
                            </label>
                            <button
                                type="button"
                                onClick={addRole}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Add Role
                            </button>
                        </div>

                        <div className="space-y-2">
                            {formData.roles?.map((role, index) => (
                                <div key={role.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Role Name (e.g. Vocalist)"
                                            value={role.name}
                                            onChange={e => updateRole(index, { name: e.target.value })}
                                            required
                                            className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`check-${role.id}`}
                                                checked={role.requiresBackgroundCheck}
                                                onChange={e => updateRole(index, { requiresBackgroundCheck: e.target.checked })}
                                                className="rounded border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <label htmlFor={`check-${role.id}`} className="text-xs text-zinc-500 dark:text-zinc-400">
                                                Requires Background Check
                                            </label>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeRole(index)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {(!formData.roles || formData.roles.length === 0) && (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 italic py-2">No roles defined yet.</p>
                            )}
                        </div>
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? 'Saving...' : 'Save Ministry'}
                    </button>
                </div>
            </div>
        </div>
    );
}
