'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FirestoreUser, VolunteerProfile, Ministry } from '@/types';
import { Loader2, Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Badge } from '@/components/ui/badge';
import { VolunteerService } from '@/lib/volunteer-service';

interface VolunteerProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: FirestoreUser | null;
    ministries: Ministry[]; // For selection
    onSave: () => Promise<void>;
}

export function VolunteerProfileModal({ isOpen, onClose, user, ministries, onSave }: VolunteerProfileModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<VolunteerProfile>({
        isVolunteer: false,
        ministries: [],
        skills: [],
        availability: {
            sunday: false,
            wednesday: false,
            saturday: false
        },
        backgroundCheckStatus: 'not_started',
    });

    // Initial State loading
    useEffect(() => {
        if (user && user.volunteerProfile) {
            setFormData(user.volunteerProfile);
        } else if (user) {
            // Default empty profile
            setFormData({
                isVolunteer: false,
                ministries: [],
                skills: [],
                availability: {
                    sunday: false,
                    wednesday: false,
                    saturday: false
                },
                backgroundCheckStatus: 'not_started',
            });
        }
    }, [user, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        try {
            await VolunteerService.updateVolunteerProfile(user.uid, formData);
            await onSave();
            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update volunteer profile');
        } finally {
            setLoading(false);
        }
    };

    const toggleMinistry = (ministryId: string) => {
        setFormData(prev => {
            const current = prev.ministries || [];
            if (current.includes(ministryId)) {
                return { ...prev, ministries: current.filter(id => id !== ministryId) };
            } else {
                return { ...prev, ministries: [...current, ministryId] };
            }
        });
    };

    const toggleDay = (day: keyof typeof formData.availability) => {
        setFormData(prev => ({
            ...prev,
            availability: {
                ...prev.availability,
                [day]: !prev.availability?.[day]
            }
        }));
    };

    if (!user) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Volunteer Profile: {user.displayName}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Status Section */}
                    <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                        <div>
                            <Label className="text-base font-semibold">Volunteer Status</Label>
                            <p className="text-sm text-gray-500">Enable to list this user as a volunteer.</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="isVolunteer"
                                checked={formData.isVolunteer}
                                onChange={e => setFormData(prev => ({ ...prev, isVolunteer: e.target.checked }))}
                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Label htmlFor="isVolunteer" className="cursor-pointer">Active Volunteer</Label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Ministries */}
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">Ministries</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {ministries.map(ministry => (
                                    <div
                                        key={ministry.id}
                                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${formData.ministries?.includes(ministry.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}
                                        onClick={() => toggleMinistry(ministry.id)}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 ${formData.ministries?.includes(ministry.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                            {formData.ministries?.includes(ministry.id) && <CheckCircle className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="font-medium text-gray-900">{ministry.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Availability & Background Check */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <Label className="text-base font-semibold">Availability</Label>
                                <div className="flex flex-wrap gap-2">
                                    {['sunday', 'wednesday', 'saturday'].map((day) => (
                                        <Button
                                            key={day}
                                            type="button"
                                            variant={formData.availability?.[day as keyof typeof formData.availability] ? 'default' : 'outline'}
                                            onClick={() => toggleDay(day as any)}
                                            className="capitalize"
                                        >
                                            {day}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-base font-semibold">Background Check</Label>
                                <div className="space-y-2">
                                    <select
                                        value={formData.backgroundCheckStatus}
                                        onChange={e => setFormData(prev => ({ ...prev, backgroundCheckStatus: e.target.value as any }))}
                                        className="w-full rounded-md border border-gray-300 p-2"
                                    >
                                        <option value="not_started">Not Started</option>
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="expired">Expired</option>
                                    </select>
                                    {formData.backgroundCheckStatus === 'approved' && (
                                        <div className="flex items-center text-sm text-green-600">
                                            <CheckCircle className="w-4 h-4 mr-1" /> Clear to serve
                                        </div>
                                    )}
                                    {formData.backgroundCheckStatus === 'expired' && (
                                        <div className="flex items-center text-sm text-red-600">
                                            <AlertCircle className="w-4 h-4 mr-1" /> Needs renewal
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Skills & Notes */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Skills & Notes</Label>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Skills (comma separated)</Label>
                            <Input
                                value={formData.skills?.join(', ')}
                                onChange={e => setFormData(prev => ({ ...prev, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                                placeholder="e.g. Mixing, Camera, Guitar"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Privates Notes</Label>
                            <Textarea
                                value={formData.notes || ''}
                                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Internal notes about this volunteer..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save Profile
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
