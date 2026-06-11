import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useAntiCheat — Detects malpractice during interviews
 * 
 * Monitors:
 * - Tab switching (visibilitychange)
 * - Window blur (alt-tab, switching apps)
 * - Paste events (Ctrl+V / right-click paste)
 * - Copy events (Ctrl+C)
 * 
 * 3-strike rule: after 3 violations, the interview is terminated.
 */
export default function useAntiCheat({ enabled = true, maxStrikes = 3, onTerminate }) {
    const [strikes, setStrikes] = useState(0);
    const [violations, setViolations] = useState([]); // { type, timestamp, message }
    const [showWarning, setShowWarning] = useState(false);
    const [terminated, setTerminated] = useState(false);
    const [currentWarning, setCurrentWarning] = useState(null);
    const strikeRef = useRef(0); // Ref to avoid stale closure issues
    const violationsRef = useRef([]); // Ref to always have current violations list
    const cooldownRef = useRef(false); // Prevent rapid-fire violations
    const firstBlurConsumedRef = useRef(false); // First blur is a soft warning only
    const hiddenTimerRef = useRef(null); // Tab-hidden grace timer

    const addViolation = useCallback((type, message) => {
        if (!enabled || terminated || cooldownRef.current) return;

        // Cooldown: prevent multiple triggers from the same event (e.g., blur + visibilitychange)
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, 2000);

        const newStrike = strikeRef.current + 1;
        strikeRef.current = newStrike;

        const violation = {
            type,
            message,
            timestamp: new Date().toISOString(),
            strikeNumber: newStrike,
        };

        violationsRef.current = [...violationsRef.current, violation];
        setViolations(violationsRef.current);
        setStrikes(newStrike);
        setCurrentWarning(violation);
        setShowWarning(true);

        // Auto-hide warning after 4s (unless it's the final strike)
        if (newStrike < maxStrikes) {
            setTimeout(() => setShowWarning(false), 4000);
        }

        // Terminate on max strikes
        if (newStrike >= maxStrikes) {
            setTerminated(true);
            onTerminate?.({
                strikes: newStrike,
                violations: violationsRef.current,
                reason: `Interview terminated: ${newStrike} malpractice violations detected.`,
            });
        }
    }, [enabled, terminated, maxStrikes, onTerminate]);

    useEffect(() => {
        if (!enabled) return;

        // Tab switch / minimize detection — grace period before striking
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Only count as violation if the tab stays hidden for >4s
                // (quick alt-tab to check something shouldn't punish the user)
                hiddenTimerRef.current = setTimeout(() => {
                    addViolation('tab_switch', 'You switched away from the interview tab for too long.');
                }, 4000);
            } else if (hiddenTimerRef.current) {
                clearTimeout(hiddenTimerRef.current);
                hiddenTimerRef.current = null;
            }
        };

        // Window blur — first blur is a soft warning (no strike)
        // This covers DevTools, URL bar clicks, brief alt-tabs, etc.
        const handleBlur = () => {
            if (!firstBlurConsumedRef.current) {
                firstBlurConsumedRef.current = true;
                setCurrentWarning({
                    type: 'window_blur_soft',
                    message: 'Stay on the interview window — further switches will count as a violation.',
                    strikeNumber: 0,
                    soft: true,
                });
                setShowWarning(true);
                setTimeout(() => setShowWarning(false), 3500);
                return;
            }
            addViolation('window_blur', 'You left the interview window.');
        };

        // Right-click prevention
        const handleContextMenu = (e) => {
            e.preventDefault();
            addViolation('right_click', 'Right-click is disabled during interviews.');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('contextmenu', handleContextMenu);
            if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
        };
    }, [enabled, addViolation]);

    const dismissWarning = useCallback(() => {
        setShowWarning(false);
    }, []);

    return {
        strikes,
        maxStrikes,
        violations,
        showWarning,
        currentWarning,
        terminated,
        dismissWarning,
        remainingStrikes: maxStrikes - strikes,
    };
}
