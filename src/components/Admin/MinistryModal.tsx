'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Ministry, MinistryRole } from '@/types';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import * as Icons from 'lucide-react';

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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{ministry ? 'Edit Ministry' : 'Create New Ministry'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ministry Name</Label>
                            <Input
                                required
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Worship Team"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex items-center space-x-2">
                                <Input
                                    type="color"
                                    value={formData.color}
                                    onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                    className="w-12 h-10 p-1"
                                />
                                <Input
                                    value={formData.color}
                                    onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            value={formData.description}
                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe this ministry..."
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-base">Roles & Positions</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addRole}>
                                <Plus className="w-4 h-4 mr-2" /> Add Role
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {formData.roles?.map((role, index) => (
                                <div key={role.id} className="flex items-start space-x-3 bg-gray-50 p-3 rounded-lg border">
                                    <div className="flex-1 space-y-2">
                                        <Input
                                            placeholder="Role Name (e.g. Vocalist)"
                                            value={role.name}
                                            onChange={e => updateRole(index, { name: e.target.value })}
                                            required
                                        />
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`check-${role.id}`}
                                                checked={role.requiresBackgroundCheck}
                                                onChange={e => updateRole(index, { requiresBackgroundCheck: e.target.checked })}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor={`check-${role.id}`} className="text-sm text-gray-600">
                                                Requires Background Check
                                            </label>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeRole(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {(!formData.roles || formData.roles.length === 0) && (
                                <p className="text-sm text-gray-500 italic">No roles defined yet.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save Ministry
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
