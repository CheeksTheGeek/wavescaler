import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

// Create the theme store
function createThemeStore() {
  // Check for saved theme preference or default to light
  const defaultTheme: Theme = 'light';
  const initialTheme = browser 
    ? (localStorage.getItem('theme') as Theme) || defaultTheme
    : defaultTheme;

  const { subscribe, set, update } = writable<Theme>(initialTheme);

  return {
    subscribe,
    setTheme: (theme: Theme) => {
      if (browser) {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
      set(theme);
    },
    toggleTheme: () => {
      update(currentTheme => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        if (browser) {
          localStorage.setItem('theme', newTheme);
          document.documentElement.setAttribute('data-theme', newTheme);
        }
        return newTheme;
      });
    },
    init: () => {
      if (browser) {
        document.documentElement.setAttribute('data-theme', initialTheme);
      }
    }
  };
}

export const themeStore = createThemeStore(); 
