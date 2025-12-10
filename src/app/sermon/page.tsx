import React from 'react';
import SermonDetailClient from '@/components/Sermons/SermonDetailClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
    return [];
}

export default async function SermonDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <SermonDetailClient id={id} />;
}
