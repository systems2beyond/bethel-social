"use client";

import React, { useState, useCallback, useRef } from 'react';
import {
    GoogleMap,
    useLoadScript,
    DrawingManager,
    Circle,
    Polygon,
    Rectangle,
    Marker,
    Libraries,
} from '@react-google-maps/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Trash2, Search, Circle as CircleIcon, Square, SquareEqual, Spline, X, Plus, Navigation } from 'lucide-react';
import { toast } from 'sonner';

const libraries: Libraries = ['places', 'drawing', 'geometry'];

interface ZipCodeMapSelectorProps {
    zipCodes: string[];
    onZipCodesChange: (zipCodes: string[]) => void;
    churchLocation?: { lat: number; lng: number };
    onClose?: () => void;
}

interface DrawnShape {
    id: string;
    type: 'circle' | 'rectangle' | 'polygon';
    center?: { lat: number; lng: number };
    radius?: number;
    bounds?: { north: number; south: number; east: number; west: number };
    paths?: { lat: number; lng: number }[];
}

const mapContainerStyle = {
    width: '100%',
    height: '320px',
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
    const [drawingMode, setDrawingMode] = useState<'circle' | 'square' | 'rectangle' | 'polygon' | null>(null);
    const [manualZipInput, setManualZipInput] = useState('');

    const mapRef = useRef<google.maps.Map | null>(null);
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

    // Handle rectangle/square complete
    const onRectangleComplete = useCallback((rectangle: google.maps.Rectangle) => {
        const bounds = rectangle.getBounds();

        if (!bounds) return;

        let ne = bounds.getNorthEast();
        let sw = bounds.getSouthWest();

        // If square mode, adjust to make it a perfect square
        const isSquare = drawingMode === 'square';
        if (isSquare) {
            const latDiff = ne.lat() - sw.lat();
            const lngDiff = ne.lng() - sw.lng();
            // Use the smaller dimension to make a square
            const centerLat = (ne.lat() + sw.lat()) / 2;
            const centerLng = (ne.lng() + sw.lng()) / 2;
            const halfSize = Math.min(latDiff, lngDiff) / 2;
            ne = new google.maps.LatLng(centerLat + halfSize, centerLng + halfSize);
            sw = new google.maps.LatLng(centerLat - halfSize, centerLng - halfSize);
        }

        const shapeId = `${isSquare ? 'square' : 'rectangle'}-${Date.now()}`;
        const newShape: DrawnShape = {
            id: shapeId,
            type: 'rectangle',
            bounds: {
                north: ne.lat(),
                south: sw.lat(),
                east: ne.lng(),
                west: sw.lng(),
            },
        };

        setDrawnShapes(prev => [...prev, newShape]);

        // Find ZIP codes within the rectangle
        findZipCodesInRectangle(newShape.bounds!);

        // Remove the drawn rectangle (we'll render our own)
        rectangle.setMap(null);
        setDrawingMode(null);
    }, [drawingMode]);

    // Handle polygon complete (freeform selection)
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

    // Find ZIP codes within a rectangle
    const findZipCodesInRectangle = async (bounds: { north: number; south: number; east: number; west: number }) => {
        if (!geocoderRef.current) return;

        setIsSearching(true);
        const foundZips = new Set<string>();

        // Sample points in a grid pattern within the rectangle
        const gridSize = 4;
        const latStep = (bounds.north - bounds.south) / (gridSize + 1);
        const lngStep = (bounds.east - bounds.west) / (gridSize + 1);

        const points: { lat: number; lng: number }[] = [];

        // Center point
        points.push({
            lat: (bounds.north + bounds.south) / 2,
            lng: (bounds.east + bounds.west) / 2,
        });

        // Grid points
        for (let i = 1; i <= gridSize; i++) {
            for (let j = 1; j <= gridSize; j++) {
                points.push({
                    lat: bounds.south + i * latStep,
                    lng: bounds.west + j * lngStep,
                });
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

        const gridSize = 4;
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

    // Get drawing mode hint text
    const getDrawingHint = () => {
        switch (drawingMode) {
            case 'circle':
                return 'Click and drag to draw a circle area';
            case 'square':
                return 'Click and drag to draw a square area';
            case 'rectangle':
                return 'Click and drag to draw a rectangle area';
            case 'polygon':
                return 'Click to place points, click first point to close the shape';
            default:
                return null;
        }
    };

    // Get Google Maps drawing overlay type
    const getOverlayType = () => {
        switch (drawingMode) {
            case 'circle':
                return google.maps.drawing.OverlayType.CIRCLE;
            case 'square':
            case 'rectangle':
                return google.maps.drawing.OverlayType.RECTANGLE;
            case 'polygon':
                return google.maps.drawing.OverlayType.POLYGON;
            default:
                return null;
        }
    };

    // Calculate area in square miles for display
    const calculateShapeArea = (shape: DrawnShape): string => {
        const sqMetersToSqMiles = 0.000000386102;

        if (shape.type === 'circle' && shape.radius) {
            const areaMeters = Math.PI * shape.radius * shape.radius;
            const areaMiles = areaMeters * sqMetersToSqMiles;
            return areaMiles < 1 ? `${(areaMiles * 640).toFixed(1)} acres` : `${areaMiles.toFixed(1)} sq mi`;
        }

        if (shape.type === 'rectangle' && shape.bounds) {
            const latDiff = shape.bounds.north - shape.bounds.south;
            const lngDiff = shape.bounds.east - shape.bounds.west;
            const avgLat = (shape.bounds.north + shape.bounds.south) / 2;
            const heightMeters = latDiff * 111320;
            const widthMeters = lngDiff * 111320 * Math.cos(avgLat * Math.PI / 180);
            const areaMeters = heightMeters * widthMeters;
            const areaMiles = areaMeters * sqMetersToSqMiles;
            return areaMiles < 1 ? `${(areaMiles * 640).toFixed(1)} acres` : `${areaMiles.toFixed(1)} sq mi`;
        }

        if (shape.type === 'polygon' && shape.paths && shape.paths.length >= 3) {
            // Shoelace formula for polygon area
            let area = 0;
            const n = shape.paths.length;
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                area += shape.paths[i].lng * shape.paths[j].lat;
                area -= shape.paths[j].lng * shape.paths[i].lat;
            }
            area = Math.abs(area) / 2;
            // Convert from degrees squared to square meters (approximate)
            const avgLat = shape.paths.reduce((sum, p) => sum + p.lat, 0) / n;
            const metersPerDegreeLat = 111320;
            const metersPerDegreeLng = 111320 * Math.cos(avgLat * Math.PI / 180);
            const areaMeters = area * metersPerDegreeLat * metersPerDegreeLng;
            const areaMiles = areaMeters * sqMetersToSqMiles;
            return areaMiles < 1 ? `${(areaMiles * 640).toFixed(1)} acres` : `${areaMiles.toFixed(1)} sq mi`;
        }

        return '';
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
        <div className="space-y-3">
            {/* Search & Manual Entry */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex gap-2">
                    <Input
                        type="text"
                        placeholder="Search city or neighborhood..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                        className="flex-1 rounded-lg text-sm"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleLocationSearch}
                        disabled={isSearching || !searchQuery.trim()}
                        className="rounded-lg"
                        size="sm"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="ZIP"
                        value={manualZipInput}
                        onChange={(e) => setManualZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddManualZip()}
                        className="w-20 rounded-lg text-sm"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddManualZip}
                        disabled={!manualZipInput.trim()}
                        className="rounded-lg"
                        size="sm"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Drawing Tools - Photoshop-style */}
            <div className="flex items-center gap-1 p-2 bg-gray-100 dark:bg-zinc-800 rounded-lg flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">Select:</span>

                <Button
                    type="button"
                    variant={drawingMode === 'square' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDrawingMode(drawingMode === 'square' ? null : 'square')}
                    className="rounded-md h-8 px-2"
                    title="Square Selection - Click and drag"
                >
                    <SquareEqual className="h-4 w-4 mr-1" />
                    <span className="text-xs">Square</span>
                </Button>

                <Button
                    type="button"
                    variant={drawingMode === 'rectangle' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDrawingMode(drawingMode === 'rectangle' ? null : 'rectangle')}
                    className="rounded-md h-8 px-2"
                    title="Rectangle Selection - Click and drag"
                >
                    <Square className="h-4 w-4 mr-1" />
                    <span className="text-xs">Rectangle</span>
                </Button>

                <Button
                    type="button"
                    variant={drawingMode === 'circle' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDrawingMode(drawingMode === 'circle' ? null : 'circle')}
                    className="rounded-md h-8 px-2"
                    title="Circle Selection - Click and drag"
                >
                    <CircleIcon className="h-4 w-4 mr-1" />
                    <span className="text-xs">Circle</span>
                </Button>

                <Button
                    type="button"
                    variant={drawingMode === 'polygon' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
                    className="rounded-md h-8 px-2"
                    title="Freeform Selection - Click to add points"
                >
                    <Spline className="h-4 w-4 mr-1" />
                    <span className="text-xs">Freeform</span>
                </Button>

                <div className="flex-1" />

                {churchLocation && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCenterOnChurch}
                        className="rounded-md h-8 px-2"
                        title="Center on church"
                    >
                        <Navigation className="h-4 w-4" />
                    </Button>
                )}

                {isSearching && (
                    <span className="flex items-center text-xs text-blue-600 dark:text-blue-400 px-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Finding...
                    </span>
                )}
            </div>

            {/* Drawing mode hint */}
            {drawingMode && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        {getDrawingHint()}
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDrawingMode(null)}
                        className="h-5 w-5 p-0 ml-auto hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}

            {/* Map */}
            <div className="rounded-xl overflow-hidden border-2 border-gray-200 dark:border-zinc-700 shadow-sm">
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
                        styles: [
                            {
                                featureType: 'poi',
                                elementType: 'labels',
                                stylers: [{ visibility: 'off' }]
                            }
                        ]
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
                            onRectangleComplete={onRectangleComplete}
                            onPolygonComplete={onPolygonComplete}
                            options={{
                                drawingMode: getOverlayType(),
                                drawingControl: false,
                                circleOptions: {
                                    fillColor: '#3B82F6',
                                    fillOpacity: 0.25,
                                    strokeColor: '#3B82F6',
                                    strokeWeight: 2,
                                    editable: false,
                                    draggable: false,
                                },
                                rectangleOptions: {
                                    fillColor: '#3B82F6',
                                    fillOpacity: 0.25,
                                    strokeColor: '#3B82F6',
                                    strokeWeight: 2,
                                    editable: false,
                                    draggable: false,
                                },
                                polygonOptions: {
                                    fillColor: '#3B82F6',
                                    fillOpacity: 0.25,
                                    strokeColor: '#3B82F6',
                                    strokeWeight: 2,
                                    strokeOpacity: 0.8,
                                    editable: false,
                                    draggable: false,
                                },
                            }}
                        />
                    )}

                    {/* Render saved shapes - use onMouseUp/onDragEnd to avoid infinite loops */}
                    {drawnShapes.map(shape => {
                        if (shape.type === 'circle' && shape.center && shape.radius) {
                            return (
                                <Circle
                                    key={shape.id}
                                    center={shape.center}
                                    radius={shape.radius}
                                    editable={true}
                                    draggable={true}
                                    onMouseUp={function(this: google.maps.Circle) {
                                        // Update both center and radius on mouse up (after drag or resize)
                                        const newCenter = this.getCenter();
                                        const newRadius = this.getRadius();
                                        if (newCenter) {
                                            setDrawnShapes(prev => prev.map(s =>
                                                s.id === shape.id
                                                    ? { ...s, center: { lat: newCenter.lat(), lng: newCenter.lng() }, radius: newRadius }
                                                    : s
                                            ));
                                        }
                                    }}
                                    onDragEnd={function(this: google.maps.Circle) {
                                        const newCenter = this.getCenter();
                                        if (newCenter) {
                                            setDrawnShapes(prev => prev.map(s =>
                                                s.id === shape.id
                                                    ? { ...s, center: { lat: newCenter.lat(), lng: newCenter.lng() } }
                                                    : s
                                            ));
                                        }
                                    }}
                                    options={{
                                        fillColor: '#10B981',
                                        fillOpacity: 0.2,
                                        strokeColor: '#10B981',
                                        strokeWeight: 2,
                                    }}
                                />
                            );
                        }
                        if (shape.type === 'rectangle' && shape.bounds) {
                            return (
                                <Rectangle
                                    key={shape.id}
                                    bounds={shape.bounds}
                                    editable={true}
                                    draggable={true}
                                    onMouseUp={function(this: google.maps.Rectangle) {
                                        // Update bounds on mouse up (after drag or resize)
                                        const newBounds = this.getBounds();
                                        if (newBounds) {
                                            const ne = newBounds.getNorthEast();
                                            const sw = newBounds.getSouthWest();
                                            setDrawnShapes(prev => prev.map(s =>
                                                s.id === shape.id
                                                    ? {
                                                        ...s,
                                                        bounds: {
                                                            north: ne.lat(),
                                                            south: sw.lat(),
                                                            east: ne.lng(),
                                                            west: sw.lng(),
                                                        }
                                                    }
                                                    : s
                                            ));
                                        }
                                    }}
                                    onDragEnd={function(this: google.maps.Rectangle) {
                                        const newBounds = this.getBounds();
                                        if (newBounds) {
                                            const ne = newBounds.getNorthEast();
                                            const sw = newBounds.getSouthWest();
                                            setDrawnShapes(prev => prev.map(s =>
                                                s.id === shape.id
                                                    ? {
                                                        ...s,
                                                        bounds: {
                                                            north: ne.lat(),
                                                            south: sw.lat(),
                                                            east: ne.lng(),
                                                            west: sw.lng(),
                                                        }
                                                    }
                                                    : s
                                            ));
                                        }
                                    }}
                                    options={{
                                        fillColor: '#10B981',
                                        fillOpacity: 0.2,
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
                                    editable={true}
                                    draggable={true}
                                    onMouseUp={function(this: google.maps.Polygon) {
                                        const path = this.getPath();
                                        const newPaths: { lat: number; lng: number }[] = [];
                                        for (let i = 0; i < path.getLength(); i++) {
                                            const point = path.getAt(i);
                                            newPaths.push({ lat: point.lat(), lng: point.lng() });
                                        }
                                        setDrawnShapes(prev => prev.map(s =>
                                            s.id === shape.id
                                                ? { ...s, paths: newPaths }
                                                : s
                                        ));
                                    }}
                                    onDragEnd={function(this: google.maps.Polygon) {
                                        const path = this.getPath();
                                        const newPaths: { lat: number; lng: number }[] = [];
                                        for (let i = 0; i < path.getLength(); i++) {
                                            const point = path.getAt(i);
                                            newPaths.push({ lat: point.lat(), lng: point.lng() });
                                        }
                                        setDrawnShapes(prev => prev.map(s =>
                                            s.id === shape.id
                                                ? { ...s, paths: newPaths }
                                                : s
                                        ));
                                    }}
                                    options={{
                                        fillColor: '#10B981',
                                        fillOpacity: 0.2,
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

            {/* ZIP Codes List */}
            {zipCodes.length > 0 && (
                <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        Selected ZIP Codes ({zipCodes.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {zipCodes.map(zip => (
                            <span
                                key={zip}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs font-medium"
                            >
                                <MapPin className="h-3 w-3" />
                                {zip}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveZip(zip)}
                                    className="ml-0.5 hover:text-green-900 dark:hover:text-green-100"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Drawn shapes list with area sizes */}
            {drawnShapes.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            Drawn Areas ({drawnShapes.length})
                        </span>
                        <span className="text-[10px] text-muted-foreground italic">
                            Drag shapes to move, drag corners to resize
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {drawnShapes.map(shape => (
                            <span
                                key={shape.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs border border-emerald-200 dark:border-emerald-800/50"
                            >
                                {shape.type === 'circle' && <CircleIcon className="h-3.5 w-3.5" />}
                                {shape.type === 'rectangle' && (
                                    shape.id.startsWith('square') ? <SquareEqual className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />
                                )}
                                {shape.type === 'polygon' && <Spline className="h-3.5 w-3.5" />}
                                <span className="font-medium">{calculateShapeArea(shape)}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveShape(shape.id)}
                                    className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 rounded transition-colors"
                                    title="Remove area"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
