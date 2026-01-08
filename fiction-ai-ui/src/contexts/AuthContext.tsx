import React, { createContext, useContext, useState, useEffect } from 'react'

interface User {
    user_id: string
    email: string
    full_name: string
}

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (token: string, userData: User) => void
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem('fiction_ai_token')
        const storedUser = localStorage.getItem('fiction_ai_user')

        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) {
                console.error('Failed to parse stored user', e)
                localStorage.removeItem('fiction_ai_token')
                localStorage.removeItem('fiction_ai_user')
            }
        }
        setLoading(false)
    }, [])

    const login = (token: string, userData: User) => {
        localStorage.setItem('fiction_ai_token', token)
        localStorage.setItem('fiction_ai_user', JSON.stringify(userData))
        setUser(userData)
    }

    const logout = () => {
        localStorage.removeItem('fiction_ai_token')
        localStorage.removeItem('fiction_ai_user')
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
