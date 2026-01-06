import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { Play, ListPlus, Sparkles, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/utils";

interface ChapterEditorProps {
    markdown: string;
    title: string;
    chapterNumber: number;
    isLoading: boolean;
    isStreaming: boolean;
    instruction: string;
    onInstructionChange: (v: string) => void;
    onGenerateNext: () => void;
    onGenerateSpecific: (n: number) => void;
    onGenerateAll: () => void;
    onGenerateAllStream: () => void;
}

export function ChapterEditor({
    markdown,
    title,
    chapterNumber,
    isLoading,
    isStreaming,
    instruction,
    onInstructionChange,
    onGenerateNext,
    onGenerateSpecific,
    onGenerateAllStream,
}: ChapterEditorProps) {
    const [targetChapterNum, setTargetChapterNum] = useState("");

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Immersive Toolbar */}
            <div className="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center px-6 gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Chapter {chapterNumber || "-"}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm font-semibold truncate max-w-[200px]">{title || "Untitled"}</span>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                    <Button size="sm" variant="default" onClick={onGenerateNext} disabled={isLoading || isStreaming} className="bg-blue-600 hover:bg-blue-700">
                        <Play className="mr-2 h-4 w-4 fill-current" /> Next
                    </Button>

                    <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1">
                        <Input
                            className="w-10 h-7 text-xs border-none focus-visible:ring-0 p-0 text-center"
                            placeholder="#"
                            value={targetChapterNum}
                            onChange={e => setTargetChapterNum(e.target.value)}
                        />
                        <Button variant="ghost" className="h-7 px-2 text-[10px] font-bold uppercase" onClick={() => onGenerateSpecific(Number(targetChapterNum))}>Go</Button>
                    </div>

                    <Button size="sm" variant="outline" onClick={onGenerateAllStream} disabled={isLoading || isStreaming}>
                        {isStreaming ? <Sparkles className="h-4 w-4 animate-spin text-blue-600" /> : <ListPlus className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Writing Area */}
            <div className="flex-1 overflow-y-auto p-10 md:p-16">
                <div className="max-w-2xl mx-auto">
                    {title && <h1 className="text-4xl font-bold mb-10 text-slate-900 dark:text-white">{title}</h1>}
                    <div className="prose prose-slate dark:prose-invert max-w-none text-lg leading-relaxed font-serif">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {markdown || "_Ready to generate..._"}
                        </ReactMarkdown>
                        {isStreaming && <span className="inline-block w-2 h-6 bg-blue-500 animate-pulse align-middle ml-1" />}
                    </div>
                    <div className="h-40" />
                </div>
            </div>

            {/* Floating Insight Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                <div className="max-w-2xl mx-auto flex gap-3 items-center">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <Input
                        placeholder="Instruct the AI to rewrite or continue..."
                        value={instruction}
                        onChange={e => onInstructionChange(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                    <Button size="icon" variant="ghost" className="text-blue-600">
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
