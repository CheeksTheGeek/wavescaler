<script lang="ts">
    import type { WaveSignal } from '$lib/wavejson-types';
    import { createEventDispatcher } from 'svelte';
    import SignalCycle from './SignalCycle.svelte';
  
        export let signal: WaveSignal;
  export let signalIndex: number;
  export let maxCycles: number;
  export let hscale: number = 1;
  export let isCellSelected: (signalIndex: number, cycleIndex: number) => boolean = () => false;

    const dispatch = createEventDispatcher<{
      signalchange: { signalIndex: number; newSignal: WaveSignal };
      cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
      rightclick: { signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string };
    }>();
  
    interface ProcessedCycle {
      cycleIndex: number;
      originalChar: string;
      effectiveChar: string;
      isInteractive: boolean;
      dataValue?: string;
    }
  
    let processedCycles: ProcessedCycle[] = [];
    let isEditingName = false;
    let nameInput = '';
  
    // Process wave string into individual cycles
    $: {
      const waveChars = signal.wave.split('');
      const dataArray = Array.isArray(signal.data) 
        ? signal.data 
        : (typeof signal.data === 'string' ? signal.data.split(/\s+/) : []);
      
      let dataIndex = 0;
      let effectivePrevChar: string | null = null;
      const newCycles: ProcessedCycle[] = [];
  
      for (let i = 0; i < maxCycles; i++) {
        const originalChar = i < waveChars.length ? waveChars[i] : '';
        let effectiveChar = originalChar;
  
        // Handle continuation dots
        if (originalChar === '.') {
          effectiveChar = effectivePrevChar || '';
        }
  
        // Determine if this cycle is interactive (can be clicked/dragged)
        const isInteractive = ['0', '1', ''].includes(effectiveChar) || effectiveChar === '';
  
        // Handle data values for data signals
        let dataValue: string | undefined;
        if (['=', '2', '3', '4', '5'].includes(effectiveChar)) {
          if (['=', '2', '3', '4', '5'].includes(originalChar)) {
            dataValue = dataArray[dataIndex] || '';
            dataIndex++;
          } else if (originalChar === '.' && ['=', '2', '3', '4', '5'].includes(effectivePrevChar || '')) {
            // Find the data value this dot extends
            let k = i - 1;
            while (k >= 0) {
              if (['=', '2', '3', '4', '5'].includes(waveChars[k])) {
                let count = 0;
                for (let c = 0; c <= k; c++) {
                  if (['=', '2', '3', '4', '5'].includes(waveChars[c])) count++;
                }
                dataValue = dataArray[count - 1] || '';
                break;
              }
              if (waveChars[k] !== '.') break;
              k--;
            }
          }
        }
  
        newCycles.push({
          cycleIndex: i,
          originalChar,
          effectiveChar,
          isInteractive,
          dataValue
        });
  
        if (originalChar !== '.') {
          effectivePrevChar = originalChar;
        }
      }
  
      processedCycles = newCycles;
    }
  
    function handleCycleChange(cycleIndex: number, newChar: string) {
      let waveChars = signal.wave.split('');
      
      // Extend wave string if necessary
      while (waveChars.length <= cycleIndex) {
        waveChars.push('');
      }
      
      // Update the character
      waveChars[cycleIndex] = newChar;
      
      // Create new signal object
      const newSignal = {
        ...signal,
        wave: waveChars.join('')
      };
      
      dispatch('signalchange', { signalIndex, newSignal });
    }
  
    function handleBulkCycleChange(startIndex: number, endIndex: number, newChar: string) {
      let waveChars = signal.wave.split('');
      
      // Extend wave string if necessary
      while (waveChars.length <= endIndex) {
        waveChars.push('');
      }
      
      // Update all characters in range
      for (let i = startIndex; i <= endIndex; i++) {
        waveChars[i] = newChar;
      }
      
      const newSignal = {
        ...signal,
        wave: waveChars.join('')
      };
      
      dispatch('signalchange', { signalIndex, newSignal });
    }
  
    function startEditingName() {
      isEditingName = true;
      nameInput = signal.name;
    }
  
    function finishEditingName() {
      if (nameInput.trim() && nameInput !== signal.name) {
        const newSignal = {
          ...signal,
          name: nameInput.trim()
        };
        dispatch('signalchange', { signalIndex, newSignal });
      }
      isEditingName = false;
    }
  
    function handleNameKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        finishEditingName();
      } else if (event.key === 'Escape') {
        isEditingName = false;
      }
    }
  </script>
  
  <div class="signal-lane">
    <!-- Signal Name -->
    <div class="signal-name-container">
      {#if isEditingName}
        <input
          type="text"
          class="signal-name-input"
          bind:value={nameInput}
          on:blur={finishEditingName}
          on:keydown={handleNameKeydown}
        />
      {:else}
        <button 
          class="signal-name-button"
          on:click={startEditingName}
          title="Click to edit signal name"
        >
          {signal.name}
        </button>
      {/if}
    </div>
  
    <!-- Signal Cycles -->
    <div class="signal-cycles">
      {#each processedCycles as cycle (cycle.cycleIndex)}
        {@const isSelected = isCellSelected(signalIndex, cycle.cycleIndex)}
        <SignalCycle
          {cycle}
          {hscale}
          {signalIndex}
          {isSelected}
          on:cyclechange={(e) => handleCycleChange(e.detail.cycleIndex, e.detail.newChar)}
          on:bulkcyclechange={(e) => handleBulkCycleChange(e.detail.startIndex, e.detail.endIndex, e.detail.newChar)}
          on:cellselection={(e) => dispatch('cellselection', e.detail)}
          on:rightclick={(e) => dispatch('rightclick', e.detail)}
        />
      {/each}
    </div>
  </div>
  
  <style>
    .signal-lane {
      display: flex;
      height: var(--lane-height);
      border-bottom: 1px solid var(--border-color);
      background-color: var(--background-color);
    }
  
    .signal-name-container {
      width: var(--name-width);
      display: flex;
      align-items: center;
      padding: 0 12px;
      background-color: #f8fafc;
      border-right: 1px solid var(--border-color);
      flex-shrink: 0;
    }
  
    .signal-name-button {
      background: none;
      border: none;
      font: inherit;
      color: var(--text-color);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background-color 0.15s ease;
      text-align: left;
      width: 100%;
      font-weight: 500;
    }
  
    .signal-name-button:hover {
      background-color: #e5e7eb;
    }
  
    .signal-name-input {
      width: 100%;
      border: 1px solid #3b82f6;
      border-radius: 4px;
      padding: 4px 8px;
      font: inherit;
      font-weight: 500;
      background-color: white;
    }
  
    .signal-name-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    }
  
    .signal-cycles {
      display: flex;
      flex: 1;
      align-items: center;
    }
  </style>
  