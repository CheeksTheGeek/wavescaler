<script lang="ts">
	import WaveformDiagram from '$lib/components/WaveformDiagram.svelte';
	import WaveformToolbar from '$lib/components/WaveformToolbar.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import SelectionPopup from '$lib/components/SelectionPopup.svelte';
	import SelectionToolbar from '$lib/components/SelectionToolbar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import CycleContextMenu from '$lib/components/CycleContextMenu.svelte';
	import MonacoWaveJsonEditor from '$lib/components/MonacoWaveJsonEditor.svelte';
	import type { WaveJson, WaveSignal, WaveGroup, SignalItem } from '$lib/wavejson-types';
	import { clearLaneSelection, selectedLanes } from '$lib/lane-selection-store';
	import { initializeCommandPalette, commandPaletteStore } from '$lib/command-palette';
	import type { CommandContext } from '$lib/command-palette/types';
	import { createHistoryActions, canUndo, canRedo } from '$lib/history-store';
	import { onMount } from 'svelte';

	// Sample WaveJSON data for demonstration
	let waveformData: WaveJson = {
		signal: [
			{ name: 'clk', wave: 'p.......' },
			{ name: 'bus', wave: 'x.==.=x.', data: ['head', 'body', 'tail', 'data'] },
			{ name: 'wire', wave: '0.1..0.1' },
			{},
			['CPU', 
				{ name: 'UPC', wave: '01.0....' },
				{ name: 'IPC', wave: '0...1..0' },
				{ name: 'PPC', wave: '0..10..1' }
			],
			{},
			{ name: 'reset', wave: '1.0.....' }
		],
		config: { hscale: 1 }
	};

	// Create history actions with a callback to update waveformData
	const history = createHistoryActions((newData) => {
		waveformData = newData;
		clearSelection(); // Clear selection after undo/redo
	});

	// Initialize history store on mount
	onMount(() => {
		// Initialize command palette
		initializeCommandPalette();

		// Initialize history with initial state
		history.initialize(waveformData);
	});

	// Helper function to save state to history
	function saveStateToHistory(description: string) {
		history.saveState(waveformData, description);
	}

	// Selection state
	interface CellSelection {
		signalIndex: number;
		cycleIndex: number;
		signalName: string;
	}

	let selectedCells: CellSelection[] = [];
	let isShiftSelecting = false;
	let lastSelectedCell: CellSelection | null = null;

	// Context menu state
	let contextMenuVisible = false;
	let contextMenuX = 0;
	let contextMenuY = 0;
	let contextMenuSignalName = '';
	let contextMenuSignalIndex = 0;
	let contextMenuCycleIndex = 0;
	let contextMenuCurrentValue = '';
	let contextMenuIsImplicit = false;
	let contextMenuIsExplicit = false;

	// Monaco editor state
	let editorVisible = false;

	function handleAddSignal(event: CustomEvent<{ signal: WaveSignal }>) {
		saveStateToHistory('Add signal');
		waveformData = {
			...waveformData,
			signal: [...waveformData.signal, event.detail.signal]
		};
	}

	function handleAddGroup(event: CustomEvent<{ group: WaveGroup }>) {
		saveStateToHistory('Add group');
		waveformData = {
			...waveformData,
			signal: [...waveformData.signal, event.detail.group]
		};
	}

	function handleAddSpacer() {
		saveStateToHistory('Add spacer');
		waveformData = {
			...waveformData,
			signal: [...waveformData.signal, {}]
		};
	}

	function handleClear() {
		saveStateToHistory('Clear waveform');
		waveformData = {
			signal: [],
			config: { hscale: 1 }
		};
	}

	function handleExport(event: CustomEvent<{ format: 'json' | 'svg' | 'png' | 'jpeg' }>) {
		const { format } = event.detail;
		
		if (format === 'json') {
			const dataStr = JSON.stringify(waveformData, null, 2);
			const dataBlob = new Blob([dataStr], { type: 'application/json' });
			const url = URL.createObjectURL(dataBlob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'waveform.json';
			link.click();
			URL.revokeObjectURL(url);
		} else {
			// For image formats, we need to capture the waveform diagram
			const waveformElement = document.querySelector('.waveform-container') as HTMLElement;
			if (!waveformElement) return;

			// Use html-to-image library for high-quality image export
			import('html-to-image').then(async (htmlToImage) => {
				try {
					let imageData: string;
					const options = {
						backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface-1'),
						style: {
							// Ensure scrollbars are hidden during capture
							overflow: 'hidden',
							// Add some padding
							padding: '20px'
						}
					};

					switch (format) {
						case 'svg':
							imageData = await htmlToImage.toSvg(waveformElement, options);
							downloadFile(imageData, 'waveform.svg', 'image/svg+xml');
							break;
						case 'png':
							imageData = await htmlToImage.toPng(waveformElement, options);
							downloadFile(imageData, 'waveform.png', 'image/png');
							break;
						case 'jpeg':
							imageData = await htmlToImage.toJpeg(waveformElement, {
								...options,
								quality: 0.95
							});
							downloadFile(imageData, 'waveform.jpg', 'image/jpeg');
							break;
					}
				} catch (error) {
					console.error('Error exporting image:', error);
					alert('Failed to export image. Please try again.');
				}
			});
		}
	}

	function downloadFile(data: string, filename: string, mimeType: string) {
		const link = document.createElement('a');
		link.href = data;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function handleImport(event: CustomEvent<{ waveJson: WaveJson }>) {
		saveStateToHistory('Import waveform');
		waveformData = event.detail.waveJson;
	}

	function handleSignalChange(event: CustomEvent<{ signalIndex: number; newSignal: WaveSignal }>) {
		const { signalIndex, newSignal } = event.detail;
		if (waveformData.signal[signalIndex]) {
			// Create new waveform data first
			const newWaveformData = {
				...waveformData,
				signal: waveformData.signal.map((item, idx) => 
					idx === signalIndex ? newSignal : item
				)
			};
			
			// Only save state and update if the data actually changed
			const currentStr = JSON.stringify(waveformData);
			const newStr = JSON.stringify(newWaveformData);
			if (currentStr !== newStr) {
				saveStateToHistory('Modify signal');
				waveformData = newWaveformData;
			}
		}
	}

	function handleStructureChange(event: CustomEvent<{ newWaveJson: WaveJson }>) {
		// Only save state if the new data is actually different
		const currentStr = JSON.stringify(waveformData);
		const newStr = JSON.stringify(event.detail.newWaveJson);
		if (currentStr !== newStr) {
			saveStateToHistory('Structure change');
			waveformData = event.detail.newWaveJson;
		}
	}

	// Selection management functions
	function handleCellSelection(event: CustomEvent<{ signalIndex: number; cycleIndex: number; shiftKey: boolean }>) {
		const { signalIndex, cycleIndex, shiftKey } = event.detail;
		
		// Get signal name
		const signal = getSignalAtIndex(signalIndex);
		if (!signal) {
			console.warn('Could not find signal at index:', signalIndex);
			return;
		}
		
		const newCell: CellSelection = {
			signalIndex,
			cycleIndex,
			signalName: signal.name
		};

		if (shiftKey) {
			// Multi-selection mode
			isShiftSelecting = true;
			if (lastSelectedCell) {
				// Extend selection from last selected cell to new cell
				selectedCells = getSelectionRange(lastSelectedCell, newCell);
			} else {
				// No previous selection, start multi-selection with this cell
				selectedCells = [newCell];
				lastSelectedCell = newCell;
			}
		} else {
			// Single selection mode - replace any existing selection
			isShiftSelecting = false;
			selectedCells = [newCell];
			lastSelectedCell = newCell;
		}
		
		// Force reactivity update
		selectedCells = selectedCells;
	}

	function handleLaneSelection(event: CustomEvent<{ signalIndex: number; signalName: string; shiftKey: boolean }>) {
		const { signalIndex, signalName, shiftKey } = event.detail;
		
		// Create selection for all cycles in this lane
		const laneSelection: CellSelection[] = [];
		
		// Calculate the maximum cycles for this signal
		const signal = getSignalAtIndex(signalIndex);
		if (!signal) {
			console.warn('Could not find signal at index:', signalIndex);
			return;
		}
		
		// Select all cycles in the signal's wave
		const waveLength = signal.wave.length;
		for (let cycleIndex = 0; cycleIndex < Math.max(waveLength, 8); cycleIndex++) {
			laneSelection.push({
				signalIndex,
				cycleIndex,
				signalName
			});
		}

		if (shiftKey && selectedCells.length > 0) {
			// Add to existing selection
			const existingSignalIndices = new Set(selectedCells.map(cell => cell.signalIndex));
			if (existingSignalIndices.has(signalIndex)) {
				// Remove this signal's cells if already selected
				selectedCells = selectedCells.filter(cell => cell.signalIndex !== signalIndex);
			} else {
				// Add this signal's cells to selection
				selectedCells = [...selectedCells, ...laneSelection];
			}
		} else {
			// Replace selection with this lane
			selectedCells = laneSelection;
			lastSelectedCell = laneSelection[0] || null;
		}
		
		// Force reactivity update
		selectedCells = selectedCells;
		
		// Note: Lane highlighting is now handled by the global store in the components themselves
	}

	function handleGroupSelection(event: CustomEvent<{ groupName: string; signalIndices: number[]; shiftKey: boolean }>) {
		const { groupName, signalIndices, shiftKey } = event.detail;
		
		// Create selection for all cycles in all signals within the group
		const groupSelection: CellSelection[] = [];
		
		for (const signalIndex of signalIndices) {
			const signal = getSignalAtIndex(signalIndex);
			if (signal) {
				// Select all cycles in this signal's wave
				const waveLength = signal.wave.length;
				for (let cycleIndex = 0; cycleIndex < Math.max(waveLength, 8); cycleIndex++) {
					groupSelection.push({
						signalIndex,
						cycleIndex,
						signalName: signal.name
					});
				}
			}
		}

		if (shiftKey && selectedCells.length > 0) {
			// Toggle group selection - if any signal in the group is selected, remove all group signals
			const existingSignalIndices = new Set(selectedCells.map(cell => cell.signalIndex));
			const hasAnyGroupSignal = signalIndices.some(index => existingSignalIndices.has(index));
			
			if (hasAnyGroupSignal) {
				// Remove all group signals from selection
				selectedCells = selectedCells.filter(cell => !signalIndices.includes(cell.signalIndex));
			} else {
				// Add all group signals to selection
				selectedCells = [...selectedCells, ...groupSelection];
			}
		} else {
			// Replace selection with this group
			selectedCells = groupSelection;
			lastSelectedCell = groupSelection[0] || null;
		}
		
		// Force reactivity update
		selectedCells = selectedCells;
		
		// Note: Lane highlighting is handled by the global store in the components
	}

	function getSignalAtIndex(index: number): WaveSignal | null {
		// Helper to get signal from potentially nested structure - matches WaveformDiagram.createSignalIndexMap logic
		let currentIndex = 0;
		
		function processItems(itemList: SignalItem[]): WaveSignal | null {
			for (const item of itemList) {
				if (Array.isArray(item)) {
					// It's a group - process its children recursively
					const result = processItems(item.slice(1) as SignalItem[]);
					if (result) return result;
				} else if (item && typeof item === 'object' && 'name' in item) {
					// It's a signal
					if (currentIndex === index) {
						return item as WaveSignal;
					}
					currentIndex++;
				} else {
					// It's a spacer or unknown - still counts for indexing
					currentIndex++;
				}
			}
			return null;
		}
		
		return processItems(waveformData.signal);
	}

	function getSelectionRange(start: CellSelection, end: CellSelection): CellSelection[] {
		const range: CellSelection[] = [];
		
		const minSignal = Math.min(start.signalIndex, end.signalIndex);
		const maxSignal = Math.max(start.signalIndex, end.signalIndex);
		const minCycle = Math.min(start.cycleIndex, end.cycleIndex);
		const maxCycle = Math.max(start.cycleIndex, end.cycleIndex);

		for (let signalIdx = minSignal; signalIdx <= maxSignal; signalIdx++) {
			const signal = getSignalAtIndex(signalIdx);
			if (signal) {
				for (let cycleIdx = minCycle; cycleIdx <= maxCycle; cycleIdx++) {
					range.push({
						signalIndex: signalIdx,
						cycleIndex: cycleIdx,
						signalName: signal.name
					});
				}
			}
		}
		
		return range;
	}

	function clearSelection() {
		selectedCells = [];
		lastSelectedCell = null;
		isShiftSelecting = false;
		clearLaneSelection(); // Clear global lane selection
	}

	// Make the isCellSelected function reactive
	$: isCellSelected = (signalIndex: number, cycleIndex: number): boolean => {
		return selectedCells.some(cell => 
			cell.signalIndex === signalIndex && cell.cycleIndex === cycleIndex
		);
	};

	// Note: Lane selection is now handled by the global store

	// Generate selection description for popup
	$: selectionDescription = getSelectionDescription();

	function getSelectionDescription(): string {
		if (selectedCells.length === 0) return '';
		
		if (selectedCells.length === 1) {
			const cell = selectedCells[0];
			return `Cycle ${cell.cycleIndex} selected on Signal '${cell.signalName}'`;
		}

		// Multiple selection
		const signalNames = [...new Set(selectedCells.map(cell => cell.signalName))];
		const cycles = [...new Set(selectedCells.map(cell => cell.cycleIndex))];
		
		if (signalNames.length === 1) {
			// Same signal, multiple cycles
			const minCycle = Math.min(...cycles);
			const maxCycle = Math.max(...cycles);
			return `Cycles ${minCycle}-${maxCycle} selected on Signal '${signalNames[0]}'`;
		} else if (cycles.length === 1) {
			// Same cycle, multiple signals
			return `Cycle ${cycles[0]} selected on ${signalNames.length} signals`;
		} else {
			// Mixed selection
			return `${selectedCells.length} cells selected across ${signalNames.length} signals`;
		}
	}

	// Selection toolbar action handlers
	function handleSelectionAction(event: CustomEvent) {
		const action = event.type;
		
		switch (action) {
			case 'setvalue':
				applyValueToSelection(event.detail.value);
				break;
			case 'copy':
				copySelection();
				break;
			case 'paste':
				pasteToSelection();
				break;
			case 'delete':
				deleteSelection();
				break;
			case 'duplicate':
				duplicateSelection();
				break;
			case 'invert':
				invertSelection();
				break;
			case 'clear':
				clearSelection();
				break;
			case 'explicitate':
				explicitateSelection();
				break;
			case 'implicitate':
				implicitateSelection();
				break;
		}
	}

	function applyValueToSelection(value: string) {
		// Save state before making changes
		saveStateToHistory('Apply value to selection');
		
		// Create a new waveform state by applying the value to each selected cell
		let newWaveformData = { ...waveformData };
		
		selectedCells.forEach(cell => {
			const signal = getSignalAtIndex(cell.signalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				
				// Extend wave if necessary
				while (waveChars.length <= cell.cycleIndex) {
					waveChars.push('');
				}
				
				// Set the value
				waveChars[cell.cycleIndex] = value;
				
				// Create the new signal
				const newSignal = { ...signal, wave: waveChars.join('') };
				
				// Update the waveform data structure recursively
				newWaveformData = updateSignalInWaveformData(newWaveformData, cell.signalIndex, newSignal);
			}
		});
		
		// Update the waveform data
		waveformData = newWaveformData;
	}

	// Helper function to update a signal in the waveform data structure
	function updateSignalInWaveformData(waveformData: WaveJson, signalIndex: number, newSignal: WaveSignal): WaveJson {
		let currentIndex = 0;
		
		function processItems(itemList: SignalItem[]): SignalItem[] {
			return itemList.map(item => {
				if (Array.isArray(item)) {
					// It's a group - process its children recursively
					return [item[0], ...processItems(item.slice(1) as SignalItem[])] as WaveGroup;
				} else if (item && typeof item === 'object' && 'name' in item) {
					// It's a signal
					if (currentIndex === signalIndex) {
						currentIndex++;
						return newSignal;
					}
					currentIndex++;
					return item;
				} else {
					// It's a spacer or unknown - still counts for indexing
					currentIndex++;
					return item;
				}
			});
		}
		
		return {
			...waveformData,
			signal: processItems(waveformData.signal)
		};
	}

	function updateSignalAtIndex(index: number, newSignal: WaveSignal) {
		// Only save state if the signal is actually different
		const currentSignal = getSignalAtIndex(index);
		if (!currentSignal || JSON.stringify(currentSignal) === JSON.stringify(newSignal)) return;

		// Create a new waveform state
		const newWaveformData = {
			...waveformData,
			signal: waveformData.signal.map((item, idx) => {
				if (Array.isArray(item)) {
					// Handle group
					return item.map((subItem, subIdx) => {
						if (subIdx === 0) return subItem; // Group name
						const subIndex = getSignalFlatIndex(idx, subIdx - 1);
						return subIndex === index ? newSignal : subItem;
					});
				} else {
					// Handle signal or spacer
					const flatIndex = getSignalFlatIndex(idx);
					return flatIndex === index ? newSignal : item;
				}
			})
		} as WaveJson;
		
		// Save state before updating waveform data
		saveStateToHistory('Update signal');
		waveformData = newWaveformData;
	}

	function copySelection() {
		// TODO: Implement copy functionality
	}

	function pasteToSelection() {
		// TODO: Implement paste functionality
	}

	function deleteSelection() {
		saveStateToHistory('Delete selection');
		applyValueToSelection('');
	}

	function duplicateSelection() {
		// TODO: Implement duplicate functionality
	}

	function invertSelection() {
		saveStateToHistory('Invert selection');
		
		// Create a new waveform state
		const newWaveformData = {
			...waveformData,
			signal: waveformData.signal.map((item, idx) => {
				if (Array.isArray(item)) {
					// Handle group
					return item.map((subItem, subIdx) => {
						if (subIdx === 0) return subItem; // Group name
						const subIndex = getSignalFlatIndex(idx, subIdx - 1);
						if (selectedCells.some(cell => cell.signalIndex === subIndex)) {
							const signal = subItem as WaveSignal;
							let waveChars = signal.wave.split('');
							selectedCells
								.filter(cell => cell.signalIndex === subIndex)
								.forEach(cell => {
									if (cell.cycleIndex < waveChars.length) {
										const currentChar = waveChars[cell.cycleIndex];
										if (currentChar === '0') {
											waveChars[cell.cycleIndex] = '1';
										} else if (currentChar === '1') {
											waveChars[cell.cycleIndex] = '0';
										}
									}
								});
							return { ...signal, wave: waveChars.join('') };
						}
						return subItem;
					});
				} else if (item && typeof item === 'object' && 'name' in item) {
					// Handle signal
					const flatIndex = getSignalFlatIndex(idx);
					if (selectedCells.some(cell => cell.signalIndex === flatIndex)) {
						const signal = item as WaveSignal;
						let waveChars = signal.wave.split('');
						selectedCells
							.filter(cell => cell.signalIndex === flatIndex)
							.forEach(cell => {
								if (cell.cycleIndex < waveChars.length) {
									const currentChar = waveChars[cell.cycleIndex];
									if (currentChar === '0') {
										waveChars[cell.cycleIndex] = '1';
									} else if (currentChar === '1') {
										waveChars[cell.cycleIndex] = '0';
									}
								}
							});
						return { ...signal, wave: waveChars.join('') };
					}
					return item;
				}
				return item;
			})
		} as WaveJson;
		
		waveformData = newWaveformData;
	}

	function explicitateSelection() {
		saveStateToHistory('Explicitate selection');
		// Convert implicit cells (.) to explicit (hardcoded values)
		selectedCells.forEach(cell => {
			const signal = getSignalAtIndex(cell.signalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				
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
						updateSignalAtIndex(cell.signalIndex, newSignal);
					}
				}
			}
		});
		
		waveformData = waveformData; // Trigger reactivity
	}

	function implicitateSelection() {
		saveStateToHistory('Implicitate selection');
		// Convert explicit cells to implicit where possible (replace with .)
		selectedCells.forEach(cell => {
			const signal = getSignalAtIndex(cell.signalIndex);
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
							updateSignalAtIndex(cell.signalIndex, newSignal);
						}
					}
				}
			}
		});
		
		waveformData = waveformData; // Trigger reactivity
	}

	function handleCycleChange(event: CustomEvent<{ signalIndex: number; cycleIndex: number; newChar: string }>) {
		const { signalIndex, cycleIndex, newChar } = event.detail;
		
		// Find and update the signal
		const signal = getSignalAtIndex(signalIndex);
		if (signal) {
			// Create the new signal state first
			let waveChars = signal.wave.split('');
			while (waveChars.length <= cycleIndex) {
				waveChars.push('');
			}

			// Only proceed if the value is actually different
			if (waveChars[cycleIndex] !== newChar) {
				// Save state before making any changes
				saveStateToHistory('Change cycle value');

				waveChars[cycleIndex] = newChar;
				const newSignal = { ...signal, wave: waveChars.join('') };
				
				// Create a new waveform state
				const newWaveformData = {
					...waveformData,
					signal: waveformData.signal.map((item, idx) => {
						if (Array.isArray(item)) {
							// Handle group
							return item.map((subItem, subIdx) => {
								if (subIdx === 0) return subItem; // Group name
								const subIndex = getSignalFlatIndex(idx, subIdx - 1);
								return subIndex === signalIndex ? newSignal : subItem;
							});
						} else {
							// Handle signal or spacer
							const flatIndex = getSignalFlatIndex(idx);
							return flatIndex === signalIndex ? newSignal : item;
						}
					})
				} as WaveJson;

				// Update the waveform data
				waveformData = newWaveformData;
			}
		}
	}

	// Helper to get flat index for a signal in nested structure
	function getSignalFlatIndex(groupIndex: number, subIndex?: number): number {
		let flatIndex = 0;
		for (let i = 0; i < groupIndex; i++) {
			const item = waveformData.signal[i];
			if (Array.isArray(item)) {
				// It's a group - count its signals (excluding group name)
				flatIndex += item.length - 1;
			} else if (item && typeof item === 'object' && 'name' in item) {
				// It's a signal
				flatIndex++;
			} else {
				// It's a spacer
				flatIndex++;
			}
		}
		
		if (subIndex !== undefined) {
			// Add subIndex for signals within the current group
			flatIndex += subIndex;
		} else if (!Array.isArray(waveformData.signal[groupIndex])) {
			// For non-group items, no adjustment needed
		}
		
		return flatIndex;
	}

	function handleTransitionClick(event: CustomEvent<{ signalIndex: number; fromCycleIndex: number; toCycleIndex: number }>) {
		// Future: implement transition drag functionality
	}

	// Handle clicking outside of cells to clear selection
	function handleBackgroundClick(event: MouseEvent) {
		// Only clear selection if clicking on the background, not on interactive elements
		const target = event.target as Element;
		
		// Check if the click was on a cell, button, or other interactive element
		if (target.closest('.signal-cycle') || 
		    target.closest('.signal-name-button') || 
		    target.closest('.signal-name-container') ||
		    target.closest('.selection-popup') ||
		    target.closest('.selection-toolbar') ||
		    target.closest('.cycle-context-menu') ||
		    target.closest('.waveform-toolbar') ||
		    target.closest('button') ||
		    target.closest('input') ||
		    target.closest('textarea')) {
			return; // Don't clear selection
		}
		
		// Clear selection when clicking on background
		clearSelection();
	}

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		// Don't handle shortcuts if typing in input fields
		const target = event.target as Element;
		if (target.closest('input') || target.closest('textarea') || target.closest('.cycle-context-menu')) {
			return;
		}

		if (event.key === 'Escape') {
			clearSelection();
			return;
		}

		// Check for Cmd (Mac) or Ctrl (Windows/Linux)
		const isCmdOrCtrl = event.metaKey || event.ctrlKey;
		
		if (isCmdOrCtrl) {
			switch (event.key.toLowerCase()) {
				case 'z':
					event.preventDefault();
					if (event.shiftKey) {
						if ($canRedo) handleRedo();
					} else {
						if ($canUndo) handleUndo();
					}
					break;
				case 'y':
					event.preventDefault();
					if ($canRedo) handleRedo();
					break;
				case 'e':
					if (selectedCells.length > 0) {
						event.preventDefault();
						explicitateSelection();
					}
					break;
				case 'i':
					if (selectedCells.length > 0) {
						event.preventDefault();
						implicitateSelection();
					}
					break;
			}
		}
	}

	// Ensure config object exists
	$: if (!waveformData.config) {
		waveformData.config = { hscale: 1 };
	}

	// Initialize command palette and history
	onMount(() => {
		initializeCommandPalette();
		history.initialize(waveformData);
	});

	// Create command context for the command palette
	$: commandContext = {
		waveformData,
		setWaveformData: (data: WaveJson) => {
			waveformData = data;
		},
		selectedCells,
		clearSelection,
		selectedLanes: $selectedLanes,
		clearLaneSelection,
		isCommandPaletteOpen: $commandPaletteStore.isOpen,
		closeCommandPalette: () => commandPaletteStore.close(),
		getSignalAtIndex,
		updateSignalAtIndex
	};

	// History management
	// Type guard to validate WaveJson structure
	function isWaveJson(obj: any): obj is WaveJson {
		return (
			obj &&
			Array.isArray(obj.signal) &&
			obj.signal.every((item: any) =>
				// Check if item is a WaveSignal
				(item && typeof item === 'object' && 'name' in item && 'wave' in item) ||
				// Check if item is a WaveGroup (array with string as first element)
				(Array.isArray(item) && typeof item[0] === 'string') ||
				// Check if item is a WaveSpacer (empty object)
				(item && typeof item === 'object' && Object.keys(item).length === 0)
			)
		);
	}

	function handleUndo() {
		history.undo();
	}

	function handleRedo() {
		history.redo();
	}

	function handleToggleEditor(event: CustomEvent<{ visible: boolean }>) {
		editorVisible = event.detail.visible;
	}

	function handleEditorChange(event: CustomEvent<{ waveJson: WaveJson }>) {
		saveStateToHistory('Edit WaveJSON in editor');
		waveformData = event.detail.waveJson;
	}

	function handleEditorError(event: CustomEvent<{ message: string }>) {
		// Editor will show the error inline, we could also show a toast here if needed
		console.warn('WaveJSON editor error:', event.detail.message);
	}

	function handleContextMenu(event: CustomEvent<{ signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string; isImplicit: boolean; isExplicit: boolean }>) {
		const { signalIndex, cycleIndex, x, y, currentValue, isImplicit, isExplicit } = event.detail;
		
		// Get signal name
		const signal = getSignalAtIndex(signalIndex);
		if (!signal) return;
		
		contextMenuVisible = true;
		contextMenuX = x;
		contextMenuY = y;
		contextMenuSignalName = signal.name;
		contextMenuSignalIndex = signalIndex;
		contextMenuCycleIndex = cycleIndex;
		contextMenuCurrentValue = currentValue;
		contextMenuIsImplicit = isImplicit;
		contextMenuIsExplicit = isExplicit;
	}

	function handleContextMenuClose() {
		contextMenuVisible = false;
	}

	function handleContextMenuAction(event: CustomEvent) {
		const action = event.type;
		const value = 'value' in event.detail ? event.detail.value : null;
		
		if (action === 'setvalue' && value) {
			handleCycleChange({
				detail: {
					signalIndex: contextMenuSignalIndex,
					cycleIndex: contextMenuCycleIndex,
					newChar: value
				}
			} as CustomEvent);
		} else if (action === 'explicitate') {
			// Handle explicitate action
			const signal = getSignalAtIndex(contextMenuSignalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				if (waveChars[contextMenuCycleIndex] === '.') {
					// Find the effective character for this specific cell
					let effectivePrevChar: string | null = null;
					
					// Look backwards to find the last non-dot character
					for (let i = contextMenuCycleIndex - 1; i >= 0; i--) {
						if (waveChars[i] !== '.') {
							effectivePrevChar = waveChars[i];
							break;
						}
					}
					
					if (effectivePrevChar) {
						handleCycleChange({
							detail: {
								signalIndex: contextMenuSignalIndex,
								cycleIndex: contextMenuCycleIndex,
								newChar: effectivePrevChar
							}
						} as CustomEvent);
					}
				}
			}
		} else if (action === 'implicitate') {
			// Handle implicitate action
			const signal = getSignalAtIndex(contextMenuSignalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				if (contextMenuCycleIndex > 0 && waveChars[contextMenuCycleIndex] !== '.') {
					const currentChar = waveChars[contextMenuCycleIndex];
					
					// Skip empty characters
					if (currentChar !== '') {
						// Special handling for data signals - don't collapse data values
						if (!['=', '2', '3', '4', '5'].includes(currentChar)) {
							handleCycleChange({
								detail: {
									signalIndex: contextMenuSignalIndex,
									cycleIndex: contextMenuCycleIndex,
									newChar: '.'
								}
							} as CustomEvent);
						}
					}
				}
			}
		}
		
		handleContextMenuClose();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app-container" role="application">
	<header class="app-header">
		<div class="header-content">
			<div class="header-text">
				<h1>Wavescaler</h1>
				<p>Interactive Digital Waveform Editor</p>
			</div>
			<div class="header-actions">
				<ThemeToggle />
			</div>
		</div>
	</header>
	
	<main class="app-main">
		<!-- Sidebar Toolbar -->
		<aside class="app-sidebar">
			<WaveformToolbar 
				waveJson={waveformData}
				editorVisible={editorVisible}
				on:addsignal={handleAddSignal}
				on:addgroup={handleAddGroup}
				on:addspacer={handleAddSpacer}
				on:clear={handleClear}
				on:export={handleExport}
				on:import={handleImport}
				on:undo={handleUndo}
				on:redo={handleRedo}
				on:toggleeditor={handleToggleEditor}
			/>
		</aside>

		<!-- Main Content Area -->
		<div class="app-content">
			<div 
				class="waveform-container" 
				role="button"
				aria-label="Waveform editing area - click to clear selection, press Escape to clear selection"
				tabindex="0"
				on:click={handleBackgroundClick}
				on:keydown={(e) => { if (e.key === 'Escape') clearSelection(); }}
			>
				<WaveformDiagram
					waveJson={waveformData}
					isCellSelected={isCellSelected}
					on:signalchange={handleSignalChange}
					on:structurechange={handleStructureChange}
					on:cellselection={handleCellSelection}
					on:laneselection={handleLaneSelection}
					on:groupselection={handleGroupSelection}
					on:cyclechange={handleCycleChange}
					on:rightclick={(e) => {
						contextMenuVisible = true;
						contextMenuX = e.detail.x;
						contextMenuY = e.detail.y;
						const signal = getSignalAtIndex(e.detail.signalIndex);
						contextMenuSignalName = signal?.name || '';
						contextMenuSignalIndex = e.detail.signalIndex;
						contextMenuCycleIndex = e.detail.cycleIndex;
						contextMenuCurrentValue = e.detail.currentValue;
						contextMenuIsImplicit = e.detail.isImplicit;
						contextMenuIsExplicit = e.detail.isExplicit;
					}}
				/>
			</div>

			<!-- Monaco Editor Panel -->
			<MonacoWaveJsonEditor
				waveJson={waveformData}
				visible={editorVisible}
				on:change={handleEditorChange}
				on:error={handleEditorError}
				on:close={() => editorVisible = false}
			/>
		</div>
	</main>

	<!-- Selection Popup -->
	<SelectionPopup
		visible={selectedCells.length > 0}
		description={selectionDescription}
		onClear={clearSelection}
	/>

	<!-- Selection Toolbar -->
	<SelectionToolbar
		visible={selectedCells.length > 0}
		selectedCount={selectedCells.length}
		on:setvalue={handleSelectionAction}
		on:copy={handleSelectionAction}
		on:paste={handleSelectionAction}
		on:delete={handleSelectionAction}
		on:duplicate={handleSelectionAction}
		on:invert={handleSelectionAction}
		on:explicitate={handleSelectionAction}
		on:implicitate={handleSelectionAction}
		on:clear={handleSelectionAction}
	/>

	<!-- Command Palette -->
	<CommandPalette context={commandContext} />

	<!-- Cycle Context Menu -->
	<CycleContextMenu
		visible={contextMenuVisible}
		x={contextMenuX}
		y={contextMenuY}
		signalName={contextMenuSignalName}
		cycleIndex={contextMenuCycleIndex}
		currentValue={contextMenuCurrentValue}
		isImplicit={contextMenuIsImplicit}
		isExplicit={contextMenuIsExplicit}
		on:setvalue={(event) => {
			const { value } = event.detail;
			handleCycleChange({
				detail: {
					signalIndex: contextMenuSignalIndex,
					cycleIndex: contextMenuCycleIndex,
					newChar: value
				}
			} as CustomEvent);
			contextMenuVisible = false;
		}}
		on:explicitate={() => {
			// Handle explicitate action
			const signal = getSignalAtIndex(contextMenuSignalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				if (waveChars[contextMenuCycleIndex] === '.') {
					// Find the effective character for this specific cell
					let effectivePrevChar: string | null = null;
					
					// Look backwards to find the last non-dot character
					for (let i = contextMenuCycleIndex - 1; i >= 0; i--) {
						if (waveChars[i] !== '.') {
							effectivePrevChar = waveChars[i];
							break;
						}
					}
					
					if (effectivePrevChar) {
						// Save state before making changes
						saveStateToHistory('Explicitate cycle');
						handleCycleChange({
							detail: {
								signalIndex: contextMenuSignalIndex,
								cycleIndex: contextMenuCycleIndex,
								newChar: effectivePrevChar
							}
						} as CustomEvent);
					}
				}
			}
			contextMenuVisible = false;
		}}
		on:implicitate={() => {
			// Handle implicitate action
			const signal = getSignalAtIndex(contextMenuSignalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				if (contextMenuCycleIndex > 0 && waveChars[contextMenuCycleIndex] !== '.') {
					const currentChar = waveChars[contextMenuCycleIndex];
					
					// Skip empty characters
					if (currentChar !== '') {
						// Special handling for data signals - don't collapse data values
						if (!['=', '2', '3', '4', '5'].includes(currentChar)) {
							// Save state before making changes
							saveStateToHistory('Implicitate cycle');
							handleCycleChange({
								detail: {
									signalIndex: contextMenuSignalIndex,
									cycleIndex: contextMenuCycleIndex,
									newChar: '.'
								}
							} as CustomEvent);
						}
					}
				}
			}
			contextMenuVisible = false;
		}}
		on:close={() => {
			contextMenuVisible = false;
		}}
	/>
</div>

<style>
	.app-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: var(--color-bg-secondary);
		transition: background-color 0.2s ease;
	}

	.app-header {
		background: var(--gradient-header);
		color: var(--color-text-inverse);
		padding: 1rem 2rem;
		box-shadow: var(--shadow-md);
		border-bottom: 1px solid var(--color-border-primary);
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: auto;
		min-height: 56px;
		padding: 0;
	}

	.header-text {
		flex: 0 0 auto;
	}

	.header-text h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: white;
	}

	.header-text p {
		margin: 0;
		opacity: 0.9;
		font-size: 0.95rem;
		color: white;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 0 0 auto;
	}

	.app-main {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.app-sidebar {
		flex-shrink: 0;
		background-color: var(--color-bg-elevated);
		border-right: 1px solid var(--color-border-primary);
		box-shadow: var(--shadow-sm);
		transition: all 0.2s ease;
	}

	.app-content {
		flex: 1;
		display: flex;
		flex-direction: row;
		overflow: hidden;
	}

	.waveform-container {
		flex: 1;
		margin: 1rem;
		margin-right: 0.5rem;
		background: var(--color-bg-elevated);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		border: 1px solid var(--color-border-primary);
		overflow: auto;
		display: flex;
		flex-direction: column;
		outline: none;
		transition: all 0.2s ease;
		min-width: 0;
	}

	.waveform-container:focus {
		box-shadow: var(--shadow-lg), 0 0 0 2px var(--color-accent-light);
		border-color: var(--color-accent-primary);
	}

	/* Global styles for the component-based approach */
	:global(.waveform-diagram) {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	:global(.signal-lane) {
		transition: all 0.2s ease;
	}

	:global(.signal-lane:hover) {
		background-color: var(--color-bg-tertiary);
	}

	:global(.signal-cycle) {
		transition: all 0.15s ease;
	}

	:global(.signal-cycle:hover) {
		background-color: var(--color-accent-light);
		transform: translateY(-1px);
		z-index: 10;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.app-main {
			flex-direction: column;
		}

		.app-sidebar {
			border-right: none;
			border-bottom: 1px solid var(--color-border-primary);
		}

		.app-content {
			flex-direction: column;
		}

		.waveform-container {
			margin: 0.5rem;
			margin-right: 0.5rem;
		}

		.app-header {
			padding: 1rem 1.5rem;
		}

		.header-content {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
			min-height: auto;
		}

		.header-actions {
			align-self: flex-end;
		}
	}

	/* Tablet responsive design */
	@media (max-width: 1024px) and (min-width: 769px) {
		.app-header {
			padding: 1rem 1.75rem;
		}
	}
</style>
