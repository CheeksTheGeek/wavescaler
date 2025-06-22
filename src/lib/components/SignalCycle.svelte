<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let cycle: {
    cycleIndex: number;
    originalChar: string;
    effectiveChar: string;
    isInteractive: boolean;
    dataValue?: string;
  };
  export let hscale: number = 1;
  export let signalIndex: number;
  export let isSelected: boolean = false;

  const dispatch = createEventDispatcher<{
    cyclechange: { cycleIndex: number; newChar: string };
    bulkcyclechange: { startIndex: number; endIndex: number; newChar: string };
    cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
    rightclick: { signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string };
  }>();

  // Get visual representation for the cycle
  function getCycleType(): 'high' | 'low' | 'x' | 'z' | 'data' | 'clock' | 'gap' | 'empty' | 'unknown' {
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

  function handleClick(event: MouseEvent) {
    // Only handle selection, no value toggling
    dispatch('cellselection', { 
      signalIndex, 
      cycleIndex: cycle.cycleIndex, 
      shiftKey: event.shiftKey 
    });
  }

  function handleRightClick(event: MouseEvent) {
    event.preventDefault();
    
    // Only show context menu for interactive cycles
    if (!cycle.isInteractive) return;
    
    dispatch('rightclick', {
      signalIndex,
      cycleIndex: cycle.cycleIndex,
      x: event.clientX,
      y: event.clientY,
      currentValue: cycle.effectiveChar || ''
    });
  }

  $: cycleType = getCycleType();
  $: cycleWidth = 20 * hscale;
</script>

<div 
  class="signal-cycle {cycleType}"
  class:interactive={cycle.isInteractive}
  class:selected={isSelected}
  style="width: {cycleWidth}px"
  data-cycle-index={cycle.cycleIndex}
  on:click={handleClick}
  on:contextmenu={handleRightClick}
  role={cycle.isInteractive ? 'button' : 'presentation'}
  title={cycle.isInteractive ? `Cycle ${cycle.cycleIndex}: ${cycle.effectiveChar || 'empty'} (right-click for options)` : `Cycle ${cycle.cycleIndex}: ${cycle.effectiveChar}`}
>
  <!-- Signal visualization -->
  <div class="signal-visual">
    {#if cycleType === 'data' && cycle.dataValue}
      <div class="data-value">{cycle.dataValue}</div>
    {:else if cycleType === 'x'}
      <div class="x-pattern">
        <div class="x-line-1"></div>
        <div class="x-line-2"></div>
      </div>
    {:else if cycleType === 'gap'}
      <div class="gap-lines">
        <div class="gap-line"></div>
        <div class="gap-line"></div>
      </div>
    {/if}
  </div>
  
  <!-- Interactive overlay for empty cycles -->
  {#if cycle.isInteractive && cycleType === 'empty'}
    <div class="empty-overlay">+</div>
  {/if}
</div>

<style>
  .signal-cycle {
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid rgba(229, 229, 229, 0.5);
    transition: all 0.15s ease;
    user-select: none;
  }

  .signal-cycle.interactive {
    cursor: pointer;
  }

  .signal-cycle.interactive:hover {
    background-color: rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
  }

  .signal-cycle.selected {
    background-color: rgba(59, 130, 246, 0.3) !important;
    border: 2px solid #3b82f6 !important;
    box-shadow: 0 0 0 1px #3b82f6;
    z-index: 10;
  }

  /* Signal state styles */
  .signal-cycle.high {
    background-color: #dbeafe;
    border-top: 3px solid #3b82f6;
  }

  .signal-cycle.low {
    background-color: #dbeafe;
    border-bottom: 3px solid #3b82f6;
  }

  .signal-cycle.x {
    background-color: #fef2f2;
  }

  .signal-cycle.z {
    background-color: #fef3c7;
    border-top: 2px solid #f59e0b;
    border-bottom: 2px solid #f59e0b;
  }

  .signal-cycle.data {
    background-color: #f3f4f6;
    border: 2px solid #6b7280;
  }

  .signal-cycle.clock {
    background-color: #d1fae5;
    border-top: 2px solid #10b981;
    border-bottom: 2px solid #10b981;
  }

  .signal-cycle.gap {
    background-color: #f9fafb;
  }

  .signal-cycle.empty {
    background-color: #fafafa;
    border: 1px dashed #d1d5db;
  }

  .signal-cycle.unknown {
    background-color: #f3f4f6;
    border: 1px solid #ef4444;
  }

  .signal-visual {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .data-value {
    font-size: 10px;
    font-weight: 500;
    color: #374151;
    background-color: white;
    padding: 2px 4px;
    border-radius: 2px;
    border: 1px solid #d1d5db;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .x-pattern {
    position: relative;
    width: 80%;
    height: 60%;
  }

  .x-line-1,
  .x-line-2 {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: #ef4444;
    top: 50%;
    left: 0;
  }

  .x-line-1 {
    transform: translateY(-50%) rotate(45deg);
  }

  .x-line-2 {
    transform: translateY(-50%) rotate(-45deg);
  }

  .gap-lines {
    display: flex;
    flex-direction: column;
    height: 60%;
    justify-content: center;
    gap: 2px;
  }

  .gap-line {
    width: 2px;
    height: 8px;
    background-color: #9ca3af;
    margin: 0 auto;
  }

  .empty-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #9ca3af;
    font-weight: bold;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .signal-cycle.empty:hover .empty-overlay {
    opacity: 1;
  }

  /* Keyboard focus */
  .signal-cycle:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }
</style> 
