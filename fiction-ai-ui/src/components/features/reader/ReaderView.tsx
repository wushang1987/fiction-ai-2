import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../../ui/button";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import type { ChapterRef } from "../../../types";
import { cn } from "../../../lib/utils";

interface ReaderViewProps {
    bookTitle: string;
    chapterTitle: string;
    chapterNumber: number;
    markdown: string;
    chapters: ChapterRef[];
    isLoading: boolean;
    onNavigate: (chapterNumber: number) => void;
    onBackToLibrary: () => void;
}

export function ReaderView({
    bookTitle,
    chapterTitle,
    chapterNumber,
    markdown,
    chapters,
    isLoading,
    onNavigate,
    onBackToLibrary,
}: ReaderViewProps) {
    const prevChapter = chapters.find(c => c.number === chapterNumber - 1);
    const nextChapter = chapters.find(c => c.number === chapterNumber + 1);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            {/* Reader Header */}
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center px-4 md:px-8 justify-between">
                <div className="flex items-center gap-4 min-w-0">
                    <Button variant="ghost" size="sm" onClick={onBackToLibrary} className="hidden md:flex">
                        <ChevronLeft className="mr-1 h-4 w-4" /> Library
                    </Button>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-muted-foreground truncate">{bookTitle}</span>
                        <span className="text-sm font-bold truncate">{chapterTitle || `Chapter ${chapterNumber}`}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={!prevChapter}
                        onClick={() => prevChapter && onNavigate(prevChapter.number)}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-xs font-medium px-2 py-1 bg-muted rounded">
                        {chapterNumber} / {chapters.length}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={!nextChapter}
                        onClick={() => nextChapter && onNavigate(nextChapter.number)}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Reading Content */}
            <main className="flex-1 overflow-y-auto py-12 px-6 md:py-20">
                <div className="max-w-screen-md mx-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <article className="prose prose-slate dark:prose-invert max-w-none">
                            <h1 className="text-3xl md:text-5xl font-bold mb-12 font-serif text-center">
                                {chapterTitle || `Chapter ${chapterNumber}`}
                            </h1>
                            <div className="text-lg md:text-xl leading-relaxed font-serif text-foreground/90 space-y-6">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {markdown}
                                </ReactMarkdown>
                            </div>
                        </article>
                    )}
                </div>
            </main>

            {/* Bottom Navigation */}
            <footer className="border-t border-border py-12 px-6 bg-muted/20">
                <div className="max-w-screen-md mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="w-full md:w-1/3">
                        {prevChapter && (
                            <Button
                                variant="outline"
                                className="w-full h-auto py-4 flex flex-col items-start gap-1"
                                onClick={() => onNavigate(prevChapter.number)}
                            >
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Previous</span>
                                <span className="text-sm font-semibold truncate w-full text-left">{prevChapter.title}</span>
                            </Button>
                        )}
                    </div>

                    <Button variant="ghost" onClick={onBackToLibrary} className="md:order-2">
                        <List className="mr-2 h-4 w-4" /> Table of Contents
                    </Button>

                    <div className="w-full md:w-1/3 md:order-3">
                        {nextChapter && (
                            <Button
                                variant="default"
                                className="w-full h-auto py-4 flex flex-col items-end gap-1"
                                onClick={() => onNavigate(nextChapter.number)}
                            >
                                <span className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Next</span>
                                <span className="text-sm font-semibold truncate w-full text-right">{nextChapter.title}</span>
                            </Button>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
}
