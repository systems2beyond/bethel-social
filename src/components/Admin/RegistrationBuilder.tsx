'use client';

import React, { useState } from 'react';
import { RegistrationField } from '@/types';
import { Plus, Trash2, GripVertical, Settings2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface RegistrationBuilderProps {
    fields: RegistrationField[];
    onChange: (fields: RegistrationField[]) => void;
}

export const RegistrationBuilder = ({ fields, onChange }: RegistrationBuilderProps) => {
    const addField = () => {
        const newField: RegistrationField = {
            id: `field_${Date.now()}`,
            type: 'text',
            label: '',
            required: false,
            placeholder: '',
            options: []
        };
        onChange([...fields, newField]);
    };

    const updateField = (index: number, key: keyof RegistrationField, value: any) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], [key]: value };
        onChange(newFields);
    };

    const removeField = (index: number) => {
        const newFields = fields.filter((_, i) => i !== index);
        onChange(newFields);
    };

    const addOption = (fieldIndex: number) => {
        const newFields = [...fields];
        const currentOptions = newFields[fieldIndex].options || [];
        newFields[fieldIndex].options = [...currentOptions, `Option ${currentOptions.length + 1}`];
        onChange(newFields);
    };

    const updateOption = (fieldIndex: number, optionIndex: number, value: string) => {
        const newFields = [...fields];
        if (newFields[fieldIndex].options) {
            newFields[fieldIndex].options![optionIndex] = value;
            onChange(newFields);
        }
    };

    const removeOption = (fieldIndex: number, optionIndex: number) => {
        const newFields = [...fields];
        if (newFields[fieldIndex].options) {
            newFields[fieldIndex].options = newFields[fieldIndex].options!.filter((_, i) => i !== optionIndex);
            onChange(newFields);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div>
                    <h3 className="text-sm font-medium">Standard Fields</h3>
                    <p className="text-xs text-gray-500">Name and Email are always required.</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Full Name</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Email Address</span>
                </div>
            </div>

            <div className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="relative group border-l-4 border-l-blue-500">
                        <CardHeader className="py-3 px-4 bg-gray-50/50 dark:bg-gray-800/50 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-2">
                                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                                <span className="text-sm font-medium">Question {index + 1}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeField(index)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Question Label</Label>
                                    <Input
                                        value={field.label}
                                        onChange={(e) => updateField(index, 'label', e.target.value)}
                                        placeholder="e.g., Dietary Requirements"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Answer Type</Label>
                                    <Select
                                        value={field.type}
                                        onValueChange={(val) => updateField(index, 'type', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text">Short Text</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="phone">Phone Number</SelectItem>
                                            <SelectItem value="select">Dropdown Menu</SelectItem>
                                            <SelectItem value="checkbox">Checkbox (Yes/No)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`req-${field.id}`}
                                        checked={field.required}
                                        onCheckedChange={(checked) => updateField(index, 'required', checked)}
                                    />
                                    <Label htmlFor={`req-${field.id}`} className="text-sm font-normal cursor-pointer">
                                        Required Field
                                    </Label>
                                </div>
                                {field.type !== 'checkbox' && (
                                    <div className="flex-1">
                                        <Input
                                            value={field.placeholder || ''}
                                            onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                                            placeholder="Placeholder text (optional)"
                                            className="text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Options Editor for Select Type */}
                            {field.type === 'select' && (
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md space-y-2 mt-2">
                                    <Label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Dropdown Options</Label>
                                    {field.options?.map((option, optIndex) => (
                                        <div key={optIndex} className="flex gap-2">
                                            <Input
                                                value={option}
                                                onChange={(e) => updateOption(index, optIndex, e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeOption(index, optIndex)}
                                                className="h-8 w-8 p-0 text-red-400 hover:text-red-500"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addOption(index)}
                                        className="mt-2 text-xs"
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Add Option
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Button onClick={addField} variant="outline" className="w-full border-dashed py-6 text-gray-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10">
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Question
            </Button>
        </div>
    );
};
