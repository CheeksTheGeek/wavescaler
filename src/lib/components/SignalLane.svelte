<script lang="ts">
    import type { WaveSignal } from '$lib/wavejson-types';
    import { createEventDispatcher } from 'svelte';
    import SignalCycle from './SignalCycle.svelte';
    import SignalTransition from './SignalTransition.svelte';
    import { onDestroy } from 'svelte';
  
        export let signal: WaveSignal;
  export let signalIndex: number;
  export let maxCycles: number;
  export let hscale: number = 1;
  export let isCellSelected: (signalIndex: number, cycleIndex: number) => boolean = () => false;

    const dispatch = createEventDispatcher<{
      signalchange: { signalIndex: number; newSignal: WaveSignal };
      cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
      rightclick: { signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string };
      transitionclick: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number };
    }>();
  
    interface ProcessedCycle {
      cycleIndex: number;
      originalChar: string;
      effectiveChar: string;
      isInteractive: boolean;
      dataValue?: string;
      displayText?: string;
    }
  
    let cycles: ProcessedCycle[] = [];
    let spans: Array<{
      start: number;
      end: number;
      text: string;
      left: number;
      width: number;
    }> = [];
    let isEditingName = false;
    let nameInput = '';
    let editingSpan: number | null = null;
    let signalCyclesContainer: HTMLElement;
    let recalculateTimeout: number;
    let transitionPositions: Array<{ left: number; width: number }> = [];
    let resizeObserver: ResizeObserver | null = null;
    let animationFrameId: number | null = null;
    let isUpdating = false;
  
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
        const isInteractive = ['0', '1', 'x', 'z', ''].includes(effectiveChar) || effectiveChar === '';

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
          dataValue,
          displayText: dataValue ? undefined : dataValue // Hide text immediately for data cycles
        });

        if (originalChar !== '.') {
          effectivePrevChar = originalChar;
        }
      }

      // Assign cycles immediately for synchronous rendering
      cycles = newCycles;
      
      // Calculate spans after DOM is updated
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          if (signalCyclesContainer) {
            calculateSpanPositions();
          }
        });
      }
    }
  
    // Debounced recalculation when scale changes
    $: if (hscale && signalCyclesContainer) {
      clearTimeout(recalculateTimeout);
      
      // Hide text immediately during scaling
      cycles = cycles.map(cycle => ({
        ...cycle,
        displayText: cycle.dataValue ? undefined : cycle.displayText
      }));
      
      recalculateTimeout = setTimeout(() => {
        calculateSpanPositions();
        smoothUpdateTransitions();
      }, 100); // Debounce for 100ms
    }
  
    // Recalculate transition positions when cycles change
    $: if (cycles.length > 0 && signalCyclesContainer && typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        smoothUpdateTransitions();
      });
    }
    
    // Also recalculate when signal.wave changes (for context menu updates)
    $: if (signal.wave && signalCyclesContainer && typeof requestAnimationFrame !== 'undefined') {
      // Use requestAnimationFrame for better performance and immediate visual updates
      requestAnimationFrame(() => {
        smoothUpdateTransitions();
      });
    }
  
    // Set up resize observer for continuous positioning updates
    $: if (signalCyclesContainer && typeof ResizeObserver !== 'undefined') {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      
      resizeObserver = new ResizeObserver(() => {
        smoothUpdateTransitions();
      });
      
      resizeObserver.observe(signalCyclesContainer);
      
      // Also observe individual cycles for more granular updates
      const cycleElements = signalCyclesContainer.querySelectorAll('[data-cycle-index]');
      cycleElements.forEach(element => {
        resizeObserver?.observe(element as HTMLElement);
      });
    }
  
    // Cleanup resize observer and animation frames
    onDestroy(() => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    });
  
    function calculateSpanPositions() {
      if (!signalCyclesContainer) return;
      
      const dataSpans: Array<{
        start: number;
        end: number;
        text: string;
        left: number;
        width: number;
      }> = [];
      
      // Find all data spans
      for (let i = 0; i < cycles.length; i++) {
        if (cycles[i].dataValue) {
          let spanStart = i;
          let spanEnd = i;
          const currentDataValue = cycles[i].dataValue;
          
          // Find the span of consecutive cycles with the same data value
          while (spanStart > 0 && cycles[spanStart - 1].dataValue === currentDataValue) {
            spanStart--;
          }
          
          while (spanEnd < cycles.length - 1 && cycles[spanEnd + 1].dataValue === currentDataValue) {
            spanEnd++;
          }
          
          // Get actual DOM positions of the cycles in this span
          const startCycleElement = signalCyclesContainer.querySelector(`[data-cycle-index="${spanStart}"]`) as HTMLElement;
          const endCycleElement = signalCyclesContainer.querySelector(`[data-cycle-index="${spanEnd}"]`) as HTMLElement;
          
          if (startCycleElement && endCycleElement && currentDataValue) {
            const containerRect = signalCyclesContainer.getBoundingClientRect();
            const startRect = startCycleElement.getBoundingClientRect();
            const endRect = endCycleElement.getBoundingClientRect();
            
            // Calculate position relative to the container
            const left = startRect.left - containerRect.left;
            const width = endRect.right - startRect.left;
            
            dataSpans.push({
              start: spanStart,
              end: spanEnd,
              text: currentDataValue,
              left: left,
              width: width
            });
          }
          
          // Skip to end of span
          i = spanEnd;
        }
      }
      
      spans = dataSpans;
      
      // Show text for single cycles, hide for multi-cycle spans
      cycles = cycles.map(cycle => {
        if (!cycle.dataValue) return cycle;
        
        const span = dataSpans.find(span => 
          cycle.cycleIndex >= span.start && cycle.cycleIndex <= span.end
        );
        
        // If part of a multi-cycle span, hide text (overlay will show it)
        // If single cycle (no span found), show text in the cycle
        return {
          ...cycle,
          displayText: span ? undefined : cycle.dataValue
        };
      });
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
      
      // Force immediate recalculation of transitions after the DOM updates
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          if (signalCyclesContainer) {
            smoothUpdateTransitions();
          }
        });
      }
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

    function handleTransitionClick(event: CustomEvent<{ fromCycleIndex: number; toCycleIndex: number }>) {
      dispatch('transitionclick', {
        signalIndex,
        fromCycleIndex: event.detail.fromCycleIndex,
        toCycleIndex: event.detail.toCycleIndex
      });
    }

    function startEditingSpan(spanIndex: number) {
      editingSpan = spanIndex;
    }

    function finishEditingSpan(spanIndex: number, newText: string) {
      if (newText.trim() && spans[spanIndex]) {
        const span = spans[spanIndex];
        
        // Update data array
        const newData = Array.isArray(signal.data) ? [...signal.data] : [];
        
        // Find which data index corresponds to this span
        let dataIndex = 0;
        for (let i = 0; i < span.start; i++) {
          if (cycles[i]?.dataValue) {
            dataIndex++;
          }
        }
        
        // Update the data value
        newData[dataIndex] = newText.trim();
        
        const newSignal = {
          ...signal,
          data: newData
        };
        
        dispatch('signalchange', { signalIndex, newSignal });
      }
      editingSpan = null;
    }

    function handleSpanKeydown(event: KeyboardEvent, spanIndex: number) {
      if (event.key === 'Enter') {
        const target = event.target as HTMLInputElement;
        finishEditingSpan(spanIndex, target.value);
      } else if (event.key === 'Escape') {
        editingSpan = null;
      }
    }

    function needsTransition(fromCycle: ProcessedCycle, toCycle: ProcessedCycle): boolean {
      // Get visual representation for the cycle (same logic as SignalTransition)
      function getCycleType(cycle: ProcessedCycle): 'high' | 'low' | 'x' | 'z' | 'data' | 'clock' | 'gap' | 'empty' | 'unknown' {
        const char = cycle.effectiveChar;
        
        if (char === '1' || char === 'h' || char === 'H' || char === 'P') return 'high';
        if (char === '0' || char === 'l' || char === 'L' || char === 'N') return 'low';
        if (char === 'x') return 'x';
        if (char === 'z') return 'z';
        if (['=', '2', '3', '4', '5'].includes(char)) return 'data';
        if (['p', 'P', 'n', 'N', 'h', 'l', 'H', 'L'].includes(char)) return 'clock';
        if (char === '|') return 'gap';
        if (char === '') return 'empty';
        return 'unknown';
      }

      const fromType = getCycleType(fromCycle);
      const toType = getCycleType(toCycle);
      
      // No transition if from/to empty
      if (fromType === 'empty' || toType === 'empty') {
        return false;
      }
      
      // For data signals, check if the actual data values are different
      if (fromType === 'data' && toType === 'data') {
        return fromCycle.dataValue !== toCycle.dataValue;
      }
      
      // Transition needed if different types
      return fromType !== toType;
    }

    function calculateTransitionPositions() {
      if (!signalCyclesContainer) return;
      
      const newTransitionPositions: Array<{ left: number; width: number }> = [];
      const transitionWidth = 8 * hscale;
      
      // Measure actual DOM positions of cycles
      for (let i = 0; i < cycles.length - 1; i++) {
        const currentCycle = signalCyclesContainer.querySelector(`[data-cycle-index="${i}"]`) as HTMLElement;
        const nextCycle = signalCyclesContainer.querySelector(`[data-cycle-index="${i + 1}"]`) as HTMLElement;
        
        if (currentCycle && nextCycle && needsTransition(cycles[i], cycles[i + 1])) {
          const containerRect = signalCyclesContainer.getBoundingClientRect();
          const currentRect = currentCycle.getBoundingClientRect();
          const nextRect = nextCycle.getBoundingClientRect();
          
          // Calculate transition position to be exactly between cycles
          const currentRight = currentRect.right - containerRect.left;
          const nextLeft = nextRect.left - containerRect.left;
          const transitionLeft = currentRight - transitionWidth / 2;
          
          newTransitionPositions.push({
            left: transitionLeft,
            width: transitionWidth
          });
        } else {
          // Push a placeholder to maintain index alignment
          newTransitionPositions.push({
            left: 0,
            width: 0
          });
        }
      }
      
      transitionPositions = newTransitionPositions;
    }
    
    function smoothUpdateTransitions() {
      if (isUpdating) return;
      isUpdating = true;
      
      if (animationFrameId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animationFrameId);
      }
      
      if (typeof requestAnimationFrame !== 'undefined') {
        animationFrameId = requestAnimationFrame(() => {
          calculateTransitionPositions();
          isUpdating = false;
        });
      } else {
        // Fallback for SSR
        calculateTransitionPositions();
        isUpdating = false;
      }
    }
  </script>
  
  <div class="signal-lane" style="--hscale: {hscale}; --cycle-height: 40px;">
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
    <div class="signal-cycles" bind:this={signalCyclesContainer}>
      {#each cycles as cycle, index (`${cycle.cycleIndex}-${cycle.effectiveChar}-${cycle.originalChar}`)}
        {@const isSelected = isCellSelected(signalIndex, cycle.cycleIndex)}
        {@const prevCycle = index > 0 ? cycles[index - 1] : null}
        {@const nextCycle = index < cycles.length - 1 ? cycles[index + 1] : null}
        {@const hasLeftTransition = prevCycle ? needsTransition(prevCycle, cycle) : false}
        {@const hasRightTransition = nextCycle ? needsTransition(cycle, nextCycle) : false}
        
        <!-- Render the cycle -->
        <SignalCycle
          {cycle}
          {hscale}
          {signalIndex}
          {isSelected}
          {hasLeftTransition}
          {hasRightTransition}
          on:cyclechange={(e) => handleCycleChange(e.detail.cycleIndex, e.detail.newChar)}
          on:bulkcyclechange={(e) => handleBulkCycleChange(e.detail.startIndex, e.detail.endIndex, e.detail.newChar)}
          on:cellselection={(e) => dispatch('cellselection', e.detail)}
          on:rightclick={(e) => dispatch('rightclick', e.detail)}
        />
      {/each}
      
      <!-- Render all transitions as absolute positioned overlays -->
      {#each cycles as cycle, index (`transition-${cycle.cycleIndex}-${cycle.effectiveChar}`)}
        {@const nextCycle = index < cycles.length - 1 ? cycles[index + 1] : null}
        {@const needsCurrentTransition = nextCycle ? needsTransition(cycle, nextCycle) : false}
        {#if nextCycle && needsCurrentTransition && transitionPositions[index] && transitionPositions[index].width > 0}
          <div class="transition-overlay" style="left: {transitionPositions[index].left}px; width: {transitionPositions[index].width}px;">
          <SignalTransition 
            fromCycle={cycle}
            toCycle={nextCycle}
            {hscale}
            on:transitionclick={handleTransitionClick}
          />
          </div>
        {/if}
      {/each}
      
      <!-- Editable data text overlays -->
      {#each spans as span, index}
        <div class="data-text-overlay" 
             style="left: {span.left}px; width: {span.width}px;">
          {#if editingSpan === index}
            <input
              type="text"
              class="data-text-input"
              value={span.text}
              on:blur={(e) => finishEditingSpan(index, (e.target as HTMLInputElement).value)}
              on:keydown={(e) => handleSpanKeydown(e, index)}
              autofocus
            />
          {:else}
            <button 
              class="data-text-button"
              on:click={() => startEditingSpan(index)}
              title="Click to edit data value"
            >
              {span.text}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
  
  <style>
    .signal-lane {
      display: flex;
      height: var(--lane-height);
      border-bottom: 1px solid var(--border-color);
      background-color: transparent; /* Allow grid lines to show through */
    }
  
    .signal-name-container {
      width: var(--name-width);
      display: flex;
      align-items: center;
      padding: 0 12px;
      background-color: #f8fafc;
      border-right: 1px solid var(--border-color);
      flex-shrink: 0;
      z-index: 2; /* Above grid lines */
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
      position: relative;
      /* Optimize for smooth scaling */
      will-change: transform;
      transform: translateZ(0); /* Force hardware acceleration */
    }

    .data-text-overlay {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      height: auto;
      pointer-events: none; /* Only the button/input inside should be clickable */
    }

    .data-text-button {
      background: transparent;
      border: 1px solid transparent;
      font: inherit;
      color: #1f2937;
      font-size: 12px;
      font-weight: 500;
      font-family: 'Arial', sans-serif;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 3px;
      transition: all 0.15s ease;
      text-align: center;
      white-space: nowrap;
      pointer-events: auto;
      min-width: fit-content;
      height: auto;
    }

    .data-text-button:hover {
      background-color: rgba(59, 130, 246, 0.1);
      border-color: rgba(59, 130, 246, 0.3);
    }

    .data-text-input {
      border: 1px solid #3b82f6;
      border-radius: 3px;
      padding: 2px 6px;
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      font-family: 'Arial', sans-serif;
      background-color: white;
      text-align: center;
      pointer-events: auto;
      min-width: 40px;
      height: auto;
    }

    .data-text-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    }

    .transition-overlay {
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 5; /* Above cycles but below text overlays */
      pointer-events: auto;
      /* Optimize for smooth scaling */
      will-change: transform;
      transform: translateZ(0); /* Force hardware acceleration */
      /* Ensure sub-pixel precision */
      backface-visibility: hidden;
      -webkit-font-smoothing: subpixel-antialiased;
    }
  </style>
  