import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Note: I am adding class-variance-authority to the package manually or creating a mini version if not present? 
// Wait, I didn't see it in package.json. I should install it or write a simpler version. 
// For now, I'll use a simple implementation or install it. 
// Given the environment, it's safer to just write the logic without extra deps if possible, 
// BUT `cva` is standard. Let me check package.json again. 
// It was NOT in package.json. I will stick to simple props or install it. 
// Actually, I can use a simple switch/map approach to avoid adding dependencies unless user asked. 
// "Simple professional design" -> I'll write a clean internal utility or just use template literals.
// Let's mimic cva behavior manually to keep it lightweight if I can't run install easily (I can, but maybe faster not to).
// User said "looks good, please help me implement it". I should adding deps if needed.
// `npm install class-variance-authority` is quick.

const buttonVariants = (variant: string = "default", size: string = "default", className?: string) => {
  const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };

  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  };

  return cn(base, variants[variant] || variants.default, sizes[size] || sizes.default, className);
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={buttonVariants(variant, size, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
