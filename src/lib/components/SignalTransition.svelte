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
    
    // No transition if same type or from/to empty
    if (fromType === toType || fromType === 'empty' || toType === 'empty') {
      return 'none';
    }
    
    // Rising edge: low to high
    if (fromType === 'low' && toType === 'high') return 'rising';
    
    // Falling edge: high to low
    if (fromType === 'high' && toType === 'low') return 'falling';
    
    // All other transitions are crosses (including data transitions)
    return 'cross';
  }

  // Get CSS coordinate values for each signal type
  function getSignalCSSCoordinates(cycle: typeof fromCycle) {
    const type = getCycleType(cycle);
    
    switch (type) {
      case 'high':
        return { percent: 20, cssVar: '--signal-high' };
      case 'low':
        return { percent: 80, cssVar: '--signal-low' };
      case 'data':
      case 'x':
      case 'z':
      case 'clock':
      default:
        return { percent: 50, cssVar: '--signal-middle' };
    }
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
  $: transitionWidth = 8 * hscale;
  $: fromCoords = getSignalCSSCoordinates(fromCycle);
  $: toCoords = getSignalCSSCoordinates(toCycle);
  
  // Calculate transition geometry with consistent units
  $: cycleHeight = 40;
  $: fromY = (fromCoords.percent / 100) * cycleHeight;
  $: toY = (toCoords.percent / 100) * cycleHeight;
  $: deltaY = toY - fromY;
  $: lineAngle = Math.atan2(deltaY, transitionWidth) * (180 / Math.PI);
  $: lineLength = Math.sqrt(transitionWidth * transitionWidth + deltaY * deltaY);
</script>

{#if transitionType !== 'none'}
  <div 
    class="signal-transition {transitionType}"
    class:interactive={true}
    style="
      width: {transitionWidth}px;
      --from-y: {fromY}px;
      --to-y: {toY}px;
      --line-angle: {lineAngle}deg;
      --line-length: {lineLength}px;
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
    /* Optimize for smooth rendering */
    will-change: auto;
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
  }

  .cross-line-1 {
    top: var(--from-y);
    transform: translateY(-1px) rotate(var(--line-angle));
  }

  .cross-line-2 {
    top: var(--to-y);
    transform: translateY(-1px) rotate(calc(-1 * var(--line-angle)));
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
