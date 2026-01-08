import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fictionApi } from "../api/fiction";
import { ReaderView } from "../components/features/reader/ReaderView";
import type { Book, ChapterRef, GetChapterData } from "../types";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export const ReadingPage: React.FC = () => {
    const { bookId, chapterNumber } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [book, setBook] = useState<Book | null>(null);
    const [chapters, setChapters] = useState<ChapterRef[]>([]);
    const [currentChapter, setCurrentChapter] = useState<GetChapterData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!bookId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch book details
                const bookRes = await fictionApi.getBook(bookId);
                setBook(bookRes.book);

                // 2. Fetch chapter list
                const chaptersRes = await fictionApi.listChapters(bookId);
                setChapters(chaptersRes.chapters);

                // 3. Determine which chapter to load
                const chNum = chapterNumber ? parseInt(chapterNumber) : (chaptersRes.chapters[0]?.number || 1);

                // 4. Fetch the specific chapter
                const chapterRes = await fictionApi.getChapter(bookId, chNum);
                setCurrentChapter(chapterRes);
            } catch (error: any) {
                console.error("Failed to fetch reading data", error);
                toast.error(error.message || "Failed to load the book");
                navigate("/");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [bookId, chapterNumber, navigate]);

    const handleNavigate = (num: number) => {
        navigate(`/books/${bookId}/read/${num}`);
    };

    const handleBackToLibrary = () => {
        if (user) {
            navigate("/dashboard");
        } else {
            navigate("/");
        }
    };

    if (isLoading && !book) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!book) return null;

    return (
        <ReaderView
            bookTitle={book.title}
            chapterTitle={currentChapter?.title || ""}
            chapterNumber={currentChapter?.number || 1}
            markdown={currentChapter?.content_markdown || ""}
            chapters={chapters}
            isLoading={isLoading}
            onNavigate={handleNavigate}
            onBackToLibrary={handleBackToLibrary}
        />
    );
};
