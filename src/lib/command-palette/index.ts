// Main command palette API
export { commandPaletteStore, isCommandPaletteOpen } from './store';
export { commandRegistry } from './registry';
export type { CommandContext, CommandAction, CommandCategory } from './types';

// Initialize the command palette with core commands
import { commandRegistry } from './registry';
import { coreCategories, coreCommands } from './commands/core';

// Register core categories
coreCategories.forEach(category => {
  commandRegistry.registerCategory(category);
});

// Register core commands
commandRegistry.registerMany(coreCommands);

// Export a function to initialize the command palette in the app
export function initializeCommandPalette() {
  // This can be extended to load additional command modules
  // or perform any other initialization tasks
  console.log('Command palette initialized with', coreCommands.length, 'commands');
} 
