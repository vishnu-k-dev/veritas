import { ArrowLeft } from 'lucide-react';

/**
 * Consistent back button — top-left of screen, works on all navigable phases
 */
export default function BackButton({ onClick, label = 'Back' }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-text-muted hover:text-white hover:bg-white/5 transition-all duration-200 mb-6 group"
        >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            {label}
        </button>
    );
}
