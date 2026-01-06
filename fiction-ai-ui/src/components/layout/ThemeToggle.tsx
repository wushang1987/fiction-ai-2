import { Moon, Sun } from "lucide-react";
import { Button } from "../ui/button";

interface ThemeToggleProps {
    isDarkMode: boolean;
    onToggle: () => void;
}

export function ThemeToggle({ isDarkMode, onToggle }: ThemeToggleProps) {
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-9 w-9 rounded-full transition-all duration-300 hover:bg-muted"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            {isDarkMode ? (
                <Sun className="h-[1.2rem] w-[1.2rem] text-yellow-500 transition-all scale-100 rotate-0" />
            ) : (
                <Moon className="h-[1.2rem] w-[1.2rem] text-slate-700 transition-all scale-100 rotate-0" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
