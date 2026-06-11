/**
 * API Service Layer
 * Handles all communication with the VERITAS backend
 */
import { getAuthToken as getSupabaseToken } from '../lib/supabase';

// Use environment variable for production, empty for local dev (Vite proxy handles /api)
const API_BASE = import.meta.env.VITE_API_URL || '';

// Get the current Supabase JWT — no legacy fallback (stale tokens are worse than re-login)
async function getToken() {
    return await getSupabaseToken();
}

// Legacy token setter — no-op now that Firebase is the sole auth source.
// Kept as a stub so old call sites don't crash; remove once those are gone.
function setAuthToken(_token) { /* no-op */ }

// Generic fetch wrapper with error handling — exported for use in useAuth
export async function apiRequest(endpoint, options = {}) {
    const controller = new AbortController();
    // 30s hard limit — covers Railway cold start (up to ~15s) + auth middleware
    // chain (8s Supabase getUser + 8s DB query) with headroom. Anything longer
    // than this is a real hang, not a slow start.
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
        const { headers: callerHeaders, signal: callerSignal, ...restOptions } = options;
        const token = await getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...callerHeaders,
        };

        // Add auth token if available (after merging caller headers so it can't be overwritten)
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        // Combine our abort signal with any caller-supplied signal
        const signal = callerSignal
            ? AbortSignal.any
                ? AbortSignal.any([controller.signal, callerSignal])
                : controller.signal
            : controller.signal;

        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers,
            signal,
            ...restOptions,
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
            const err = new Error(errBody.error || `HTTP ${response.status}`);
            err.status = response.status; // Expose status so callers can distinguish 4xx (don't retry) from 5xx (retry)
            err.body = errBody;
            throw err;
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            const timeoutErr = new Error('Request timed out — please refresh and try again.');
            timeoutErr.isTimeout = true;
            console.error(`API Timeout [${endpoint}]`);
            throw timeoutErr;
        }
        console.error(`API Error [${endpoint}]:`, error.message);
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

// ============================================
// AUTH ENDPOINTS
// ============================================

export async function register(email, password, name, company) {
    const result = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, company }),
    });
    setAuthToken(result.token);
    return result;
}

export async function login(email, password) {
    const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    setAuthToken(result.token);
    return result;
}

export async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => { });
    setAuthToken(null);
}

export async function getCurrentUser() {
    try {
        const result = await apiRequest('/api/auth/me');
        return result.recruiter;
    } catch {
        return null;
    }
}

// ============================================
// RECRUITER ENDPOINTS
// ============================================

export async function fetchRecruiterStats() {
    return apiRequest('/api/recruiter/stats');
}

export async function fetchRecruiterCodes() {
    return apiRequest('/api/recruiter/codes');
}

export async function createScreeningCode(data) {
    return apiRequest('/api/recruiter/codes', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchCodeSubmissions(code) {
    return apiRequest(`/api/recruiter/codes/${code}/submissions`);
}

export async function bulkInviteCode(code, emails) {
    return apiRequest(`/api/recruiter/codes/${code}/invite-bulk`, {
        method: 'POST',
        body: JSON.stringify({ emails }),
    });
}

export async function reinviteCandidate(code, interviewId) {
    return apiRequest(`/api/recruiter/codes/${code}/reinvite`, {
        method: 'POST',
        body: JSON.stringify({ interviewId }),
    });
}

// ============================================
// APPLICANT ENDPOINTS
// ============================================

export async function validateScreeningCode(code) {
    return apiRequest(`/api/codes/${code}`);
}

export async function checkApplicantExists(code, email) {
    const result = await apiRequest(`/api/codes/${code}/check`, {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
    return result.alreadyTaken;
}

export async function startApplicantScreening(code, email, candidateName, resumeText) {
    return apiRequest(`/api/codes/${code}/start`, {
        method: 'POST',
        body: JSON.stringify({ email, candidateName, resumeText }),
    });
}

export async function updateScreening(id, data) {
    return apiRequest(`/api/screenings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function fetchScreening(id) {
    return apiRequest(`/api/screenings/${id}`);
}

// Health check
export async function checkHealth() {
    return apiRequest('/api/ping');
}

// ============================================
// INTERVIEW SAVE ENDPOINT
// ============================================

// Save a completed interview result to Supabase (called in parallel with Firestore save)
export async function saveInterviewResult(data) {
    return apiRequest('/api/interview/save', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// Redeem a promo code for extra interviews
export async function redeemPromoCode(code) {
    return apiRequest('/api/admin/promo-redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
    });
}

// Fetch leaderboard (college or user grouping)
export async function fetchLeaderboard(groupBy = 'college') {
    return apiRequest(`/api/usage/leaderboard?groupBy=${groupBy}`);
}

// Ensure Supabase user row exists — call fire-and-forget after Firebase sign-in
// Accepts: name (string) OR a full profile object { name, role, college, branch, year, company }
export async function syncUserToBackend(nameOrProfile) {
    const payload = typeof nameOrProfile === 'string'
        ? { name: nameOrProfile }
        : nameOrProfile;
    return apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

// ============================================
// USAGE LIMIT ENDPOINTS
// ============================================

export async function checkUsageLimits() {
    return apiRequest('/api/usage/check');
}

export async function recordUsageAction(actionType) {
    return apiRequest('/api/usage/record', {
        method: 'POST',
        body: JSON.stringify({ actionType }),
    });
}

export default {
    setAuthToken,
    apiRequest,
    register,
    login,
    logout,
    getCurrentUser,
    fetchRecruiterStats,
    fetchRecruiterCodes,
    createScreeningCode,
    fetchCodeSubmissions,
    validateScreeningCode,
    checkApplicantExists,
    startApplicantScreening,
    updateScreening,
    fetchScreening,
    checkHealth,
    checkUsageLimits,
    recordUsageAction,
    saveInterviewResult,
    syncUserToBackend,
};

