import React, { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, AlertCircle, Loader2 } from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Medicine {
    id: number;
    is_discontinued: boolean;
    manufacturer_name: string;
    name: string;
    pack_size_label: string;
    price: number;
    score: number;
    short_composition1: string;
    short_composition2: string;
    type: string;
}

interface MedicineResponse {
    medicines: Medicine[];
    query: string;
    total: number;
}

const fetchMedicine = async (name: string) => {
    const response = await fetch(
        `http://127.0.0.1:5000/fetchMedicine?name=${name}`
    );
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
};

const fetchSuggestions = async (prefix: string) => {
    if (!prefix || prefix.length < 2) return [];
    const response = await fetch(
        `http://127.0.0.1:5000/suggestions?prefix=${prefix}`
    );
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data.suggestions;
};

const MedicineCard = ({ medicine }: { medicine: Medicine }) => (
    <Card className="h-full hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
            <CardTitle className="text-lg font-semibold">
                {medicine.name}
            </CardTitle>
            <CardDescription>{medicine.manufacturer_name}</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                <div>
                    <h4 className="font-medium mb-2">Composition</h4>
                    <p className="text-sm text-gray-600">
                        {medicine.short_composition1}
                    </p>
                    {medicine.short_composition2 && (
                        <p className="text-sm text-gray-600 mt-1">
                            {medicine.short_composition2}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <span className="font-medium">Pack Size:</span>
                        <span className="ml-2 text-gray-600">
                            {medicine.pack_size_label}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium">Price:</span>
                        <span className="ml-2 text-gray-600">
                            ₹{medicine.price.toFixed(2)}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium">Type:</span>
                        <span className="ml-2 text-gray-600">
                            {medicine.type}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium">Status:</span>
                        <Badge
                            variant={
                                medicine.is_discontinued
                                    ? 'destructive'
                                    : 'outline'
                            }
                            className="ml-2"
                        >
                            {medicine.is_discontinued
                                ? 'Discontinued'
                                : 'Available'}
                        </Badge>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
);

function App() {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Medicine[]>([]);
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { mutate, isPending, isError } = useMutation({
        mutationFn: fetchMedicine,
        onSuccess: (data: MedicineResponse) => {
            setSearchResults(data.medicines);
            setOpen(false);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        },
    });

    const { data: suggestions = [] } = useQuery({
        queryKey: ['suggestions', searchTerm],
        queryFn: () => fetchSuggestions(searchTerm),
        enabled: searchTerm.length >= 2,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            mutate(searchTerm);
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Medicine Search</h1>
                <p className="text-gray-600">
                    Search for medicines, check availability and prices
                </p>
            </div>

            <div className="relative max-w-2xl mx-auto mb-8">
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Popover
                            open={open && suggestions.length > 0}
                            onOpenChange={setOpen}
                        >
                            <PopoverTrigger asChild>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                                    <Input
                                        placeholder="Search medicines..."
                                        value={searchTerm}
                                        ref={inputRef}
                                        onChange={(e) => {
                                            e.preventDefault();
                                            setSearchTerm(e.target.value);
                                            setOpen(true);
                                        }}
                                        className="pl-9"
                                    />
                                </div>
                            </PopoverTrigger>
                            <PopoverContent
                                className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-auto"
                                align="start"
                            >
                                <div className="py-2">
                                    {suggestions.map(
                                        (suggestion: string, index: number) => (
                                            <button
                                                key={index}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                                                onClick={() => {
                                                    setSearchTerm(suggestion);
                                                    mutate(suggestion);
                                                    setOpen(false);
                                                }}
                                            >
                                                {suggestion}
                                            </button>
                                        )
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button
                        type="submit"
                        disabled={isPending || searchTerm.trim() === ''}
                        className="min-w-24"
                    >
                        {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            'Search'
                        )}
                    </Button>
                </form>
            </div>

            {isPending && (
                <div className="flex justify-center my-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {isError && (
                <Alert variant="destructive" className="max-w-2xl mx-auto mb-8">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Error fetching data. Please try again.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((medicine) => (
                    <MedicineCard key={medicine.id} medicine={medicine} />
                ))}
            </div>
        </div>
    );
}

export default App;
