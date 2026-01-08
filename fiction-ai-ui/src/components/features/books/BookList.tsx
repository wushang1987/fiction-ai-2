import type { BookRef } from "../../../types";
import { cn } from "../../../lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { BookOpen, Check, Globe, Lock, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useState } from "react";
import { Input } from "../../ui/input";

interface BookListProps {
    books: BookRef[];
    activeBookId: string | null;
    onSetActive: (id: string) => void;
    onTogglePublic?: (id: string, is_public: boolean) => void;
    onUpdateTitle?: (id: string, title: string) => void;
    onDelete?: (id: string) => void;
    isLoading: boolean;
    buttonLabel?: string;
}

export function BookList({ books, activeBookId, onSetActive, onTogglePublic, onUpdateTitle, onDelete, isLoading, buttonLabel }: BookListProps) {
    const { user } = useAuth();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    if (books.length === 0 && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <BookOpen className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-slate-500">No books found. Create your first book below.</p>
            </div>
        );
    }

    const handleStartEdit = (book: BookRef) => {
        setEditingId(book.book_id);
        setEditValue(book.title);
    };

    const handleSaveEdit = (id: string) => {
        if (onUpdateTitle && editValue.trim()) {
            onUpdateTitle(id, editValue.trim());
        }
        setEditingId(null);
    };

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            {books.map((book) => {
                const isActive = book.book_id === activeBookId;
                const isEditing = editingId === book.book_id;

                return (
                    <Card key={book.book_id} className={cn(
                        "transition-all duration-200 border-border bg-card/40 backdrop-blur-sm group",
                        isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent" : "hover:border-primary/50"
                    )}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-2">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="h-8 py-0 focus-visible:ring-1"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleSaveEdit(book.book_id);
                                                    if (e.key === "Escape") setEditingId(null);
                                                }}
                                            />
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={() => handleSaveEdit(book.book_id)}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group/title">
                                            <CardTitle className="text-lg font-bold truncate">
                                                {book.title}
                                            </CardTitle>
                                            {onUpdateTitle && book.user_id === user?.user_id && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover/title:opacity-100 transition-opacity"
                                                    onClick={() => handleStartEdit(book)}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {isActive && <Badge className="bg-primary text-primary-foreground hidden sm:inline-flex">Active</Badge>}
                                    {book.user_id === user?.user_id && (
                                        <div className="flex items-center gap-1">
                                            {onTogglePublic && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={() => onTogglePublic(book.book_id, !book.is_public)}
                                                    title={book.is_public ? "Make Private" : "Make Public"}
                                                >
                                                    {book.is_public ? <Globe className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4" />}
                                                </Button>
                                            )}
                                            {onDelete && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => onDelete(book.book_id)}
                                                    title="Delete Book"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <CardDescription className="font-mono text-[10px] opacity-70">
                                    ID: {book.book_id.slice(0, 8)}...
                                </CardDescription>
                                {book.is_public && (
                                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/50 text-emerald-500">
                                        Public
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardFooter>
                            <Button
                                variant={isActive ? "secondary" : "outline"}
                                className="w-full h-10 font-medium"
                                onClick={() => onSetActive(book.book_id)}
                                disabled={isLoading}
                            >
                                {buttonLabel ? buttonLabel : (isActive ? (
                                    <span className="flex items-center"><Check className="mr-2 h-4 w-4" /> Editing</span>
                                ) : (
                                    "Edit Book"
                                ))}
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}
