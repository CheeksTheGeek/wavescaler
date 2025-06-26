<script lang="ts">
    import type { WaveSignal } from '$lib/wavejson-types';
    import { createEventDispatcher } from 'svelte';
    import SignalCycle from './SignalCycle.svelte';
    import SignalTransition from './SignalTransition.svelte';
    import { onDestroy } from 'svelte';
    import { selectedLanes, toggleLane, isLaneSelected as isLaneSelectedStore } from '$lib/lane-selection-store';
  
        export let signal: WaveSignal;
  export let signalIndex: number;
  export let maxCycles: number;
  export let hscale: number = 1;
  export let isCellSelected: (signalIndex: number, cycleIndex: number) => boolean = () => false;
  export let parentGroupIndex: number | null = null;
  export let localIndex: number | null = null;
  export let treePath: number[] = [];

  // Use global store for immediate lane selection updates
  $: isLaneSelected = isLaneSelectedStore(signalIndex, $selectedLanes);

    const dispatch = createEventDispatcher<{
      signalchange: { signalIndex: number; newSignal: WaveSignal };
      cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
      laneselection: { signalIndex: number; signalName: string; shiftKey: boolean };
      rightclick: { signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string };
      transitionclick: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number };
      signalreorder: { fromIndex: number; toIndex: number };
      dragstart: { path: number[]; itemType: 'signal'; event: DragEvent };
      drop: { targetPath: number[]; position: 'before' | 'after'; event: DragEvent };
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
    
    // Drag and drop state
    let isDragging = false;
    let draggedOverPosition: 'above' | 'below' | null = null;
  
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

    function handleLaneSelection(event: Event) {
      event.stopPropagation(); // Prevent drag start
      const mouseEvent = event as MouseEvent | KeyboardEvent;
      const shiftKey = 'shiftKey' in mouseEvent ? mouseEvent.shiftKey : false;
      
      // Update global store immediately for instant visual feedback
      if (shiftKey) {
        toggleLane(signalIndex);
      } else {
        // Clear all other selections and select only this lane
        selectedLanes.set(new Set([signalIndex]));
      }
      
      // Still dispatch event for compatibility with existing selection logic
      dispatch('laneselection', {
        signalIndex,
        signalName: signal.name,
        shiftKey
      });
    }

    // Helper function to determine if a cell should show reduced internal borders
    function hasReducedBorders(cycleIndex: number): { left: boolean; right: boolean } {
      const isCurrentSelected = isCellSelected(signalIndex, cycleIndex);
      if (!isCurrentSelected) return { left: false, right: false };
      
      const isPrevSelected = cycleIndex > 0 ? isCellSelected(signalIndex, cycleIndex - 1) : false;
      const isNextSelected = cycleIndex < maxCycles - 1 ? isCellSelected(signalIndex, cycleIndex + 1) : false;
      
      return {
        left: isPrevSelected, // Reduce left border if previous cell is selected
        right: isNextSelected  // Reduce right border if next cell is selected
      };
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

    // Drag and drop handlers
    function handleDragStart(event: DragEvent) {
      isDragging = true;
      
      // Use the new tree path system for precise identification
      dispatch('dragstart', { path: treePath, itemType: 'signal', event });
    }

    function handleDragEnd(event: DragEvent) {
      isDragging = false;
      draggedOverPosition = null;
    }

    function handleDragOver(event: DragEvent) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      
      // Determine if dragging over top or bottom half
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      draggedOverPosition = event.clientY < middleY ? 'above' : 'below';
    }

    function handleDragLeave(event: DragEvent) {
      draggedOverPosition = null;
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault();
      const position = draggedOverPosition === 'above' ? 'before' : 'after';
      
      // Use the new tree path system
      dispatch('drop', { targetPath: treePath, position, event });
      
      draggedOverPosition = null;
      isDragging = false;
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
  
  <div class="signal-lane" 
       class:dragging={isDragging}
       class:lane-selected={isLaneSelected}
       class:drag-over-above={draggedOverPosition === 'above'}
       class:drag-over-below={draggedOverPosition === 'below'}
       style="--hscale: {hscale}; --cycle-height: 40px;">
    <!-- Signal Name -->
    <div class="signal-name-container"
         draggable="true"
         on:dragstart={handleDragStart}
         on:dragend={handleDragEnd}
         on:dragover={handleDragOver}
         on:dragleave={handleDragLeave}
         on:drop={handleDrop}>
      {#if isEditingName}
        <input
          type="text"
          class="signal-name-input"
          bind:value={nameInput}
          on:blur={finishEditingName}
          on:keydown={handleNameKeydown}
          autofocus
        />
      {:else}
        <div class="signal-name-display">
          <span class="signal-name-text" 
                on:click={handleLaneSelection}
                title="Click to select entire lane"
                role="button"
                tabindex="0"
                on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLaneSelection(e); }}
          >{signal.name}</span>
          <button 
            class="edit-name-button"
            on:click={startEditingName}
            title="Edit signal name"
            aria-label="Edit signal name"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M8.5 1.5 L10.5 3.5 L3.5 10.5 L1.5 11 L2 8.5 L8.5 1.5 Z M7.5 2.5 L9.5 4.5" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
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
        {@const reducedBorders = hasReducedBorders(cycle.cycleIndex)}
        
        <!-- Render the cycle -->
        <SignalCycle
          {cycle}
          {hscale}
          {signalIndex}
          {isSelected}
          {hasLeftTransition}
          {hasRightTransition}
          hasReducedLeftBorder={reducedBorders.left}
          hasReducedRightBorder={reducedBorders.right}
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
      position: relative;
      /* No transition for immediate lane selection updates */
    }

    .signal-lane.dragging {
      opacity: 0.5;
    }

    .signal-lane.drag-over-above::before {
      content: '';
      position: absolute;
      top: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: #3b82f6;
      z-index: 10;
    }

    .signal-lane.drag-over-below::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: #3b82f6;
      z-index: 10;
    }

    /* Lane selection highlighting */
    .signal-lane.lane-selected {
      background-color: rgba(59, 130, 246, 0.15) !important;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
      border-radius: 4px;
      z-index: 5;
    }

    .signal-lane.lane-selected .signal-name-container {
      background-color: rgba(59, 130, 246, 0.2) !important;
      border-radius: 4px 0 0 4px;
    }

    .signal-lane.lane-selected .signal-cycles {
      background-color: rgba(59, 130, 246, 0.1);
      border-radius: 0 4px 4px 0;
    }
  
    .signal-name-container {
      width: var(--name-width);
      display: flex;
      align-items: center;
      padding: 0 12px;
      background-color: transparent;
      border-right: 1px solid var(--border-color);
      flex-shrink: 0;
      z-index: 2; /* Above grid lines */
      cursor: grab;
      /* No transition for immediate lane selection updates */
    }

    .signal-name-container:active {
      cursor: grabbing;
    }

    .signal-name-container:hover {
      background-color: rgba(59, 130, 246, 0.05);
      transition: background-color 0.15s ease; /* Only transition on hover */
    }
  
    .signal-name-display {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 8px;
    }

    .signal-name-text {
      color: var(--text-color);
      font-weight: 500;
      flex: 1;
      text-align: left;
      cursor: pointer;
      padding: 4px;
      border-radius: 3px;
      transition: background-color 0.15s ease;
    }

    .signal-name-text:hover {
      background-color: rgba(59, 130, 246, 0.1);
    }

    .signal-name-text:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
    }

    .edit-name-button {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      color: #6b7280;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .edit-name-button:hover {
      background-color: #e5e7eb;
      color: #374151;
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
  