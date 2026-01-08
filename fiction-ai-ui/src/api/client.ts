import type { ApiErr, ApiResponse } from '../types'

export class ApiError extends Error {
    public readonly code: string
    public readonly details?: Record<string, unknown>

    constructor(message: string, code: string, details?: Record<string, unknown>) {
        super(message)
        this.code = code
        this.details = details
    }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
    const text = await res.text()
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem('fiction_ai_token')
    const res = await fetch(path, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(init?.headers ?? {}),
        },
    })

    const payload = (await parseJsonSafe(res)) as ApiResponse<T> | unknown

    if (!res.ok) {
        const err = payload as ApiErr
        if (err && typeof err === 'object' && 'error' in err) {
            throw new ApiError(err.error.message, err.error.code, err.error.details)
        }
        throw new ApiError(`HTTP ${res.status}`, 'HTTP_ERROR')
    }

    const apiRes = payload as ApiResponse<T>
    if (!apiRes || typeof apiRes !== 'object') {
        throw new ApiError('Invalid API response', 'INVALID_RESPONSE')
    }

    if (apiRes.ok) return apiRes.data

    throw new ApiError(apiRes.error.message, apiRes.error.code, apiRes.error.details)
}
