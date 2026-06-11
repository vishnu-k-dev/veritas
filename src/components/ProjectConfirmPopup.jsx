import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProjectConfirmPopup — Shows auto-generated project summary before interview starts
 * User confirms the project is theirs, or provides their own description
 */
export default function ProjectConfirmPopup({ projectSummary, onConfirm, onClose }) {
    const [mode, setMode] = useState('confirm'); // 'confirm' | 'describe'
    const [customDescription, setCustomDescription] = useState('');

    const handleConfirmYes = () => {
        onConfirm(projectSummary);
    };

    const handleDescribeInstead = () => {
        setMode('describe');
    };

    const handleCustomContinue = () => {
        if (customDescription.trim().length >= 30) {
            onConfirm(customDescription.trim());
        }
    };

    const isCustomValid = customDescription.trim().length >= 30;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={(e) => e.target === e.currentTarget && onClose?.()}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-4">
                        <h2 className="text-white font-bold text-lg">Is this your project?</h2>
                        <p className="text-white/80 text-sm mt-1">
                            We analyzed your repository — please confirm the details below.
                        </p>
                    </div>

                    <div className="p-6">
                        {mode === 'confirm' ? (
                            <>
                                {/* Auto-generated summary */}
                                <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                                    <p className="text-gray-800 text-sm leading-relaxed">
                                        {projectSummary}
                                    </p>
                                </div>

                                {/* Two buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleConfirmYes}
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
                                    >
                                        ✓ Yes, that's my project
                                    </button>
                                    <button
                                        onClick={handleDescribeInstead}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
                                    >
                                        ✎ No, let me describe it
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Custom description textarea */}
                                <label className="block text-gray-700 text-sm font-medium mb-2">
                                    Describe your project in your own words
                                </label>
                                <textarea
                                    value={customDescription}
                                    onChange={(e) => setCustomDescription(e.target.value)}
                                    placeholder="e.g. A task manager app built with Flask and SQLite. I built the auth system and REST API from scratch."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none"
                                    autoFocus
                                />

                                <div className="flex items-center justify-between mt-2 mb-4">
                                    <span className={`text-xs ${isCustomValid ? 'text-emerald-500' : 'text-gray-400'}`}>
                                        {customDescription.trim().length}/30 characters minimum
                                    </span>
                                    <button
                                        onClick={() => setMode('confirm')}
                                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        ← Back to summary
                                    </button>
                                </div>

                                <button
                                    onClick={handleCustomContinue}
                                    disabled={!isCustomValid}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
                                >
                                    Continue to Interview →
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
