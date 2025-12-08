import { Suspense } from 'react';
import { ChatInterface } from '@/components/Chat/ChatInterface';

export default function ChatPage() {
    return (
        <div className="min-h-full">
            <Suspense fallback={<div className="p-8 text-center">Loading chat...</div>}>
                <ChatInterface />
            </Suspense>
        </div>
    );
}
