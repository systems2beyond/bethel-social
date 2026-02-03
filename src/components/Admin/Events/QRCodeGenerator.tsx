'use client';

import React, { useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Download, RefreshCcw } from 'lucide-react';

interface QRCodeGeneratorProps {
    url: string;
    eventId: string;
}

export default function QRCodeGenerator({ url, eventId }: QRCodeGeneratorProps) {
    const [fgColor, setFgColor] = useState('#000000');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [isTransparent, setIsTransparent] = useState(false);
    const [includeMargin, setIncludeMargin] = useState(true);

    const handleDownload = () => {
        const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `event-${eventId}-qr${isTransparent ? '-transparent' : ''}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Configuration Controls */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4 min-w-[280px]">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-500 mb-2">Details</h3>

                    <div>
                        <label className="block text-sm font-medium mb-1">Foreground Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={fgColor}
                                onChange={(e) => setFgColor(e.target.value)}
                                className="h-10 w-10 p-1 rounded border cursor-pointer"
                            />
                            <span className="text-sm font-mono text-gray-500">{fgColor}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Background Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={bgColor}
                                onChange={(e) => setBgColor(e.target.value)}
                                disabled={isTransparent}
                                className={`h-10 w-10 p-1 rounded border cursor-pointer ${isTransparent ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            <span className={`text-sm font-mono text-gray-500 ${isTransparent ? 'opacity-50' : ''}`}>
                                {isTransparent ? 'Transparent' : bgColor}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isTransparent}
                                onChange={(e) => setIsTransparent(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Transparent Background</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeMargin}
                                onChange={(e) => setIncludeMargin(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Include Margin</span>
                        </label>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={() => {
                                setFgColor('#000000');
                                setBgColor('#ffffff');
                                setIsTransparent(false);
                            }}
                            className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-700"
                        >
                            <RefreshCcw className="w-3 h-3" /> Reset Colors
                        </button>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="flex flex-col items-center">
                    <div className={`p-4 rounded-xl shadow-sm border border-gray-100 mb-4 ${isTransparent ? 'bg-gray-200 dark:bg-gray-700/50 bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIi8+CjxwYXRoIGQ9Ik0wIDBMNCA0TTQgMEwwIDQiIHN0cm9rZT0iI2VlZSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==")]' : 'bg-white'}`}>
                        <QRCodeSVG
                            value={url}
                            size={200}
                            bgColor={isTransparent ? 'transparent' : bgColor}
                            fgColor={fgColor}
                            level={'H'}
                            includeMargin={includeMargin}
                        />
                    </div>

                    {/* Hidden Canvas for Download */}
                    <div className="hidden">
                        <QRCodeCanvas
                            id="qr-code-canvas"
                            value={url}
                            size={1000}
                            bgColor={isTransparent ? 'transparent' : bgColor}
                            fgColor={fgColor}
                            level={'H'}
                            includeMargin={includeMargin}
                        />
                    </div>

                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Download PNG
                    </button>
                </div>
            </div>
        </div>
    );
}
