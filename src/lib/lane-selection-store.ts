import { writable } from 'svelte/store';

// Global store for immediate lane selection updates
export const selectedLanes = writable<Set<number>>(new Set());

// Helper functions for immediate lane selection
export function selectLane(signalIndex: number) {
  selectedLanes.update(lanes => {
    const newLanes = new Set(lanes);
    newLanes.add(signalIndex);
    return newLanes;
  });
}

export function deselectLane(signalIndex: number) {
  selectedLanes.update(lanes => {
    const newLanes = new Set(lanes);
    newLanes.delete(signalIndex);
    return newLanes;
  });
}

export function toggleLane(signalIndex: number) {
  selectedLanes.update(lanes => {
    const newLanes = new Set(lanes);
    if (newLanes.has(signalIndex)) {
      newLanes.delete(signalIndex);
    } else {
      newLanes.add(signalIndex);
    }
    return newLanes;
  });
}

export function clearLaneSelection() {
  selectedLanes.set(new Set());
}

export function setSelectedLanes(signalIndices: number[]) {
  selectedLanes.set(new Set(signalIndices));
}

// Helper to check if a lane is selected (for use in components)
export function isLaneSelected(signalIndex: number, currentSelectedLanes: Set<number>): boolean {
  return currentSelectedLanes.has(signalIndex);
} 
