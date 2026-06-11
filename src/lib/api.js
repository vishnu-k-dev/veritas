/**
 * API helper — resolves base URL for backend requests.
 * In dev: Vite proxy handles /api → localhost:3001
 * In prod: Uses VITE_API_URL env var (e.g. https://VERITAS-api.onrender.com)
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Make an API request with proper base URL and error handling.
 * @param {string} path - API path starting with /api/
 * @param {object} options - fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error ${res.status}`);
    }
    return res;
}

export default apiFetch;

