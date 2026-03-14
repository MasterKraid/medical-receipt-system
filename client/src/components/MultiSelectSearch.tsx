import React, { useState, useEffect, useRef } from 'react';

interface Option {
    value: string;
    label: string;
}

interface MultiSelectSearchProps {
    options: Option[];
    selectedValues: string[];
    onChange: (selectedValues: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

const MultiSelectSearch: React.FC<MultiSelectSearchProps> = ({
    options,
    selectedValues,
    onChange,
    placeholder = "Search...",
    disabled = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Filter options based on search term
    const filteredOptions = options
        .filter(option => option.label && option.label.trim() !== '')
        .filter(option => option.label.toLowerCase().includes(searchTerm.toLowerCase()));

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset highlight when search changes
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [searchTerm, isOpen]);

    // Scroll to highlighted item
    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
            if (highlightedEl) {
                highlightedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex]);

    const toggleSelection = (value: string) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter(v => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
        setSearchTerm('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
            return;
        }

        if (filteredOptions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selectedOption = highlightedIndex >= 0 ? filteredOptions[highlightedIndex] : filteredOptions[0];
                if (selectedOption) {
                    toggleSelection(selectedOption.value);
                }
            } else if (e.key === 'Escape') {
                setIsOpen(false);
            }
        }
    };

    return (
        <div className="relative min-w-0" ref={wrapperRef}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fa-solid fa-search text-gray-400"></i>
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        // Calculate exact offset to scroll to top with ~40px padding
                        setTimeout(() => {
                            if (wrapperRef.current) {
                                const y = wrapperRef.current.getBoundingClientRect().top + window.scrollY - 40;
                                window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                            }
                        }, 500);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm shadow-sm"
                />
            </div>
            {isOpen && filteredOptions.length > 0 && (
                <ul ref={listRef} className="absolute z-50 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                    {filteredOptions.map((option, index) => {
                        const isSelected = selectedValues.includes(option.value);
                        return (
                            <li
                                key={option.value}
                                onClick={() => toggleSelection(option.value)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`p-3 cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-0 transition-colors ${
                                    index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                                }`}
                            >
                                <span className={`${isSelected ? 'font-bold text-blue-700' : 'text-gray-700'} break-words min-w-0 pr-4 flex-1`}>
                                    {option.label}
                                </span>
                                {isSelected && (
                                    <i className="fa-solid fa-check text-blue-600 font-bold"></i>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {isOpen && filteredOptions.length === 0 && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-lg p-4 text-center text-gray-500 text-sm">
                    No matching tests found.
                </div>
            )}
        </div>
    );
};

export default MultiSelectSearch;
