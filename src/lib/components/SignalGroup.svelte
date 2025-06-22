<script lang="ts">
    import type { WaveGroup, SignalItem, WaveSignal, WaveSpacer } from '$lib/wavejson-types';
    import SignalLane from './SignalLane.svelte';
    // Recursive type for svelte:self, not strictly needed for TS but good for clarity
    // type SignalGroupComponent = typeof import('./SignalGroup.svelte').default;
  
        export let group: WaveGroup;
    export let y: number; // Starting y position for this group's own label.
    export let nameWidth: number;
    export let cycleWidth: number;
    export let laneHeight: number;
    export let hscale: number;
    export let maxCycles: number;
    export let level: number; // Nesting level
    export let getItemType: (item: SignalItem) => 'signal' | 'group' | 'spacer' | 'unknown';
  
    const groupName = group[0];
    const groupItems = group.slice(1) as SignalItem[];
  
        const nameIndent = level * 20; // Indent nested group names visually
    const effectiveNameWidth = nameWidth - nameIndent;

    // Calculate positions for child items
    function getChildYPosition(childIndex: number): number {
      let childY = y + laneHeight; // Start below the group label
      
      for (let i = 0; i < childIndex; i++) {
        const item = groupItems[i];
        const type = getItemType(item);
        
        if (type === 'signal') {
          childY += laneHeight;
        } else if (type === 'spacer') {
          childY += laneHeight / 1.5;
        } else if (type === 'group') {
          childY += laneHeight; // For group label
          childY += calculateGroupHeight((item as WaveGroup).slice(1) as SignalItem[]);
        } else if (type === 'unknown') {
          childY += laneHeight;
        }
      }
      
      return childY;
    }
    
    function calculateGroupHeight(items: SignalItem[]): number {
      let height = 0;
      items.forEach(item => {
        const type = getItemType(item);
        if (type === 'signal') {
          height += laneHeight;
        } else if (type === 'spacer') {
          height += laneHeight / 1.5;
        } else if (type === 'group') {
          height += laneHeight; // For group label itself
          height += calculateGroupHeight((item as WaveGroup).slice(1) as SignalItem[]);
        } else if (type === 'unknown') {
          height += laneHeight;
        }
      });
      return height;
    }
  
  </script>
  
  <g class="signal-group" transform="translate({nameIndent}, 0)">
    <!-- Group Label -->
    <text
      x="5"
      y="{y + laneHeight / 2}"
      class="group-name"
      dominant-baseline="middle"
    >
      {groupName}
    </text>
  
        <!-- Render Children -->
    {#each groupItems as item, index (index)}
      {@const itemType = getItemType(item)}
      {@const childComponentY = getChildYPosition(index)}

      {#if itemType === 'signal'}
        <SignalLane
          signal={item as WaveSignal}
          signalIndex={index}
          y={childComponentY}
          nameWidth={effectiveNameWidth}
          {cycleWidth}
          {laneHeight}
          {hscale}
          {maxCycles}
        />
      {:else if itemType === 'group'}
        <svelte:self
          group={item as WaveGroup}
          y={childComponentY}
          nameWidth={nameWidth}
          {cycleWidth}
          {laneHeight}
          {hscale}
          {maxCycles}
          level={level + 1}
          {getItemType}
        />
      {:else if itemType === 'spacer'}
        <!-- Spacer: just a visual gap -->
      {:else if itemType === 'unknown'}
        <text x="10" y={childComponentY + laneHeight / 2} fill="red" font-size="12">Unknown item type in group</text>
      {/if}
    {/each}
  </g>
  
  <style>
    .group-name {
      font-weight: 500; /* Slightly less bold than original WaveDrom, adjust as needed */
      fill: #1a1a1a;
      font-family: inherit;
      font-size: 13px;
    }
  </style>
  