import type { WaveJson, WaveSignal } from '$lib/wavejson-types';

export interface CellSelection {
  signalIndex: number;
  cycleIndex: number;
  signalName: string;
}

export interface CommandContext {
  // Waveform data and manipulation
  waveformData: WaveJson;
  setWaveformData: (data: WaveJson) => void;
  
  // Selection state
  selectedCells: CellSelection[];
  clearSelection: () => void;
  
  // Lane selection store
  selectedLanes: Set<number>;
  clearLaneSelection: () => void;
  
  // UI state
  isCommandPaletteOpen: boolean;
  closeCommandPalette: () => void;
  
  // Utility functions
  getSignalAtIndex: (index: number) => WaveSignal | null;
  updateSignalAtIndex: (index: number, signal: WaveSignal) => void;
}

export interface CommandAction {
  id: string;
  title: string;
  description?: string;
  category: string;
  icon?: string;
  keywords?: string[];
  shortcut?: string;
  
  // Execution
  execute: (context: CommandContext, args?: Record<string, unknown>) => Promise<void> | void;
  
  // Conditional availability
  isAvailable?: (context: CommandContext) => boolean;
  
  // Dynamic properties
  getDynamicTitle?: (context: CommandContext) => string;
  getDynamicDescription?: (context: CommandContext) => string;
}

export interface CommandCategory {
  id: string;
  title: string;
  icon?: string;
  priority: number; // Lower numbers appear first
}

export interface CommandPaletteState {
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  filteredCommands: CommandAction[];
  categories: CommandCategory[];
}

export type CommandExecutionResult = {
  success: boolean;
  message?: string;
  error?: string;
}; 
