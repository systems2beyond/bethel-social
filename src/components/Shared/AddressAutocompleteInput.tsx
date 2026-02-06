'use client';

import React, { useState } from 'react';
import { useLoadScript, Libraries } from '@react-google-maps/api';
import usePlacesAutocomplete, {
    getGeocode,
} from 'use-places-autocomplete';
import { Loader2, MapPin } from 'lucide-react';

const libraries: Libraries = ['places'];

export interface ParsedAddress {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

interface AddressAutocompleteInputProps {
    onAddressSelect: (address: ParsedAddress) => void;
    defaultValue?: string;
    className?: string;
    placeholder?: string;
    inputClassName?: string;
}

// Helper to parse Google's address components
function parseAddressComponents(
    components: google.maps.GeocoderAddressComponent[]
): ParsedAddress {
    const result: ParsedAddress = {
        street1: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'USA',
    };

    let streetNumber = '';
    let route = '';

    for (const component of components) {
        const types = component.types;

        if (types.includes('street_number')) {
            streetNumber = component.long_name;
        } else if (types.includes('route')) {
            route = component.long_name;
        } else if (types.includes('locality') || types.includes('sublocality')) {
            result.city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
            result.state = component.short_name; // Use abbreviation for state
        } else if (types.includes('postal_code')) {
            result.postalCode = component.long_name;
        } else if (types.includes('country')) {
            result.country = component.short_name;
        }
    }

    // Combine street number and route
    result.street1 = [streetNumber, route].filter(Boolean).join(' ');

    return result;
}

export default function AddressAutocompleteInput({
    onAddressSelect,
    defaultValue = '',
    className,
    placeholder = 'Start typing your address...',
    inputClassName,
}: AddressAutocompleteInputProps) {
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: libraries,
        preventGoogleFontsLoading: true,
    });

    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        return (
            <div className={`relative ${className}`}>
                <input
                    className={inputClassName || "w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all placeholder:text-zinc-600"}
                    placeholder={placeholder}
                    defaultValue={defaultValue}
                    onChange={(e) => {
                        onAddressSelect({
                            street1: e.target.value,
                            city: '',
                            state: '',
                            postalCode: '',
                            country: 'USA',
                        });
                    }}
                />
                <p className="text-xs text-amber-600 mt-1">
                    Autocomplete unavailable. Enter address manually below.
                </p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className={`relative ${className}`}>
                <input
                    className={inputClassName || "w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all placeholder:text-zinc-600"}
                    placeholder={placeholder}
                    defaultValue={defaultValue}
                    onChange={(e) => {
                        onAddressSelect({
                            street1: e.target.value,
                            city: '',
                            state: '',
                            postalCode: '',
                            country: 'USA',
                        });
                    }}
                />
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className={`relative ${className}`}>
                <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl h-[50px]">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    <span className="text-sm text-zinc-500">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <PlacesAutocompleteInner
            onAddressSelect={onAddressSelect}
            defaultValue={defaultValue}
            className={className}
            placeholder={placeholder}
            inputClassName={inputClassName}
        />
    );
}

function PlacesAutocompleteInner({
    onAddressSelect,
    defaultValue,
    className,
    placeholder,
    inputClassName,
}: AddressAutocompleteInputProps) {
    const [showSuggestions, setShowSuggestions] = useState(false);

    const {
        ready,
        value,
        setValue,
        suggestions: { status, data },
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            componentRestrictions: { country: 'us' },
            types: ['address'],
        },
        debounce: 300,
        defaultValue: defaultValue,
    });

    const handleSelect = async (description: string, placeId: string) => {
        setValue(description, false);
        clearSuggestions();
        setShowSuggestions(false);

        try {
            const results = await getGeocode({ placeId });
            if (results[0]?.address_components) {
                const parsed = parseAddressComponents(results[0].address_components);
                // Update the input value to show just the street address
                setValue(parsed.street1, false);
                onAddressSelect(parsed);
            }
        } catch (error) {
            console.error('Error getting address details:', error);
        }
    };

    return (
        <div className={`relative ${className}`}>
            <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                        // Delay to allow click on suggestions
                        setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    disabled={!ready}
                    placeholder={placeholder}
                    className={inputClassName || "w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"}
                />
            </div>

            {showSuggestions && status === 'OK' && (
                <div className="absolute z-50 w-full mt-1 overflow-hidden rounded-xl border bg-zinc-900 border-zinc-700 shadow-xl">
                    <ul className="max-h-60 overflow-auto py-1">
                        {data.map(({ place_id, description }) => (
                            <li
                                key={place_id}
                                onMouseDown={() => handleSelect(description, place_id)}
                                className="px-4 py-3 text-sm cursor-pointer hover:bg-zinc-800 flex items-start gap-2 transition-colors text-zinc-300"
                            >
                                <MapPin className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                                <span>{description}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
