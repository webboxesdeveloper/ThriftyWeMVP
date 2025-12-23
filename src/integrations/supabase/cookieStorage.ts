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
      expires: cookieOptions?.expires || 365,
      path: cookieOptions?.path || '/',
      secure: cookieOptions?.secure ?? (window.location.protocol === 'https:'),
      sameSite: cookieOptions?.sameSite || 'lax',
      ...cookieOptions,
    };
  }

  get length(): number {
    let count = 0;
    const allCookies = document.cookie.split(';');
    const seenKeys = new Set<string>();
    
    for (const cookie of allCookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(this.cookiePrefix)) {
        const key = trimmed.split('=')[0].trim();
        if (!key.endsWith('_storage')) {
          seenKeys.add(key);
          count++;
        }
      }
    }
    
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.cookiePrefix) && !seenKeys.has(key)) {
          count++;
        }
      }
    } catch {
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
      const cookieValue = Cookies.get(key);
      if (cookieValue) {
        return cookieValue;
      }
      
      const storageMarker = Cookies.get(`${key}_storage`);
      
      if (storageMarker === 's') {
        try {
          const sessionValue = sessionStorage.getItem(key);
          if (sessionValue) {
            return sessionValue;
          }
        } catch {
        }
      } else if (storageMarker === 'l') {
        try {
          const localValue = localStorage.getItem(key);
          if (localValue) {
            return localValue;
          }
        } catch {
        }
      } else {
        try {
          const sessionValue = sessionStorage.getItem(key);
          if (sessionValue) {
            return sessionValue;
          }
        } catch {
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      const MAX_COOKIE_SIZE = 4000;
      
      if (value.length > MAX_COOKIE_SIZE) {
        try {
          sessionStorage.setItem(key, value);
          try {
            Cookies.set(`${key}_storage`, 's', { 
              ...this.cookieOptions,
              expires: 365 // Same expiry as main token
            });
          } catch {
          }
        } catch (fallbackError) {
          try {
            localStorage.setItem(key, value);
            try {
              Cookies.set(`${key}_storage`, 'l', { 
                ...this.cookieOptions,
                expires: 365
              });
            } catch {
            }
          } catch (localError) {
            throw localError;
          }
        }
      } else {
        try {
          Cookies.set(key, value, this.cookieOptions);
          try {
            Cookies.remove(`${key}_storage`, { path: this.cookieOptions.path });
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
          } catch {
          }
        } catch (cookieError) {
          sessionStorage.setItem(key, value);
          try {
            Cookies.set(`${key}_storage`, 's', { 
              ...this.cookieOptions,
              expires: 365
            });
          } catch {
          }
        }
      }
    } catch (error) {
    }
  }

  removeItem(key: string): void {
    try {
      Cookies.remove(key, { path: this.cookieOptions.path });
      Cookies.remove(`${key}_storage`, { path: this.cookieOptions.path });
      try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } catch {
      }
    } catch (error) {
    }
  }

  clear(): void {
    try {
      const allCookies = document.cookie.split(';');
      for (const cookie of allCookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(this.cookiePrefix)) {
          const key = trimmed.split('=')[0];
          Cookies.remove(key, { path: this.cookieOptions.path });
        }
      }
    } catch (error) {
    }
  }
}

