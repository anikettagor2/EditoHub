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

  // Suppress AbortError and known Firestore internal assertions in console.error and console.warn
  console.error = function (...args: any[]) {
    // Check if any argument contains suppressed errors
    const shouldSuppress = args.some(arg => {
      const strArg = typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : '');
      const nameArg = arg instanceof Error ? arg.name : '';

      // 1. Suppress AbortError (video playback interruptions)
      if (nameArg === 'AbortError' || strArg.includes('AbortError') || strArg.includes('play() request was interrupted')) {
        return true;
      }

      // 2. Suppress Firestore Internal Assertion (Known SDK bugs like ID: ca9)
      if (strArg.includes('INTERNAL ASSERTION FAILED') || strArg.includes('Unexpected state (ID: ca9)')) {
        return true;
      }

      return false;
    });

    // Only log if not suppressed
    if (!shouldSuppress) {
      originalError.apply(console, args);
    }
  };

  console.warn = function (...args: any[]) {
    // Check if any argument contains suppressed warnings
    const shouldSuppress = args.some(arg => {
      const strArg = typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : '');
      const nameArg = arg instanceof Error ? arg.name : '';

      if (nameArg === 'AbortError' || strArg.includes('AbortError') || strArg.includes('play() request was interrupted')) {
        return true;
      }
      
      if (strArg.includes('INTERNAL ASSERTION FAILED') || strArg.includes('Unexpected state (ID: ca9)')) {
        return true;
      }

      return false;
    });

    if (!shouldSuppress) {
      originalWarn.apply(console, args);
    }
  };
}

// Auto-setup on import
if (typeof window !== 'undefined') {
  setupAbortErrorSuppression();
}
