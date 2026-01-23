'use client';

import React from 'react';
import { ActivityPanel } from '@/components/Activity/ActivityPanel';
import { ViewResourceModal } from '@/components/Meeting/ViewResourceModal';
import { useActivity } from '@/context/ActivityContext';
import { LocalActivitySidebar } from '@/components/Bible/LocalActivitySidebar';

export function GlobalLayoutComponents() {
    const { selectedResource, setSelectedResource } = useActivity();

    return (
        <>
            <ActivityPanel />
            <LocalActivitySidebar />

            {/* Global Resource Modal */}
            {selectedResource && (
                <ViewResourceModal
                    isOpen={!!selectedResource}
                    onClose={() => setSelectedResource(null)}
                    title={selectedResource.title || selectedResource.resourceTitle || 'Untitled Scroll'}
                    content={selectedResource.previewContent || '<p>No preview content available.</p>'}
                    type="scroll"
                    meetingId={selectedResource.resourceId || selectedResource.meetingId}
                    collaborationId={selectedResource.resourceId || selectedResource.meetingId}
                />
            )}
        </>
    );
}
