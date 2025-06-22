<script lang="ts">
    import type { WaveJson, SignalItem, WaveSignal, WaveGroup, WaveSpacer, JsonMl } from '$lib/wavejson-types';
    import SignalLane from './SignalLane.svelte';
    import SignalGroup from './SignalGroup.svelte';
  
    export let waveJson: WaveJson;
  
    // Helper to differentiate SignalItem types for dynamic component rendering
    function getItemType(item: SignalItem): 'signal' | 'group' | 'spacer' | 'unknown' {
      if (!item || typeof item !== 'object') return 'unknown';
      if (Object.keys(item).length === 0 && !Array.isArray(item)) return 'spacer'; // Empty object for spacer
      if (Array.isArray(item)) return 'group'; // Array for group
      if ('name' in item && 'wave' in item) return 'signal'; // Object with name and wave for signal
      return 'unknown';
    }
  
    // --- Configuration & Calculations ---
    const config = waveJson.config || {};
    const hscale = config.hscale ?? 1;
    const laneHeight = 20; // Height of a single signal lane (can be part of config later)
    const nameWidth = 150; // Width allocated for signal/group names
    const wavePadding = 5; // Padding
    const cycleWidth = 20 * hscale; // Width of a single cycle char
  
    let maxCycles = 0;
  
    function findMaxCycles(items: SignalItem[]): void {
      for (const item of items) {
        const type = getItemType(item);
        if (type === 'signal') {
          maxCycles = Math.max(maxCycles, (item as WaveSignal).wave.length);
        } else if (type === 'group') {
          findMaxCycles((item as WaveGroup).slice(1) as SignalItem[]);
        }
      }
    }
    findMaxCycles(waveJson.signal);
  
  
    const totalWaveformWidth = maxCycles * cycleWidth;
    const svgWidth = nameWidth + totalWaveformWidth + wavePadding * 2;
  
    let calculatedTotalSvgHeight = 0;
    const headHeight = config.head?.text ? 40 : 0;
    const footHeight = config.foot?.text ? 40 : 0;
  
    function calculateHeightRecursive(items: SignalItem[], level: number): number {
      let height = 0;
      items.forEach(item => {
        const type = getItemType(item);
        if (type === 'signal') {
          height += laneHeight;
        } else if (type === 'spacer') {
          height += laneHeight / 1.5; // Spacers take less height
        } else if (type === 'group') {
          height += laneHeight; // For group label itself
          height += calculateHeightRecursive((item as WaveGroup).slice(1) as SignalItem[], level + 1);
        }
      });
      return height;
    }
  
    calculatedTotalSvgHeight = headHeight + calculateHeightRecursive(waveJson.signal, 0) + footHeight;
    let currentYOffset = headHeight; // Start drawing signals below the head
  
    // --- JsonML Rendering (Simplified) ---
    function renderJsonMlToSvg(ml: JsonMl | undefined, x: number, y: number): string {
      if (!ml) return '';
      if (typeof ml === 'string') {
        return `<text x="${x}" y="${y}" dominant-baseline="middle">${ml}</text>`;
      }
  
      if (Array.isArray(ml)) {
        const tagName = ml[0] as string;
        let attributesObj: Record<string, any> = {};
        let children: Array<JsonMl | string> = [];
  
        if (ml.length > 1 && typeof ml[1] === 'object' && !Array.isArray(ml[1])) {
          attributesObj = ml[1] as Record<string, any>;
          children = ml.slice(2) as Array<JsonMl | string>;
        } else {
          children = ml.slice(1) as Array<JsonMl | string>;
        }
  
        const attributesStr = Object.entries(attributesObj)
          .map(([key, value]) => `${key}="${String(value).replace(/"/g, '&quot;')}"`)
          .join(' ');
  
        const childrenSvg = children.map((child, index) => {
          // Basic handling for nested tspans, assuming they don't alter x,y significantly themselves
          // or use dx, dy which is more complex. For simplicity, we pass parent x,y.
          // A real JsonML to SVG would need more sophisticated coordinate management.
          if (typeof child === 'string') return child;
          return renderJsonMlToSvg(child, 0, 0); // dx/dy would be relative if used in tspan
        }).join('');
  
        // For tspans, x and y might be relative to the parent text element.
        // Here we assume top-level text elements or tspans that are self-contained.
        if (tagName === 'text') {
          return `<text x="${x}" y="${y}" ${attributesStr}>${childrenSvg}</text>`;
        }
        return `<${tagName} ${attributesStr}>${childrenSvg}</${tagName}>`;
      }
      return '';
    }
  </script>
  
  <svg width="{svgWidth}" height="{calculatedTotalSvgHeight}" xmlns="http://www.w3.org/2000/svg" class="wavedrom-diagram">
    <defs>
      <!-- Common definitions can go here, e.g., markers for arrows -->
    </defs>
    <style>
      .wavedrom-diagram {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
        font-size: 14px;
        background-color: white; /* Or inherit */
      }
      .signal-name, .group-name {
        text-anchor: start;
        dominant-baseline: middle;
        font-size: 13px;
      }
      .group-name {
        font-weight: 500;
      }
      .diagram-head text, .diagram-foot text {
        text-anchor: middle;
        dominant-baseline: middle;
      }
      /* Styles for SignalLane will be defined within or imported by SignalLane.svelte */
    </style>
  
    <!-- Head Section -->
    {#if config.head?.text}
      <g class="diagram-head" transform="translate(0, 0)">
        {@html renderJsonMlToSvg(config.head.text, svgWidth / 2, headHeight / 2)}
      </g>
      <!-- Ticks for head would be rendered here -->
    {/if}
  
    <!-- Main Signal Area -->
    <g class="signal-area" transform="translate(0, {headHeight})">
      {#each waveJson.signal as item, i (JSON.stringify(item) + i)} <!-- Basic key, consider more robust unique ID generation -->
        {@const itemType = getItemType(item)}
        {@const yPos = currentYOffset}
  
        {#if itemType === 'signal'}
          <SignalLane
            signal={item as WaveSignal}
            signalIndex={i}
            y={yPos}
            {nameWidth}
            {cycleWidth}
            {laneHeight}
            {hscale}
            {maxCycles}
          />
          {@const _ = currentYOffset += laneHeight}
        {:else if itemType === 'group'}
          <SignalGroup
            group={item as WaveGroup}
            bind:currentYOffset={currentYOffset}
            y={yPos}
            {nameWidth}
            {cycleWidth}
            {laneHeight}
            {hscale}
            {maxCycles}
            level={0}
            {getItemType}
          />
          <!-- currentYOffset is updated by SignalGroup via binding -->
        {:else if itemType === 'spacer'}
          <!-- Spacer: just advance Y. Could draw a faint line or nothing. -->
          {@const _ = currentYOffset += (laneHeight / 1.5)}
        {:else if itemType === 'unknown'}
          <text x="10" y={yPos + laneHeight / 2} fill="red">Unknown item type at index {i}</text>
          {@const _ = currentYOffset += laneHeight}
        {/if}
      {/each}
    </g>
  
    <!-- Foot Section -->
    {#if config.foot?.text}
      <g class="diagram-foot" transform="translate(0, {calculatedTotalSvgHeight - footHeight})">
        {@html renderJsonMlToSvg(config.foot.text, svgWidth / 2, footHeight / 2)}
      </g>
      <!-- Tocks for foot would be rendered here -->
    {/if}
  
    <!-- Edges would be rendered last, on top of everything else -->
    <!-- <g class="edge-layer"></g> -->
  </svg>
  