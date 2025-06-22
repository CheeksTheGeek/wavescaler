<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let fromCycle: {
    cycleIndex: number;
    originalChar: string;
    effectiveChar: string;
    isInteractive: boolean;
    dataValue?: string;
  };
  export let toCycle: {
    cycleIndex: number;
    originalChar: string;
    effectiveChar: string;
    isInteractive: boolean;
    dataValue?: string;
  };
  export let hscale: number = 1;

  const dispatch = createEventDispatcher<{
    transitionclick: { fromCycleIndex: number; toCycleIndex: number };
    transitiondrag: { fromCycleIndex: number; toCycleIndex: number; deltaY: number };
  }>();

  // Use the same positioning logic as SignalCycle to ensure perfect alignment
  $: fullCycleWidth = 40 * hscale;
  $: transitionWidth = 8 * hscale;
  $: halfTransitionWidth = transitionWidth / 2;
  
  // Calculate signal line positions for perfect alignment
  function getSignalLinePosition(cycle: typeof fromCycle): { y: number; left: number; width: number } {
    // Get visual representation for the cycle (same logic as SignalCycle)
    function getCycleType(c: typeof cycle): 'high' | 'low' | 'x' | 'z' | 'data' | 'clock' | 'gap' | 'empty' | 'unknown' {
      const char = c.effectiveChar;
      
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

    const type = getCycleType(cycle);
    
    // Get Y position (same logic as SignalCycle.getSignalLinePosition)
    let yPercent: number;
    switch (type) {
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
    const y = (yPercent / 100) * cycleHeight;
    
    // Calculate signal line width and position (same logic as SignalCycle)
    // For transitions, we need to know the signal line extends to the edge
    const rightOffset = halfTransitionWidth; // Signal line ends halfTransitionWidth from cycle edge
    const signalLineWidth = fullCycleWidth - rightOffset;
    
    return {
      y,
      left: 0, // Signal line starts at cycle beginning
      width: signalLineWidth
    };
  }

  // Get visual representation for the cycle
  function getCycleType(cycle: typeof fromCycle): 'high' | 'low' | 'x' | 'z' | 'data' | 'clock' | 'gap' | 'empty' | 'unknown' {
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

  function getTransitionType(): 'rising' | 'falling' | 'cross' | 'none' {
    const fromType = getCycleType(fromCycle);
    const toType = getCycleType(toCycle);
    
    // No transition if from/to empty
    if (fromType === 'empty' || toType === 'empty') {
      return 'none';
    }
    
    // For data signals, check if the actual data values are different
    if (fromType === 'data' && toType === 'data') {
      if (fromCycle.dataValue !== toCycle.dataValue) {
        return 'cross'; // Different data values need cross transition
      } else {
        return 'none'; // Same data value, no transition needed
      }
    }
    
    // No transition if same type and not data
    if (fromType === toType) {
      return 'none';
    }
    
    // Rising edge: low to high
    if (fromType === 'low' && toType === 'high') return 'rising';
    
    // Falling edge: high to low
    if (fromType === 'high' && toType === 'low') return 'falling';
    
    // All other transitions are crosses (including data transitions)
    return 'cross';
  }

  function needsCleanCrossTransition(): boolean {
    const fromType = getCycleType(fromCycle);
    const toType = getCycleType(toCycle);
    
    // Need clean cross when transitioning to/from undefined (x) or data signals
    return (fromType === 'x' || toType === 'x' || 
            fromType === 'data' || toType === 'data' ||
            fromType === 'z' || toType === 'z');
  }

  function hasDataTransition(): boolean {
    const fromType = getCycleType(fromCycle);
    const toType = getCycleType(toCycle);
    
    return fromType === 'data' || toType === 'data';
  }

  function handleClick(event: MouseEvent) {
    dispatch('transitionclick', {
      fromCycleIndex: fromCycle.cycleIndex,
      toCycleIndex: toCycle.cycleIndex
    });
  }

  function handleMouseDown(event: MouseEvent) {
    // Future: implement drag functionality
    event.preventDefault();
  }

  $: transitionType = getTransitionType();
  $: fromSignalPos = getSignalLinePosition(fromCycle);
  $: toSignalPos = getSignalLinePosition(toCycle);
  $: isCleanCross = needsCleanCrossTransition();
  $: isDataTransition = hasDataTransition();
  
  // Calculate transition geometry using exact signal line endpoints
  $: fromX = fromSignalPos.left + fromSignalPos.width; // End of from signal line
  $: toX = 0; // Start of to signal line (relative to transition container)
  $: fromY = fromSignalPos.y;
  $: toY = toSignalPos.y;
  $: deltaX = toX - fromX;
  $: deltaY = toY - fromY;
  
  // For cross transitions at the same Y level, force a visual separation
  $: adjustedDeltaY = (transitionType === 'cross' && Math.abs(deltaY) < 1) ? 8 : deltaY;
  $: lineAngle = Math.atan2(adjustedDeltaY, transitionWidth) * (180 / Math.PI);
  $: lineLength = Math.sqrt(transitionWidth * transitionWidth + adjustedDeltaY * adjustedDeltaY);
</script>

{#if transitionType !== 'none'}
  <div 
    class="signal-transition {transitionType}"
    class:interactive={true}
    class:data-transition={isDataTransition}
    style="
      width: {transitionWidth}px;
      --from-y: {fromY}px;
      --to-y: {toY}px;
      --line-angle: {lineAngle}deg;
      --line-length: {lineLength}px;
      --is-clean-cross: {isCleanCross ? 1 : 0};
      --cycle-height: {40}px;
    "
    on:click={handleClick}
    on:mousedown={handleMouseDown}
    role="button"
    tabindex="0"
    title="Transition: {fromCycle.effectiveChar} → {toCycle.effectiveChar}"
  >
    <!-- Rising transition -->
    {#if transitionType === 'rising'}
      <div class="transition-line rising"></div>
    <!-- Falling transition -->
    {:else if transitionType === 'falling'}
      <div class="transition-line falling"></div>
    <!-- Cross transition (for data/unknown changes) -->
    {:else if transitionType === 'cross'}
      <div class="cross-transition">
        <div class="cross-line cross-line-1"></div>
        <div class="cross-line cross-line-2"></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .signal-transition {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    cursor: pointer;
    transition: background-color 0.15s ease;
    /* Optimize for smooth rendering and scaling */
    will-change: transform;
    transform: translateZ(0); /* Force hardware acceleration */
    contain: layout style;
  }

  .signal-transition.interactive:hover {
    background-color: rgba(37, 99, 235, 0.1);
    border-radius: 2px;
  }

  .signal-transition:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
    border-radius: 2px;
  }

  /* Transition lines with calculated positioning */
  .transition-line {
    position: absolute;
    height: 2px;
    background-color: #2563eb;
    left: 0;
    top: var(--from-y);
    width: var(--line-length);
    transform-origin: left center;
    transform: translateY(-1px) rotate(var(--line-angle));
  }

  .rising {
    /* Rising edge: uses CSS calc for perfect positioning */
  }

  .falling {
    /* Falling edge: uses CSS calc for perfect positioning */
  }

  /* Cross transition container */
  .cross-transition {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .cross-line {
    position: absolute;
    height: 2px;
    background-color: #2563eb;
    left: 0;
    transform-origin: left center;
    width: var(--line-length);
    /* Ensure clean lines for pattern compatibility */
    z-index: 2;
  }

  .cross-line-1 {
    top: calc(var(--from-y) - 4px);
    transform: translateY(-1px) rotate(var(--line-angle));
  }

  .cross-line-2 {
    top: calc(var(--from-y) + 4px);
    transform: translateY(-1px) rotate(calc(-1 * var(--line-angle)));
  }

  /* Enhanced styling for data transitions */
  .signal-transition.data-transition .cross-line {
    /* Slightly thicker lines for data transitions to make them more visible */
    height: 2.5px;
    /* Ensure they connect precisely to data signal edges */
    z-index: 3;
  }

  .signal-transition.data-transition .cross-line-1 {
    /* Precise positioning for data signal connection */
    top: calc(var(--from-y) - 4px);
    transform: translateY(-1.25px) rotate(var(--line-angle));
  }

  .signal-transition.data-transition .cross-line-2 {
    /* Precise positioning for data signal connection */
    top: calc(var(--from-y) + 4px);
    transform: translateY(-1.25px) rotate(calc(-1 * var(--line-angle)));
  }

  /* Enhanced interactivity */
  .signal-transition.interactive {
    border: 1px solid transparent;
  }

  .signal-transition.interactive:hover {
    border-color: rgba(37, 99, 235, 0.3);
    background-color: rgba(37, 99, 235, 0.05);
  }

  .signal-transition.interactive:active {
    background-color: rgba(37, 99, 235, 0.15);
    border-color: rgba(37, 99, 235, 0.5);
  }
</style> 
