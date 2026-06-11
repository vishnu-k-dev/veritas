/**
 * useAuth — React context for authentication.
 *
 * Backed by Supabase Auth. Routing-critical state (`role`, `needsOnboarding`)
 * is derived synchronously from the JWT's `user_role` claim, populated by the
 * Custom Access Token Hook (see infra/migration_v4_jwt_hook.sql). The full
 * profile row is fetched once for components that need fields like college,
 * department, company etc., but it is NOT on the routing critical path.
 *
 * Public API preserved for compat:
 *   user, profile, loading, role, signUp, signIn, signInWithGoogle,
 *   signInWithGitHub, githubAccessToken, saveProfile, logout,
 *   isAuthenticated, needsOnboarding.
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, decodeJwt } from '../lib/supabase';
import { syncUserToBackend, apiRequest } from '../services/api';

const AuthContext = createContext(null);

// Wrap a Supabase User with a Firebase-compatible shape so legacy consumers
// reading `.displayName` / `.uid` don't have to change.
function toCompatUser(u) {
    if (!u) return null;
    const displayName =
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.email?.split('@')[0] ||
        '';
    return { ...u, displayName, uid: u.id };
}

// Map Supabase column names to the field names the app reads.
function mapProfile(row, authUserId) {
    if (!row) return null;
    return {
        id: authUserId,
        ...row,
        college: row.college_name,
        branch: row.department,
        year: row.year_of_study,
        instituteName: row.institute_name,
        instituteType: row.institute_type,
        contactPerson: row.contact_person,
        contactPhone: row.contact_phone,
    };
}

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [githubAccessToken, setGithubAccessTokenState] = useState(
        () => sessionStorage.getItem('veritas_github_token') || null
    );

    const setGithubAccessToken = (token) => {
        setGithubAccessTokenState(token);
        if (token) sessionStorage.setItem('veritas_github_token', token);
        else sessionStorage.removeItem('veritas_github_token');
    };

    // Single bootstrap effect. getSession() resolves from localStorage
    // synchronously after the SDK init; onAuthStateChange handles all
    // subsequent transitions (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED).
    useEffect(() => {
        let mounted = true;

        supabase.auth.getSession().then(({ data }) => {
            if (!mounted) return;
            setSession(data.session || null);
            setLoading(false);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
            if (!mounted) return;
            setSession(s || null);
            if (event === 'SIGNED_OUT') {
                setProfile(null);
                setGithubAccessToken(null);
            }
            // Capture GitHub provider_token on SIGNED_IN
            if (event === 'SIGNED_IN' && s?.provider_token &&
                s.user?.app_metadata?.provider === 'github') {
                setGithubAccessToken(s.provider_token);
                syncUserToBackend({
                    github_connected: true,
                    github_token: s.provider_token,
                    github_username: s.user.user_metadata?.user_name ||
                                     s.user.user_metadata?.preferred_username || '',
                }).catch(() => { /* non-critical */ });
            }
        });

        return () => {
            mounted = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    // Read role from the JWT's custom claim (set by custom_access_token_hook).
    // This is synchronous — no network call, no race.
    const claims = session?.access_token ? decodeJwt(session.access_token) : null;
    const role = claims?.user_role || null;
    const user = toCompatUser(session?.user);

    // Fetch full profile row once we have a session and a role. Pure data
    // hydration for components that read fields like college/company; never
    // gates routing.
    useEffect(() => {
        if (!session?.user || !role) {
            setProfile(null);
            return;
        }
        let cancelled = false;
        apiRequest('/api/auth/profile')
            .then(({ profile: p }) => {
                if (cancelled) return;
                setProfile(mapProfile(p, session.user.id));
                if (p?.github_connected && p?.github_token &&
                    !sessionStorage.getItem('veritas_github_token')) {
                    setGithubAccessToken(p.github_token);
                }
            })
            .catch(err => {
                if (!cancelled) console.warn('[useAuth] profile fetch failed:', err.message);
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user?.id, role]);

    // ─── Sign up with email/password ────────────────────────────────────────
    const signUp = async (email, password, displayName) => {
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: displayName } },
        });
        if (error) throw error;
        return data.user;
    };

    // ─── Sign in with email/password ────────────────────────────────────────
    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
    };

    // ─── Sign in with Google (OAuth redirect to /auth/callback) ─────────────
    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        return null;
    };

    // ─── Sign in with GitHub (OAuth redirect to /auth/callback) ─────────────
    const signInWithGitHub = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                scopes: 'read:user user:email public_repo',
            },
        });
        if (error) throw error;
        return null;
    };

    // ─── Save profile during onboarding ─────────────────────────────────────
    // Writes role to public.users via backend, then refreshes the session so
    // the new JWT carries the role claim. Without the refresh, needsOnboarding
    // would stay true until the next natural token refresh (~1h).
    const saveProfile = async (chosenRole, profileData) => {
        if (!session?.user) throw new Error('Not authenticated');
        const name = profileData.name ||
                     session.user.user_metadata?.full_name ||
                     session.user.user_metadata?.name || '';

        await syncUserToBackend({
            name,
            role: chosenRole,
            college: profileData.college || null,
            branch: profileData.branch || null,
            year: profileData.year || null,
            company: profileData.company || null,
            designation: profileData.designation || null,
            instituteName: profileData.instituteName || null,
            instituteType: profileData.instituteType || null,
            contactPerson: profileData.contactPerson || null,
            contactPhone: profileData.contactPhone || null,
            city: profileData.city || null,
        });

        // Re-issue the JWT so the custom claim picks up the just-saved role.
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        setSession(data.session);
        // Optimistically populate profile so UI doesn't flicker while fetch races
        setProfile(mapProfile({ role: chosenRole, name, ...profileData, email: session.user.email }, session.user.id));
        return { role: chosenRole, name, ...profileData };
    };

    const logout = async () => {
        await supabase.auth.signOut();
        // onAuthStateChange will fire SIGNED_OUT, but clear eagerly too.
        setSession(null);
        setProfile(null);
        setGithubAccessToken(null);
    };

    const value = {
        user,
        session,
        profile,
        role,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithGitHub,
        githubAccessToken,
        saveProfile,
        logout,
        isAuthenticated: !!user,
        // Role comes from the JWT, set by the auth hook. No role = needs onboarding.
        needsOnboarding: !!user && !role,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export default useAuth;
