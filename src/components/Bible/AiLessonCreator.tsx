'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, BookOpen, MessageSquare, Users, Plus, Loader2, FileText, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { formatAiResponse } from '@/lib/utils/ai-formatting';

interface AiLessonCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    contextTitle: string; // e.g., "John 3"
    onInsert: (content: string) => void;
}

type GeneratorMode = 'lesson_plan' | 'questions' | 'icebreaker' | 'summary';

export default function AiLessonCreator({ isOpen, onClose, contextTitle, onInsert }: AiLessonCreatorProps) {
    const { user, userData } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [mode, setMode] = useState<GeneratorMode | null>(null);

    if (!isOpen) return null;

    const handleGenerate = async (selectedMode: GeneratorMode) => {
        setMode(selectedMode);
        setIsLoading(true);
        setResult(null);

        let prompt = '';
        switch (selectedMode) {
            case 'lesson_plan':
                prompt = `Create a comprehensive Bible Study Lesson Plan for ${contextTitle}. 
                Structure it with:
                1. **Title & Theme**: A catchy title and main theme.
                2. **Ice Breaker**: A brief opening activity or question.
                3. **Scripture Reading**: Key verses to read.
                4. **Observation**: What does the text say? (Bullet points)
                5. **Interpretation**: What does it mean? (Theology/Context)
                6. **Application**: How does it apply today?
                7. **Closing Prayer**: A prayer focus.
                Format with bold headers and clear bullet points.`;
                break;
            case 'questions':
                prompt = `Generate 5-7 thought-provoking discussion questions for separate small groups studying ${contextTitle}.
                Include:
                - 2 Observation questions (What does it say?)
                - 2 Interpretation questions (What does it mean?)
                - 3 Application questions (How do we live it?)
                Ensure they are open-ended and encourage dialogue.`;
                break;
            case 'icebreaker':
                prompt = `Suggest 3 creative ice-breaker activities or questions related to the themes of ${contextTitle} to start a small group meeting. Keep them fun and low-pressure.`;
                break;
            default:
                prompt = `Summarize ${contextTitle}`;
        }

        try {
            const chatFn = httpsCallable(functions, 'chat');
            const response = await chatFn({
                message: prompt,
                history: [], // No history needed for fresh generation
                userName: userData?.displayName || user?.displayName,
                intent: 'notes_assistant' // Use notes_assistant for formatting
            }) as any;

            setResult(response.data.response);
        } catch (error) {
            console.error("Generation failed:", error);
            setResult("Sorry, I encountered an error generating the content. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleInsert = () => {
        if (result) {
            // Format before inserting (though notes_assistant usually returns decent HTML/Markdown)
            // We use formatAiResponse to ensure tables/lists are clean, but disable buttons
            const formatted = formatAiResponse(result, { useButtons: false });
            onInsert(formatted + '<p></p>'); // Add spacing
            onClose();
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/10 dark:to-zinc-900 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white">Lesson Creator</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">AI Co-pilot for {contextTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {!result && !isLoading && (
                        <div className="grid gap-3">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Select what you'd like to create:</p>

                            <button onClick={() => handleGenerate('lesson_plan')} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group text-left">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Full Lesson Plan</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Structured outline with intro, observation, and application.</p>
                                </div>
                            </button>

                            <button onClick={() => handleGenerate('questions')} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group text-left">
                                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Discussion Questions</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Thought-provoking questions for small group dialogue.</p>
                                </div>
                            </button>

                            <button onClick={() => handleGenerate('icebreaker')} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group text-left">
                                <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Ice Breakers</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Fun opening activities related to the theme.</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 animate-pulse rounded-full" />
                                <Sparkles className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-spin" />
                            </div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 animate-pulse">
                                Writing your {mode?.replace('_', ' ')}...
                            </p>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4">
                            <div className="prose dark:prose-invert prose-sm max-w-none p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                                <div dangerouslySetInnerHTML={{ __html: formatAiResponse(result, { useButtons: false }) }} />
                            </div>

                            <div className="flex gap-3 sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-4 -mx-6 -mb-6 mt-4 border-t border-gray-100 dark:border-zinc-800">
                                <button
                                    onClick={() => setResult(null)}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleInsert}
                                    className="flex-[2] py-2.5 px-4 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    Insert into Notes
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    return null;
}
