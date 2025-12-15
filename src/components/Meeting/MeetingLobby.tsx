'use client';

import React, { useState, useEffect } from 'react';
import { Meeting } from '@/types';
import { MeetingChat } from './MeetingChat';
import { Users, FileText, Video, ArrowRight, Share2, File } from 'lucide-react';
import { format } from 'date-fns';

interface MeetingLobbyProps {
    meeting: Meeting;
    onClose: () => void;
    onJoin: () => void;
}

export default function MeetingLobby({ meeting, onClose, onJoin }: MeetingLobbyProps) {
    const isLive = Date.now() >= meeting.startTime && Date.now() <= meeting.startTime + (meeting.durationMinutes * 60 * 1000);

    // Placeholder for file sharing
    const files = [
        { id: '1', name: 'Bible Study Outline.pdf', size: '2.4 MB' },
        { id: '2', name: 'Discussion Questions.docx', size: '1.1 MB' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-200 dark:border-zinc-800">

                {/* Left Pane: Info & Files */}
                <div className="md:w-2/5 p-6 bg-gray-50 dark:bg-zinc-950 flex flex-col border-r border-gray-200 dark:border-zinc-800">
                    {/* Header */}
                    <div className="mb-8">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
                            {meeting.type}
                        </span>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                            {meeting.topic}
                        </h2>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                            <span className="font-medium text-gray-900 dark:text-gray-200">{meeting.hostName}</span>
                            <span>·</span>
                            <span>{format(meeting.startTime, 'MMM d, h:mm a')}</span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-8">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">About this meeting</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            {meeting.description || "No description provided."}
                        </p>
                    </div>

                    {/* Files (Mock) */}
                    <div className="flex-1 overflow-y-auto min-h-0 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Shared Files</h4>
                            <button className="text-xs text-blue-600 font-medium hover:underline">+ Add File</button>
                        </div>
                        <div className="space-y-2">
                            {files.map(file => (
                                <div key={file.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800 transition-colors group cursor-pointer">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</div>
                                        <div className="text-xs text-gray-500">{file.size}</div>
                                    </div>
                                    <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Share2 className="w-3.5 h-3.5 text-gray-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto space-y-3">
                        <button
                            onClick={onJoin}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Video className="w-4 h-4" />
                            {isLive ? 'Join Meeting Now' : 'Join Meeting'}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Right Pane: Chat */}
                <div className="md:w-3/5 h-full flex flex-col bg-white dark:bg-zinc-900">
                    <MeetingChat meetingId={meeting.id} />
                </div>
            </div>
        </div>
    );
}
