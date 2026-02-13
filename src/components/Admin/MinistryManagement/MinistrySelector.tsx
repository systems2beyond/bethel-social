'use client';

import React from 'react';
import { Ministry } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import * as Icons from 'lucide-react';
import { LucideIcon, Users } from 'lucide-react';

interface MinistrySelectorProps {
    ministries: Ministry[];
    selectedMinistry: Ministry | null;
    onSelectMinistry: (ministry: Ministry) => void;
    memberCounts?: Record<string, number>; // Optional member counts by ministry ID
}

// Helper to get dynamic icons
const getIcon = (iconName?: string): LucideIcon => {
    if (!iconName) return Users;
    const IconComponent = (Icons as unknown as Record<string, LucideIcon>)[iconName];
    return IconComponent || Users;
};

export function MinistrySelector({
    ministries,
    selectedMinistry,
    onSelectMinistry,
    memberCounts = {}
}: MinistrySelectorProps) {
    const handleChange = (value: string) => {
        const ministry = ministries.find(m => m.id === value);
        if (ministry) {
            onSelectMinistry(ministry);
        }
    };

    return (
        <Select
            value={selectedMinistry?.id || ''}
            onValueChange={handleChange}
        >
            <SelectTrigger className="h-9 w-[240px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-xl shadow-sm font-semibold text-sm">
                <SelectValue placeholder="Select ministry">
                    {selectedMinistry && (
                        <div className="flex items-center gap-2">
                            {(() => {
                                const IconComponent = getIcon(selectedMinistry.icon);
                                return (
                                    <div
                                        className="w-5 h-5 rounded-md flex items-center justify-center"
                                        style={{ backgroundColor: `${selectedMinistry.color}20` }}
                                    >
                                        <IconComponent
                                            className="w-3 h-3"
                                            style={{ color: selectedMinistry.color }}
                                        />
                                    </div>
                                );
                            })()}
                            <span className="truncate">{selectedMinistry.name}</span>
                        </div>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200 dark:border-zinc-700">
                {ministries.length === 0 ? (
                    <div className="py-4 px-3 text-center text-sm text-muted-foreground">
                        No ministries found
                    </div>
                ) : (
                    ministries.map(ministry => {
                        const IconComponent = getIcon(ministry.icon);
                        const count = memberCounts[ministry.id] || 0;

                        return (
                            <SelectItem
                                key={ministry.id}
                                value={ministry.id}
                                className="rounded-lg cursor-pointer"
                            >
                                <div className="flex items-center gap-3 py-1">
                                    <div
                                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${ministry.color}20` }}
                                    >
                                        <IconComponent
                                            className="w-3.5 h-3.5"
                                            style={{ color: ministry.color }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium">{ministry.name}</span>
                                    </div>
                                    {count > 0 && (
                                        <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                            {count}
                                        </span>
                                    )}
                                </div>
                            </SelectItem>
                        );
                    })
                )}
            </SelectContent>
        </Select>
    );
}
