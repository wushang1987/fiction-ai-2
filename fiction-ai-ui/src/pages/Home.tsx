import React, { useEffect, useState } from 'react';
import { fictionApi } from '../api/fiction';
import type { BookRef } from '../types';
import { BookList } from '../components/features/books/BookList';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Sidebar } from '../components/layout/Sidebar';

export const Home: React.FC = () => {
    const [publicBooks, setPublicBooks] = useState<BookRef[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        const fetchPublicBooks = async () => {
            try {
                const data = await fictionApi.listBooks();
                // Since listBooks is updated to return public books for unauth users,
                // and user's books + public books for auth users, we might want to filter
                // specifically for public books here if we only want "public" ones on home.
                // But usually Home Page displays everything accessible to the user.
                // For a true "Public Home", we filter for is_public.
                setPublicBooks(data.books.filter(b => b.is_public));
            } catch (error) {
                console.error('Failed to fetch public books', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPublicBooks();
    }, []);

    const handleSelectBook = (bookId: string) => {
        navigate(`/books/${bookId}/read`);
    };

    return (
        <AppLayout
            sidebar={<Sidebar activeTab="home" onTabChange={(tab: "dashboard" | "write" | "outline" | "snippets" | "home") => tab === "home" ? null : navigate(tab === "dashboard" ? "/dashboard" : "/")} />}
        >
            <div className="max-w-6xl mx-auto px-4 py-12">
                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-extrabold text-foreground mb-4">Explore Public Fictions</h1>
                    <p className="text-xl text-muted-foreground">Discover stories created by our community with AI assistance.</p>
                    {!user && (
                        <div className="mt-8">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-all shadow-lg"
                            >
                                Start Your Own Story
                            </button>
                        </div>
                    )}
                </header>

                <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-foreground">Featured Stories</h2>
                    <BookList
                        books={publicBooks}
                        activeBookId={null}
                        onSetActive={handleSelectBook}
                        isLoading={isLoading}
                        buttonLabel="Read Book"
                    />

                    {publicBooks.length === 0 && !isLoading && (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-slate-400 text-lg">No public fictions found. Be the first to share your story!</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
};
