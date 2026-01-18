// Utility functions for managing favorites in localStorage (for logged-out users)

const LOCAL_FAVORITES_KEY = 'guestFavorites';

/**
 * Get all favorite dish IDs from localStorage
 */
export function getLocalFavorites(): string[] {
  try {
    const stored = localStorage.getItem(LOCAL_FAVORITES_KEY);
    if (stored) {
      const favorites = JSON.parse(stored);
      return Array.isArray(favorites) ? favorites : [];
    }
  } catch (error) {
    console.error('Error reading favorites from localStorage:', error);
  }
  return [];
}

/**
 * Save favorite dish IDs to localStorage
 */
export function saveLocalFavorites(favorites: string[]): void {
  try {
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving favorites to localStorage:', error);
  }
}

/**
 * Add a dish ID to favorites in localStorage
 */
export function addLocalFavorite(dishId: string): void {
  const favorites = getLocalFavorites();
  if (!favorites.includes(dishId)) {
    favorites.push(dishId);
    saveLocalFavorites(favorites);
  }
}

/**
 * Remove a dish ID from favorites in localStorage
 */
export function removeLocalFavorite(dishId: string): void {
  const favorites = getLocalFavorites();
  const updated = favorites.filter((id) => id !== dishId);
  saveLocalFavorites(updated);
}

/**
 * Check if a dish is in favorites (localStorage)
 */
export function isLocalFavorite(dishId: string): boolean {
  const favorites = getLocalFavorites();
  return favorites.includes(dishId);
}

/**
 * Clear all favorites from localStorage
 */
export function clearLocalFavorites(): void {
  try {
    localStorage.removeItem(LOCAL_FAVORITES_KEY);
  } catch (error) {
    console.error('Error clearing favorites from localStorage:', error);
  }
}

