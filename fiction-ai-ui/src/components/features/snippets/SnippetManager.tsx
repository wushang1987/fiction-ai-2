import type { Snippet } from "../../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Search, Save, Loader2 } from "lucide-react";
import { useState } from "react";

interface SnippetManagerProps {
    onSave: (text: string) => Promise<void>;
    onSearch: (q: string) => Promise<void>;
    snippets: Snippet[];
    isSaving: boolean;
    isSearching: boolean;
}

export function SnippetManager({ onSave, onSearch, snippets, isSaving, isSearching }: SnippetManagerProps) {
    const [text, setText] = useState("");
    const [query, setQuery] = useState("");

    const handleSave = async () => {
        if (!text.trim()) return;
        await onSave(text);
        setText("");
    };

    const handleSearch = () => {
        if (!query.trim()) return;
        onSearch(query);
    };

    return (
        <div className="h-full flex flex-col space-y-4 p-4">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">新建片段</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        placeholder="记录灵感、设定或素材..."
                        rows={3}
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />
                    <Button onClick={handleSave} disabled={isSaving || !text.trim()} className="w-full">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        保存片段
                    </Button>
                </CardContent>
            </Card>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex gap-2 mb-4">
                    <Input
                        placeholder="搜索片段..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSearch()}
                    />
                    <Button size="icon" variant="secondary" onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {snippets.map(s => (
                        <Card key={s.snippet_id} className="bg-muted/50">
                            <CardContent className="p-3 text-sm whitespace-pre-wrap">
                                {s.text}
                            </CardContent>
                            <div className="px-3 pb-2 text-[10px] text-muted-foreground font-mono truncate">
                                {s.snippet_id}
                            </div>
                        </Card>
                    ))}
                    {snippets.length === 0 && query && !isSearching && (
                        <div className="text-center text-muted-foreground text-sm py-4">未找到相关片段</div>
                    )}
                </div>
            </div>
        </div>
    );
}
