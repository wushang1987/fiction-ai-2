import { apiFetch } from './client'
import type { UserLoginRequest, UserRegisterRequest, TokenResponse } from '../types'

export const authApi = {
    login: (req: UserLoginRequest) =>
        apiFetch<TokenResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(req),
        }),

    register: (req: UserRegisterRequest) =>
        apiFetch<{ message: string; user: any }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(req),
        }),

    verifyEmail: (token: string) =>
        apiFetch<{ message: string }>(`/api/auth/verify-email?token=${token}`),

    me: () => apiFetch<{ user_id: string; email: string; full_name: string }>('/api/auth/me'),
}
