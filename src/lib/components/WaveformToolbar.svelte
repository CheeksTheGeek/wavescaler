<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WaveJson, WaveSignal, WaveGroup } from '$lib/wavejson-types';
  import { parseWaveJson } from '$lib/wavejson-parser';

  export let waveJson: WaveJson;

  const dispatch = createEventDispatcher<{
    addsignal: { signal: WaveSignal };
    addgroup: { group: WaveGroup };
    addspacer: {};
    clear: {};
    export: { format: 'json' | 'svg' | 'png' };
    import: { waveJson: WaveJson };
  }>();

  let fileInput: HTMLInputElement;
  let showTextImport = false;
  let importText = '';

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

  function exportDiagram(format: 'json' | 'svg' | 'png') {
    dispatch('export', { format });
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


</script>

<div class="waveform-toolbar">
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
    <button class="toolbar-button secondary" on:click={() => exportDiagram('json')}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M8 2 L8 10 M5 5 L8 2 L11 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M3 12 L13 12" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      Export WaveJSON
    </button>
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
      <span class="scale-hint">⌘+scroll to zoom horizontally</span>
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
</style> 
