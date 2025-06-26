<script lang="ts">
    import type { WaveJson, SignalItem, WaveSignal, WaveGroup, WaveSpacer, JsonMl, TreePath, DragDropContext } from '$lib/wavejson-types';
    import { WaveTreeManager } from '$lib/wavejson-types';
    import SignalLane from './SignalLane.svelte';
    import SignalGroup from './SignalGroup.svelte';
    import WaveformGrid from './WaveformGrid.svelte';
    import CycleContextMenu from './CycleContextMenu.svelte';
    import { createEventDispatcher } from 'svelte';
    import { selectedLanes, clearLaneSelection } from '$lib/lane-selection-store';
  
      export let waveJson: WaveJson;
  export let isCellSelected: (signalIndex: number, cycleIndex: number) => boolean = () => false;

  const dispatch = createEventDispatcher<{
    signalchange: { signalIndex: number; newSignal: WaveSignal };
    structurechange: { newWaveJson: WaveJson };
    cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
    laneselection: { signalIndex: number; signalName: string; shiftKey: boolean };
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
  
  // Drag and drop state for spacers
  let spacerDraggedOverPosition: { [key: number]: 'above' | 'below' | null } = {};
  
  // Improved drag and drop state using tree paths
  let dragState: {
    isDragging: boolean;
    sourcePath: number[] | null;
    sourceType: 'signal' | 'group' | 'spacer' | null;
    sourceItem: SignalItem | null;
  } = {
    isDragging: false,
    sourcePath: null,
    sourceType: null,
    sourceItem: null
  };

  // Resizable column state
  let nameColumnWidth = 150; // Default width
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  // Calculate minimum width needed for nested groups
  let minimumNameWidth = 100; // Base minimum

  // Load saved width from localStorage on mount
  if (typeof window !== 'undefined') {
    const savedWidth = localStorage.getItem('wavescaler-name-column-width');
    if (savedWidth) {
      nameColumnWidth = parseInt(savedWidth, 10);
    }
  }

  // Calculate the minimum width needed based on group nesting
  function calculateMinimumNameWidth(items: SignalItem[], level: number = 0): number {
    let maxNeededWidth = 120; // Base minimum for signals (increased)
    
    for (const item of items) {
      if (Array.isArray(item)) {
        // It's a group - check its nesting depth
        const groupName = item[0] as string;
        const groupItems = item.slice(1) as SignalItem[];
        
        // Calculate space needed for this level:
        // - Base padding: 8px on each side = 16px
        // - Indentation: level * 20px (margin-left on signal-group)
        // - Collapse button: 18px (min 14px)
        // - Edit button: 16px (min 12px)
        // - Add button: 18px (min 14px)
        // - Gaps between elements: 2px + 1px = 3px total
        // - Minimum text space: 40px (for at least 3-4 characters)
        const spaceNeeded = 16 + (level * 20) + 18 + 16 + 18 + 3 + 40;
        
        maxNeededWidth = Math.max(maxNeededWidth, spaceNeeded);
        
        // Recursively check nested groups
        const nestedMin = calculateMinimumNameWidth(groupItems, level + 1);
        maxNeededWidth = Math.max(maxNeededWidth, nestedMin);
      }
    }
    
    return maxNeededWidth;
  }

  // Reactively calculate minimum width
  $: {
    minimumNameWidth = calculateMinimumNameWidth(waveJson.signal);
    // Ensure current width meets minimum
    if (nameColumnWidth < minimumNameWidth) {
      nameColumnWidth = minimumNameWidth;
    }
  }
  
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

    // Resize handlers
    function handleResizeStart(event: MouseEvent) {
      isResizing = true;
      resizeStartX = event.clientX;
      resizeStartWidth = nameColumnWidth;
      
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      
      // Add global mouse listeners
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }

    function handleResizeMove(event: MouseEvent) {
      if (!isResizing) return;
      
      const deltaX = event.clientX - resizeStartX;
      const newWidth = Math.max(minimumNameWidth, Math.min(400, resizeStartWidth + deltaX)); // Use dynamic minimum, max 400px
      nameColumnWidth = newWidth;
    }

    function handleResizeEnd() {
      if (!isResizing) return;
      
      isResizing = false;
      
      // Restore normal cursor and text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      // Remove global listeners
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('wavescaler-name-column-width', nameColumnWidth.toString());
      }
    }

    // New unified drag and drop handling
    function handleDragStart(event: DragEvent, path: number[], itemType: 'signal' | 'group' | 'spacer') {
      const item = WaveTreeManager.getItemAtPath(waveJson.signal, path);
      if (!item) return;
      
      dragState = {
        isDragging: true,
        sourcePath: path,
        sourceType: itemType,
        sourceItem: item
      };
      
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        // Encode the path as JSON for precise identification
        event.dataTransfer.setData('application/wavescaler-path', JSON.stringify(path));
        event.dataTransfer.setData('application/wavescaler-type', itemType);
        
        // Create appropriate drag image
        const dragImage = document.createElement('div');
        if (itemType === 'signal') {
          dragImage.textContent = (item as WaveSignal).name;
          dragImage.style.backgroundColor = '#3b82f6';
        } else if (itemType === 'group') {
          dragImage.textContent = `📁 ${(item as WaveGroup)[0]}`;
          dragImage.style.backgroundColor = '#3b82f6';
        } else {
          dragImage.textContent = '--- SPACER ---';
          dragImage.style.backgroundColor = '#6b7280';
        }
        
        dragImage.style.padding = '4px 8px';
        dragImage.style.color = 'white';
        dragImage.style.borderRadius = '4px';
        dragImage.style.fontSize = '12px';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        
        setTimeout(() => {
          document.body.removeChild(dragImage);
        }, 0);
      }
    }

    function handleDragEnd() {
      dragState = {
        isDragging: false,
        sourcePath: null,
        sourceType: null,
        sourceItem: null
      };
    }

    function handleDrop(event: DragEvent, targetPath: number[], position: 'before' | 'after' | 'inside') {
      event.preventDefault();
      
      const sourcePathStr = event.dataTransfer?.getData('application/wavescaler-path');
      const sourceType = event.dataTransfer?.getData('application/wavescaler-type') as 'signal' | 'group' | 'spacer';
      
      if (!sourcePathStr || !sourceType) return;
      
      const sourcePath: number[] = JSON.parse(sourcePathStr);
      
      // Don't drop on self
      if (JSON.stringify(sourcePath) === JSON.stringify(targetPath)) return;
      
      // Validate that inside drops are only on groups
      if (position === 'inside') {
        const targetItem = WaveTreeManager.getItemAtPath(waveJson.signal, targetPath);
        if (!Array.isArray(targetItem)) return; // Can only drop inside groups
      }
      
      // Perform the move operation
      const newSignals = WaveTreeManager.moveItem(waveJson.signal, sourcePath, targetPath, position);
      
      // Update the waveJson structure
      const newWaveJson = {
        ...waveJson,
        signal: newSignals
      };
      
      waveJson = newWaveJson;
      dispatch('structurechange', { newWaveJson });
      
      // Reset drag state
      handleDragEnd();
    }

    // Legacy handlers for compatibility - these will forward to the new system
    function handleSignalReorder(event: CustomEvent<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = event.detail;
      
      if (fromIndex === toIndex) return; // No change needed
      
      const position = fromIndex < toIndex ? 'after' : 'before';
      const newSignals = WaveTreeManager.moveItem(waveJson.signal, [fromIndex], [toIndex], position);
      
      const newWaveJson = {
        ...waveJson,
        signal: newSignals
      };
      
      waveJson = newWaveJson;
      dispatch('structurechange', { newWaveJson });
    }

    function handleGroupReorder(event: CustomEvent<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = event.detail;
      
      if (fromIndex === toIndex) return; // No change needed
      
      const position = fromIndex < toIndex ? 'after' : 'before';
      const newSignals = WaveTreeManager.moveItem(waveJson.signal, [fromIndex], [toIndex], position);
      
      const newWaveJson = {
        ...waveJson,
        signal: newSignals
      };
      
      waveJson = newWaveJson;
      dispatch('structurechange', { newWaveJson });
    }

    function handleMoveToGroup(event: CustomEvent<{ fromIndex: number; toGroupIndex: number; itemType: 'signal' | 'group' | 'spacer' }>) {
      const { fromIndex, toGroupIndex, itemType } = event.detail;
      
      const newSignals = WaveTreeManager.moveItem(waveJson.signal, [fromIndex], [toGroupIndex], 'inside');
      
      const newWaveJson = {
        ...waveJson,
        signal: newSignals
      };
      
      waveJson = newWaveJson;
      dispatch('structurechange', { newWaveJson });
    }

    // Spacer drag and drop handlers (legacy compatibility)
    function handleSpacerDragStart(event: DragEvent, spacerIndex: number) {
      handleDragStart(event, [spacerIndex], 'spacer');
    }

    function handleSpacerDragOver(event: DragEvent, spacerIndex: number) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      
      // Determine if dragging over top or bottom half
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      spacerDraggedOverPosition[spacerIndex] = event.clientY < middleY ? 'above' : 'below';
      spacerDraggedOverPosition = { ...spacerDraggedOverPosition }; // Trigger reactivity
    }

    function handleSpacerDragLeave(event: DragEvent, spacerIndex: number) {
      spacerDraggedOverPosition[spacerIndex] = null;
      spacerDraggedOverPosition = { ...spacerDraggedOverPosition }; // Trigger reactivity
    }

    function handleSpacerDrop(event: DragEvent, spacerIndex: number) {
      const dragPosition = spacerDraggedOverPosition[spacerIndex];
      const position = dragPosition === 'above' ? 'before' : 'after';
      
      handleDrop(event, [spacerIndex], position);
      
      spacerDraggedOverPosition[spacerIndex] = null;
      spacerDraggedOverPosition = { ...spacerDraggedOverPosition };
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
  
    <div class="waveform-diagram" style="--hscale: {hscale}; --name-width: {nameColumnWidth}px">
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
      <WaveformGrid {maxCycles} {hscale} {nameColumnWidth} />
      
      <!-- Column Resize Handle -->
      <div 
        class="column-resize-handle"
        class:resizing={isResizing}
        class:at-minimum={nameColumnWidth <= minimumNameWidth}
        style="left: {nameColumnWidth - 2}px"
        on:mousedown={handleResizeStart}
        role="separator"
        aria-label="Resize signal name column"
        title="Drag to resize signal name column (minimum: {minimumNameWidth}px)"
      ></div>
      
      <!-- Signal Content -->
      <div class="signal-container">
        {#each waveJson.signal as item, i (item)}
          {@const itemType = getItemType(item)}
          
          {#if itemType === 'signal'}
            <SignalLane
              signal={item as WaveSignal}
              signalIndex={signalIndexMap.get(item) ?? i}
              treePath={[i]}
              {maxCycles}
              {hscale}
              {isCellSelected}
              on:signalchange={(e) => handleSignalChange(e)}
              on:cellselection={(e) => dispatch('cellselection', e.detail)}
              on:laneselection={(e) => dispatch('laneselection', e.detail)}
              on:rightclick={(e) => handleRightClick(e)}
              on:transitionclick={(e) => dispatch('transitionclick', e.detail)}
              on:signalreorder={(e) => handleSignalReorder(e)}
              on:dragstart={(e) => handleDragStart(e.detail.event, e.detail.path, e.detail.itemType)}
              on:drop={(e) => handleDrop(e.detail.event, e.detail.targetPath, e.detail.position)}
            />
          {:else if itemType === 'group'}
            <SignalGroup
              group={item as WaveGroup}
              parentIndex={i}
              treePath={[i]}
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
              on:laneselection={(e) => dispatch('laneselection', e.detail)}
              on:rightclick={(e) => handleRightClick(e)}
              on:signalreorder={(e) => handleSignalReorder(e)}
              on:groupreorder={(e) => handleGroupReorder(e)}
              on:movetogroup={(e) => handleMoveToGroup(e)}
              on:dragstart={(e) => handleDragStart(e.detail.event, e.detail.path, e.detail.itemType)}
              on:drop={(e) => handleDrop(e.detail.event, e.detail.targetPath, e.detail.position)}
            />
          {:else if itemType === 'spacer'}
            <div class="signal-spacer" 
                 class:drag-over-above={spacerDraggedOverPosition[i] === 'above'}
                 class:drag-over-below={spacerDraggedOverPosition[i] === 'below'}
                 draggable="true"
                 on:dragstart={(e) => handleSpacerDragStart(e, i)}
                 on:dragover={(e) => handleSpacerDragOver(e, i)}
                 on:dragleave={(e) => handleSpacerDragLeave(e, i)}
                 on:drop={(e) => handleSpacerDrop(e, i)}>
              <div class="spacer-name">spacer</div>
              <div class="spacer-wave-area" style="width: {maxCycles * cycleWidth}px;">
                <div class="spacer-vertical-line"></div>
              </div>
            </div>
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
      --name-width: 150px; /* Default, will be overridden by inline style */
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
      display: flex;
      margin: 2px 0;
      cursor: grab;
      transition: all 0.15s ease;
      position: relative;
    }

    .signal-spacer:active {
      cursor: grabbing;
    }

    .signal-spacer:hover {
      background-color: rgba(59, 130, 246, 0.05);
    }

    .signal-spacer.drag-over-above::before {
      content: '';
      position: absolute;
      top: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: #3b82f6;
      z-index: 10;
    }

    .signal-spacer.drag-over-below::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: #3b82f6;
      z-index: 10;
    }

    .spacer-name {
      width: var(--name-width);
      display: flex;
      align-items: center;
      padding: 0 16px;
      font-size: 11px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
      background-color: transparent;
    }

    .spacer-wave-area {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: transparent;
      position: relative;
    }

    .spacer-wave-area::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 2px;
      background-image: repeating-linear-gradient(
        to right,
        #9ca3af 0,
        #9ca3af 12px,
        transparent 12px,
        transparent 20px
      );
      opacity: 0.9;
    }

    .spacer-vertical-line {
      width: 1px;
      height: 100%;
      background: transparent;
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

    /* Column resize handle */
    .column-resize-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 4px;
      background-color: transparent;
      cursor: col-resize;
      z-index: 100;
      transition: background-color 0.15s ease;
    }

    .column-resize-handle:hover {
      background-color: rgba(59, 130, 246, 0.3);
    }

    .column-resize-handle.resizing {
      background-color: rgba(59, 130, 246, 0.5);
    }

    /* Add a subtle visual indicator */
    .column-resize-handle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 1px;
      height: 20px;
      background-color: #d1d5db;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .column-resize-handle:hover::after {
      opacity: 1;
    }

    .column-resize-handle.resizing::after {
      opacity: 1;
      background-color: #3b82f6;
    }

    /* Visual indicator when at minimum width */
    .column-resize-handle.at-minimum {
      background-color: rgba(245, 158, 11, 0.3);
    }

    .column-resize-handle.at-minimum:hover {
      background-color: rgba(245, 158, 11, 0.5);
    }

    .column-resize-handle.at-minimum::after {
      background-color: #f59e0b;
      opacity: 0.8;
    }
  </style>
  