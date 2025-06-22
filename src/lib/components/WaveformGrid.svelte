<script lang="ts">
  export let maxCycles: number;
  export let hscale: number = 1;

  $: fullCycleWidth = 40 * hscale; // Each cycle gets full 40px width like WaveDrom
  $: totalWidth = maxCycles * fullCycleWidth;
  
  let gridContainer: HTMLElement;
  let actualCyclesStartOffset = 0;
  let measurementAttempts = 0;
  
  // Measure the actual position of signal cycles
  function measureActualLayout() {
    if (!gridContainer || measurementAttempts > 5) return;
    measurementAttempts++;
    
    // Find the first signal cycle in the DOM
    const firstSignalLane = document.querySelector('.signal-lane');
    const firstCycle = firstSignalLane?.querySelector('[data-cycle-index="0"]');
    
    if (firstCycle && gridContainer) {
      const gridRect = gridContainer.getBoundingClientRect();
      const cycleRect = firstCycle.getBoundingClientRect();
      const newOffset = cycleRect.left - gridRect.left;
      
      // Only update if we got a reasonable measurement
      if (newOffset > 0 && newOffset < 1000) {
        actualCyclesStartOffset = newOffset;
        // console.log('Grid positioning debug:', {
        //   gridLeft: gridRect.left,
        //   firstCycleLeft: cycleRect.left,
        //   calculatedOffset: actualCyclesStartOffset,
        //   fullCycleWidth,
        //   attempt: measurementAttempts
        // });
      } else {
        // Retry measurement if we got an unreasonable value
        setTimeout(() => measureActualLayout(), 50);
      }
    } else {
      // Retry if elements not found
      setTimeout(() => measureActualLayout(), 50);
    }
  }
  
  // Measure layout after component mounts and when hscale changes
  $: if (gridContainer) {
    measurementAttempts = 0;
    setTimeout(measureActualLayout, 100);
  }
</script>

<div class="waveform-grid" bind:this={gridContainer} style="--total-width: {totalWidth}px; --full-cycle-width: {fullCycleWidth}px">
  <!-- Time scale labels -->
  <div class="time-scale">
    {#each Array(maxCycles) as _, i}
      <div class="time-tick" style="left: {actualCyclesStartOffset + (i + 0.5) * fullCycleWidth}px">
        {i}
      </div>
    {/each}
  </div>
  
  <!-- Vertical grid lines -->
  <div class="grid-lines">
    {#each Array(maxCycles + 1) as _, i}
      <div 
        class="grid-line" 
        style="left: {actualCyclesStartOffset + i * fullCycleWidth}px"
        class:major-line={i % 5 === 0}
      ></div>
    {/each}
  </div>
</div>

<style>
  .waveform-grid {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
    min-width: calc(var(--name-width, 150px) + var(--full-cycle-width, 40px) * 16);
  }

  .time-scale {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 24px;
    background-color: #f8fafc;
    border-bottom: 1px solid #d1d5db;
    display: flex;
    align-items: center;
    z-index: 3;
  }

  .time-tick {
    position: absolute;
    font-size: 10px;
    color: #6b7280;
    text-align: center;
    width: var(--full-cycle-width);
    transform: translateX(-50%);
    user-select: none;
  }

  .grid-lines {
    position: absolute;
    top: 24px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
  }

  .grid-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: #e5e7eb;
    opacity: 0.8;
  }

  .grid-line.major-line {
    background-color: #d1d5db;
    opacity: 1;
  }
</style> 
