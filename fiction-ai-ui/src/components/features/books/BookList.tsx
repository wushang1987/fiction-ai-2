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
    onUpdatePremise?: (id: string, premise: string) => void;
    onDelete?: (id: string) => void;
    isLoading: boolean;
    buttonLabel?: string;
}

export function BookList({ books, activeBookId, onSetActive, onTogglePublic, onUpdateTitle, onUpdatePremise, onDelete, isLoading, buttonLabel }: BookListProps) {
    const { user } = useAuth();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editType, setEditType] = useState<"title" | "premise">("title");
    const [editValue, setEditValue] = useState("");

    if (books.length === 0 && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <BookOpen className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-slate-500">No books found. Create your first book below.</p>
            </div>
        );
    }

    const handleStartEdit = (book: BookRef, type: "title" | "premise") => {
        setEditingId(book.book_id);
        setEditType(type);
        setEditValue(type === "title" ? book.title : book.premise);
    };

    const handleSaveEdit = (id: string) => {
        if (editType === "title") {
            if (onUpdateTitle && editValue.trim()) {
                onUpdateTitle(id, editValue.trim());
            }
        } else {
            if (onUpdatePremise) {
                onUpdatePremise(id, editValue.trim());
            }
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
                                    {isEditing && editType === "title" ? (
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
                                            <Button size="icon" variant="ghost" type="button" className="h-8 w-8 text-emerald-500" onClick={() => handleSaveEdit(book.book_id)}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" type="button" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
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
                                                    onClick={() => handleStartEdit(book, "title")}
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

                            {/* Summary / Premise Section */}
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between group/premise">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                        Summary
                                        {onUpdatePremise && book.user_id === user?.user_id && !isEditing && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 opacity-0 group-hover/premise:opacity-100 transition-opacity"
                                                onClick={() => handleStartEdit(book, "premise")}
                                            >
                                                <Pencil className="h-2.5 w-2.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {isEditing && editType === "premise" ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-full min-h-[80px] text-sm p-2 rounded-md border border-input bg-background focus:ring-1 focus:ring-primary outline-none resize-none"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveEdit(book.book_id);
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" type="button" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                                            <Button size="sm" type="button" className="h-7 text-xs" onClick={() => handleSaveEdit(book.book_id)}>Save</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                        {book.premise || "No summary provided."}
                                    </p>
                                )}
                            </div>

                            {/* Progress Section */}
                            {book.planned_chapters_count !== null && (
                                <div className="mt-6 space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-medium text-muted-foreground">Progress</span>
                                        <span className="text-xs font-bold text-primary">
                                            {book.chapters_count} / {book.planned_chapters_count} Chapters
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-500 ease-out"
                                            style={{
                                                width: `${Math.min(100, (book.chapters_count / book.planned_chapters_count) * 100)}%`
                                            }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-right text-muted-foreground italic">
                                        {book.planned_chapters_count && book.planned_chapters_count > 0
                                            ? `${Math.round(Math.min(100, ((book.chapters_count || 0) / book.planned_chapters_count) * 100))}% complete`
                                            : "Calculating..."
                                        }
                                    </div>
                                </div>
                            )}

                            {book.planned_chapters_count === null && book.chapters_count > 0 && (
                                <div className="mt-4 pt-4 border-t border-border/50">
                                    <span className="text-xs text-muted-foreground">
                                        <span className="font-bold text-foreground">{book.chapters_count}</span> chapters written
                                    </span>
                                </div>
                            )}
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
