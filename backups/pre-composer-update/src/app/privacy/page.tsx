import React from 'react';

export default function PrivacyPolicy() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12 prose prose-slate">
            <h1>Privacy Policy</h1>
            <p>Last updated: {new Date().toLocaleDateString()}</p>

            <h2>1. Information We Collect</h2>
            <p>
                We collect information you provide directly to us, such as when you create an account, post content, or communicate with us. This may include your name, email address, and any other information you choose to provide.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>
                We use the information we collect to:
            </p>
            <ul>
                <li>Provide, maintain, and improve our services.</li>
                <li>Communicate with you about updates, events, and news.</li>
                <li>Monitor and analyze trends and usage.</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p>
                We do not share your personal information with third parties except as described in this policy or with your consent.
            </p>

            <h2>4. Security</h2>
            <p>
                We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access.
            </p>

            <h2>5. Contact Us</h2>
            <p>
                If you have any questions about this Privacy Policy, please contact us at info@bmbcfamily.com.
            </p>
        </div>
    );
}
