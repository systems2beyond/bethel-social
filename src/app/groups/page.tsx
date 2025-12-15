'use client';

import React from 'react';
import { Users, Construction } from 'lucide-react';

export default function GroupsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-6">
                <Users className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                Community Groups
            </h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-md text-lg mb-8">
                Connect with others, join small groups, and grow together. This feature is currently under development.
            </p>

            <div className="flex items-center text-sm text-gray-500 dark:text-gray-500 border border-dashed border-gray-300 dark:border-zinc-700 px-4 py-2 rounded-full">
                <Construction className="w-4 h-4 mr-2" />
                Coming Soon
            </div>
        </div>
    );
}
