"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    GoogleMap,
    useLoadScript,
    DrawingManager,
    Circle,
    Polygon,
    Marker,
    Libraries,
} from '@react-google-maps/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Trash2, Search, Circle as CircleIcon, Pentagon, X, Plus, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const libraries: Libraries = ['places', 'drawing', 'geometry'];

interface ZipCodeMapSelectorProps {
    zipCodes: string[];
    onZipCodesChange: (zipCodes: string[]) => void;
    churchLocation?: { lat: number; lng: number };
    onClose?: () => void;
}

interface DrawnShape {
    id: string;
    type: 'circle' | 'polygon';
    center?: { lat: number; lng: number };
    radius?: number;
    paths?: { lat: number; lng: number }[];
}

const mapContainerStyle = {
    width: '100%',
    height: '300px',
};

// Default center (Atlanta, GA) - will be overridden by church location
const defaultCenter = {
    lat: 33.7490,
    lng: -84.3880,
};

export default function ZipCodeMapSelector({
    zipCodes,
    onZipCodesChange,
    churchLocation,
    onClose,
}: ZipCodeMapSelectorProps) {
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries,
        preventGoogleFontsLoading: true,
    });

    const [mapCenter, setMapCenter] = useState(churchLocation || defaultCenter);
    const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [drawingMode, setDrawingMode] = useState<'circle' | 'polygon' | null>(null);
    const [manualZipInput, setManualZipInput] = useState('');

    const mapRef = useRef<google.maps.Map | null>(null);
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    // Initialize geocoder when map loads
    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();
    }, []);

    // Handle circle complete
    const onCircleComplete = useCallback((circle: google.maps.Circle) => {
        const center = circle.getCenter();
        const radius = circle.getRadius();

        if (!center) return;

        const shapeId = `circle-${Date.now()}`;
        const newShape: DrawnShape = {
            id: shapeId,
            type: 'circle',
            center: { lat: center.lat(), lng: center.lng() },
            radius: radius,
        };

        setDrawnShapes(prev => [...prev, newShape]);

        // Find ZIP codes within the circle
        findZipCodesInCircle(center.lat(), center.lng(), radius);

        // Remove the drawn circle (we'll render our own)
        circle.setMap(null);
        setDrawingMode(null);
    }, []);

    // Handle polygon complete
    const onPolygonComplete = useCallback((polygon: google.maps.Polygon) => {
        const path = polygon.getPath();
        const paths: { lat: number; lng: number }[] = [];

        for (let i = 0; i < path.getLength(); i++) {
            const point = path.getAt(i);
            paths.push({ lat: point.lat(), lng: point.lng() });
        }

        const shapeId = `polygon-${Date.now()}`;
        const newShape: DrawnShape = {
            id: shapeId,
            type: 'polygon',
            paths,
        };

        setDrawnShapes(prev => [...prev, newShape]);

        // Find ZIP codes within the polygon
        findZipCodesInPolygon(paths);

        // Remove the drawn polygon (we'll render our own)
        polygon.setMap(null);
        setDrawingMode(null);
    }, []);

    // Find ZIP codes within a circle by sampling points
    const findZipCodesInCircle = async (centerLat: number, centerLng: number, radius: number) => {
        if (!geocoderRef.current) return;

        setIsSearching(true);
        const foundZips = new Set<string>();

        // Sample points within the circle
        const numSamples = Math.min(15, Math.ceil(radius / 2000)); // More samples for larger areas
        const points: { lat: number; lng: number }[] = [
            { lat: centerLat, lng: centerLng }, // Center
        ];

        // Add points in a grid pattern
        for (let i = 0; i < numSamples; i++) {
            const angle = (2 * Math.PI * i) / numSamples;
            const distance = radius * 0.7; // 70% of radius
            const lat = centerLat + (distance / 111320) * Math.cos(angle);
            const lng = centerLng + (distance / (111320 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angle);
            points.push({ lat, lng });
        }

        // Geocode each point
        for (const point of points) {
            try {
                const result = await geocodePoint(point.lat, point.lng);
                if (result) {
                    foundZips.add(result);
                }
            } catch (e) {
                console.error('Geocode error:', e);
            }
        }

        // Add new ZIP codes
        const newZips = Array.from(foundZips).filter(z => !zipCodes.includes(z));
        if (newZips.length > 0) {
            onZipCodesChange([...zipCodes, ...newZips]);
            toast.success(`Found ${newZips.length} new ZIP code${newZips.length > 1 ? 's' : ''}`);
        } else {
            toast.info('No new ZIP codes found in this area');
        }

        setIsSearching(false);
    };

    // Find ZIP codes within a polygon
    const findZipCodesInPolygon = async (paths: { lat: number; lng: number }[]) => {
        if (!geocoderRef.current || paths.length < 3) return;

        setIsSearching(true);
        const foundZips = new Set<string>();

        // Calculate bounding box
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const p of paths) {
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);
            minLng = Math.min(minLng, p.lng);
            maxLng = Math.max(maxLng, p.lng);
        }

        // Calculate centroid
        const centroidLat = paths.reduce((sum, p) => sum + p.lat, 0) / paths.length;
        const centroidLng = paths.reduce((sum, p) => sum + p.lng, 0) / paths.length;

        // Sample points: centroid + grid within bounding box
        const points: { lat: number; lng: number }[] = [
            { lat: centroidLat, lng: centroidLng },
        ];

        const gridSize = 3;
        const latStep = (maxLat - minLat) / (gridSize + 1);
        const lngStep = (maxLng - minLng) / (gridSize + 1);

        for (let i = 1; i <= gridSize; i++) {
            for (let j = 1; j <= gridSize; j++) {
                const lat = minLat + i * latStep;
                const lng = minLng + j * lngStep;
                // Check if point is inside polygon
                if (isPointInPolygon({ lat, lng }, paths)) {
                    points.push({ lat, lng });
                }
            }
        }

        // Geocode each point
        for (const point of points) {
            try {
                const result = await geocodePoint(point.lat, point.lng);
                if (result) {
                    foundZips.add(result);
                }
            } catch (e) {
                console.error('Geocode error:', e);
            }
        }

        const newZips = Array.from(foundZips).filter(z => !zipCodes.includes(z));
        if (newZips.length > 0) {
            onZipCodesChange([...zipCodes, ...newZips]);
            toast.success(`Found ${newZips.length} new ZIP code${newZips.length > 1 ? 's' : ''}`);
        } else {
            toast.info('No new ZIP codes found in this area');
        }

        setIsSearching(false);
    };

    // Helper: Check if point is inside polygon
    const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lng, yi = polygon[i].lat;
            const xj = polygon[j].lng, yj = polygon[j].lat;
            const intersect = ((yi > point.lat) !== (yj > point.lat))
                && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    // Geocode a point to get ZIP code
    const geocodePoint = (lat: number, lng: number): Promise<string | null> => {
        return new Promise((resolve) => {
            if (!geocoderRef.current) {
                resolve(null);
                return;
            }

            geocoderRef.current.geocode(
                { location: { lat, lng } },
                (results, status) => {
                    if (status === 'OK' && results && results.length > 0) {
                        // Find the postal code component
                        for (const result of results) {
                            for (const component of result.address_components) {
                                if (component.types.includes('postal_code')) {
                                    // Get just the 5-digit ZIP
                                    const zip = component.short_name.split('-')[0];
                                    resolve(zip);
                                    return;
                                }
                            }
                        }
                    }
                    resolve(null);
                }
            );
        });
    };

    // Search for a location/city
    const handleLocationSearch = async () => {
        if (!searchQuery.trim() || !geocoderRef.current) return;

        setIsSearching(true);

        geocoderRef.current.geocode({ address: searchQuery }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
                const location = results[0].geometry.location;
                setMapCenter({ lat: location.lat(), lng: location.lng() });
                mapRef.current?.panTo({ lat: location.lat(), lng: location.lng() });
                mapRef.current?.setZoom(12);

                // Check for ZIP code in result
                for (const component of results[0].address_components) {
                    if (component.types.includes('postal_code')) {
                        const zip = component.short_name.split('-')[0];
                        if (!zipCodes.includes(zip)) {
                            onZipCodesChange([...zipCodes, zip]);
                            toast.success(`Added ZIP code ${zip}`);
                        }
                        break;
                    }
                }
            } else {
                toast.error('Location not found');
            }
            setIsSearching(false);
        });
    };

    // Add manual ZIP code
    const handleAddManualZip = () => {
        const zip = manualZipInput.trim();
        if (!zip) return;

        const zipPattern = /^\d{5}$/;
        if (!zipPattern.test(zip)) {
            toast.error('Please enter a valid 5-digit ZIP code');
            return;
        }

        if (zipCodes.includes(zip)) {
            toast.error('This ZIP code is already added');
            return;
        }

        onZipCodesChange([...zipCodes, zip]);
        setManualZipInput('');
        toast.success(`Added ZIP code ${zip}`);
    };

    // Remove a shape
    const handleRemoveShape = (shapeId: string) => {
        setDrawnShapes(prev => prev.filter(s => s.id !== shapeId));
    };

    // Remove a ZIP code
    const handleRemoveZip = (zip: string) => {
        onZipCodesChange(zipCodes.filter(z => z !== zip));
    };

    // Center on church location
    const handleCenterOnChurch = () => {
        if (churchLocation) {
            setMapCenter(churchLocation);
            mapRef.current?.panTo(churchLocation);
            mapRef.current?.setZoom(12);
        }
    };

    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        return (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                    Google Maps API key not configured. Please add ZIP codes manually.
                </p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">
                    Error loading Google Maps. Please add ZIP codes manually.
                </p>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                <span className="text-sm text-muted-foreground">Loading map...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search & Manual Entry */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex gap-2">
                    <Input
                        type="text"
                        placeholder="Search city or neighborhood..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                        className="flex-1 rounded-lg"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleLocationSearch}
                        disabled={isSearching || !searchQuery.trim()}
                        className="rounded-lg"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="ZIP code"
                        value={manualZipInput}
                        onChange={(e) => setManualZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddManualZip()}
                        className="w-24 rounded-lg"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddManualZip}
                        disabled={!manualZipInput.trim()}
                        className="rounded-lg"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Draw area:</span>
                <Button
                    type="button"
                    variant={drawingMode === 'circle' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawingMode(drawingMode === 'circle' ? null : 'circle')}
                    className="rounded-lg h-8"
                >
                    <CircleIcon className="h-3.5 w-3.5 mr-1" />
                    Circle
                </Button>
                <Button
                    type="button"
                    variant={drawingMode === 'polygon' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
                    className="rounded-lg h-8"
                >
                    <Pentagon className="h-3.5 w-3.5 mr-1" />
                    Polygon
                </Button>
                {churchLocation && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCenterOnChurch}
                        className="rounded-lg h-8 ml-auto"
                    >
                        <Navigation className="h-3.5 w-3.5 mr-1" />
                        Center on Church
                    </Button>
                )}
                {isSearching && (
                    <span className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Finding ZIP codes...
                    </span>
                )}
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={mapCenter}
                    zoom={11}
                    onLoad={onMapLoad}
                    options={{
                        disableDefaultUI: false,
                        zoomControl: true,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                    }}
                >
                    {/* Church marker */}
                    {churchLocation && (
                        <Marker
                            position={churchLocation}
                            icon={{
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 10,
                                fillColor: '#3B82F6',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2,
                            }}
                        />
                    )}

                    {/* Drawing Manager */}
                    {drawingMode && (
                        <DrawingManager
                            onCircleComplete={onCircleComplete}
                            onPolygonComplete={onPolygonComplete}
                            options={{
                                drawingMode: drawingMode === 'circle'
                                    ? google.maps.drawing.OverlayType.CIRCLE
                                    : google.maps.drawing.OverlayType.POLYGON,
                                drawingControl: false,
                                circleOptions: {
                                    fillColor: '#3B82F6',
                                    fillOpacity: 0.2,
                                    strokeColor: '#3B82F6',
                                    strokeWeight: 2,
                                    editable: false,
                                    draggable: false,
                                },
                                polygonOptions: {
                                    fillColor: '#3B82F6',
                                    fillOpacity: 0.2,
                                    strokeColor: '#3B82F6',
                                    strokeWeight: 2,
                                    editable: false,
                                    draggable: false,
                                },
                            }}
                        />
                    )}

                    {/* Render saved shapes */}
                    {drawnShapes.map(shape => {
                        if (shape.type === 'circle' && shape.center && shape.radius) {
                            return (
                                <Circle
                                    key={shape.id}
                                    center={shape.center}
                                    radius={shape.radius}
                                    options={{
                                        fillColor: '#10B981',
                                        fillOpacity: 0.15,
                                        strokeColor: '#10B981',
                                        strokeWeight: 2,
                                    }}
                                />
                            );
                        }
                        if (shape.type === 'polygon' && shape.paths) {
                            return (
                                <Polygon
                                    key={shape.id}
                                    paths={shape.paths}
                                    options={{
                                        fillColor: '#10B981',
                                        fillOpacity: 0.15,
                                        strokeColor: '#10B981',
                                        strokeWeight: 2,
                                    }}
                                />
                            );
                        }
                        return null;
                    })}
                </GoogleMap>
            </div>

            {/* Drawing mode hint */}
            {drawingMode && (
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                    {drawingMode === 'circle'
                        ? 'Click and drag on the map to draw a circle'
                        : 'Click points on the map to draw a polygon, then click the first point to close it'}
                </p>
            )}

            {/* ZIP Codes List */}
            {zipCodes.length > 0 && (
                <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        Selected ZIP Codes ({zipCodes.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {zipCodes.map(zip => (
                            <span
                                key={zip}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium"
                            >
                                <MapPin className="h-3 w-3" />
                                {zip}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveZip(zip)}
                                    className="ml-1 hover:text-green-900 dark:hover:text-green-100"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Drawn shapes list */}
            {drawnShapes.length > 0 && (
                <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        Drawn Areas ({drawnShapes.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {drawnShapes.map(shape => (
                            <span
                                key={shape.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs"
                            >
                                {shape.type === 'circle' ? (
                                    <CircleIcon className="h-3 w-3" />
                                ) : (
                                    <Pentagon className="h-3 w-3" />
                                )}
                                {shape.type === 'circle'
                                    ? `Circle (${Math.round((shape.radius || 0) / 1609.34)} mi)`
                                    : `Polygon (${shape.paths?.length || 0} points)`}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveShape(shape.id)}
                                    className="ml-1 hover:text-red-500"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
