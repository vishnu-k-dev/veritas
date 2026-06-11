import { useState, useRef, useCallback } from 'react';

/**
 * useVoiceInput — Web Speech API push-to-talk hook
 *
 * Returns:
 *   listening     boolean
 *   transcript    string  (live partial + final)
 *   supported     boolean (false on Firefox/Safari without flag)
 *   startListening()
 *   stopListening()
 *   resetTranscript()
 */
export function useVoiceInput({ onFinal, lang = 'en-IN' } = {}) {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef(null);

    const supported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const startListening = useCallback(() => {
        if (!supported) return;
        const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        let finalText = '';

        recognition.onresult = (e) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const result = e.results[i];
                if (result.isFinal) {
                    finalText += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }
            setTranscript(finalText + interim);
        };

        recognition.onerror = (e) => {
            if (e.error !== 'aborted') console.warn('Speech recognition error:', e.error);
            setListening(false);
        };

        recognition.onend = () => {
            setListening(false);
            if (finalText.trim() && onFinal) onFinal(finalText.trim());
        };

        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    }, [supported, lang, onFinal]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);

    return { listening, transcript, supported, startListening, stopListening, resetTranscript };
}
