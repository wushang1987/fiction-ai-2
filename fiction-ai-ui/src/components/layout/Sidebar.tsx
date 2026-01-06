import { BookOpen, PenTool, LayoutTemplate, Sparkles, FileText, UserCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

interface SidebarProps {
    activeTab: "dashboard" | "write" | "outline" | "snippets";
    onTabChange: (tab: "dashboard" | "write" | "outline" | "snippets") => void;
    statusText?: string;
}

export function Sidebar({ activeTab, onTabChange, statusText }: SidebarProps) {
    const NavItem = ({
        value,
        icon: Icon,
        label
    }: {
        value: "dashboard" | "write" | "outline" | "snippets",
        icon: React.ElementType,
        label: string
    }) => (
        <Button
            variant={activeTab === value ? "secondary" : "ghost"}
            className={cn(
                "w-full justify-start text-sm font-medium px-3 h-10 mb-1",
                activeTab === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => onTabChange(value)}
        >
            <Icon className={cn("mr-3 h-4 w-4", activeTab === value ? "text-blue-600" : "opacity-70")} />
            {label}
        </Button>
    );

    return (
        <div className="flex h-full flex-col bg-background border-r border-border">
            <div className="flex h-16 items-center px-6 mb-4">
                <div className="flex items-center gap-2 font-bold text-xl text-foreground">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Fiction AI
                </div>
            </div>

            <div className="flex-1 px-3">
                <div className="px-3 mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Workspace</span>
                </div>
                <NavItem value="dashboard" icon={BookOpen} label="Library" />
                <NavItem value="outline" icon={LayoutTemplate} label="Outline" />
                <NavItem value="write" icon={PenTool} label="Writer" />

                <div className="px-3 mb-2 mt-6">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resources</span>
                </div>
                <NavItem value="snippets" icon={FileText} label="Snippets" />
            </div>

            <div className="p-4 mt-auto border-t border-border">
                <div className="flex items-center gap-3">
                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground">AI Editor</span>
                        <span className="text-[10px] text-muted-foreground truncate">{statusText || "Ready"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
