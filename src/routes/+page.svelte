<script lang="ts">
	import WaveformDiagram from '$lib/components/WaveformDiagram.svelte';
	import WaveformToolbar from '$lib/components/WaveformToolbar.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import SelectionPopup from '$lib/components/SelectionPopup.svelte';
	import SelectionToolbar from '$lib/components/SelectionToolbar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import type { WaveJson, WaveSignal, WaveGroup } from '$lib/wavejson-types';
	import { clearLaneSelection, selectedLanes } from '$lib/lane-selection-store';
	import { initializeCommandPalette, commandPaletteStore } from '$lib/command-palette';
	import type { CommandContext } from '$lib/command-palette/types';
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



	// Selection state
	interface CellSelection {
		signalIndex: number;
		cycleIndex: number;
		signalName: string;
	}

	let selectedCells: CellSelection[] = [];
	let isShiftSelecting = false;
	let lastSelectedCell: CellSelection | null = null;

	function handleAddSignal(event: CustomEvent<{ signal: WaveSignal }>) {
		waveformData.signal = [...waveformData.signal, event.detail.signal];
		waveformData = waveformData; // Trigger reactivity
	}

	function handleAddGroup(event: CustomEvent<{ group: WaveGroup }>) {
		waveformData.signal = [...waveformData.signal, event.detail.group];
		waveformData = waveformData; // Trigger reactivity
	}

	function handleAddSpacer() {
		waveformData.signal = [...waveformData.signal, {}];
		waveformData = waveformData; // Trigger reactivity
	}

	function handleClear() {
		waveformData = {
			signal: [],
			config: { hscale: 1 }
		};
	}

	function handleExport(event: CustomEvent<{ format: 'json' | 'svg' | 'png' }>) {
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
		}
		// TODO: Implement SVG and PNG export
	}

	function handleImport(event: CustomEvent<{ waveJson: WaveJson }>) {
		waveformData = event.detail.waveJson;
	}



	function handleSignalChange(event: CustomEvent<{ signalIndex: number; newSignal: WaveSignal }>) {
		const { signalIndex, newSignal } = event.detail;
		if (waveformData.signal[signalIndex]) {
			waveformData.signal[signalIndex] = newSignal;
			waveformData = waveformData; // Trigger reactivity
		}
	}

	function handleStructureChange(event: CustomEvent<{ newWaveJson: WaveJson }>) {
		waveformData = event.detail.newWaveJson;
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
		// Helper to get signal from potentially nested structure
		let currentIndex = 0;
		for (const item of waveformData.signal) {
			if (Array.isArray(item)) {
				// It's a group - iterate through its signals
				for (let i = 1; i < item.length; i++) {
					const subItem = item[i];
					if (currentIndex === index && subItem && typeof subItem === 'object' && !Array.isArray(subItem) && 'name' in subItem) {
						return subItem as WaveSignal;
					}
					currentIndex++;
				}
			} else if (item && typeof item === 'object' && 'name' in item) {
				// It's a signal
				if (currentIndex === index) {
					return item as WaveSignal;
				}
				currentIndex++;
			} else {
				// It's a spacer or unknown
				currentIndex++;
			}
		}
		return null;
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
		}
	}

	function applyValueToSelection(value: string) {
		// Apply the value to all selected cells
		selectedCells.forEach(cell => {
			const signal = getSignalAtIndex(cell.signalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				while (waveChars.length <= cell.cycleIndex) {
					waveChars.push('.');
				}
				waveChars[cell.cycleIndex] = value;
				
				const newSignal = { ...signal, wave: waveChars.join('') };
				updateSignalAtIndex(cell.signalIndex, newSignal);
			}
		});
		waveformData = waveformData; // Trigger reactivity
	}

	function updateSignalAtIndex(index: number, newSignal: WaveSignal) {
		// Helper to update signal in potentially nested structure
		let currentIndex = 0;
		for (let i = 0; i < waveformData.signal.length; i++) {
			const item = waveformData.signal[i];
			if (Array.isArray(item)) {
				// It's a group - iterate through its signals
				for (let j = 1; j < item.length; j++) {
					const subItem = item[j];
					if (currentIndex === index && subItem && typeof subItem === 'object' && !Array.isArray(subItem) && 'name' in subItem) {
						item[j] = newSignal;
						return;
					}
					currentIndex++;
				}
			} else if (item && typeof item === 'object' && 'name' in item) {
				// It's a signal
				if (currentIndex === index) {
					waveformData.signal[i] = newSignal;
					return;
				}
				currentIndex++;
			} else {
				// It's a spacer or unknown
				currentIndex++;
			}
		}
	}

	function copySelection() {
		// TODO: Implement copy functionality
	}

	function pasteToSelection() {
		// TODO: Implement paste functionality
	}

	function deleteSelection() {
		applyValueToSelection('');
	}

	function duplicateSelection() {
		// TODO: Implement duplicate functionality
	}

	function invertSelection() {
		// Invert binary values (0 <-> 1)
		selectedCells.forEach(cell => {
			const signal = getSignalAtIndex(cell.signalIndex);
			if (signal) {
				let waveChars = signal.wave.split('');
				if (cell.cycleIndex < waveChars.length) {
					const currentChar = waveChars[cell.cycleIndex];
					if (currentChar === '0') {
						waveChars[cell.cycleIndex] = '1';
					} else if (currentChar === '1') {
						waveChars[cell.cycleIndex] = '0';
					}
					
					const newSignal = { ...signal, wave: waveChars.join('') };
					updateSignalAtIndex(cell.signalIndex, newSignal);
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
			let waveChars = signal.wave.split('');
			while (waveChars.length <= cycleIndex) {
				waveChars.push('');
			}
			waveChars[cycleIndex] = newChar;
			
			const newSignal = { ...signal, wave: waveChars.join('') };
			updateSignalAtIndex(signalIndex, newSignal);
			waveformData = waveformData; // Trigger reactivity
		}
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
		if (event.key === 'Escape') {
			clearSelection();
		}
	}

	// Ensure config object exists
	$: if (!waveformData.config) {
		waveformData.config = { hscale: 1 };
	}

	// Initialize command palette
	onMount(() => {
		initializeCommandPalette();
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
				on:addsignal={handleAddSignal}
				on:addgroup={handleAddGroup}
				on:addspacer={handleAddSpacer}
				on:clear={handleClear}
				on:export={handleExport}
				on:import={handleImport}
			/>
		</aside>

		<!-- Main Content Area -->
		<div class="app-content">
			<div 
				class="waveform-container" 
				role="region"
				aria-label="Waveform editing area - click to clear selection, press Escape to clear selection"
				tabindex="0"
				on:click={handleBackgroundClick}
				on:keydown={(e) => { if (e.key === 'Escape') clearSelection(); }}
			>
				<WaveformDiagram 
					waveJson={waveformData} 
					on:signalchange={handleSignalChange}
					on:structurechange={handleStructureChange}
					on:cellselection={handleCellSelection}
					on:laneselection={handleLaneSelection}
					on:groupselection={handleGroupSelection}
					on:cyclechange={handleCycleChange}
					on:transitionclick={handleTransitionClick}
					{isCellSelected}
				/>
			</div>
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
		on:clear={handleSelectionAction}
	/>

	<!-- Command Palette -->
	<CommandPalette context={commandContext} />
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
	}

	.header-text p {
		margin: 0;
		opacity: 0.9;
		font-size: 0.95rem;
		color: var(--color-text-inverse);
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
		flex-direction: column;
		overflow: hidden;
	}

	.waveform-container {
		flex: 1;
		margin: 1rem;
		background: var(--color-bg-elevated);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		border: 1px solid var(--color-border-primary);
		overflow: auto;
		display: flex;
		flex-direction: column;
		outline: none;
		transition: all 0.2s ease;
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

		.waveform-container {
			margin: 0.5rem;
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
