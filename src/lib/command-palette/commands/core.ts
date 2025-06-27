import type { CommandAction, CommandCategory } from '../types';
import type { WaveGroup } from '$lib/wavejson-types';

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
  
  // Edit commands
  {
    id: 'set-high',
    title: 'Set to High (1)',
    description: 'Set selected cells to high state',
    category: 'edit',
    icon: '⬆️',
    keywords: ['high', '1', 'set'],
    shortcut: '1',
    isAvailable: (context) => context.selectedCells.length > 0,
    execute: async () => {
      // This would need to integrate with the actual signal update logic
      console.log('Setting selected cells to high');
    }
  },
  
  {
    id: 'set-low',
    title: 'Set to Low (0)',
    description: 'Set selected cells to low state',
    category: 'edit',
    icon: '⬇️',
    keywords: ['low', '0', 'set'],
    shortcut: '0',
    isAvailable: (context) => context.selectedCells.length > 0,
    execute: async () => {
      // This would need to integrate with the actual signal update logic
      console.log('Setting selected cells to low');
    }
  },
  
  {
    id: 'set-unknown',
    title: 'Set to Unknown (X)',
    description: 'Set selected cells to unknown state',
    category: 'edit',
    icon: '❓',
    keywords: ['unknown', 'x', 'undefined'],
    shortcut: 'x',
    isAvailable: (context) => context.selectedCells.length > 0,
    execute: async () => {
      console.log('Setting selected cells to unknown');
    }
  },
  
  {
    id: 'invert-selection',
    title: 'Invert Selection',
    description: 'Invert binary values in selected cells (0↔1)',
    category: 'edit',
    icon: '🔄',
    keywords: ['invert', 'toggle', 'flip'],
    shortcut: 'Ctrl+I',
    isAvailable: (context) => context.selectedCells.length > 0,
    execute: async () => {
      console.log('Inverting selected cells');
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
