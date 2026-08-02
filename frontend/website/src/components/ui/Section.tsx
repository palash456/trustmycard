import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
    /**
     * Remove default vertical spacing.
     */
    noPadding?: boolean;
}

const Section = forwardRef<HTMLElement, SectionProps>(
    (
        {
            className,
            noPadding = false,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <section
                ref={ref}
                className={cn(
                    !noPadding && "py-16 sm:py-20 lg:py-24",
                    className
                )}
                {...props}
            >
                {children}
            </section>
        );
    }
);

Section.displayName = "Section";

export default Section;
