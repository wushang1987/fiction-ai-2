import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../ui/card";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Button } from "../../ui/button";
import { Plus } from "lucide-react";

interface CreateBookFormProps {
    onSubmit: (data: { premise: string; genre: string; targetWords: string }) => Promise<void>;
    isLoading: boolean;
}

export function CreateBookForm({ onSubmit, isLoading }: CreateBookFormProps) {
    const [premise, setPremise] = useState("");
    const [genre, setGenre] = useState("");
    const [targetWords, setTargetWords] = useState("3000");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!premise.trim()) return;
        onSubmit({ premise, genre, targetWords });
    };

    return (
        <Card className="border-border shadow-md overflow-hidden bg-card/30 backdrop-blur-sm">
            <CardHeader className="bg-primary/10 border-b border-border">
                <CardTitle className="text-xl font-bold text-primary flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create New Novel
                </CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-3">
                        <Label htmlFor="premise" className="text-sm font-semibold text-foreground/80">Story Premise (Required)</Label>
                        <Textarea
                            id="premise"
                            placeholder="e.g. A 3000-word cyberpunk romance set in a neon-lit Tokyo..."
                            value={premise}
                            onChange={(e) => setPremise(e.target.value)}
                            className="min-h-[120px] bg-background/50 border-border focus:border-primary/50 transition-all"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label htmlFor="genre" className="text-sm font-semibold text-foreground/80">Genre / Style</Label>
                            <Input
                                id="genre"
                                placeholder="e.g. Xianxia, Sci-Fi"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                className="bg-background/50 border-border focus:border-primary/50 transition-all"
                            />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="words" className="text-sm font-semibold text-foreground/80">Target Word Count</Label>
                            <Input
                                id="words"
                                placeholder="3000"
                                value={targetWords}
                                onChange={(e) => setTargetWords(e.target.value)}
                                className="bg-background/50 border-border focus:border-primary/50 transition-all"
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-6 bg-muted/30 border-t border-border">
                    <Button type="submit" disabled={isLoading} className="w-full h-11 text-base font-semibold">
                        {isLoading ? "Generating..." : (
                            <>
                                <Plus className="mr-2 h-5 w-5" />
                                Create & Generate Outline
                            </>
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
