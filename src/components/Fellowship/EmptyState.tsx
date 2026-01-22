import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
}

export function EmptyState({ icon, title, description, color }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-3xl bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md border border-white/20 dark:border-white/5">
            <div className={`
                p-6 rounded-3xl mb-6 ring-1 ring-inset ring-white/10 shadow-2xl
                bg-gradient-to-br from-${color}-500/20 to-${color}-600/5
            `}>
                {icon}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {title}
            </h3>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
                {description}
            </p>
        </div>
    );
}
