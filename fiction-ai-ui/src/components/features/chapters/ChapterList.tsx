import type { ChapterRef } from "../../../types";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import { cn } from "../../../lib/utils";
import { FileEdit, Loader2 } from "lucide-react";

interface ChapterListProps {
    chapters: ChapterRef[];
    activeChapterNumber: number | null;
    onSelect: (ch: ChapterRef) => void;
    isLoading: boolean;
}

export function ChapterList({ chapters, activeChapterNumber, onSelect, isLoading }: ChapterListProps) {
    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Chapters</h3>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {isLoading && chapters.length === 0 ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted" />
                        </div>
                    ) : (
                        chapters.map((ch) => (
                            <Button
                                key={ch.number}
                                variant={activeChapterNumber === ch.number ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start text-left h-auto py-3 px-3",
                                    activeChapterNumber === ch.number ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => onSelect(ch)}
                            >
                                <FileEdit className={cn("mr-3 h-4 w-4 shrink-0", activeChapterNumber === ch.number ? "text-primary" : "opacity-40")} />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs opacity-50 font-medium">No. {ch.number}</span>
                                    <span className="truncate text-sm font-semibold">{ch.title}</span>
                                </div>
                            </Button>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
