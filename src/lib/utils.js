/**
 * Simple utility function to join class names
 */
export function cn(...classes) {
  // Flatten arrays and filter out falsy values
  return classes
    .flat()
    .filter(Boolean)
    .join(' ');
}
