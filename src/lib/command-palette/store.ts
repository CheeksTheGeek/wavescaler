import { writable, derived, get } from 'svelte/store';
import type { CommandPaletteState, CommandAction, CommandContext } from './types';
import { commandRegistry } from './registry';

// Create the base state store
const createCommandPaletteStore = () => {
  const initialState: CommandPaletteState = {
    isOpen: false,
    searchQuery: '',
    selectedIndex: 0,
    filteredCommands: [],
    categories: []
  };

  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,
    
    // Open the command palette
    open: (context?: CommandContext) => update(state => {
      const newState = {
        ...state,
        isOpen: true,
        searchQuery: '',
        selectedIndex: 0
      };
      
      // Initialize commands if context is provided
      if (context) {
        newState.filteredCommands = commandRegistry.getAvailableCommands(context);
        newState.categories = commandRegistry.getCategories();
      }
      
      return newState;
    }),
    
    // Close the command palette
    close: () => update(state => ({
      ...state,
      isOpen: false,
      searchQuery: '',
      selectedIndex: 0,
      filteredCommands: []
    })),
    
    // Toggle the command palette
    toggle: (context?: CommandContext) => update(state => {
      const newIsOpen = !state.isOpen;
      const newState = {
        ...state,
        isOpen: newIsOpen,
        searchQuery: newIsOpen ? '' : state.searchQuery,
        selectedIndex: 0
      };
      
      // Initialize commands if opening and context is provided
      if (newIsOpen && context) {
        newState.filteredCommands = commandRegistry.getAvailableCommands(context);
        newState.categories = commandRegistry.getCategories();
      }
      
      return newState;
    }),
    
    // Update search query and filter commands
    setSearchQuery: (query: string, context: CommandContext) => update(state => {
      const filteredCommands = commandRegistry.searchCommands(query, context);
      return {
        ...state,
        searchQuery: query,
        selectedIndex: 0, // Reset selection to first item
        filteredCommands
      };
    }),
    
    // Navigate selection
    selectNext: () => update(state => ({
      ...state,
      selectedIndex: Math.min(state.selectedIndex + 1, state.filteredCommands.length - 1)
    })),
    
    selectPrevious: () => update(state => ({
      ...state,
      selectedIndex: Math.max(state.selectedIndex - 1, 0)
    })),
    
    // Set specific selection index
    setSelectedIndex: (index: number) => update(state => ({
      ...state,
      selectedIndex: Math.max(0, Math.min(index, state.filteredCommands.length - 1))
    })),
    
    // Get currently selected command
    getSelectedCommand: (): CommandAction | null => {
      const state = get({ subscribe });
      return state.filteredCommands[state.selectedIndex] || null;
    },
    
    // Initialize with context (load all commands)
    initialize: (context: CommandContext) => update(state => ({
      ...state,
      filteredCommands: commandRegistry.getAvailableCommands(context),
      categories: commandRegistry.getCategories()
    })),
    
    // Reset state
    reset: () => set(initialState)
  };
};

// Export the store instance
export const commandPaletteStore = createCommandPaletteStore();

// Derived store for easy access to current state
export const isCommandPaletteOpen = derived(
  commandPaletteStore,
  $store => $store.isOpen
);

export const currentSearchQuery = derived(
  commandPaletteStore,
  $store => $store.searchQuery
);

export const filteredCommands = derived(
  commandPaletteStore,
  $store => $store.filteredCommands
);

export const selectedCommandIndex = derived(
  commandPaletteStore,
  $store => $store.selectedIndex
); 
