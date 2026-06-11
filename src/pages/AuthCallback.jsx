// src/pages/AuthCallback.jsx
//
// OAuth landing page. Mounted by App.jsx when window.location.pathname is
// '/auth/callback'. The Supabase SDK auto-detects the ?code= in the URL
// (detectSessionInUrl: true), runs the PKCE exchange, and fires SIGNED_IN.
// All we do here is wait for that to happen, then navigate back to "/".
//
// On error (bad code, missing config, expired flow): bounce home with an
// error param so Landing can surface a toast.

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
    useEffect(() => {
        let cancelled = false;

        // If the SDK already exchanged the code (it runs the exchange in its
        // own init flow when detectSessionInUrl is true), getSession() returns
        // the session immediately. Otherwise we wait for SIGNED_IN.
        const finish = (path = '/') => {
            if (cancelled) return;
            window.history.replaceState({}, document.title, path);
            // Force a re-render of App by mutating location — using a soft
            // navigation here is fine because there's no router in this app.
            window.location.replace(path);
        };

        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return;
            if (data?.session) return finish('/');
        });

        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) finish('/');
        });

        // Safety: if the URL contains an OAuth #error= or ?error= , bounce home with it.
        const hash = new URLSearchParams(window.location.hash.replace('#', ''));
        const search = new URLSearchParams(window.location.search);
        const err = hash.get('error') || search.get('error');
        if (err) {
            const desc = hash.get('error_description') || search.get('error_description') || err;
            finish(`/?auth_error=${encodeURIComponent(desc)}`);
        }

        // Hard timeout: if 15s pass with no session and no error, something is
        // genuinely wrong (popup blocker, third-party cookies, network).
        const timer = setTimeout(() => {
            finish('/?auth_error=' + encodeURIComponent('Sign-in timed out. Please try again.'));
        }, 15_000);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            listener.subscription.unsubscribe();
        };
    }, []);

    return (
        <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
            <div className="text-center">
                <div className="size-12 mx-auto mb-4 border-4 border-card-dark border-t-primary rounded-full animate-spin" />
                <p className="text-text-muted">Signing you in…</p>
            </div>
        </div>
    );
}
