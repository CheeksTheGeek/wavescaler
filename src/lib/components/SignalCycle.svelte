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
  export let hasLeftTransition: boolean = false;
  export let hasRightTransition: boolean = false;
  export let hasReducedLeftBorder: boolean = false;
  export let hasReducedRightBorder: boolean = false;

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
  $: cycleWidth = 40 * hscale; // Use full cycle width like WaveDrom
  $: signalLinePixelPos = getSignalLinePixelPosition();
  
  // Calculate signal line positioning based on adjacent transitions
  $: transitionWidth = 8 * hscale;
  $: leftOffset = hasLeftTransition ? transitionWidth / 2 : 0;
  $: rightOffset = hasRightTransition ? transitionWidth / 2 : 0;
  $: signalLineWidth = cycleWidth - leftOffset - rightOffset;
  $: signalLineLeft = leftOffset;
  
  // Force immediate visual update when cycle data changes
  $: cycleKey = `${cycle.cycleIndex}-${cycle.effectiveChar}-${cycle.originalChar}`;
  
  // Reactive update to ensure immediate rendering when cycle changes
  let forceUpdate = 0;
  $: if (cycle.effectiveChar) {
    forceUpdate++;
  }
</script>

<div 
  class="signal-cycle {cycleType}"
  class:interactive={cycle.isInteractive}
  class:selected={isSelected}
  class:reduced-left-border={hasReducedLeftBorder}
  class:reduced-right-border={hasReducedRightBorder}
  style="
    width: {cycleWidth}px;
    --signal-line-y: {signalLinePixelPos}px;
    --signal-line-width: {signalLineWidth}px;
    --signal-line-left: {signalLineLeft}px;
  "
  data-cycle-index={cycle.cycleIndex}
  data-cycle-key={cycleKey}
  data-force-update={forceUpdate}
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
        <!-- Background fill pattern with opacity for grid transparency -->
        <div class="x-pattern-fill"></div>
        <!-- Signal line borders with full opacity -->
        <div class="x-top-border"></div>
        <div class="x-bottom-border"></div>
      </div>
    {:else if cycleType === 'z'}
      <div class="z-line">
        <!-- Background fill pattern with opacity for grid transparency -->
        <div class="z-line-fill"></div>
        <!-- Signal line borders with full opacity -->
        <div class="z-top-border"></div>
        <div class="z-bottom-border"></div>
      </div>
    {:else if cycleType === 'clock'}
      {#if cycle.effectiveChar === 'p' || cycle.effectiveChar === 'P'}
        <!-- Positive clock - starts low, rising edge at beginning -->
        <div class="clock-shape positive-clock">
          <div class="clock-rising-edge"></div>
          <div class="clock-high-segment"></div>
          <div class="clock-falling-edge"></div>
          <div class="clock-low-segment"></div>
          {#if cycle.effectiveChar === 'P'}
            <div class="working-edge-marker rising"></div>
          {/if}
        </div>
      {:else if cycle.effectiveChar === 'n' || cycle.effectiveChar === 'N'}
        <!-- Negative clock - starts high, falling edge at beginning -->
        <div class="clock-shape negative-clock">
          <div class="clock-falling-edge"></div>
          <div class="clock-low-segment"></div>
          <div class="clock-rising-edge"></div>
          <div class="clock-high-segment"></div>
          {#if cycle.effectiveChar === 'N'}
            <div class="working-edge-marker falling"></div>
          {/if}
        </div>
      {:else}
        <!-- Other clock states (h, H, l, L) - static high or low -->
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
    /* Only animate background-color and opacity, not all properties */
    transition: background-color 0.15s ease, opacity 0.15s ease;
    user-select: none;
    flex-shrink: 0;
    background-color: transparent; /* Allow grid lines to show through */
    /* Optimize for smooth scaling */
    will-change: transform;
    transform: translateZ(0); /* Force hardware acceleration */
    /* Ensure sub-pixel precision */
    backface-visibility: hidden;
    -webkit-font-smoothing: subpixel-antialiased;
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

  /* Reduced border styling for consecutive selections */
  .signal-cycle.selected.reduced-left-border {
    box-shadow: 
      0 2px 0 0 #3b82f6,      /* top */
      0 -2px 0 0 #3b82f6,     /* bottom */
      2px 0 0 0 #3b82f6;      /* right */
    /* left border removed */
  }

  .signal-cycle.selected.reduced-right-border {
    box-shadow: 
      0 2px 0 0 #3b82f6,      /* top */
      0 -2px 0 0 #3b82f6,     /* bottom */
      -2px 0 0 0 #3b82f6;     /* left */
    /* right border removed */
  }

  .signal-cycle.selected.reduced-left-border.reduced-right-border {
    box-shadow: 
      0 2px 0 0 #3b82f6,      /* top */
      0 -2px 0 0 #3b82f6;     /* bottom */
    /* left and right borders removed */
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
    width: var(--signal-line-width);
    height: 2px;
    background-color: #2563eb;
    left: var(--signal-line-left);
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
    width: var(--signal-line-width);
    height: 70%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    top: var(--signal-line-y);
    left: var(--signal-line-left);
    transform: translateY(-50%);
    background-color: #f3f4f6;
    border-top: 2px solid #2563eb;
    border-bottom: 2px solid #2563eb;
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
    border-right: 12% solid #2563eb;
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
    border-left: 12% solid #2563eb;
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
    width: var(--signal-line-width);
    height: 70%;
    top: var(--signal-line-y);
    left: var(--signal-line-left);
    transform: translateY(-50%);
  }

  .x-pattern-fill {
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: 
      radial-gradient(circle at 25% 25%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 25% 75%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 75%, #9ca3af 0.5px, transparent 0.5px);
    background-size: 6px 6px;
    opacity: 0.6; /* Keep opacity for grid transparency */
  }

  .x-top-border, .x-bottom-border {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: #2563eb;
    left: 0;
    opacity: 1; /* Ensure full opacity for signal lines */
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
    width: var(--signal-line-width);
    height: 60%;
    top: var(--signal-line-y);
    left: var(--signal-line-left);
    transform: translateY(-50%);
  }

  .z-line-fill {
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 4px,
        #f59e0b 4px,
        #f59e0b 6px
      );
    opacity: 0.8; /* Keep opacity for grid transparency */
  }

  .z-top-border, .z-bottom-border {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: #2563eb;
    left: 0;
    opacity: 1; /* Ensure full opacity for signal lines */
  }

  .z-top-border {
    top: 0;
  }

  .z-bottom-border {
    bottom: 0;
  }

  /* Clock shapes */
  .clock-shape {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
  }

  .clock-low-segment, .clock-high-segment {
    position: absolute;
    width: calc(var(--signal-line-width) / 2);
    height: 2px;
    background-color: #10b981;
  }

  .positive-clock .clock-high-segment {
    left: var(--signal-line-left);
    top: 20%;
    transform: translateY(-50%);
  }

  .positive-clock .clock-low-segment {
    left: calc(var(--signal-line-left) + var(--signal-line-width) / 2);
    top: 80%;
    transform: translateY(-50%);
  }

  .negative-clock .clock-high-segment {
    left: calc(var(--signal-line-left) + var(--signal-line-width) / 2);
    top: 20%;
    transform: translateY(-50%);
  }

  .negative-clock .clock-low-segment {
    left: var(--signal-line-left);
    top: 80%;
    transform: translateY(-50%);
  }

  .clock-rising-edge, .clock-falling-edge {
    position: absolute;
    width: 2px;
    height: 60%;
    background-color: #10b981;
    top: 50%;
    transform: translateY(-50%);
  }

  .positive-clock .clock-rising-edge {
    left: var(--signal-line-left);
  }

  .positive-clock .clock-falling-edge {
    left: calc(var(--signal-line-left) + var(--signal-line-width) / 2);
  }

  .negative-clock .clock-falling-edge {
    left: var(--signal-line-left);
  }

  .negative-clock .clock-rising-edge {
    left: calc(var(--signal-line-left) + var(--signal-line-width) / 2);
  }

  .working-edge-marker {
    position: absolute;
    width: 6px;
    height: 6px;
    background-color: #10b981;
    border-radius: 50%;
    top: 50%;
    transform: translateY(-50%);
  }

  .working-edge-marker.rising {
    left: -3px;
  }

  .working-edge-marker.falling {
    left: -3px;
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
