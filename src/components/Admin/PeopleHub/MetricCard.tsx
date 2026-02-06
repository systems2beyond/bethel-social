
import React from 'react';
import { LucideIcon, ArrowRight } from "lucide-react";
import Link from 'next/link';
import { cn } from "@/lib/utils";

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    change?: string; // e.g., "+12%"
    trend?: 'up' | 'down' | 'neutral';
    link?: string;
    description?: string;
    accentColor?: 'purple' | 'blue' | 'green' | 'coral' | 'amber';
    className?: string;
}

const accentColors = {
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        icon: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white',
        border: 'border-l-purple-500',
        hover: 'hover:shadow-purple-100 dark:hover:shadow-purple-950/20'
    },
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        icon: 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white',
        border: 'border-l-blue-500',
        hover: 'hover:shadow-blue-100 dark:hover:shadow-blue-950/20'
    },
    green: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        icon: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
        border: 'border-l-emerald-500',
        hover: 'hover:shadow-emerald-100 dark:hover:shadow-emerald-950/20'
    },
    coral: {
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        icon: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white',
        border: 'border-l-rose-500',
        hover: 'hover:shadow-rose-100 dark:hover:shadow-rose-950/20'
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        icon: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
        border: 'border-l-amber-500',
        hover: 'hover:shadow-amber-100 dark:hover:shadow-amber-950/20'
    }
};

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    icon: Icon,
    change,
    trend,
    link,
    description,
    accentColor = 'purple',
    className
}) => {
    const colors = accentColors[accentColor];

    const content = (
        <div className={cn(
            "relative group rounded-2xl border-l-[6px] bg-white dark:bg-zinc-900",
            "shadow-sm hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/20 transition-all duration-300",
            "p-6 overflow-hidden h-full flex flex-col justify-between",
            colors.border,
            link && "cursor-pointer hover:-translate-y-1",
            className
        )}>
            {/* Subtle background pattern */}
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-30",
                colors.bg
            )} />

            <div className="relative flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                        {title}
                    </p>
                    <p className="text-4xl font-black tracking-tight text-foreground">
                        {value}
                    </p>
                    {(change || description) && (
                        <p className="text-xs mt-3 text-muted-foreground flex items-center gap-1 font-medium">
                            {change && (
                                <span className={cn(
                                    "font-bold",
                                    trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
                                    trend === 'down' && 'text-red-600 dark:text-red-400',
                                    trend === 'neutral' && 'text-muted-foreground'
                                )}>
                                    {change}
                                </span>
                            )}
                            {description}
                        </p>
                    )}
                </div>

                {/* Icon with gradient background */}
                <div className={cn(
                    "flex-shrink-0 p-3.5 rounded-2xl shadow-sm transition-transform group-hover:scale-110 duration-300",
                    colors.icon
                )}>
                    <Icon className="h-6 w-6 stroke-[2.5]" />
                </div>
            </div>

            {/* Link arrow indicator */}
            {link && (
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
            )}
        </div>
    );

    if (link) {
        return <Link href={link} className="block h-full">{content}</Link>;
    }

    return content;
};
