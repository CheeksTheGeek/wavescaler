<script lang="ts">
	import WaveformDiagram from '$lib/components/WaveformDiagram.svelte';
	import WaveformToolbar from '$lib/components/WaveformToolbar.svelte';

	import SelectionPopup from '$lib/components/SelectionPopup.svelte';
	import SelectionToolbar from '$lib/components/SelectionToolbar.svelte';
	import type { WaveJson, WaveSignal, WaveGroup } from '$lib/wavejson-types';

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
		console.log('Main page handleStructureChange:', event.detail.newWaveJson);
		waveformData = event.detail.newWaveJson;
		// Force reactivity by triggering a re-assignment
		waveformData = waveformData;
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

		console.log('Cell selection:', { signalIndex, cycleIndex, shiftKey, signalName: signal.name });

		if (shiftKey) {
			// Multi-selection mode
			isShiftSelecting = true;
			if (lastSelectedCell) {
				// Extend selection from last selected cell to new cell
				selectedCells = getSelectionRange(lastSelectedCell, newCell);
				console.log('Extended selection to:', selectedCells.length, 'cells');
			} else {
				// No previous selection, start multi-selection with this cell
				selectedCells = [newCell];
				lastSelectedCell = newCell;
				console.log('Started multi-selection with:', newCell);
			}
		} else {
			// Single selection mode - replace any existing selection
			isShiftSelecting = false;
			selectedCells = [newCell];
			lastSelectedCell = newCell;
			console.log('Single selection:', newCell);
		}
		
		// Force reactivity update
		selectedCells = selectedCells;
	}

	function getSignalAtIndex(index: number): WaveSignal | null {
		// Helper to get signal from potentially nested structure
		let currentIndex = 0;
		for (const item of waveformData.signal) {
			if (Array.isArray(item)) {
				// It's a group - iterate through its signals
				for (let i = 1; i < item.length; i++) {
					if (currentIndex === index && typeof item[i] === 'object' && 'name' in item[i]) {
						return item[i] as WaveSignal;
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
	}

	// Make the isCellSelected function reactive
	$: isCellSelected = (signalIndex: number, cycleIndex: number): boolean => {
		return selectedCells.some(cell => 
			cell.signalIndex === signalIndex && cell.cycleIndex === cycleIndex
		);
	};

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
					if (currentIndex === index && typeof item[j] === 'object' && 'name' in item[j]) {
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
		console.log('Copy selection:', selectedCells);
	}

	function pasteToSelection() {
		// TODO: Implement paste functionality
		console.log('Paste to selection:', selectedCells);
	}

	function deleteSelection() {
		applyValueToSelection('');
	}

	function duplicateSelection() {
		// TODO: Implement duplicate functionality
		console.log('Duplicate selection:', selectedCells);
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
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app-container" role="application">
	<header class="app-header">
		<h1>Wavescaler</h1>
		<p>Interactive Digital Waveform Editor</p>
	</header>
	
	<main class="app-main">
		<!-- Sidebar Toolbar -->
		<aside class="app-sidebar">
			<WaveformToolbar 
				waveJson={waveformData}
				on:addsignal={handleAddSignal}
				on:addgroup={handleAddGroup}
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
					on:cyclechange={handleCycleChange}
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
</div>

<style>
	.app-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #f8fafc;
	}

	.app-header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 1rem 2rem;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.app-header h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.75rem;
		font-weight: 700;
	}

	.app-header p {
		margin: 0;
		opacity: 0.9;
		font-size: 0.95rem;
	}

	.app-main {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.app-sidebar {
		flex-shrink: 0;
		background-color: white;
		border-right: 1px solid #e5e7eb;
		box-shadow: 2px 0 4px rgba(0,0,0,0.05);
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
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		overflow: auto; /* Allow scrolling */
		display: flex;
		flex-direction: column;
		outline: none; /* Remove focus outline */
	}

	.waveform-container:focus {
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 2px rgba(59, 130, 246, 0.3);
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
		background-color: #f8fafc;
	}

	:global(.signal-cycle) {
		transition: all 0.15s ease;
	}

	:global(.signal-cycle:hover) {
		transform: scale(1.02);
		z-index: 10;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.app-main {
			flex-direction: column;
		}

		.app-sidebar {
			border-right: none;
			border-bottom: 1px solid #e5e7eb;
		}

		.waveform-container {
			margin: 0.5rem;
		}
	}
</style>
