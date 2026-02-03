'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useBible } from '@/context/BibleContext';
import { Loader2 } from 'lucide-react';

// Lazy load the heavy modal to avoid eager Tiptap initialization
const BibleStudyModal = dynamic(() => import('./BibleStudyModal'), {
    loading: () => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-full shadow-xl">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        </div>
    ),
    ssr: false
});

export default function BibleStudyModalWrapper() {
    const { isStudyOpen, closeStudy } = useBible();

    // Do not even attempt to render/load chunk unless open
    if (!isStudyOpen) return null;

    return <BibleStudyModal onClose={closeStudy} />;
}
