'use client';

import React from 'react';
import { useChurch } from '@/context/ChurchContext';

export default function TermsOfService() {
    const { church } = useChurch();
    const churchName = church?.name || 'Church';

    return (
        <div className="max-w-4xl mx-auto px-4 py-12 prose prose-slate">
            <h1>Terms of Service</h1>
            <p>Last updated: {new Date().toLocaleDateString()}</p>

            <h2>1. Acceptance of Terms</h2>
            <p>
                By accessing and using the {churchName} Social Platform (&quot;the App&quot;), you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h2>2. Description of Service</h2>
            <p>
                The App provides a social platform for the {churchName} community to share updates, events, and connect with one another.
            </p>

            <h2>3. User Conduct</h2>
            <p>
                You agree to use the App only for lawful purposes. You are prohibited from posting content that is:
            </p>
            <ul>
                <li>Unlawful, harmful, threatening, abusive, harassing, defamatory, or hateful.</li>
                <li>Infringing on any third party&#39;s intellectual property rights.</li>
                <li>Contains viruses or any other computer code designed to interrupt or damage functionality.</li>
            </ul>

            <h2>4. Intellectual Property</h2>
            <p>
                All content provided on the App is the property of {churchName} or its content creators and protected by international copyright laws.
            </p>

            <h2>5. Termination</h2>
            <p>
                We reserve the right to terminate your access to the App without cause or notice.
            </p>

            <h2>6. Disclaimer</h2>
            <p>
                The App is provided &quot;as is&quot; without any warranties of any kind.
            </p>

            <h2>7. Contact Information</h2>
            <p>
                If you have any questions about these Terms, please contact us at info@bmbcfamily.com.
            </p>
        </div>
    );
}
