/** Stagger delay for list item entrance animations (ms). */
export function linkModalStaggerDelay(index: number, baseMs = 32): number {
  return index * baseMs;
}
