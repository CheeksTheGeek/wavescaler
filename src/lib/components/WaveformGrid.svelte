<script lang="ts">
  export let maxCycles: number;
  export let hscale: number = 1;
  export let nameColumnWidth: number = 150;

  $: fullCycleWidth = 40 * hscale; // Each cycle gets full 40px width like WaveDrom
  $: totalWidth = maxCycles * fullCycleWidth;
  
  // Calculate the cycles start offset based on the name column width
  // The cycles start right after the name column
  $: cyclesStartOffset = nameColumnWidth;
</script>

<div class="waveform-grid" style="--total-width: {totalWidth}px; --full-cycle-width: {fullCycleWidth}px; --name-width: {nameColumnWidth}px">
  <!-- Time scale labels -->
  <div class="time-scale">
    {#each Array(maxCycles) as _, i}
      <div class="time-tick" style="left: {cyclesStartOffset + (i + 0.5) * fullCycleWidth}px">
        {i}
      </div>
    {/each}
  </div>
  
  <!-- Vertical grid lines -->
  <div class="grid-lines">
    <!-- Name column separator line -->
    <div 
      class="grid-line name-separator" 
      style="left: {nameColumnWidth}px"
    ></div>
    
    <!-- Cycle grid lines -->
    {#each Array(maxCycles + 1) as _, i}
      <div 
        class="grid-line" 
        style="left: {cyclesStartOffset + i * fullCycleWidth}px"
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
    background-color: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border-primary);
    display: flex;
    align-items: center;
    z-index: 3;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .time-tick {
    position: absolute;
    font-size: 10px;
    color: var(--color-text-tertiary);
    text-align: center;
    width: var(--full-cycle-width);
    transform: translateX(-50%);
    user-select: none;
    font-weight: 500;
    transition: color 0.2s ease;
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
    background-color: var(--color-border-primary);
    opacity: 0.6;
    transition: background-color 0.2s ease, opacity 0.2s ease;
  }

  .grid-line.major-line {
    background-color: var(--color-border-secondary);
    opacity: 0.8;
  }

  .grid-line.name-separator {
    background-color: var(--color-border-secondary);
    opacity: 1;
    z-index: 2;
  }
</style> 
