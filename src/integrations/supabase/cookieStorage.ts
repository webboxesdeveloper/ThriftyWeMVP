import Cookies from 'js-cookie';

/**
 * Custom storage adapter that uses cookies instead of localStorage
 * Implements the Storage interface required by Supabase
 * 
 * Supabase stores multiple keys like:
 * - sb-<project-ref>-auth-token (main session)
 * - sb-<project-ref>-auth-token.code_verifier
 * - etc.
 */
export class CookieStorage implements Storage {
  private readonly cookiePrefix: string;
  private readonly cookieOptions: {
    expires?: number | Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  };

  constructor(cookiePrefix: string = 'sb-', cookieOptions?: {
    expires?: number | Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  }) {
    this.cookiePrefix = cookiePrefix;
    this.cookieOptions = {
      expires: cookieOptions?.expires || 365, // Default: 1 year
      path: cookieOptions?.path || '/',
      secure: cookieOptions?.secure ?? (window.location.protocol === 'https:'), // Secure in production
      sameSite: cookieOptions?.sameSite || 'lax', // CSRF protection
      ...cookieOptions,
    };
  }

  get length(): number {
    // Count cookies that match our prefix, plus sessionStorage items
    let count = 0;
    const allCookies = document.cookie.split(';');
    const seenKeys = new Set<string>();
    
    for (const cookie of allCookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(this.cookiePrefix)) {
        const key = trimmed.split('=')[0].trim();
        // Don't count storage markers
        if (!key.endsWith('_storage')) {
          seenKeys.add(key);
          count++;
        }
      }
    }
    
    // Also count sessionStorage items that match prefix
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.cookiePrefix) && !seenKeys.has(key)) {
          count++;
        }
      }
    } catch {
      // Ignore sessionStorage errors
    }
    
    return count;
  }

  key(index: number): string | null {
    const allCookies = document.cookie.split(';');
    let currentIndex = 0;
    for (const cookie of allCookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(this.cookiePrefix)) {
        if (currentIndex === index) {
          const key = trimmed.split('=')[0];
          return key;
        }
        currentIndex++;
      }
    }
    return null;
  }

  getItem(key: string): string | null {
    try {
      // First try to get from cookie
      const cookieValue = Cookies.get(key);
      if (cookieValue) {
        return cookieValue;
      }
      
      // Check if there's a storage marker indicating value is elsewhere
      const storageMarker = Cookies.get(`${key}_storage`);
      
      if (storageMarker === 's') {
        // Value is in sessionStorage
        try {
          const sessionValue = sessionStorage.getItem(key);
          if (sessionValue) {
            return sessionValue;
          }
        } catch {
          // Ignore sessionStorage errors
        }
      } else if (storageMarker === 'l') {
        // Value is in localStorage (fallback)
        try {
          const localValue = localStorage.getItem(key);
          if (localValue) {
            return localValue;
          }
        } catch {
          // Ignore localStorage errors
        }
      } else {
        // No marker, but check sessionStorage anyway (for backwards compatibility)
        try {
          const sessionValue = sessionStorage.getItem(key);
          if (sessionValue) {
            return sessionValue;
          }
        } catch {
          // Ignore sessionStorage errors
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error reading storage:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      // Cookies have a 4KB limit per cookie
      // Supabase tokens can be large (especially the main auth token)
      // Strategy: Try cookie first, fall back to sessionStorage if too large
      
      const MAX_COOKIE_SIZE = 4000; // Leave some buffer (4KB = 4096 bytes)
      
      if (value.length > MAX_COOKIE_SIZE) {
        // Value is too large for cookie, use sessionStorage
        // This ensures session persists across page reloads
        try {
          sessionStorage.setItem(key, value);
          // Store a marker in cookie to indicate where the value is
          // Use single char 's' to save space
          try {
            Cookies.set(`${key}_storage`, 's', { 
              ...this.cookieOptions,
              expires: 365 // Same expiry as main token
            });
          } catch {
            // If we can't set marker, that's okay - we'll check sessionStorage anyway
          }
        } catch (fallbackError) {
          console.error('Error setting fallback storage:', fallbackError);
          // Last resort: try localStorage (but this defeats the purpose of using cookies)
          try {
            localStorage.setItem(key, value);
            try {
              Cookies.set(`${key}_storage`, 'l', { 
                ...this.cookieOptions,
                expires: 365
              });
            } catch {
              // Ignore marker errors
            }
          } catch (localError) {
            console.error('Error setting localStorage fallback:', localError);
            throw localError; // Re-throw if all storage methods fail
          }
        }
      } else {
        // Value fits in cookie, store it there
        try {
          Cookies.set(key, value, this.cookieOptions);
          // Remove any fallback storage markers and data
          try {
            Cookies.remove(`${key}_storage`, { path: this.cookieOptions.path });
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
          } catch {
            // Ignore cleanup errors
          }
        } catch (cookieError) {
          // If cookie setting fails (e.g., secure flag in HTTP), fall back
          console.warn('Cookie set failed, using sessionStorage fallback:', cookieError);
          sessionStorage.setItem(key, value);
          try {
            Cookies.set(`${key}_storage`, 's', { 
              ...this.cookieOptions,
              expires: 365
            });
          } catch {
            // Ignore marker errors
          }
        }
      }
    } catch (error) {
      console.error('Error setting storage:', error);
      // Don't throw - let Supabase handle the error
    }
  }

  removeItem(key: string): void {
    try {
      Cookies.remove(key, { path: this.cookieOptions.path });
      Cookies.remove(`${key}_storage`, { path: this.cookieOptions.path });
      // Also try to remove from sessionStorage and localStorage
      try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } catch {
        // Ignore errors
      }
    } catch (error) {
      console.error('Error removing cookie:', error);
    }
  }

  clear(): void {
    try {
      // Remove all cookies that match our prefix
      const allCookies = document.cookie.split(';');
      for (const cookie of allCookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(this.cookiePrefix)) {
          const key = trimmed.split('=')[0];
          Cookies.remove(key, { path: this.cookieOptions.path });
        }
      }
    } catch (error) {
      console.error('Error clearing cookies:', error);
    }
  }
}

