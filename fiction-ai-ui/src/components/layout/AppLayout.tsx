import * as React from "react";
import { cn } from "../../lib/utils";

interface AppLayoutProps {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    className?: string;
}

export function AppLayout({ children, sidebar, className }: AppLayoutProps) {
    return (
        <div className={cn("flex h-screen w-full overflow-hidden bg-white dark:bg-slate-950", className)}>
            <aside className="hidden w-64 flex-col md:flex h-full flex-shrink-0">
                {sidebar}
            </aside>
            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
                <div className="max-w-5xl mx-auto py-10 px-6 lg:px-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
