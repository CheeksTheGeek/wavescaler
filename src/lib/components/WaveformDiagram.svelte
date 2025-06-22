<script lang="ts">
    import type { WaveJson, SignalItem, WaveSignal, WaveGroup, WaveSpacer } from '$lib/wavejson-types';
    import SignalLane from './SignalLane.svelte';
    import SignalGroup from './SignalGroup.svelte';
    import WaveformGrid from './WaveformGrid.svelte';
    import CycleContextMenu from './CycleContextMenu.svelte';
    import { createEventDispatcher } from 'svelte';
  
      export let waveJson: WaveJson;
  export let isCellSelected: (signalIndex: number, cycleIndex: number) => boolean = () => false;

  const dispatch = createEventDispatcher<{
    signalchange: { signalIndex: number; newSignal: WaveSignal };
    structurechange: { newWaveJson: WaveJson };
    cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
    cyclechange: { signalIndex: number; cycleIndex: number; newChar: string };
    transitionclick: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number };
  }>();

  // Context menu state
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuSignalName = '';
  let contextMenuSignalIndex = 0;
  let contextMenuCycleIndex = 0;
  let contextMenuCurrentValue = '';
  
    // Helper to differentiate SignalItem types
    function getItemType(item: SignalItem): 'signal' | 'group' | 'spacer' | 'unknown' {
      if (!item || typeof item !== 'object') return 'unknown';
      if (Object.keys(item).length === 0 && !Array.isArray(item)) return 'spacer';
      if (Array.isArray(item)) return 'group';
      if ('name' in item && 'wave' in item) return 'signal';
      return 'unknown';
    }
  
    // Configuration - make reactive
    $: config = waveJson.config || {};
    $: hscale = config.hscale ?? 1;
    const laneHeight = 20; // Height of a single signal lane (can be part of config later)
    const nameWidth = 150; // Width allocated for signal/group names
    const wavePadding = 5; // Padding
    $: cycleWidth = 40 * hscale; // Width of a single cycle char
  
    let maxCycles = 0;
  
    function findMaxCycles(items: SignalItem[]): number {
      let cycles = 0;
      for (const item of items) {
        const type = getItemType(item);
        if (type === 'signal') {
          cycles = Math.max(cycles, (item as WaveSignal).wave.length);
        } else if (type === 'group') {
          cycles = Math.max(cycles, findMaxCycles((item as WaveGroup).slice(1) as SignalItem[]));
        }
      }
      return cycles;
    }
    
    // Make maxCycles reactive
    $: {
      maxCycles = findMaxCycles(waveJson.signal);
      // Add just one extra cycle for the "add" button functionality
      maxCycles = maxCycles + 1;
      // Ensure minimum of 8 cycles for usability
      maxCycles = Math.max(maxCycles, 8);
    }

    // Create signal index map reactively
    $: signalIndexMap = createSignalIndexMap(waveJson.signal);
  
    function handleSignalChange(event: CustomEvent<{ signalIndex: number; newSignal: WaveSignal }>) {
      const { signalIndex, newSignal } = event.detail;
      
      // Update the signal in our waveJson
      if (waveJson.signal[signalIndex] && getItemType(waveJson.signal[signalIndex]) === 'signal') {
        waveJson.signal[signalIndex] = newSignal;
        dispatch('signalchange', event.detail);
      }
    }
  
    function handleStructureChange(event: CustomEvent<{ newWaveJson: WaveJson }>) {
      waveJson = event.detail.newWaveJson;
      dispatch('structurechange', event.detail);
    }

    function handleGroupChange(event: CustomEvent<{ groupIndex: number; newGroup: WaveGroup }>) {
      const { groupIndex, newGroup } = event.detail;
      
      // Update the group in our waveJson
      if (waveJson.signal[groupIndex] && Array.isArray(waveJson.signal[groupIndex])) {
        // Create a new signal array to trigger reactivity
        const newSignals = [...waveJson.signal];
        newSignals[groupIndex] = newGroup;
        
        // Create a new waveJson object
        waveJson = {
          ...waveJson,
          signal: newSignals
        };
        
        dispatch('structurechange', { newWaveJson: waveJson });
      }
    }

    function handleRightClick(event: CustomEvent<{ signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string }>) {
      const { signalIndex, cycleIndex, x, y, currentValue } = event.detail;
      
      // Find the signal name
      let signalName = '';
      let currentIndex = 0;
      
      function findSignalName(items: SignalItem[]): string | null {
        for (const item of items) {
          if (Array.isArray(item)) {
            // It's a group
            const result = findSignalName(item.slice(1) as SignalItem[]);
            if (result) return result;
          } else if (item && typeof item === 'object' && 'name' in item) {
            // It's a signal
            if (currentIndex === signalIndex) {
              return (item as WaveSignal).name;
            }
            currentIndex++;
          } else {
            // Spacer or unknown
            currentIndex++;
          }
        }
        return null;
      }
      
      signalName = findSignalName(waveJson.signal) || `Signal ${signalIndex}`;
      
      contextMenuSignalName = signalName;
      contextMenuSignalIndex = signalIndex;
      contextMenuCycleIndex = cycleIndex;
      contextMenuCurrentValue = currentValue;
      contextMenuX = x;
      contextMenuY = y;
      contextMenuVisible = true;
    }

    function handleContextMenuSetValue(event: CustomEvent<{ value: string }>) {
      const { value } = event.detail;
      dispatch('cyclechange', {
        signalIndex: contextMenuSignalIndex,
        cycleIndex: contextMenuCycleIndex,
        newChar: value
      });
      contextMenuVisible = false;
    }

    function handleContextMenuClose() {
      contextMenuVisible = false;
    }

    // Create a map from signal items to their flat index for proper selection tracking
    function createSignalIndexMap(items: SignalItem[]): Map<any, number> {
      const map = new Map();
      let index = 0;
      
      function processItems(itemList: SignalItem[]) {
        for (const item of itemList) {
          if (Array.isArray(item)) {
            // It's a group - process its children
            processItems(item.slice(1) as SignalItem[]);
          } else if (item && typeof item === 'object' && 'name' in item) {
            // It's a signal
            map.set(item, index);
            index++;
          } else {
            // It's a spacer or unknown - still counts for indexing
            index++;
          }
        }
      }
      
      processItems(items);
      return map;
    }

    function handleWheel(event: WheelEvent) {
      // Check for CMD key on macOS (metaKey) or Ctrl key on other platforms
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        
        // Determine zoom direction
        const zoomOut = event.deltaY > 0;
        const zoomFactor = 0.1;
        
        // Calculate new scale
        const currentScale = waveJson.config?.hscale ?? 1;
        let newScale = zoomOut 
          ? Math.max(0.25, currentScale - zoomFactor)
          : Math.min(4, currentScale + zoomFactor);
        
        // Round to 2 decimal places for cleaner values
        newScale = Math.round(newScale * 100) / 100;
        
        // Update the waveJson configuration
        if (!waveJson.config) waveJson.config = {};
        waveJson.config.hscale = newScale;
        waveJson = waveJson; // Trigger reactivity
        
        // Dispatch the change event
        dispatch('structurechange', { newWaveJson: waveJson });
      }
      // If no modifier key, allow normal vertical scrolling
    }
  
        $: totalWaveformWidth = maxCycles * cycleWidth;
    $: svgWidth = nameWidth + totalWaveformWidth + wavePadding * 2;

    let calculatedTotalSvgHeight = 0;
    $: headHeight = config.head?.text ? 40 : 0;
    $: footHeight = config.foot?.text ? 40 : 0;
  
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
  
    $: calculatedTotalSvgHeight = headHeight + calculateHeightRecursive(waveJson.signal, 0) + footHeight;
    
    // Calculate Y positions for each item without reactive mutations
    function getYPositionForItem(itemIndex: number): number {
      let yPos = headHeight; // Start drawing signals below the head
      
      for (let i = 0; i < itemIndex; i++) {
        const item = waveJson.signal[i];
        const type = getItemType(item);
        
        if (type === 'signal') {
          yPos += laneHeight;
        } else if (type === 'spacer') {
          yPos += laneHeight / 1.5;
        } else if (type === 'group') {
          yPos += laneHeight; // For group label
          yPos += calculateHeightRecursive((item as WaveGroup).slice(1) as SignalItem[], 1);
        } else if (type === 'unknown') {
          yPos += laneHeight;
        }
      }
      
      return yPos;
    }
  
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
  
    <div class="waveform-diagram" style="--hscale: {hscale}">
    <!-- Header Section -->
    {#if config.head?.text}
      <div class="diagram-header">
        <div class="header-content">
          {#if typeof config.head.text === 'string'}
            {config.head.text}
          {:else}
            <!-- Handle JsonML text rendering if needed -->
            Header
          {/if}
        </div>
      </div>
    {/if}

    <!-- Main Content Area -->
    <div class="diagram-content" on:wheel={handleWheel}>
      <!-- Time Scale Grid Background -->
      <WaveformGrid {maxCycles} {hscale} />
      
      <!-- Signal Content -->
      <div class="signal-container">
        {#each waveJson.signal as item, i (item)}
          {@const itemType = getItemType(item)}
          
          {#if itemType === 'signal'}
            <SignalLane
              signal={item as WaveSignal}
              signalIndex={signalIndexMap.get(item) ?? i}
              {maxCycles}
              {hscale}
              {isCellSelected}
              on:signalchange={(e) => handleSignalChange(e)}
              on:cellselection={(e) => dispatch('cellselection', e.detail)}
              on:rightclick={(e) => handleRightClick(e)}
              on:transitionclick={(e) => dispatch('transitionclick', e.detail)}
            />
          {:else if itemType === 'group'}
            <SignalGroup
              group={item as WaveGroup}
              parentIndex={i}
              {maxCycles}
              {hscale}
              level={0}
              {getItemType}
              {isCellSelected}
              {signalIndexMap}
              on:signalchange={(e) => handleSignalChange(e)}
              on:structurechange={(e) => handleStructureChange(e)}
              on:groupchange={(e) => handleGroupChange(e)}
              on:cellselection={(e) => dispatch('cellselection', e.detail)}
              on:rightclick={(e) => handleRightClick(e)}
            />
          {:else if itemType === 'spacer'}
            <div class="signal-spacer"></div>
          {:else}
            <div class="signal-unknown">
              Unknown item type at index {i}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  
    <!-- Footer Section -->
    {#if config.foot?.text}
      <div class="diagram-footer">
        <div class="footer-content">
          {#if typeof config.foot.text === 'string'}
            {config.foot.text}
          {:else}
            Footer
          {/if}
        </div>
      </div>
    {/if}

    <!-- Context Menu -->
    <CycleContextMenu
      visible={contextMenuVisible}
      x={contextMenuX}
      y={contextMenuY}
      signalName={contextMenuSignalName}
      cycleIndex={contextMenuCycleIndex}
      currentValue={contextMenuCurrentValue}
      on:setvalue={handleContextMenuSetValue}
      on:close={handleContextMenuClose}
    />
  </div>
  
  <style>
    .waveform-diagram {
      --name-width: 150px;
      --cycle-width: calc(40px * var(--hscale));
      --lane-height: 40px;
      --grid-color: #e5e5e5;
      --border-color: #d1d5db;
      --background-color: #ffffff;
      --text-color: #1f2937;
      --header-footer-height: 40px;
      
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      background-color: var(--background-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  
    .diagram-header,
    .diagram-footer {
      height: var(--header-footer-height);
      background-color: #f9fafb;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      color: var(--text-color);
    }
  
    .diagram-footer {
      border-bottom: none;
      border-top: 1px solid var(--border-color);
    }
  
    .diagram-content {
      position: relative;
      flex: 1;
      overflow: auto;
      min-height: 200px;
      width: 100%;
    }
  
    .signal-container {
      position: relative;
      z-index: 2;
      min-width: calc(var(--name-width) + var(--cycle-width) * 16);
      width: max-content;
      margin-top: 24px; /* Offset by time scale height */
    }
  
    .signal-spacer {
      height: calc(var(--lane-height) * 0.6);
      border-bottom: 1px dashed var(--grid-color);
    }
  
    .signal-unknown {
      height: var(--lane-height);
      display: flex;
      align-items: center;
      padding-left: 16px;
      color: #dc2626;
      background-color: #fef2f2;
      border-bottom: 1px solid var(--border-color);
    }
  </style>
  