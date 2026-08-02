type ClassValue = string | undefined | null | false;

/**
 * Combines class names, filtering out falsy values.
 */
export function cn(...inputs: ClassValue[]): string {
    return inputs.filter(Boolean).join(" ");
}
