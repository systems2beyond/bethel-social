'use client';

import React, { useEffect, useState } from 'react';
import { BibleBot } from '@/components/Chat/BibleBot';

export default function ChatEmbedPage() {
    // In embed mode, we might want to control the bot state or styling differently
    // For now, we just render the bot. 
    // Ideally, BibleBot should accept props to be "always open" or handle resizing.

    return (
        <div className="bg-transparent">
            <BibleBot />
        </div>
    );
}
