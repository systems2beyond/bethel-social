'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { VolunteerSchedulingService } from '@/lib/services/VolunteerSchedulingService';
import { Ministry, MinistryService } from '@/types';
import { toast } from 'sonner';
import { Calendar, Clock, Loader2, Type } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface CreateServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry: Ministry;
    initialDate?: Date; // If they clicked a specific day on the calendar
    serviceToEdit?: MinistryService; // If editing an existing service
}

export function CreateServiceModal({
    isOpen,
    onClose,
    ministry,
    initialDate,
    serviceToEdit
}: CreateServiceModalProps) {
    const { userData } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('11:00');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (serviceToEdit) {
                // Populate for edit
                setName(serviceToEdit.name);

                // Safe date extraction (same logic as calendar)
                let d: Date | null = null;
                const dVal = serviceToEdit.date;
                if (dVal instanceof Date) d = dVal;
                else if (dVal?.toDate) d = dVal.toDate();
                else if (dVal?.seconds) d = new Date(dVal.seconds * 1000);
                else if (typeof dVal === 'string') d = parseISO(dVal);
                else if (typeof dVal === 'number') d = new Date(dVal);

                if (d) {
                    setDate(format(d, 'yyyy-MM-dd'));
                } else {
                    setDate('');
                }

                setStartTime(serviceToEdit.startTime || '09:00');
                setEndTime(serviceToEdit.endTime || '11:00');
                setDescription(serviceToEdit.description || '');
            } else {
                // Reset for new creation
                setName('');
                setDate(initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                setStartTime('09:00');
                setEndTime('11:00');
                setDescription('');
            }
        }
    }, [isOpen, initialDate, serviceToEdit]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Please enter a service name');
            return;
        }
        if (!date) {
            toast.error('Please select a date');
            return;
        }

        setIsSubmitting(true);
        try {
            // Convert simple date string to Date object for backend storage
            // Add a middle-of-day time to avoid timezone shift issues before converting to Timestamp (which service does implicitly or explicitly)
            const serviceDate = parseISO(`${date}T12:00:00Z`); // using Z or local could shift, just stick to ISO

            if (serviceToEdit) {
                await VolunteerSchedulingService.updateService(serviceToEdit.id, {
                    name: name.trim(),
                    date: serviceDate,
                    startTime,
                    endTime,
                    description: description.trim()
                });
                toast.success('Service updated');
            } else {
                await VolunteerSchedulingService.createService({
                    ministryId: ministry.id,
                    name: name.trim(),
                    date: serviceDate,
                    startTime,
                    endTime,
                    description: description.trim(),
                    createdBy: userData!.uid
                });
                toast.success('Service created');
            }
            onClose();
        } catch (error) {
            console.error('Error saving service:', error);
            toast.error(serviceToEdit ? 'Failed to update service' : 'Failed to create service');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!serviceToEdit) return;

        if (!confirm(`Are you sure you want to delete "${serviceToEdit.name}" and all volunteer assignments for it?`)) {
            return;
        }

        setIsSubmitting(true);
        try {
            await VolunteerSchedulingService.deleteService(serviceToEdit.id);
            toast.success('Service deleted');
            onClose();
        } catch (error) {
            console.error('Error deleting service:', error);
            toast.error('Failed to delete service');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        {serviceToEdit ? 'Edit Service' : 'Create New Service'}
                    </DialogTitle>
                    <DialogDescription>
                        {serviceToEdit
                            ? 'Update the details for this scheduled service event.'
                            : 'Set up a new service event that requires volunteers.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-foreground">Service Name <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Type className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Sunday Morning Service"
                                className="pl-9 bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Date & Time Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-foreground">Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="pl-9 bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="startTime" className="text-foreground">Start</Label>
                                <div className="relative">
                                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        id="startTime"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="pl-8 text-sm bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endTime" className="text-foreground">End</Label>
                                <div className="relative">
                                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        id="endTime"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="pl-8 text-sm bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-foreground">Description/Notes</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Any specific details for this service..."
                            className="bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 min-h-[100px] resize-y focus-visible:ring-emerald-500"
                        />
                    </div>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                    {serviceToEdit ? (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="mr-auto"
                        >
                            Delete Service
                        </Button>
                    ) : <div></div>}

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                serviceToEdit ? 'Save Changes' : 'Create Service'
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
