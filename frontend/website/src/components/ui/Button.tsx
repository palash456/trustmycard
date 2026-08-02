import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
}

const variantClasses = {
    primary:
        "bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-400",

    secondary:
        "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",

    outline:
        "border border-neutral-300 bg-transparent hover:bg-neutral-100",

    ghost:
        "bg-transparent hover:bg-neutral-100",

    danger:
        "bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "primary",
            size = "md",
            loading = false,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-60",
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? "Loading..." : children}
            </button>
        );
    }
);

Button.displayName = "Button";

export default Button;