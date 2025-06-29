<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WaveJson, WaveSignal, WaveGroup } from '$lib/wavejson-types';
  import { parseWaveJson } from '$lib/wavejson-parser';
  import { historyStore, canUndo, canRedo } from '$lib/history-store';

  // Subscribe to history store to force reactivity
  $: historyState = $historyStore;
  $: undoEnabled = $canUndo;
  $: redoEnabled = $canRedo;

  export let waveJson: WaveJson;

  const dispatch = createEventDispatcher<{
    addsignal: { signal: WaveSignal };
    addgroup: { group: WaveGroup };
    addspacer: {};
    clear: {};
    export: { format: 'json' | 'svg' | 'png' | 'jpeg' };
    import: { waveJson: WaveJson };
    undo: {};
    redo: {};
    toggleeditor: { visible: boolean };
  }>();

  let fileInput: HTMLInputElement;
  let showTextImport = false;
  let importText = '';
  let showExportDropdown = false;
  let editorVisible = false;

  // Generate better signal names
  function generateSignalName(): string {
    const existingSignals = getAllSignals(waveJson.signal);
    const baseNames = ['clk', 'data', 'addr', 'ctrl', 'reset', 'enable', 'valid', 'ready'];
    
    // Try base names first
    for (const baseName of baseNames) {
      if (!existingSignals.some(s => s.name === baseName)) {
        return baseName;
      }
    }
    
    // Fallback to numbered signals
    let counter = 1;
    while (existingSignals.some(s => s.name === `sig${counter}`)) {
      counter++;
    }
    return `sig${counter}`;
  }

  // Helper to get all signals from nested structure
  function getAllSignals(items: any[]): WaveSignal[] {
    const signals: WaveSignal[] = [];
    for (const item of items) {
      if (Array.isArray(item)) {
        // It's a group
        signals.push(...getAllSignals(item.slice(1)));
      } else if (item && typeof item === 'object' && 'name' in item && 'wave' in item) {
        // It's a signal
        signals.push(item);
      }
    }
    return signals;
  }

  function addSignal() {
    const newSignal: WaveSignal = {
      name: generateSignalName(),
      wave: '0..1..0.'
    };
    dispatch('addsignal', { signal: newSignal });
  }

  function addGroup() {
    const existingGroups = waveJson.signal.filter(item => Array.isArray(item)).length;
    const newGroup: WaveGroup = [
      `Group${existingGroups + 1}`,
      {
        name: generateSignalName(),
        wave: '01.0....'
      },
      {
        name: generateSignalName(),
        wave: '0...1..0'
      }
    ];
    dispatch('addgroup', { group: newGroup });
  }

  function addSpacer() {
    dispatch('addspacer', {});
  }

  function clearDiagram() {
    if (confirm('Are you sure you want to clear the entire diagram?')) {
      dispatch('clear', {});
    }
  }

  function handleExport(format: 'json' | 'svg' | 'png' | 'jpeg') {
    dispatch('export', { format });
    showExportDropdown = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.export-dropdown')) {
      showExportDropdown = false;
    }
  }

  function importDiagram() {
    fileInput.click();
  }

  function toggleTextImport() {
    showTextImport = !showTextImport;
    if (showTextImport) {
      // Pre-fill with example WaveJSON
      importText = `{signal: [
  {name: 'clk', wave: 'p.....|...'},
  {name: 'dat', wave: 'x.345x|=.x', data: ['head', 'body', 'tail', 'data']},
  {name: 'req', wave: '0.1..0|1.0'},
  {},
  {name: 'ack', wave: '1.....|01.'}
]}`;
    }
  }

  function importFromText() {
    if (!importText.trim()) return;
    
    const parseResult = parseWaveJson(importText);
    if (parseResult.success && parseResult.data) {
      dispatch('import', { waveJson: parseResult.data });
      showTextImport = false;
      importText = '';
    } else {
      alert(`Error parsing WaveJSON: ${parseResult.error || 'Unknown error'}`);
    }
  }

  function handleFileImport(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parseResult = parseWaveJson(content);
        
        if (parseResult.success && parseResult.data) {
          dispatch('import', { waveJson: parseResult.data });
        } else {
          alert(`Error importing file: ${parseResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        alert('Error importing file: Failed to read file');
      }
    };
    reader.readAsText(file);
  }

  function handleUndo() {
    if (undoEnabled) {
      dispatch('undo', {});
    }
  }

  function handleRedo() {
    if (redoEnabled) {
      dispatch('redo', {});
    }
  }

  function toggleEditor() {
    editorVisible = !editorVisible;
    dispatch('toggleeditor', { visible: editorVisible });
  }

</script>

<svelte:window on:click={handleClickOutside} />

<div class="waveform-toolbar">
  <div class="toolbar-section">
    <h3>History</h3>
    <div class="history-buttons">
      <button class="toolbar-button compact" disabled={!undoEnabled} on:click={handleUndo}>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M3 8 A5 5 0 0 1 13 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M3 8 L6 5 M3 8 L6 11" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Undo
      </button>
      <button class="toolbar-button compact" disabled={!redoEnabled} on:click={handleRedo}>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M13 8 A5 5 0 0 0 3 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M13 8 L10 5 M13 8 L10 11" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Redo
      </button>
    </div>
  </div>

  <div class="toolbar-section">
    <h3>Add Elements</h3>
    <button class="toolbar-button primary" on:click={addSignal}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M8 2 L8 14 M2 8 L14 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      Add Signal
    </button>
    <button class="toolbar-button primary" on:click={addGroup}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="3" width="12" height="10" stroke="currentColor" stroke-width="1.5" fill="none" rx="2"/>
        <path d="M6 7 L10 7 M6 9 L10 9" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      Add Group
    </button>
    <button class="toolbar-button primary" on:click={addSpacer}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M2 8 L14 8" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/>
        <circle cx="4" cy="8" r="1" fill="currentColor"/>
        <circle cx="8" cy="8" r="1" fill="currentColor"/>
        <circle cx="12" cy="8" r="1" fill="currentColor"/>
      </svg>
      Add Spacer
    </button>
  </div>

  <div class="toolbar-section">
    <h3>File Operations</h3>
    <button class="toolbar-button secondary" on:click={importDiagram}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M8 2 L8 10 M5 7 L8 10 L11 7" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M3 12 L13 12" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      Import WaveJSON File
    </button>
    <button class="toolbar-button secondary" on:click={toggleTextImport}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" stroke="currentColor" stroke-width="1.5" fill="none" rx="2"/>
        <path d="M6 6 L10 6 M6 8 L10 8 M6 10 L8 10" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      Import WaveJSON Text
    </button>
    <button class="toolbar-button secondary" class:active={editorVisible} on:click={toggleEditor}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" stroke="currentColor" stroke-width="1.5" fill="none" rx="2"/>
        <path d="M5 5 L11 5 M5 8 L9 8 M5 11 L7 11" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 9 L12 12 M10.5 10.5 L13.5 10.5" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      {editorVisible ? 'Hide' : 'Show'} Editor
    </button>
    <div class="export-dropdown">
      <button 
        class="toolbar-button secondary" 
        on:click|stopPropagation={() => showExportDropdown = !showExportDropdown}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 2 L8 10 M5 5 L8 2 L11 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M3 12 L13 12" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        Export As
        <svg class="caret" width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
      {#if showExportDropdown}
        <div class="dropdown-menu" on:click|stopPropagation>
          <button class="dropdown-item" on:click={() => handleExport('json')}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 3h10v2H3zM3 7h7v2H3zM3 11h5v2H3z" stroke="none" fill="currentColor"/>
            </svg>
            WaveJSON
          </button>
          <button class="dropdown-item" on:click={() => handleExport('svg')}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M14 4v8H2V4h12m1-1H1v10h14V3z" stroke="none" fill="currentColor"/>
              <path d="M4 8h8" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            SVG
          </button>
          <button class="dropdown-item" on:click={() => handleExport('png')}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M14 4v8H2V4h12m1-1H1v10h14V3z" stroke="none" fill="currentColor"/>
              <path d="M4 6h8M4 8h8M4 10h8" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            PNG
          </button>
          <button class="dropdown-item" on:click={() => handleExport('jpeg')}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M14 4v8H2V4h12m1-1H1v10h14V3z" stroke="none" fill="currentColor"/>
              <path d="M4 6l8 0M4 8l8 0M4 10l8 0" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            JPEG
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if showTextImport}
    <div class="text-import-section">
      <h3>Import WaveJSON</h3>
      <textarea
        class="import-textarea"
        bind:value={importText}
        placeholder="Paste your WaveJSON here..."
        rows="8"
      ></textarea>
      <div class="import-buttons">
        <button class="toolbar-button primary" on:click={importFromText}>
          Import
        </button>
        <button class="toolbar-button secondary" on:click={() => showTextImport = false}>
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <div class="toolbar-section">
    <h3>Configuration</h3>
    <div class="scale-info">
      <span class="scale-label">Scale: {(waveJson.config?.hscale ?? 1).toFixed(1)}x</span>
      <span class="scale-hint">⌘+scroll to zoom horizontally • ⇧+scroll to scroll horizontally</span>
    </div>
  </div>

  <div class="toolbar-section">
    <h3>Actions</h3>
    <button class="toolbar-button danger" on:click={clearDiagram}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M3 6 L13 6 M5 6 L5 13 L11 13 L11 6 M7 3 L9 3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M7 8 L7 11 M9 8 L9 11" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      Clear All
    </button>
  </div>
</div>

<input 
  type="file" 
  accept=".json"
  bind:this={fileInput}
  on:change={handleFileImport}
  style="display: none;"
/>

<style>
  .waveform-toolbar {
    background-color: var(--color-bg-elevated);
    border-right: 1px solid var(--color-border-primary);
    padding: 16px;
    width: 250px;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .toolbar-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toolbar-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--color-border-primary);
    transition: color 0.2s ease, border-color 0.2s ease;
  }

  .toolbar-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-primary);
  }

  .toolbar-button:hover {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .toolbar-button:active {
    transform: translateY(0);
  }

  .toolbar-button.primary {
    background-color: var(--color-accent-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-accent-primary);
  }

  .toolbar-button.primary:hover {
    background-color: var(--color-accent-hover);
    border-color: var(--color-accent-hover);
  }

  .toolbar-button.secondary {
    background-color: var(--color-text-tertiary);
    color: var(--color-text-inverse);
    border-color: var(--color-text-tertiary);
  }

  .toolbar-button.secondary:hover {
    background-color: var(--color-text-secondary);
    border-color: var(--color-text-secondary);
  }

  .toolbar-button.active {
    background-color: var(--color-accent-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-accent-primary);
  }

  .toolbar-button.danger {
    background-color: var(--color-bg-primary);
    color: var(--color-error);
    border-color: var(--color-error);
  }

  .toolbar-button.danger:hover {
    background-color: var(--color-error);
    color: var(--color-text-inverse);
  }

  .scale-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .scale-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
    transition: color 0.2s ease;
  }

  .scale-hint {
    font-size: 11px;
    color: var(--color-text-tertiary);
    font-style: italic;
    transition: color 0.2s ease;
  }

  .text-import-section {
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    padding: 12px;
    background-color: var(--color-bg-tertiary);
    transition: all 0.2s ease;
  }

  .text-import-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 8px 0;
    border-bottom: none;
    padding-bottom: 0;
  }

  .import-textarea {
    width: 100%;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    padding: 8px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    resize: vertical;
    min-height: 120px;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    transition: all 0.2s ease;
  }

  .import-textarea:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px var(--color-accent-light);
  }

  .import-textarea::placeholder {
    color: var(--color-text-placeholder);
  }

  .import-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .history-buttons {
    display: flex;
    gap: 4px;
  }

  .toolbar-button.compact {
    padding: 4px 8px;
    font-size: 12px;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-primary);
  }

  .toolbar-button.compact:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
    transform: none;
    box-shadow: none;
  }

  .toolbar-button.compact:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-dropdown {
    position: relative;
    width: 100%;
  }

  /* Export button specific styles - matching other File Operations buttons */
  .export-dropdown .toolbar-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    background: rgb(82, 88, 102);
    border: none;
    border-radius: 0.5rem;
    color: white;
    font-size: 0.875rem;
    line-height: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .export-dropdown .toolbar-button:hover {
    background: rgb(94, 100, 114);
  }

  .export-dropdown .toolbar-button .caret {
    margin-left: auto;
    opacity: 0.7;
  }

  /* Dropdown menu styles - exact match to the glassy effect in the image */
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: rgba(60, 79, 132, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(30px);
    border-radius: 0.5rem;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.1),
      0 1px 1px rgba(255, 255, 255, 0.05);
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.98);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    line-height: 1.25rem;
    transition: background-color 0.15s ease;
  }

  .dropdown-item:hover {
    background: rgba(122, 128, 141, 0.5);
  }

  .dropdown-item:active {
    background: rgba(132, 138, 151, 0.5);
  }

  .dropdown-item svg {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.9);
  }

  .dropdown-item:not(:last-child) {
    border-bottom: 1px solid rgba(140, 146, 159, 0.2);
  }

  /* Keep existing toolbar button styles for other buttons */
  .toolbar-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: var(--surface-2);
    color: var(--text-1);
    font-size: 0.875rem;
    line-height: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toolbar-button:hover {
    background: var(--surface-3);
  }

  .toolbar-button svg {
    flex-shrink: 0;
    color: var(--text-2);
  }

  .toolbar-button.danger {
    color: var(--red-11);
    border-color: var(--red-6);
  }

  .toolbar-button.danger:hover {
    background: var(--red-3);
  }
</style> 
