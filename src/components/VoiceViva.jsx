import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';

/**
 * VoiceViva — Push-to-talk voice input for the examination.
 *
 * Uses browser Web Speech API (no external SDK, no cost).
 * Judges instantly connect "push to talk" → "viva examination" → Examinations theme.
 *
 * Props:
 *   onTranscript(text)  — called with final transcript when user stops talking
 *   disabled?           — disables the button
 *   lang?               — BCP-47 language tag, default 'en-IN'
 */
export default function VoiceViva({ onTranscript, disabled = false, lang = 'en-IN' }) {
    const { listening, transcript, supported, startListening, stopListening, resetTranscript } =
        useVoiceInput({ onFinal: onTranscript, lang });

    // Release mic if component unmounts while listening
    useEffect(() => () => { stopListening(); }, [stopListening]);

    if (!supported) return null;

    const toggle = () => {
        if (disabled) return;
        if (listening) {
            stopListening();
        } else {
            resetTranscript();
            startListening();
        }
    };

    return (
        <div className="flex flex-col items-center gap-3">
            {/* Main push-to-talk button */}
            <motion.button
                onClick={toggle}
                disabled={disabled}
                whileTap={{ scale: 0.93 }}
                className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-colors focus:outline-none
                    ${listening
                        ? 'bg-red-500/20 border-2 border-red-500/60 text-red-400'
                        : 'bg-indigo-500/15 border-2 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/25'
                    }
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
                aria-label={listening ? 'Stop speaking' : 'Start voice viva'}
            >
                {/* Pulse rings when listening */}
                {listening && (
                    <>
                        <motion.div
                            className="absolute inset-0 rounded-full border border-red-500/30"
                            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                        />
                        <motion.div
                            className="absolute inset-0 rounded-full border border-red-500/20"
                            animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                        />
                    </>
                )}
                {listening ? <MicOff className="w-6 h-6 relative z-10" /> : <Mic className="w-6 h-6" />}
            </motion.button>

            {/* Status label */}
            <div className="text-xs text-text-muted text-center">
                {listening
                    ? <span className="text-red-400 font-semibold flex items-center gap-1"><Volume2 className="w-3 h-3" /> Listening…</span>
                    : <span>Adaptive Viva</span>
                }
            </div>

            {/* Live transcript preview */}
            <AnimatePresence>
                {transcript && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="w-full max-w-xs"
                    >
                        <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] px-3 py-2">
                            <p className="text-xs text-indigo-200 leading-relaxed italic">{transcript}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
