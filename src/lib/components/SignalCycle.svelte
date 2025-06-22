<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let cycle: {
    cycleIndex: number;
    originalChar: string;
    effectiveChar: string;
    isInteractive: boolean;
    dataValue?: string;
    displayText?: string;
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

  // Get the vertical position where the signal line is located (as percentage from top)
  export function getSignalLinePosition(): number {
    const type = getCycleType();
    
    switch (type) {
      case 'high':
        return 20; // 20% from top
      case 'low':
        return 80; // 80% from top (20% from bottom)
      case 'data':
      case 'x':
      case 'z':
      case 'clock':
        return 50; // Middle
      case 'gap':
      case 'empty':
      default:
        return 50; // Middle for unknown states
    }
  }

  // Get the absolute pixel position for the signal line
  function getSignalLinePixelPosition(): number {
    const percentage = getSignalLinePosition();
    // Convert percentage to pixels based on the cycle height (40px default)
    const cycleHeight = 40;
    return (percentage / 100) * cycleHeight;
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
  $: cycleWidth = (40 - 8) * hscale; // Subtract transition width
  $: signalLinePixelPos = getSignalLinePixelPosition();
</script>

<div 
  class="signal-cycle {cycleType}"
  class:interactive={cycle.isInteractive}
  class:selected={isSelected}
  style="
    width: {cycleWidth}px;
    --signal-line-y: {signalLinePixelPos}px;
  "
  data-cycle-index={cycle.cycleIndex}
  on:click={handleClick}
  on:contextmenu={handleRightClick}
  role={cycle.isInteractive ? 'button' : 'presentation'}
  title={cycle.isInteractive ? `Cycle ${cycle.cycleIndex}: ${cycle.effectiveChar || 'empty'} (right-click for options)` : `Cycle ${cycle.cycleIndex}: ${cycle.effectiveChar}`}
>
  <!-- Signal visualization -->
  <div class="signal-visual">
    {#if cycleType === 'high'}
      <div class="signal-line high-line"></div>
    {:else if cycleType === 'low'}
      <div class="signal-line low-line"></div>
    {:else if cycleType === 'data' && cycle.dataValue}
      <div class="data-shape">
        {#if cycle.displayText}
          <div class="data-value">{cycle.displayText}</div>
        {/if}
      </div>
    {:else if cycleType === 'x'}
      <div class="x-pattern">
        <!-- Diagonal hatching background pattern -->
        <div class="x-top-border"></div>
        <div class="x-bottom-border"></div>
      </div>
    {:else if cycleType === 'z'}
      <div class="z-line">
        <div class="z-top-border"></div>
        <div class="z-bottom-border"></div>
      </div>
    {:else if cycleType === 'clock'}
      {#if cycle.effectiveChar === 'p' || cycle.effectiveChar === 'P'}
        <!-- Positive clock -->
        <svg width="100%" height="100%" viewBox="0 0 32 40" preserveAspectRatio="none">
          <polyline points="0,32 8,32 8,8 24,8 24,32 32,32" fill="none" stroke="#10b981" stroke-width="2"/>
        </svg>
      {:else if cycle.effectiveChar === 'n' || cycle.effectiveChar === 'N'}
        <!-- Negative clock -->
        <svg width="100%" height="100%" viewBox="0 0 32 40" preserveAspectRatio="none">
          <polyline points="0,8 8,8 8,32 24,32 24,8 32,8" fill="none" stroke="#10b981" stroke-width="2"/>
        </svg>
      {:else}
        <!-- Other clock states -->
        <div class="signal-line {cycle.effectiveChar === 'h' || cycle.effectiveChar === 'H' ? 'high-line' : 'low-line'}"></div>
      {/if}
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
    transition: all 0.15s ease;
    user-select: none;
    flex-shrink: 0;
  }

  .signal-cycle.interactive {
    cursor: pointer;
  }

  .signal-cycle.interactive:hover {
    background-color: rgba(59, 130, 246, 0.1);
  }

  .signal-cycle.selected {
    background-color: rgba(59, 130, 246, 0.3) !important;
    box-shadow: 0 0 0 2px #3b82f6;
    z-index: 10;
  }

  .signal-visual {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  /* Signal lines for binary signals */
  .signal-line {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: #2563eb;
    left: 0;
    top: var(--signal-line-y);
    transform: translateY(-50%);
  }

  .high-line {
    /* Position controlled by CSS variable */
  }

  .low-line {
    /* Position controlled by CSS variable */
  }

  /* Data signal shapes */
  .data-shape {
    position: absolute;
    width: 100%;
    height: 70%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    top: var(--signal-line-y);
    left: 0;
    transform: translateY(-50%);
    background-color: #f3f4f6;
    border-top: 2px solid #6b7280;
    border-bottom: 2px solid #6b7280;
  }

  .data-shape::before {
    content: '';
    position: absolute;
    left: -2px;
    top: -2px;
    width: 0;
    height: 0;
    border-top: calc(50% + 2px) solid transparent;
    border-bottom: calc(50% + 2px) solid transparent;
    border-right: 12% solid #6b7280;
  }

  .data-shape::after {
    content: '';
    position: absolute;
    right: -2px;
    top: -2px;
    width: 0;
    height: 0;
    border-top: calc(50% + 2px) solid transparent;
    border-bottom: calc(50% + 2px) solid transparent;
    border-left: 12% solid #6b7280;
  }

  .data-background {
    position: absolute;
    width: 85%;
    height: 100%;
    left: 7.5%;
    background-color: #f3f4f6;
    border-top: 2px solid #6b7280;
    border-bottom: 2px solid #6b7280;
  }

  .data-left-edge {
    position: absolute;
    left: 7.5%;
    top: 0;
    width: 0;
    height: 0;
    border-top: 50% solid #f3f4f6;
    border-bottom: 50% solid #f3f4f6;
    border-left: 7.5% solid transparent;
    z-index: 2;
  }

  .data-left-edge::after {
    content: '';
    position: absolute;
    left: -7.5%;
    top: -50%;
    width: 0;
    height: 0;
    border-top: 50% solid transparent;
    border-bottom: 50% solid transparent;
    border-right: 7.5% solid #6b7280;
  }

  .data-right-edge {
    position: absolute;
    right: 7.5%;
    top: 0;
    width: 0;
    height: 0;
    border-top: 50% solid #f3f4f6;
    border-bottom: 50% solid #f3f4f6;
    border-right: 7.5% solid transparent;
    z-index: 2;
  }

  .data-right-edge::after {
    content: '';
    position: absolute;
    right: -7.5%;
    top: -50%;
    width: 0;
    height: 0;
    border-top: 50% solid transparent;
    border-bottom: 50% solid transparent;
    border-left: 7.5% solid #6b7280;
  }

  .data-value {
    color: #1f2937;
    font-size: 12px;
    font-weight: 500;
    font-family: 'Arial', sans-serif;
    z-index: 3;
    position: relative;
    user-select: none;
    pointer-events: none;
    text-align: center;
    line-height: 1;
  }



  /* X pattern for unknown/undefined */
  .x-pattern {
    position: absolute;
    width: 100%;
    height: 60%;
    top: var(--signal-line-y);
    left: 0;
    transform: translateY(-50%);
    background-image: 
      radial-gradient(circle at 25% 25%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 25% 75%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 75%, #9ca3af 0.5px, transparent 0.5px);
    background-size: 6px 6px;
    opacity: 0.6;
  }

  .x-top-border, .x-bottom-border {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: #2563eb;
    left: 0;
  }

  .x-top-border {
    top: 0;
  }

  .x-bottom-border {
    bottom: 0;
  }

  /* Z-state (high impedance) */
  .z-line {
    position: absolute;
    width: 100%;
    height: 60%;
    top: var(--signal-line-y);
    left: 0;
    transform: translateY(-50%);
    background-image: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 4px,
        #f59e0b 4px,
        #f59e0b 6px
      );
    opacity: 0.8;
  }

  .z-top-border, .z-bottom-border {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: #2563eb;
    left: 0;
  }

  .z-top-border {
    top: 0;
  }

  .z-bottom-border {
    bottom: 0;
  }

  /* Gap indicators */
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

  /* Empty cycle overlay */
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
