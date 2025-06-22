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
  
    // This is the critical part for managing layout across nested groups.
    // currentYOffset is the Y where the *next* child item (lane or subgroup label) should be placed.
    // It's bound upwards to the parent.
    export let currentYOffset: number;
  
    const groupName = group[0];
    const groupItems = group.slice(1) as SignalItem[];
  
    const nameIndent = level * 20; // Indent nested group names visually
    const effectiveNameWidth = nameWidth - nameIndent;
  
    // The group's own label is placed at 'y'.
    // Then, currentYOffset is advanced because this group's label has taken up a slot.
    // This must happen *before* children are rendered.
    // This is a bit tricky with Svelte's reactivity.
    // One way: parent passes currentY, group uses it for label, then immediately tells parent new currentY.
  
    // Let's refine: 'y' is where this group's label is drawn.
    // 'currentYOffset' is what this group will update as it places its children.
    // The PARENT component (WaveformDiagram or another SignalGroup) is responsible for
    // setting the 'y' for this group's label AND advancing its OWN currentYOffset after this group label.
  
    // When this component is initialized:
    // 1. Its label is drawn at `y`.
    // 2. The `currentYOffset` (bound from parent) should reflect the Y *after* this group's label.
    //    So, the parent should have already advanced its currentYOffset by laneHeight when calling this.
    //    This means `y` for this component is `parentCurrentYOffset - laneHeight` (roughly).
    //    Or more simply: parent passes `y` for the label. This component's children start at `y + laneHeight`.
  
    let childrenStartOperatingY = y + laneHeight; // Children will start rendering below this group's label.
                                                  // This local variable tracks where this group's children begin.
  
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
      {@const childComponentY = childrenStartOperatingY} <!-- The Y position for the current child's label/top -->
  
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
        {@const _ = childrenStartOperatingY += laneHeight}
      {:else if itemType === 'group'}
        <svelte:self
          group={item as WaveGroup}
          y={childComponentY}
          bind:currentYOffset={childrenStartOperatingY}
          nameWidth={nameWidth}
          {cycleWidth}
          {laneHeight}
          {hscale}
          {maxCycles}
          level={level + 1}
          {getItemType}
        />
        <!-- childrenStartOperatingY is now updated by the recursive call -->
      {:else if itemType === 'spacer'}
        {@const _ = childrenStartOperatingY += (laneHeight / 1.5)}
      {:else if itemType === 'unknown'}
        <text x="10" y={childComponentY + laneHeight / 2} fill="red" font-size="12">Unknown item type in group</text>
        {@const _ = childrenStartOperatingY += laneHeight}
      {/if}
    {/each}
    {#if true}
      {@const _ = currentYOffset = childrenStartOperatingY} <!-- Finally, update the bound prop with the total height consumed by this group and its children -->
    {/if}
  </g>
  
  <style>
    .group-name {
      font-weight: 500; /* Slightly less bold than original WaveDrom, adjust as needed */
      fill: #1a1a1a;
      font-family: inherit;
      font-size: 13px;
    }
  </style>
  