import type { BookRef } from "../../../types";
import { cn } from "../../../lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { BookOpen, Check, Globe, Lock } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

interface BookListProps {
    books: BookRef[];
    activeBookId: string | null;
    onSetActive: (id: string) => void;
    onTogglePublic?: (id: string, is_public: boolean) => void;
    isLoading: boolean;
}

export function BookList({ books, activeBookId, onSetActive, onTogglePublic, isLoading }: BookListProps) {
    const { user } = useAuth();
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
                        "transition-all duration-200 border-border bg-card/40 backdrop-blur-sm",
                        isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent" : "hover:border-primary/50"
                    )}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <CardTitle className="text-lg font-bold">
                                    {book.title}
                                </CardTitle>
                                {isActive && <Badge className="bg-primary text-primary-foreground">Active</Badge>}
                                {onTogglePublic && book.user_id === user?.user_id && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTogglePublic(book.book_id, !book.is_public);
                                        }}
                                    >
                                        {book.is_public ? (
                                            <Globe className="h-4 w-4 text-emerald-500 mr-1" />
                                        ) : (
                                            <Lock className="h-4 w-4 mr-1" />
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {book.is_public ? "Public" : "Private"}
                                        </span>
                                    </Button>
                                )}
                            </div>
                            <CardDescription className="font-mono text-[10px] mt-1 opacity-70">
                                ID: {book.book_id}
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button
                                variant={isActive ? "secondary" : "outline"}
                                className="w-full h-10 font-medium"
                                onClick={() => onSetActive(book.book_id)}
                                disabled={isLoading}
                            >
                                {isActive ? (
                                    <span className="flex items-center"><Check className="mr-2 h-4 w-4" /> Editing</span>
                                ) : (
                                    "Edit Book"
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}
