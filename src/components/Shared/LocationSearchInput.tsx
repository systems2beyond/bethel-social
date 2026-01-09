'use client';

import React from 'react';
import { useLoadScript, Libraries } from '@react-google-maps/api';
import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from 'use-places-autocomplete';
import { Loader2, MapPin, Locate } from 'lucide-react';

const libraries: Libraries = ['places'];

interface LocationSearchInputProps {
    onLocationSelect: (location: {
        address: string;
        lat: number;
        lng: number;
        placeId: string;
    }) => void;
    defaultValue?: string;
    className?: string;
}

export default function LocationSearchInput({
    onLocationSelect,
    defaultValue = '',
    className,
}: LocationSearchInputProps) {
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: libraries,
        preventGoogleFontsLoading: true,
    });

    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        return (
            <div className={`relative ${className}`}>
                <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Enter location"
                    value={defaultValue}
                    onChange={(e) =>
                        onLocationSelect({
                            address: e.target.value,
                            lat: 0,
                            lng: 0,
                            placeId: '',
                        })
                    }
                />
                <p className="text-xs text-amber-600 mt-1">
                    Google Maps API Key missing. Autocomplete disabled.
                </p>
            </div>
        );
    }

    if (loadError) {
        const handleFallbackGeolocation = () => {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    onLocationSelect({
                        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                        lat: latitude,
                        lng: longitude,
                        placeId: '',
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Unable to retrieve location.');
                }
            );
        };

        return (
            <div className={`relative ${className}`}>
                <div className="relative">
                    <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Enter location"
                        value={defaultValue}
                        onChange={(e) =>
                            onLocationSelect({
                                address: e.target.value,
                                lat: 0,
                                lng: 0,
                                placeId: '',
                            })
                        }
                    />
                    <button
                        type="button"
                        onClick={handleFallbackGeolocation}
                        className="absolute left-3 top-2.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer z-10"
                        title="Use current location"
                    >
                        <MapPin className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-xs text-red-500 mt-1">
                    Error loading Maps API: {loadError.message}. Manual entry enabled.
                </p>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className={`relative ${className}`}>
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted dark:bg-gray-700 dark:border-gray-600 h-10">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading Maps...</span>
                </div>
            </div>
        );
    }

    return (
        <PlacesAutocomplete
            onLocationSelect={onLocationSelect}
            defaultValue={defaultValue}
            className={className}
        />
    );
}

function PlacesAutocomplete({
    onLocationSelect,
    defaultValue,
    className,
}: LocationSearchInputProps) {
    const {
        ready,
        value,
        setValue,
        suggestions: { status, data },
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            /* Define search scope here if needed (e.g. restrict to country) */
        },
        debounce: 300,
        defaultValue: defaultValue,
    });

    const handleSelect = async (address: string) => {
        setValue(address, false); // Do not fetch data from API again for suggestions
        clearSuggestions();

        try {
            const results = await getGeocode({ address });
            const { lat, lng } = await getLatLng(results[0]);
            onLocationSelect({
                address,
                lat,
                lng,
                placeId: results[0].place_id,
            });
        } catch (error) {
            console.error('Error selecting location:', error);
        }
    };

    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = React.useState(false);

    const handleCurrentLocation = () => {
        if (!navigator.geolocation) {
            setErrorMessage('Geolocation is not supported by your browser');
            return;
        }

        setIsLoadingLocation(true);
        setErrorMessage(null);
        setValue("Locating...", false);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Try to reverse geocode
                    const results = await getGeocode({ location: { lat: latitude, lng: longitude } });
                    if (results[0]) {
                        const address = results[0].formatted_address;
                        setValue(address, false);
                        clearSuggestions();
                        onLocationSelect({
                            address,
                            lat: latitude,
                            lng: longitude,
                            placeId: results[0].place_id,
                        });
                    }
                } catch (error) {
                    console.error('Error getting address:', error);
                    // Fallback: Use coordinates even if address lookup fails (e.g. API key issue)
                    setValue(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, false);
                    onLocationSelect({
                        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                        lat: latitude,
                        lng: longitude,
                        placeId: '',
                    });
                    // Show a subtle warning but don't block
                    setErrorMessage("Address lookup failed (API Key restricted?), but location saved.");
                } finally {
                    setIsLoadingLocation(false);
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                setValue("", false);
                setIsLoadingLocation(false);
                setErrorMessage('Unable to retrieve location. Check permissions.');
            }
        );
    };

    return (
        <div className={`relative ${className}`}>
            <div className="relative">
                <input
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                    }}
                    disabled={!ready}
                    placeholder="Search for a venue or address..."
                    className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 ${errorMessage ? 'border-red-500' : 'border-input'}`}
                />

                <button
                    type="button"
                    onClick={handleCurrentLocation}
                    disabled={isLoadingLocation}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer z-10"
                    title="Use current location"
                >
                    {isLoadingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <MapPin className="h-4 w-4" />
                    )}
                </button>

                {status === 'OK' && (
                    <div className="absolute z-50 w-full mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <ul className="max-h-60 overflow-auto py-1">
                            {data.map(({ place_id, description }) => (
                                <li
                                    key={place_id}
                                    onClick={() => handleSelect(description)}
                                    className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-start gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                                    <span>{description}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            {errorMessage && (
                <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
            )}
        </div>
    );
}
