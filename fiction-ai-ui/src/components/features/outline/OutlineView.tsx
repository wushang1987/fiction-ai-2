import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { RefreshCw, Zap } from "lucide-react";

interface OutlineViewProps {
    markdown: string | null;
    isLoading: boolean;
    onRefresh: () => void;
    onGenerate: () => void;
    hasActiveBook: boolean;
}

export function OutlineView({ markdown, isLoading, onRefresh, onGenerate, hasActiveBook }: OutlineViewProps) {
    if (!hasActiveBook) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground bg-muted/10 rounded-lg border border-dashed m-4">
                <p>请先在“小说管理”中选择一本书。</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-semibold">大纲视图</h2>
                <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        刷新
                    </Button>
                    <Button variant="default" size="sm" onClick={onGenerate} disabled={isLoading}>
                        <Zap className="mr-2 h-4 w-4" />
                        重新生成
                    </Button>
                </div>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col">
                <CardContent className="flex-1 overflow-y-auto p-6 prose prose-neutral dark:prose-invert max-w-none">
                    {isLoading && !markdown ? (
                        <div className="space-y-4">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                            <div className="pt-8 space-y-2">
                                <Skeleton className="h-6 w-1/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        </div>
                    ) : markdown ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <p>暂无大纲，请点击“重新生成”</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
