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
  export let underlyingSignal: string | null = null;

  const dispatch = createEventDispatcher<{
    cyclechange: { signalIndex: number; cycleIndex: number; newChar: string };
    bulkcyclechange: { startIndex: number; endIndex: number; newChar: string };
    cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
    rightclick: { signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string; isImplicit: boolean; isExplicit: boolean };
  }>();

  // Determine if this cycle is implicit (using . notation) vs explicit (hardcoded)
  $: isImplicit = cycle.originalChar === '.';
  $: isExplicit = !isImplicit && cycle.originalChar !== '';

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

  // Get the underlying signal type for gap characters
  function getUnderlyingType(): 'high' | 'low' | 'x' | 'z' | 'data' | 'clock' | 'empty' | 'unknown' {
    if (!underlyingSignal) return 'empty';
    const char = underlyingSignal;
    
    if (char === '1' || char === 'h' || char === 'H' || char === 'P') return 'high';
    if (char === '0' || char === 'l' || char === 'L' || char === 'N') return 'low';
    if (char === 'x') return 'x';
    if (char === 'z') return 'z';
    if (['=', '2', '3', '4', '5'].includes(char)) return 'data';
    if (['p', 'P', 'n', 'N', 'h', 'l', 'H', 'L'].includes(char)) return 'clock';
    if (char === '') return 'empty';
    return 'unknown';
  }

  // Get the vertical position where the signal line is located (as percentage from top)
  export function getSignalLinePosition(): number {
    const type = getCycleType();
    
    // For gaps, use the underlying signal position
    if (type === 'gap') {
      const underlyingType = getUnderlyingType();
      switch (underlyingType) {
        case 'high':
          return 20; // 20% from top
        case 'low':
          return 80; // 80% from top (20% from bottom)
        case 'data':
        case 'x':
        case 'z':
        case 'clock':
          return 50; // Middle
        default:
          return 50; // Middle for unknown states
      }
    }
    
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
      case 'empty':
      default:
        return 50; // Middle for unknown states
    }
  }

  // For gap cycles, calculate CSS variables based on underlying signal
  $: gapSignalLineY = (() => {
    if (getCycleType() !== 'gap') {
      return signalLinePixelPos;
    }

    const underlyingType = getUnderlyingType();
    let yPercent: number;
    switch (underlyingType) {
      case 'high':
        yPercent = 20; // 20% from top
        break;
      case 'low':
        yPercent = 80; // 80% from top (20% from bottom)
        break;
      case 'data':
      case 'x':
      case 'z':
      case 'clock':
      default:
        yPercent = 50; // Middle
        break;
    }
    
    const cycleHeight = 40;
    return (yPercent / 100) * cycleHeight;
  })();

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

  function handleCycleChange(newChar: string) {
    dispatch('cyclechange', {
      signalIndex,
      cycleIndex: cycle.cycleIndex,
      newChar
    });
  }

  function handleRightClick(event: MouseEvent) {
    event.preventDefault();
    
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    
    const rect = target.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    dispatch('rightclick', {
      signalIndex,
      cycleIndex: cycle.cycleIndex,
      x,
      y,
      currentValue: cycle.effectiveChar,
      isImplicit: cycle.originalChar === '.',
      isExplicit: cycle.originalChar !== '.'
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
    --signal-line-y: {gapSignalLineY}px;
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
      <!-- Show the underlying signal that continues through the gap -->
      {@const underlyingType = getUnderlyingType()}
      
      {#if underlyingType === 'high'}
        <div class="signal-line high-line"></div>
      {:else if underlyingType === 'low'}
        <div class="signal-line low-line"></div>
      {:else if underlyingType === 'x'}
        <div class="x-pattern">
          <div class="x-pattern-fill"></div>
          <div class="x-top-border"></div>
          <div class="x-bottom-border"></div>
        </div>
      {:else if underlyingType === 'z'}
        <div class="z-line">
          <div class="z-line-fill"></div>
          <div class="z-top-border"></div>
          <div class="z-bottom-border"></div>
        </div>
      {:else if underlyingType === 'data'}
        <div class="data-shape">
          <!-- Data shape continues through gap - no text shown in gap -->
        </div>
      {:else if underlyingType === 'clock'}
        <!-- Clock signal underlying - show the actual clock waveform continuing -->
        {#if underlyingSignal === 'p' || underlyingSignal === 'P'}
          <!-- Positive clock - show the full clock pattern continuing -->
          <div class="clock-shape positive-clock">
            <div class="clock-rising-edge"></div>
            <div class="clock-high-segment"></div>
            <div class="clock-falling-edge"></div>
            <div class="clock-low-segment"></div>
            {#if underlyingSignal === 'P'}
              <div class="working-edge-marker rising"></div>
            {/if}
          </div>
        {:else if underlyingSignal === 'n' || underlyingSignal === 'N'}  
          <!-- Negative clock - show the full clock pattern continuing -->
          <div class="clock-shape negative-clock">
            <div class="clock-falling-edge"></div>
            <div class="clock-low-segment"></div>
            <div class="clock-rising-edge"></div>
            <div class="clock-high-segment"></div>
            {#if underlyingSignal === 'N'}
              <div class="working-edge-marker falling"></div>
            {/if}
          </div>
        {:else}
          <!-- Other clock states (h, H, l, L) - static high or low -->
          <div class="signal-line {underlyingSignal === 'h' || underlyingSignal === 'H' ? 'high-line' : 'low-line'}"></div>
        {/if}
      {:else}
        <!-- Default case - show a signal line at middle -->
        <div class="signal-line"></div>
      {/if}
      
      <!-- Overlay the gap indicators on top -->
      <div class="gap-overlay">
        <div class="gap-line"></div>
        <div class="gap-line"></div>
      </div>
    {/if}
  </div>
  
  <!-- Interactive overlay for empty cycles -->
  {#if cycle.isInteractive && cycleType === 'empty'}
    <div class="empty-overlay">+</div>
  {/if}
  
  <!-- Implicit/Explicit indicator -->
  {#if isImplicit}
    <div class="signal-mode-indicator implicit" title="Implicit: Repeating previous value (.)">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <circle cx="4" cy="2" r="0.8" fill="currentColor" opacity="0.7"/>
        <circle cx="4" cy="4" r="0.8" fill="currentColor" opacity="0.7"/>
        <circle cx="4" cy="6" r="0.8" fill="currentColor" opacity="0.7"/>
      </svg>
    </div>
  {:else if isExplicit}
    <div class="signal-mode-indicator explicit" title="Explicit: Hardcoded value">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <rect x="2" y="2" width="4" height="4" fill="currentColor" opacity="0.8"/>
      </svg>
    </div>
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
    background-color: var(--color-accent-light);
  }

  .signal-cycle.selected {
    background-color: var(--color-accent-medium) !important;
    box-shadow: 0 0 0 2px var(--color-accent-primary);
    z-index: 10;
  }

  /* Reduced border styling for consecutive selections */
  .signal-cycle.selected.reduced-left-border {
    box-shadow: 
      0 2px 0 0 var(--color-accent-primary),      /* top */
      0 -2px 0 0 var(--color-accent-primary),     /* bottom */
      2px 0 0 0 var(--color-accent-primary);      /* right */
    /* left border removed */
  }

  .signal-cycle.selected.reduced-right-border {
    box-shadow: 
      0 2px 0 0 var(--color-accent-primary),      /* top */
      0 -2px 0 0 var(--color-accent-primary),     /* bottom */
      -2px 0 0 0 var(--color-accent-primary);     /* left */
    /* right border removed */
  }

  .signal-cycle.selected.reduced-left-border.reduced-right-border {
    box-shadow: 
      0 2px 0 0 var(--color-accent-primary),      /* top */
      0 -2px 0 0 var(--color-accent-primary);     /* bottom */
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
    background-color: var(--color-signal-high);
    left: var(--signal-line-left);
    top: var(--signal-line-y);
    transform: translateY(-50%);
    transition: background-color 0.2s ease;
  }

  /* high-line and low-line positioning is controlled by CSS variables in parent */

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
    background-color: var(--color-signal-data-bg);
    border-top: 2px solid var(--color-signal-high);
    border-bottom: 2px solid var(--color-signal-high);
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
    border-right: 12% solid var(--color-signal-high);
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
    border-left: 12% solid var(--color-signal-high);
  }

  .data-background {
    position: absolute;
    width: 85%;
    height: 100%;
    left: 7.5%;
    background-color: var(--color-signal-data-bg);
    border-top: 2px solid var(--color-signal-data-border);
    border-bottom: 2px solid var(--color-signal-data-border);
    transition: all 0.2s ease;
  }

  .data-left-edge {
    position: absolute;
    left: 7.5%;
    top: 0;
    width: 0;
    height: 0;
    border-top: 50% solid var(--color-signal-data-bg);
    border-bottom: 50% solid var(--color-signal-data-bg);
    border-left: 7.5% solid transparent;
    z-index: 2;
    transition: border-color 0.2s ease;
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
    border-right: 7.5% solid var(--color-signal-data-border);
    transition: border-color 0.2s ease;
  }

  .data-right-edge {
    position: absolute;
    right: 7.5%;
    top: 0;
    width: 0;
    height: 0;
    border-top: 50% solid var(--color-signal-data-bg);
    border-bottom: 50% solid var(--color-signal-data-bg);
    border-right: 7.5% solid transparent;
    z-index: 2;
    transition: border-color 0.2s ease;
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
    border-left: 7.5% solid var(--color-signal-data-border);
    transition: border-color 0.2s ease;
  }

  .data-value {
    color: var(--color-text-primary);
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
      radial-gradient(circle at 25% 25%, var(--color-signal-unknown) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, var(--color-signal-unknown) 0.5px, transparent 0.5px),
      radial-gradient(circle at 25% 75%, var(--color-signal-unknown) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 75%, var(--color-signal-unknown) 0.5px, transparent 0.5px);
    background-size: 6px 6px;
    opacity: 0.6; /* Keep opacity for grid transparency */
    transition: background-image 0.2s ease;
  }

  .x-top-border, .x-bottom-border {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: var(--color-signal-high);
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
        var(--color-warning) 4px,
        var(--color-warning) 6px
      );
    opacity: 0.8; /* Keep opacity for grid transparency */
    transition: background-image 0.2s ease;
  }

  .z-top-border, .z-bottom-border {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: var(--color-signal-high);
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
    background-color: var(--color-success);
    transition: background-color 0.2s ease;
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
    background-color: var(--color-success);
    top: 50%;
    transform: translateY(-50%);
    transition: background-color 0.2s ease;
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
    background-color: var(--color-success);
    border-radius: 50%;
    top: 50%;
    transform: translateY(-50%);
    transition: background-color 0.2s ease;
  }

  .working-edge-marker.rising {
    left: -3px;
  }

  .working-edge-marker.falling {
    left: -3px;
  }

  /* Gap overlay - simple WaveDrom style timeskip */
  .gap-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
    z-index: 10;
  }

  .gap-line {
    width: 2px;
    height: 80%;
    background: var(--color-signal-high);
    margin: 0 2px;
    border-radius: 2px 2px 8px 8px;
    transform: skewX(-15deg);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
  }
  
  .gap-line:first-child {
    border-radius: 8px 2px 2px 8px;
  }
  
  .gap-line:nth-child(2) {
    border-radius: 2px 8px 8px 2px;
  }

  /* Empty cycle overlay */
  .empty-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--color-text-tertiary);
    font-weight: bold;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.2s ease;
  }

  .signal-cycle.empty:hover .empty-overlay {
    opacity: 1;
  }

  /* Keyboard focus */
  .signal-cycle:focus {
    outline: 2px solid var(--color-accent-primary);
    outline-offset: -2px;
  }

  /* Signal mode indicators */
  .signal-mode-indicator {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    pointer-events: none;
    z-index: 10;
    opacity: 0;
    transition: all 0.2s ease;
  }

  .signal-cycle:hover .signal-mode-indicator {
    opacity: 1;
  }

  .signal-mode-indicator.implicit {
    background-color: rgba(245, 158, 11, 0.8);
    color: var(--color-text-inverse);
  }

  .signal-mode-indicator.explicit {
    background-color: rgba(59, 130, 246, 0.8);
    color: var(--color-text-inverse);
  }

  /* Show indicators when cell is selected */
  .signal-cycle.selected .signal-mode-indicator {
    opacity: 1;
  }

  /* Responsive indicator sizing */
  @media (max-width: 768px) {
    .signal-mode-indicator {
      width: 10px;
      height: 10px;
      top: 1px;
      right: 1px;
    }
    
    .signal-mode-indicator svg {
      width: 6px;
      height: 6px;
    }
  }
</style> 
