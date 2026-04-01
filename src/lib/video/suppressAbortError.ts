/**
 * Suppress AbortError warnings in console
 * 
 * The AbortError occurs when play() is interrupted by pause()
 * This is expected browser behavior and should not be logged as an error
 */

export function setupAbortErrorSuppression() {
  if (typeof window === 'undefined') return;

  const originalError = console.error;
  const originalWarn = console.warn;

  // Suppress AbortError in console.error and console.warn
  console.error = function (...args: any[]) {
    // Check if any argument contains AbortError
    const hasAbortError = args.some(arg => {
      if (typeof arg === 'string') {
        return arg.includes('AbortError') || arg.includes('play() request was interrupted');
      }
      if (arg instanceof Error) {
        return arg.name === 'AbortError' || arg.message.includes('play() request was interrupted');
      }
      return false;
    });

    // Don't log AbortError - it's expected behavior
    if (!hasAbortError) {
      originalError.apply(console, args);
    }
  };

  console.warn = function (...args: any[]) {
    // Check if any argument contains AbortError
    const hasAbortError = args.some(arg => {
      if (typeof arg === 'string') {
        return arg.includes('AbortError') || arg.includes('play() request was interrupted');
      }
      if (arg instanceof Error) {
        return arg.name === 'AbortError' || arg.message.includes('play() request was interrupted');
      }
      return false;
    });

    // Don't log AbortError warnings - it's expected behavior
    if (!hasAbortError) {
      originalWarn.apply(console, args);
    }
  };
}

// Auto-setup on import
if (typeof window !== 'undefined') {
  setupAbortErrorSuppression();
}
