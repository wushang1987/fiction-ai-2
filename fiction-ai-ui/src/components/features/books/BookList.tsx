import type { BookRef } from "../../../types";
import { cn } from "../../../lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { BookOpen, Check } from "lucide-react";

interface BookListProps {
    books: BookRef[];
    activeBookId: string | null;
    onSetActive: (id: string) => void;
    isLoading: boolean;
}

export function BookList({ books, activeBookId, onSetActive, isLoading }: BookListProps) {
    if (books.length === 0 && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <BookOpen className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-slate-500">No books found. Create your first book below.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            {books.map((book) => {
                const isActive = book.book_id === activeBookId;
                return (
                    <Card key={book.book_id} className={cn(
                        "transition-all duration-200 border border-slate-200 dark:border-slate-800",
                        isActive ? "ring-2 ring-blue-500 ring-offset-2 border-transparent" : "hover:border-slate-300 dark:hover:border-slate-700"
                    )}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <CardTitle className="text-lg font-bold">
                                    {book.title}
                                </CardTitle>
                                {isActive && <Badge className="bg-blue-500">Active</Badge>}
                            </div>
                            <CardDescription className="font-mono text-[10px] mt-1 opacity-50">
                                ID: {book.book_id}
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button
                                variant={isActive ? "secondary" : "outline"}
                                className="w-full h-10 font-medium"
                                onClick={() => onSetActive(book.book_id)}
                                disabled={isActive || isLoading}
                            >
                                {isActive ? (
                                    <span className="flex items-center"><Check className="mr-2 h-4 w-4" /> Selected</span>
                                ) : (
                                    "Select this Book"
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}
