import { writable, derived } from 'svelte/store';
import type { WaveJson, SignalItem } from './wavejson-types';

export interface HistoryState {
	waveformData: WaveJson;
	timestamp: number;
	description?: string;
}

interface HistoryStore {
	states: HistoryState[];
	currentIndex: number;
	maxStates: number;
}

const initialHistoryState: HistoryStore = {
	states: [],
	currentIndex: -1,
	maxStates: 50
};

// Create the history store
export const historyStore = writable<HistoryStore>(initialHistoryState);

// Track if store has been initialized
let isInitialized = false;

// Derived stores for undo/redo state
export const canUndo = derived(historyStore, ($history) => {
	return $history.currentIndex > 0;
});

export const canRedo = derived(historyStore, ($history) => {
	return $history.currentIndex < $history.states.length - 1;
});

// Helper function to compare signals
const compareSignals = (itemA: SignalItem | string, itemB: SignalItem | string): boolean => {
	if (Array.isArray(itemA) && Array.isArray(itemB)) {
		// Compare groups
		if (itemA.length !== itemB.length) return true;
		return itemA.some((subA, idx) => compareSignals(subA, itemB[idx]));
	} else if (itemA && itemB && typeof itemA === 'object' && typeof itemB === 'object') {
		// Compare signals
		if ('wave' in itemA && 'wave' in itemB) {
			// Compare actual wave strings - any character difference means they're different
			const waveA = itemA.wave;
			const waveB = itemB.wave;
			
			if (waveA === waveB) return false;
			if (waveA.length !== waveB.length) return true;
			
			// Compare each character - dots vs explicit values ARE different
			for (let i = 0; i < waveA.length; i++) {
				if (waveA[i] !== waveB[i]) return true;
			}
			
			return false;
		}
		
		// Compare other object properties
		return Object.keys({ ...itemA, ...itemB }).some(key => {
			const valA = (itemA as Record<string, SignalItem | string>)[key];
			const valB = (itemB as Record<string, SignalItem | string>)[key];
			return compareSignals(valA, valB);
		});
	}
	
	// Compare primitives
	return itemA !== itemB;
};

// Simplified state comparison function
const statesAreDifferent = (a: WaveJson, b: WaveJson): boolean => {
	if (!a || !b) return true;
	if (!a.signal || !b.signal || a.signal.length !== b.signal.length) return true;
	
	// Compare each signal
	for (let i = 0; i < a.signal.length; i++) {
		const signalA = a.signal[i];
		const signalB = b.signal[i];
		
		// Handle groups
		if (Array.isArray(signalA) || Array.isArray(signalB)) {
			if (!Array.isArray(signalA) || !Array.isArray(signalB)) return true;
			if (signalA.length !== signalB.length) return true;
			for (let j = 0; j < signalA.length; j++) {
				if (compareSignals(signalA[j], signalB[j])) return true;
			}
			continue;
		}
		
		// Handle spacers
		if ((!signalA || Object.keys(signalA).length === 0) || (!signalB || Object.keys(signalB).length === 0)) {
			if ((!signalA || Object.keys(signalA).length === 0) !== (!signalB || Object.keys(signalB).length === 0)) {
				return true;
			}
			continue;
		}
		
		// Compare regular signals
		if (compareSignals(signalA, signalB)) {
			return true;
		}
	}
	
	return false;
};

// Create a store action function to handle state changes
export function createHistoryActions(onChange: (waveformData: WaveJson) => void) {
	return {
		// Save a new state to history
		saveState: (waveformData: WaveJson, description?: string) => {
			historyStore.update(history => {
				// Create the new state
				const newState: HistoryState = {
					waveformData: structuredClone(waveformData),
					timestamp: Date.now(),
					description
				};

				// If this is the first state, just add it
				if (history.states.length === 0) {
					return {
						...history,
						states: [newState],
						currentIndex: 0
					};
				}

				// Check if we already have this exact state at the current index
				const currentState = history.states[history.currentIndex];
				if (currentState) {
					// Compare states by checking both the actual values and the wave string format
					const different = statesAreDifferent(currentState.waveformData, waveformData);

					if (!different) {
						// Don't save duplicate state
						return history;
					}
				}

				// Remove any states after current index (when undoing then making new changes)
				const newStates = history.states.slice(0, history.currentIndex + 1);
				
				// Add new state
				newStates.push(newState);
				
				let newIndex = newStates.length - 1;
				
				// Trim to max states if needed
				if (newStates.length > history.maxStates) {
					newStates.shift();
					newIndex = Math.max(0, newIndex - 1); // Adjust index when we remove a state
				}

				// Create a new history object to ensure reactivity
				const newHistory = {
					...history,
					states: newStates,
					currentIndex: newIndex
				};

				// Ensure the store is properly updated
				return newHistory;
			});
		},

		// Initialize history with first state
		initialize: (waveformData: WaveJson) => {
			if (isInitialized) {
				return;
			}
			// Clear any existing history first
			historyStore.set(initialHistoryState);

			// Then add the initial state
			const initialState: HistoryState = {
				waveformData: structuredClone(waveformData),
				timestamp: Date.now(),
				description: 'Initial state'
			};

			historyStore.update(history => {
				// Create a new history object to ensure reactivity
				const newHistory = {
					...history,
					states: [initialState],
					currentIndex: 0,
					maxStates: 50
				};
				isInitialized = true;
				return newHistory;
			});
		},

		// Undo to previous state
		undo: () => {
			let previousState: WaveJson | null = null;
			
			historyStore.update(history => {
				if (history.states.length > 0 && history.currentIndex > 0) {
					const newIndex = history.currentIndex - 1;
					const state = history.states[newIndex];
					previousState = structuredClone(state.waveformData);
					
					// Create a new history object to ensure reactivity
					return {
						...history,
						currentIndex: newIndex
					};
				} else {
					return history;
				}
			});

			if (previousState) {
				onChange(previousState);
			}
		},

		// Redo to next state
		redo: () => {
			let nextState: WaveJson | null = null;
			
			historyStore.update(history => {
				if (history.states.length > 0 && history.currentIndex < history.states.length - 1) {
					const newIndex = history.currentIndex + 1;
					const state = history.states[newIndex];
					nextState = structuredClone(state.waveformData);
					
					// Create a new history object to ensure reactivity
					return {
						...history,
						currentIndex: newIndex
					};
				} else {
					return history;
				}
			});

			if (nextState) {
				onChange(nextState);
			}
		}
	};
} 
