<script lang="ts">
  export let maxCycles: number;
  export let hscale: number = 1;

  $: cycleWidth = 20 * hscale;
  $: totalWidth = maxCycles * cycleWidth;
</script>

<div class="waveform-grid" style="--total-width: {totalWidth}px; --cycle-width: {cycleWidth}px">
  <!-- Time scale labels -->
  <div class="time-scale">
    {#each Array(maxCycles) as _, i}
      <div class="time-tick" style="left: calc(var(--name-width) + {i * cycleWidth}px)">
        {i}
      </div>
    {/each}
  </div>
  
  <!-- Vertical grid lines -->
  <div class="grid-lines">
    {#each Array(maxCycles + 1) as _, i}
      <div 
        class="grid-line" 
        style="left: calc(var(--name-width) + {i * cycleWidth}px)"
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
    z-index: 1;
    pointer-events: none;
    min-width: calc(var(--name-width, 150px) + var(--cycle-width, 20px) * 16);
  }

  .time-scale {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 24px;
    background-color: #f8fafc;
    border-bottom: 1px solid var(--grid-color);
    display: flex;
    align-items: center;
  }

  .time-tick {
    position: absolute;
    font-size: 10px;
    color: #6b7280;
    text-align: center;
    width: var(--cycle-width);
    transform: translateX(-50%);
    user-select: none;
  }

  .grid-lines {
    position: absolute;
    top: 24px;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .grid-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: var(--grid-color);
    opacity: 0.3;
  }

  .grid-line.major-line {
    background-color: #9ca3af;
    opacity: 0.5;
  }
</style> 
