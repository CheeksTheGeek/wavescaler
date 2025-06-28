import type { CommandAction, CommandCategory } from '../types';
import type { WaveGroup, WaveJson } from '$lib/wavejson-types';
import { themeStore } from '$lib/theme-store';

// Core command categories
export const coreCategories: CommandCategory[] = [
  {
    id: 'waveform',
    title: 'Waveform',
    icon: '📊',
    priority: 1
  },
  {
    id: 'selection',
    title: 'Selection',
    icon: '🎯',
    priority: 2
  },
  {
    id: 'edit',
    title: 'Edit',
    icon: '✏️',
    priority: 3
  },
  {
    id: 'view',
    title: 'View',
    icon: '👁️',
    priority: 4
  },
  {
    id: 'file',
    title: 'File',
    icon: '📁',
    priority: 5
  }
];

// Core commands
export const coreCommands: CommandAction[] = [
  // Waveform commands
  {
    id: 'add-signal',
    title: 'Add Signal',
    description: 'Add a new signal to the waveform',
    category: 'waveform',
    icon: '➕',
    keywords: ['signal', 'new', 'create'],
    shortcut: 'Ctrl+Shift+S',
    execute: async (context) => {
      const newSignal = {
        name: `sig${Date.now()}`,
        wave: '0..1..0.'
      };
      
      const newWaveJson = {
        ...context.waveformData,
        signal: [...context.waveformData.signal, newSignal]
      };
      
      context.setWaveformData(newWaveJson);
    }
  },
  
  {
    id: 'add-group',
    title: 'Add Group',
    description: 'Add a new signal group',
    category: 'waveform',
    icon: '📁',
    keywords: ['group', 'folder', 'organize'],
    shortcut: 'Ctrl+Shift+G',
    execute: async (context) => {
      const newGroup: WaveGroup = [
        `Group${Date.now()}`,
        {
          name: 'sig',
          wave: '0..1..0.'
        }
      ];
      
      const newWaveJson = {
        ...context.waveformData,
        signal: [...context.waveformData.signal, newGroup]
      };
      
      context.setWaveformData(newWaveJson);
    }
  },
  
  {
    id: 'add-spacer',
    title: 'Add Spacer',
    description: 'Add a spacer line for visual separation',
    category: 'waveform',
    icon: '➖',
    keywords: ['spacer', 'separator', 'divider'],
    execute: async (context) => {
      const newWaveJson = {
        ...context.waveformData,
        signal: [...context.waveformData.signal, {}]
      };
      
      context.setWaveformData(newWaveJson);
    }
  },
  
  // Selection commands
  {
    id: 'clear-selection',
    title: 'Clear Selection',
    description: 'Clear all selected cells and lanes',
    category: 'selection',
    icon: '🗑️',
    keywords: ['clear', 'deselect', 'none'],
    shortcut: 'Escape',
    isAvailable: (context) => context.selectedCells.length > 0 || context.selectedLanes.size > 0,
    execute: async (context) => {
      context.clearSelection();
      context.clearLaneSelection();
    }
  },
  
  {
    id: 'select-all-signals',
    title: 'Select All Signals',
    description: 'Select all signal lanes',
    category: 'selection',
    icon: '📋',
    keywords: ['select', 'all', 'signals'],
    shortcut: 'Ctrl+A',
    execute: async (context) => {
      // This would need to be implemented with access to the signal count
      // For now, just clear current selection
      context.clearSelection();
    }
  },
  
  // Edit commands - Note: Set value commands are handled by SelectionToolbar component
  
  {
    id: 'explicitate-selection',
    title: 'Explicitate Selection',
    description: 'Convert implicit cells (.) to explicit values',
    category: 'edit',
    icon: '📤',
    keywords: ['explicitate', 'expand', 'dots', 'implicit', 'explicit'],
    shortcut: 'Ctrl+E',
    isAvailable: (context) => context.selectedCells.length > 0,
    execute: async (context) => {
      // Find and apply explicitate to selected cells
      context.selectedCells.forEach(cell => {
        const signal = context.getSignalAtIndex(cell.signalIndex);
        if (signal) {
          const waveChars = signal.wave.split('');
          
          // Only process this specific cell if it's implicit
          if (cell.cycleIndex < waveChars.length && waveChars[cell.cycleIndex] === '.') {
            // Find the effective character for this specific cell
            let effectivePrevChar: string | null = null;
            
            // Look backwards to find the last non-dot character
            for (let i = cell.cycleIndex - 1; i >= 0; i--) {
              if (waveChars[i] !== '.') {
                effectivePrevChar = waveChars[i];
                break;
              }
            }
            
            // Replace only this specific dot with the effective character
            if (effectivePrevChar) {
              waveChars[cell.cycleIndex] = effectivePrevChar;
              
              const newSignal = { ...signal, wave: waveChars.join('') };
              context.updateSignalAtIndex(cell.signalIndex, newSignal);
            }
          }
        }
      });
      
      // Trigger reactivity
      context.setWaveformData(context.waveformData);
    }
  },
  
  {
    id: 'implicitate-selection',
    title: 'Implicitate Selection', 
    description: 'Convert explicit cells to implicit dots (.)',
    category: 'edit',
    icon: '📥',
    keywords: ['implicitate', 'collapse', 'dots', 'implicit', 'explicit'],
    shortcut: 'Ctrl+I',
    isAvailable: (context) => context.selectedCells.length > 0,
    execute: async (context) => {
      // Find and apply implicitate to selected cells
      context.selectedCells.forEach(cell => {
        const signal = context.getSignalAtIndex(cell.signalIndex);
        if (signal) {
          const waveChars = signal.wave.split('');
          
          // Only process this specific cell if it's explicit and can be collapsed
          if (cell.cycleIndex < waveChars.length && waveChars[cell.cycleIndex] !== '.') {
            const currentChar = waveChars[cell.cycleIndex];
            
            // Skip empty characters
            if (currentChar === '') return;
            
            // Can implicitate any cell after the first one (index > 0)
            if (cell.cycleIndex > 0) {
              // Special handling for data signals - don't collapse data values
              if (!['=', '2', '3', '4', '5'].includes(currentChar)) {
                // Safe to collapse this character to a dot
                waveChars[cell.cycleIndex] = '.';
                
                const newSignal = { ...signal, wave: waveChars.join('') };
                context.updateSignalAtIndex(cell.signalIndex, newSignal);
              }
            }
          }
        }
      });
      
      // Trigger reactivity
      context.setWaveformData(context.waveformData);
    }
  },
  
  // View commands
  {
    id: 'zoom-in',
    title: 'Zoom In',
    description: 'Increase horizontal scale',
    category: 'view',
    icon: '🔍',
    keywords: ['zoom', 'scale', 'magnify'],
    shortcut: 'Ctrl+🐭↓',
    execute: async (context) => {
      const currentScale = context.waveformData.config?.hscale || 1;
      const newScale = Math.min(currentScale + 0.25, 3);
      
      const newWaveJson = {
        ...context.waveformData,
        config: {
          ...context.waveformData.config,
          hscale: newScale
        }
      };
      
      context.setWaveformData(newWaveJson);
    }
  },
  
  {
    id: 'zoom-out',
    title: 'Zoom Out',
    description: 'Decrease horizontal scale',
    category: 'view',
    icon: '🔍',
    keywords: ['zoom', 'scale', 'shrink'],
    shortcut: 'Ctrl+🐭↑',
    execute: async (context) => {
      const currentScale = context.waveformData.config?.hscale || 1;
      const newScale = Math.max(currentScale - 0.25, 0.25);
      
      const newWaveJson = {
        ...context.waveformData,
        config: {
          ...context.waveformData.config,
          hscale: newScale
        }
      };
      
      context.setWaveformData(newWaveJson);
    }
  },
  
  {
    id: 'reset-zoom',
    title: 'Reset Zoom',
    description: 'Reset horizontal scale to 1x',
    category: 'view',
    icon: '🎯',
    keywords: ['reset', 'zoom', 'default'],
    shortcut: 'Ctrl+0',
    execute: async (context) => {
      const newWaveJson = {
        ...context.waveformData,
        config: {
          ...context.waveformData.config,
          hscale: 1
        }
      };
      
      context.setWaveformData(newWaveJson);
    }
  },
  
  {
    id: 'toggle-theme',
    title: 'Toggle Theme',
    description: 'Switch between light and dark mode',
    category: 'view',
    icon: '🌓',
    keywords: ['theme', 'dark', 'light', 'mode'],
    shortcut: 'Ctrl+Shift+T',
    execute: async () => {
      themeStore.toggleTheme();
    }
  },
  
  // History commands
  {
    id: 'undo',
    title: 'Undo',
    description: 'Undo the last action',
    category: 'edit',
    icon: '↶',
    keywords: ['undo', 'revert', 'back'],
    shortcut: 'Ctrl+U',
    execute: async (context) => {
      // Import history actions dynamically
      const { historyStore } = await import('$lib/history-store');
      let previousState: WaveJson | null = null;
      historyStore.update(history => {
        if (history.currentIndex > 0) {
          previousState = history.states[history.currentIndex - 1].waveformData;
          return {
            ...history,
            currentIndex: history.currentIndex - 1
          };
        }
        return history;
      });
      if (previousState) {
        context.setWaveformData(previousState);
        context.clearSelection();
      }
    }
  },

  {
    id: 'redo',
    title: 'Redo',
    description: 'Redo the last undone action',
    category: 'edit',
    icon: '↷',
    keywords: ['redo', 'forward', 'restore'],
    shortcut: 'Ctrl+R',
    execute: async (context) => {
      // Import history actions dynamically
      const { historyStore } = await import('$lib/history-store');
      let nextState: WaveJson | null = null;
      historyStore.update(history => {
        if (history.currentIndex < history.states.length - 1) {
          nextState = history.states[history.currentIndex + 1].waveformData;
          return {
            ...history,
            currentIndex: history.currentIndex + 1
          };
        }
        return history;
      });
      if (nextState) {
        context.setWaveformData(nextState);
        context.clearSelection();
      }
    }
  },
  
  // File commands
  {
    id: 'clear-waveform',
    title: 'Clear Waveform',
    description: 'Remove all signals and start fresh',
    category: 'file',
    icon: '🗑️',
    keywords: ['clear', 'delete', 'empty', 'new'],
    execute: async (context) => {
      const newWaveJson = {
        signal: [],
        config: { hscale: 1 }
      };
      
      context.setWaveformData(newWaveJson);
      context.clearSelection();
      context.clearLaneSelection();
    }
  }
]; 
