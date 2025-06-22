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
  function getSignalLinePosition(cycle: typeof fromCycle, hasLeftTransition: boolean, hasRightTransition: boolean): { y: number; left: number; width: number; topY: number; bottomY: number } {
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
    const cycleHeight = 40;
    
    // Get Y position (same logic as SignalCycle.getSignalLinePosition)
    let yPercent: number;
    let topY: number;
    let bottomY: number;
    
    switch (type) {
      case 'high':
        yPercent = 20; // 20% from top
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // For high signals, top and bottom are the same (line)
        break;
      case 'low':
        yPercent = 80; // 80% from top (20% from bottom)
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // For low signals, top and bottom are the same (line)
        break;
      case 'data':
        yPercent = 50; // Middle
        // For data signals, use the actual visual boundaries (70% height centered at 50%)
        const dataHeight = cycleHeight * 0.7;
        const centerY = (yPercent / 100) * cycleHeight;
        topY = centerY - dataHeight / 2;
        bottomY = centerY + dataHeight / 2;
        break;
      case 'x':
        yPercent = 50; // Middle
        // For x signals, use the visual boundaries (70% height centered at 50%)
        const xHeight = cycleHeight * 0.7;
        const xCenterY = (yPercent / 100) * cycleHeight;
        topY = xCenterY - xHeight / 2;
        bottomY = xCenterY + xHeight / 2;
        break;
      case 'z':
        yPercent = 50; // Middle
        // For z signals, use the visual boundaries (60% height centered at 50%)
        const zHeight = cycleHeight * 0.6;
        const zCenterY = (yPercent / 100) * cycleHeight;
        topY = zCenterY - zHeight / 2;
        bottomY = zCenterY + zHeight / 2;
        break;
      case 'clock':
      default:
        yPercent = 50; // Middle
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // For clock signals, treat as line for now
        break;
    }
    
    const y = (yPercent / 100) * cycleHeight;
    
    // Calculate signal line width and position (same logic as SignalCycle)
    // Account for adjacent transitions that shorten the signal lines
    const leftOffset = hasLeftTransition ? halfTransitionWidth : 0;
    const rightOffset = hasRightTransition ? halfTransitionWidth : 0;
    const signalLineWidth = fullCycleWidth - leftOffset - rightOffset;
    const signalLineLeft = leftOffset;
    
    return {
      y,
      left: signalLineLeft,
      width: signalLineWidth,
      topY,
      bottomY
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
  $: fromSignalPos = getSignalLinePosition(fromCycle, true, true); // fromCycle has transitions on both sides
  $: toSignalPos = getSignalLinePosition(toCycle, true, true); // toCycle has transitions on both sides
  $: isCleanCross = needsCleanCrossTransition();
  $: isDataTransition = hasDataTransition();
  
  // Calculate transition geometry using exact signal line endpoints
  $: fromX = fromSignalPos.left + fromSignalPos.width; // End of from signal line
  $: toX = toSignalPos.left; // Start of to signal line
  $: fromY = fromSignalPos.y;
  $: toY = toSignalPos.y;
  $: deltaX = toX - fromX;
  $: deltaY = toY - fromY;
  
  // For cross transitions, use the actual visual boundaries instead of fixed offsets
  $: fromTopY = fromSignalPos.topY;
  $: fromBottomY = fromSignalPos.bottomY;
  $: toTopY = toSignalPos.topY;
  $: toBottomY = toSignalPos.bottomY;
  
  // Calculate cross line start and end positions - connect to actual signal line endpoints
  $: crossStartX = 0; // Start at the beginning of transition area
  $: crossEndX = transitionWidth; // End at the end of transition area
  $: crossWidth = crossEndX - crossStartX;
  
  // Calculate cross line angles and lengths using actual signal boundaries
  $: crossLine1StartY = fromTopY;
  $: crossLine1EndY = toBottomY;
  $: crossLine2StartY = fromBottomY;
  $: crossLine2EndY = toTopY;
  
  $: crossLine1DeltaY = crossLine1EndY - crossLine1StartY;
  $: crossLine2DeltaY = crossLine2EndY - crossLine2StartY;
  
  $: crossLine1Angle = Math.atan2(crossLine1DeltaY, crossWidth) * (180 / Math.PI);
  $: crossLine2Angle = Math.atan2(crossLine2DeltaY, crossWidth) * (180 / Math.PI);
  
  $: crossLine1Length = Math.sqrt(crossWidth * crossWidth + crossLine1DeltaY * crossLine1DeltaY);
  $: crossLine2Length = Math.sqrt(crossWidth * crossWidth + crossLine2DeltaY * crossLine2DeltaY);
  
  // For regular rising/falling transitions, force a visual separation if needed
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
      --cross-line-1-start-y: {crossLine1StartY}px;
      --cross-line-1-end-y: {crossLine1EndY}px;
      --cross-line-1-angle: {crossLine1Angle}deg;
      --cross-line-1-length: {crossLine1Length}px;
      --cross-line-2-start-y: {crossLine2StartY}px;
      --cross-line-2-end-y: {crossLine2EndY}px;
      --cross-line-2-angle: {crossLine2Angle}deg;
      --cross-line-2-length: {crossLine2Length}px;
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
        <!-- Fill triangles to match adjacent signal patterns -->
        <div class="cross-fill-left {getCycleType(fromCycle)}"></div>
        <div class="cross-fill-right {getCycleType(toCycle)}"></div>
        
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

  /* Triangular fill areas for cross transitions */
  .cross-fill-left, .cross-fill-right {
    position: absolute;
    z-index: 1;
  }

  .cross-fill-left {
    left: -2px; /* Extend slightly left to overlap with signal shape */
    width: calc(50% + 4px); /* Extra width to ensure overlap */
    clip-path: polygon(0 0, calc(100% - 4px) 50%, 0 100%);
  }

  .cross-fill-right {
    right: -2px; /* Extend slightly right to overlap with signal shape */
    width: calc(50% + 4px); /* Extra width to ensure overlap */
    clip-path: polygon(4px 50%, 100% 0, 100% 100%);
  }

  /* Data signal fills */
  .cross-fill-left.data, .cross-fill-right.data {
    background-color: #f3f4f6;
    border-top: 2px solid #2563eb;
    border-bottom: 2px solid #2563eb;
    height: 70%;
  }

  .cross-fill-left.data {
    top: var(--from-y);
    transform: translateY(-50%);
  }

  .cross-fill-right.data {
    top: var(--to-y);
    transform: translateY(-50%);
  }

  /* X pattern fills */
  .cross-fill-left.x, .cross-fill-right.x {
    background-image: 
      radial-gradient(circle at 25% 25%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 25% 75%, #9ca3af 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 75%, #9ca3af 0.5px, transparent 0.5px);
    background-size: 6px 6px;
    opacity: 0.6;
    border-top: 2px solid #2563eb;
    border-bottom: 2px solid #2563eb;
    height: 70%;
  }

  .cross-fill-left.x {
    top: var(--from-y);
    transform: translateY(-50%);
  }

  .cross-fill-right.x {
    top: var(--to-y);
    transform: translateY(-50%);
  }

  /* Z-state fills */
  .cross-fill-left.z, .cross-fill-right.z {
    background-image: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 4px,
        #f59e0b 4px,
        #f59e0b 6px
      );
    opacity: 0.8;
    border-top: 2px solid #2563eb;
    border-bottom: 2px solid #2563eb;
    height: 60%;
  }

  .cross-fill-left.z {
    top: var(--from-y);
    transform: translateY(-50%);
  }

  .cross-fill-right.z {
    top: var(--to-y);
    transform: translateY(-50%);
  }

  /* High/Low signal fills - no special fill needed as they're just lines */
  .cross-fill-left.high, .cross-fill-right.high,
  .cross-fill-left.low, .cross-fill-right.low {
    display: none; /* No fill needed for line signals */
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
    top: var(--cross-line-1-start-y);
    transform: translateY(-1px) rotate(var(--cross-line-1-angle));
    width: var(--cross-line-1-length);
  }

  .cross-line-2 {
    top: var(--cross-line-2-start-y);
    transform: translateY(-1px) rotate(var(--cross-line-2-angle));
    width: var(--cross-line-2-length);
  }

  /* Enhanced styling for data transitions */
  .signal-transition.data-transition .cross-line {
    /* Slightly thicker lines for data transitions to make them more visible */
    height: 2.2px;
    /* Ensure they connect precisely to data signal edges */
    z-index: 3;
  }

  .signal-transition.data-transition .cross-line-1 {
    /* Precise positioning for data signal connection */
    top: var(--cross-line-1-start-y);
    transform: translateY(-1.25px) rotate(var(--cross-line-1-angle));
    width: var(--cross-line-1-length);
  }

  .signal-transition.data-transition .cross-line-2 {
    /* Precise positioning for data signal connection */
    top: var(--cross-line-2-start-y);
    transform: translateY(-1.25px) rotate(var(--cross-line-2-angle));
    width: var(--cross-line-2-length);
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
