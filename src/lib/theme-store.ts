import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'auto' | 'light' | 'dark';

// Create the theme store
function createThemeStore() {
  // Check for saved theme preference or default to auto
  const defaultTheme: Theme = 'auto';
  const initialTheme = browser 
    ? (localStorage.getItem('theme') as Theme) || defaultTheme
    : defaultTheme;

  const { subscribe, set, update } = writable<Theme>(initialTheme);

  // Helper function to get the effective theme (resolves 'auto' to actual theme)
  function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'auto') {
      return browser && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }

  // Helper function to apply theme to DOM
  function applyTheme(theme: Theme) {
    if (browser) {
      const effectiveTheme = getEffectiveTheme(theme);
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      localStorage.setItem('theme', theme);
    }
  }

  // Listen for system theme changes when in auto mode
  if (browser) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      // Re-apply current theme to pick up system changes
      update(currentTheme => {
        if (currentTheme === 'auto') {
          applyTheme(currentTheme);
        }
        return currentTheme;
      });
    });
  }

  return {
    subscribe,
    setTheme: (theme: Theme) => {
      applyTheme(theme);
      set(theme);
    },
    cycleTheme: () => {
      update(currentTheme => {
        const themeOrder: Theme[] = ['auto', 'light', 'dark'];
        const currentIndex = themeOrder.indexOf(currentTheme);
        const newTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
        applyTheme(newTheme);
        return newTheme;
      });
    },
    // Keep the old toggleTheme for backward compatibility
    toggleTheme: () => {
      update(currentTheme => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        return newTheme;
      });
    },
    init: () => {
      if (browser) {
        applyTheme(initialTheme);
      }
    },
    getEffectiveTheme
  };
}

export const themeStore = createThemeStore(); 
