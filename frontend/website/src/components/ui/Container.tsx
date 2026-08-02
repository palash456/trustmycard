import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * Remove the default horizontal padding.
     */
    fluid?: boolean;
}

const Container = forwardRef<HTMLDivElement, ContainerProps>(
    ({ className, fluid = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "mx-auto w-full max-w-7xl",
                    !fluid && "px-4 sm:px-6 lg:px-8",
                    className
                )}
                {...props}
            />
        );
    }
);

Container.displayName = "Container";

export default Container;