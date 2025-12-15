'use client';

import React, { useState } from 'react';
import TiptapEditor from '@/components/Editor/TiptapEditor';
import { formatAiResponse } from '@/lib/utils/ai-formatting';

export default function DebugEditorPage() {
    const [editor, setEditor] = useState<any>(null);
    const [editorContent, setEditorContent] = useState('');
    const [generatedHtml, setGeneratedHtml] = useState('');

    const [testStatus, setTestStatus] = useState<'IDLE' | 'RUNNING' | 'PASS' | 'FAIL'>('IDLE');
    const [failureReason, setFailureReason] = useState('');

    const runTest = () => {
        setTestStatus('RUNNING');
        // 1. Test Input
        const input = "Here is a reference: [[Psalm 23]].";

        // 2. Generate HTML
        const html = formatAiResponse(input);
        setGeneratedHtml(html);

        // 3. Insert into Editor
        if (editor) {
            editor.commands.setContent(html); // Use setContent to replace
            const output = editor.getHTML();
            setEditorContent(output);

            // 4. Verification Logic
            const hasClass = output.includes('class="verse-link');
            const hasDataVerse = output.includes('data-verse="Psalm 23"');
            // Check for href existence separate from tag start, as attribute order varies
            const hasAnchor = output.includes('href="verse://Psalm 23"');

            if (hasClass && hasDataVerse && hasAnchor) {
                setTestStatus('PASS');
            } else {
                setTestStatus('FAIL');
                let reason = [];
                if (!hasAnchor) reason.push('Missing <a> tag');
                if (!hasClass) reason.push('Missing class attribute');
                if (!hasDataVerse) reason.push('Missing data-verse attribute');
                setFailureReason(reason.join(', '));
            }
        }
    };

    // Auto-run when editor is ready
    React.useEffect(() => {
        if (editor && testStatus === 'IDLE') {
            runTest();
        }
    }, [editor]);

    const handleLinkClick = (href: string) => {
        alert(`Link Clicked: ${href}`);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 bg-gray-50 min-h-screen">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">Tiptap Debug Sandbox</h1>
                {testStatus === 'PASS' && (
                    <span className="bg-green-100 text-green-800 text-xl px-4 py-1 rounded-full font-bold border-2 border-green-500">
                        ✅ PASS
                    </span>
                )}
                {testStatus === 'FAIL' && (
                    <span className="bg-red-100 text-red-800 text-xl px-4 py-1 rounded-full font-bold border-2 border-red-500">
                        ❌ FAIL
                    </span>
                )}
                {testStatus === 'RUNNING' && <span className="text-gray-500 font-medium">Running...</span>}
            </div>

            {testStatus === 'FAIL' && (
                <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
                    <strong>Failure Reason:</strong> {failureReason}
                </div>
            )}

            <div className="grid grid-cols-2 gap-8">
                {/* Control Panel */}
                <div className="space-y-4">
                    <button
                        onClick={runTest}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Rerun Test
                    </button>

                    <div className="bg-white p-4 rounded shadow">
                        <h3 className="font-bold mb-2">1. AI Formatter Output (Raw HTML)</h3>
                        <pre className="text-xs break-all whitespace-pre-wrap bg-gray-100 p-2 rounded">
                            {generatedHtml || 'Waiting...'}
                        </pre>
                    </div>

                    <div className="bg-white p-4 rounded shadow">
                        <h3 className="font-bold mb-2">3. Editor Output (getHTML)</h3>
                        <pre className="text-xs break-all whitespace-pre-wrap bg-gray-100 p-2 rounded">
                            {editorContent || 'Waiting...'}
                        </pre>
                        <p className="text-xs text-gray-500 mt-2">
                            Check if &lt;a&gt; tags and classes are preserved here.
                        </p>
                    </div>
                </div>

                {/* Editor Preview */}
                <div className="space-y-4">
                    <h3 className="font-bold">2. Tiptap Editor Instance</h3>
                    <div className="border border-gray-300 rounded bg-white min-h-[300px] p-4 prose dark:prose-invert">
                        <TiptapEditor
                            content=""
                            onChange={(html) => setEditorContent(html)}
                            onEditorReady={setEditor}
                            onLinkClick={handleLinkClick}
                            className="min-h-[200px] focus:outline-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
