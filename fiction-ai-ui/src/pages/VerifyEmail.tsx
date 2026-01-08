import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'

export const VerifyEmail: React.FC = () => {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!token) {
            setStatus('error')
            setMessage('Invalid verification link.')
            return
        }

        const verify = async () => {
            try {
                const res = await authApi.verifyEmail(token)
                setStatus('success')
                setMessage(res.message)
            } catch (err) {
                setStatus('error')
                if (err instanceof ApiError) {
                    setMessage(err.message)
                } else {
                    setMessage('Failed to verify email.')
                }
            }
        }

        verify()
    }, [token])

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="max-w-md w-full subtle-card p-8 rounded-xl text-center">
                {status === 'loading' && (
                    <div className="py-8">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p>Verifying your email...</p>
                    </div>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-4">Email Verified!</h2>
                        <p className="text-muted-foreground mb-8">{message}</p>
                        <Link
                            to="/login"
                            className="inline-block bg-primary text-primary-foreground px-8 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                        >
                            Go to Login
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-4">Verification Failed</h2>
                        <p className="text-muted-foreground mb-8">{message}</p>
                        <Link
                            to="/register"
                            className="inline-block bg-primary text-primary-foreground px-8 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                        >
                            Try Registering Again
                        </Link>
                    </>
                )}
            </div>
        </div>
    )
}
