<script lang="ts">
    import type { WaveJson, SignalItem, WaveSignal, WaveGroup, TreePath } from '$lib/wavejson-types';
    import { WaveTreeManager } from '$lib/wavejson-types';
    import SignalLane from './SignalLane.svelte';
    import SignalGroup from './SignalGroup.svelte';
    import WaveformGrid from './WaveformGrid.svelte';
    import CycleContextMenu from './CycleContextMenu.svelte';
    import NodeContextMenu from './NodeContextMenu.svelte';
    import ArrowContextMenu from './ArrowContextMenu.svelte';
    import Arrow from './Arrow.svelte';
    import { createEventDispatcher } from 'svelte';
    import { selectedLanes, clearLaneSelection } from '$lib/lane-selection-store';
  
      export let waveJson: WaveJson;
  export let isCellSelected: (signalIndex: number, cycleIndex: number) => boolean = () => false;

  const dispatch = createEventDispatcher<{
    signalchange: { signalIndex: number; newSignal: WaveSignal };
    structurechange: { newWaveJson: WaveJson };
    cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
    laneselection: { signalIndex: number; signalName: string; shiftKey: boolean };
    groupselection: { groupName: string; signalIndices: number[]; shiftKey: boolean };
    cyclechange: { signalIndex: number; cycleIndex: number; newChar: string };
    transitionclick: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number };
    transitiondrag: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number; deltaX: number; dragMode: 'default' | 'extend' };
    annotationstart: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number; startX: number; startY: number };
    annotationupdate: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number; currentX: number; currentY: number; isSticky: boolean };
    annotationend: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number; endX: number; endY: number; isSticky: boolean };
    rightclick: { signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string; isImplicit: boolean; isExplicit: boolean };
    nodenamed: { signalIndex: number; cycleIndex: number; nodeId: string; nodeName: string };
  }>();

  // Context menu state
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuSignalName = '';
  let contextMenuSignalIndex = 0;
  let contextMenuCycleIndex = 0;
  let contextMenuCurrentValue = '';
  let contextMenuIsImplicit = false;
  let contextMenuIsExplicit = false;
  
  // Node context menu state
  let nodeContextMenuVisible = false;
  let nodeContextMenuX = 0;
  let nodeContextMenuY = 0;
  let nodeContextMenuNodeId = '';
  let nodeContextMenuSignalIndex = 0;
  let nodeContextMenuCycleIndex = 0;
  
  // Arrow context menu state
  let arrowContextMenuVisible = false;
  let arrowContextMenuX = 0;
  let arrowContextMenuY = 0;
  let arrowContextMenuIndex = 0;
  let arrowContextMenuCurrentMode = '->';
  
  // Arrow interaction state
  let isDraggingArrow = false;
  let draggingArrowIndex = -1;
  let arrowDragStartX = 0;
  let arrowDragStartY = 0;
  
  // Drag and drop state for spacers
  let spacerDraggedOverPosition: { [key: number]: 'above' | 'below' | null } = {};
  
  // Annotation drawing state
  let currentAnnotation: {
    signalIndex: number;
    fromCycleIndex: number;
    toCycleIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isSticky: boolean;
    isActive: boolean;
  } | null = null;
  
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
    function getItemType(item: SignalItem): 'signal' | 'group' | 'spacer' | 'node-only' | 'unknown' {
      if (!item || typeof item !== 'object') return 'unknown';
      if (Object.keys(item).length === 0 && !Array.isArray(item)) return 'spacer';
      if (Array.isArray(item)) return 'group';
      if ('name' in item && 'wave' in item) return 'signal';
      if ('node' in item && !('name' in item) && !('wave' in item)) return 'node-only';
      return 'unknown';
    }
  
    // Configuration - make reactive
    $: config = waveJson.config || {};
    $: hscale = config.hscale ?? 1;
    $: cycleWidth = 40 * hscale; // Width of a single cycle char
  
    let maxCycles = 0;
  
    function findMaxCycles(items: SignalItem[]): number {
      let cycles = 0;
      for (const item of items) {
        const type = getItemType(item);
        if (type === 'signal') {
          cycles = Math.max(cycles, (item as WaveSignal).wave.length);
        } else if (type === 'node-only') {
          // Node-only signals can also contribute to cycle count via their node string
          const nodeSignal = item as { node?: string };
          if (nodeSignal.node) {
            cycles = Math.max(cycles, nodeSignal.node.length);
          }
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
      
      // Only dispatch the event, don't modify state directly
      if (waveJson.signal[signalIndex] && getItemType(waveJson.signal[signalIndex]) === 'signal') {
        dispatch('signalchange', event.detail);
      }
    }
  
    function handleStructureChange(event: CustomEvent<{ newWaveJson: WaveJson }>) {
      // Only dispatch the event, don't modify state directly
      dispatch('structurechange', event.detail);
    }

    function handleGroupChange(event: CustomEvent<{ groupIndex: number; newGroup: WaveGroup }>) {
      const { groupIndex, newGroup } = event.detail;
      
      // Only dispatch the event, don't modify state directly
      if (waveJson.signal[groupIndex] && Array.isArray(waveJson.signal[groupIndex])) {
        dispatch('structurechange', { 
          newWaveJson: {
            ...waveJson,
            signal: waveJson.signal.map((item, idx) => 
              idx === groupIndex ? newGroup : item
            ) as SignalItem[]
          }
        });
      }
    }

    function handleRightClick(event: CustomEvent<{ signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string; isImplicit: boolean; isExplicit: boolean }>) {
      const { signalIndex, cycleIndex, x, y, currentValue, isImplicit, isExplicit } = event.detail;
      
      // Forward the event to the parent
      dispatch('rightclick', event.detail);
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

    function handleNodeRightClick(event: CustomEvent<{ signalIndex: number; cycleIndex: number; nodeId: string; x: number; y: number }>) {
      const { signalIndex, cycleIndex, nodeId, x, y } = event.detail;
      
      // Close any existing context menu
      contextMenuVisible = false;
      
      // Set node context menu state
      nodeContextMenuSignalIndex = signalIndex;
      nodeContextMenuCycleIndex = cycleIndex;
      nodeContextMenuNodeId = nodeId;
      nodeContextMenuX = x;
      nodeContextMenuY = y;
      nodeContextMenuVisible = true;
    }

    function handleNodeContextMenuSetName(event: CustomEvent<{ nodeId: string; nodeName: string }>) {
      const { nodeId, nodeName } = event.detail;
      
      // Dispatch the nodenamed event to update the waveJson
      dispatch('nodenamed', {
        signalIndex: nodeContextMenuSignalIndex,
        cycleIndex: nodeContextMenuCycleIndex,
        nodeId,
        nodeName
      });
      
      nodeContextMenuVisible = false;
    }

    function handleNodeContextMenuClose() {
      nodeContextMenuVisible = false;
    }

    function handleArrowRightClick(event: CustomEvent<{ arrowIndex: number; x: number; y: number }>) {
      const { arrowIndex, x, y } = event.detail;
      
      // Close other context menus
      contextMenuVisible = false;
      nodeContextMenuVisible = false;
      
      // Get current arrow mode
      const edge = waveJson.edge?.[arrowIndex];
      
      if (edge) {
        arrowContextMenuIndex = arrowIndex;
        arrowContextMenuCurrentMode = edge;
        arrowContextMenuX = x;
        arrowContextMenuY = y;
        arrowContextMenuVisible = true;
      }
    }

    function handleArrowModeChange(event: CustomEvent<{ arrowIndex: number; newMode: string }>) {
      const { arrowIndex, newMode } = event.detail;
      updateArrowMode(arrowIndex, newMode);
    }

    function handleArrowContextMenuSetMode(event: CustomEvent<{ mode: string }>) {
      const { mode } = event.detail;
      
      // Update the arrow mode in waveJson
      if (waveJson.edge && waveJson.edge[arrowContextMenuIndex]) {
        const currentEdgeString = waveJson.edge[arrowContextMenuIndex];
        
        // Extract node IDs and text label, then replace just the arrow part
        const match = currentEdgeString.match(/^([a-zA-Z]\d*)([^a-zA-Z\d]+)([a-zA-Z]\d*)(\s+(.+))?$/);
        if (match) {
          const [, fromNode, , toNode, , textLabel] = match;
          const newEdgeString = textLabel ? `${fromNode}${mode}${toNode} ${textLabel}` : `${fromNode}${mode}${toNode}`;
          
          waveJson.edge[arrowContextMenuIndex] = newEdgeString;
          waveJson = waveJson; // Trigger reactivity
          dispatch('structurechange', { newWaveJson: waveJson });
        }
      }
      
      arrowContextMenuVisible = false;
    }

    function handleArrowContextMenuSetText(event: CustomEvent<{ text: string }>) {
      const { text } = event.detail;
      
      // Update the arrow text in waveJson
      if (waveJson.edge && waveJson.edge[arrowContextMenuIndex]) {
        const currentEdgeString = waveJson.edge[arrowContextMenuIndex];
        
        // Extract node IDs and arrow type, then add/update text label
        const match = currentEdgeString.match(/^([a-zA-Z]\d*[^a-zA-Z\d]+[a-zA-Z]\d*)(\s+(.+))?$/);
        if (match) {
          const [, arrowPart] = match;
          const newEdgeString = text.trim() ? `${arrowPart} ${text.trim()}` : arrowPart;
          
          waveJson.edge[arrowContextMenuIndex] = newEdgeString;
          waveJson = waveJson; // Trigger reactivity
          dispatch('structurechange', { newWaveJson: waveJson });
        }
      }
      
      arrowContextMenuVisible = false;
    }

    function handleArrowContextMenuDelete() {
      // Remove the arrow from waveJson
      if (waveJson.edge && waveJson.edge[arrowContextMenuIndex]) {
        waveJson.edge.splice(arrowContextMenuIndex, 1);
        if (waveJson.edge.length === 0) {
          delete waveJson.edge;
        }
        waveJson = waveJson; // Trigger reactivity
        dispatch('structurechange', { newWaveJson: waveJson });
      }
      
      arrowContextMenuVisible = false;
    }

    function handleArrowContextMenuClose() {
      arrowContextMenuVisible = false;
    }

    function handleArrowDragStart(event: CustomEvent<{ arrowIndex: number; x: number; y: number }>) {
      const { arrowIndex, x, y } = event.detail;
      
      // Close context menus when starting to drag
      contextMenuVisible = false;
      nodeContextMenuVisible = false;
      arrowContextMenuVisible = false;
      
      isDraggingArrow = true;
      draggingArrowIndex = arrowIndex;
      arrowDragStartX = x;
      arrowDragStartY = y;
    }

    function handleArrowDragMove(event: CustomEvent<{ arrowIndex: number; x: number; y: number; deltaX: number; deltaY: number }>) {
      const { arrowIndex, deltaX, deltaY } = event.detail;
      
      if (!isDraggingArrow || arrowIndex !== draggingArrowIndex) return;
      
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // If dragged more than 10 pixels, determine new mode based on direction
      if (distance > 10) {
        const angle = Math.atan2(deltaY, deltaX);
        const degrees = (angle * 180) / Math.PI;
        
        // Determine if it should be spline or straight based on angle
        // More vertical movement suggests spline (curved)
        // More horizontal movement suggests straight
        const absAngle = Math.abs(degrees);
        const isSplineDirection = absAngle > 30 && absAngle < 150; // More vertical
        
        const currentEdge = waveJson.edge?.[draggingArrowIndex];
        if (currentEdge) {
          // Parse the current edge to extract arrow type and nodes
          const edgeData = parseEdgeString(currentEdge);
          if (edgeData) {
            // Extract node information from the full edge string
            const nodeMatch = currentEdge.match(/^([a-zA-Z]\d*)[^a-zA-Z\d]+([a-zA-Z]\d*)(\s+(.+))?$/);
            if (!nodeMatch) return;
            const [, fromNode, toNode, , textLabel] = nodeMatch;
            const isCurrentlySpline = edgeData.arrowType.includes('~');
            
            if (isSplineDirection && !isCurrentlySpline) {
              // Convert to spline - only transform valid patterns
              let newArrowType = edgeData.arrowType;
              if (edgeData.arrowType === '->') newArrowType = '~>';
              else if (edgeData.arrowType === '-|>') newArrowType = '-~>';
              else if (edgeData.arrowType === '-') newArrowType = '~';
              else if (edgeData.arrowType === '<->') newArrowType = '<~>';
              else if (edgeData.arrowType === '<-|>') newArrowType = '<-~>';
              
              if (newArrowType !== edgeData.arrowType) {
                const newEdgeString = textLabel 
                  ? `${fromNode}${newArrowType}${toNode} ${textLabel}`
                  : `${fromNode}${newArrowType}${toNode}`;
                updateArrowMode(draggingArrowIndex, newEdgeString);
              }
            } else if (!isSplineDirection && isCurrentlySpline) {
              // Convert to straight - only transform valid patterns
              let newArrowType = edgeData.arrowType;
              if (edgeData.arrowType === '~>') newArrowType = '->';
              else if (edgeData.arrowType === '-~>') newArrowType = '-|>';
              else if (edgeData.arrowType === '~') newArrowType = '-';
              else if (edgeData.arrowType === '<~>') newArrowType = '<->';
              else if (edgeData.arrowType === '<-~>') newArrowType = '<-|>';
              
              if (newArrowType !== edgeData.arrowType) {
                const newEdgeString = textLabel 
                  ? `${fromNode}${newArrowType}${toNode} ${textLabel}`
                  : `${fromNode}${newArrowType}${toNode}`;
                updateArrowMode(draggingArrowIndex, newEdgeString);
              }
            }
          }
        }
      }
    }

    function handleArrowDragEnd(event: CustomEvent<{ arrowIndex: number }>) {
      const { arrowIndex } = event.detail;
      
      if (arrowIndex === draggingArrowIndex) {
        isDraggingArrow = false;
        draggingArrowIndex = -1;
      }
    }

    function updateArrowMode(arrowIndex: number, newMode: string) {
      if (waveJson.edge && waveJson.edge[arrowIndex]) {
        waveJson.edge[arrowIndex] = newMode;
        waveJson = waveJson; // Trigger reactivity
        dispatch('structurechange', { newWaveJson: waveJson });
      }
    }

    function handleContextMenuExplicitate() {
      // Explicitate the selected signal - convert implicit to explicit
      const signal = findSignalByIndex(contextMenuSignalIndex);
      if (signal) {
        let waveChars = signal.wave.split('');
        
        // Only process the specific cell that was right-clicked
        if (contextMenuCycleIndex < waveChars.length && waveChars[contextMenuCycleIndex] === '.') {
          // Find the effective character for this specific cell
          let effectivePrevChar: string | null = null;
          
          // Look backwards to find the last non-dot character
          for (let i = contextMenuCycleIndex - 1; i >= 0; i--) {
            if (waveChars[i] !== '.') {
              effectivePrevChar = waveChars[i];
              break;
            }
          }
          
          // Replace only this specific dot with the effective character
          if (effectivePrevChar) {
            waveChars[contextMenuCycleIndex] = effectivePrevChar;
          }
          
          const newSignal = { ...signal, wave: waveChars.join('') };
          updateSignalAtIndex(contextMenuSignalIndex, newSignal);
          dispatch('structurechange', { newWaveJson: waveJson });
        }
      }
      contextMenuVisible = false;
    }

    function handleContextMenuImplicitate() {
      // Implicitate the selected signal - convert explicit to implicit where possible
      const signal = findSignalByIndex(contextMenuSignalIndex);
      if (signal) {
        const waveChars = signal.wave.split('');
        
        // Only process the specific cell that was right-clicked
        if (contextMenuCycleIndex < waveChars.length && waveChars[contextMenuCycleIndex] !== '.') {
          const currentChar = waveChars[contextMenuCycleIndex];
          
          // Skip empty characters
          if (currentChar === '') {
            contextMenuVisible = false;
            return;
          }
          
          // Can implicitate any cell after the first one (index > 0)
          if (contextMenuCycleIndex > 0) {
            // Special handling for data signals - don't collapse data values
            if (!['=', '2', '3', '4', '5'].includes(currentChar)) {
              // Safe to collapse this character to a dot
              waveChars[contextMenuCycleIndex] = '.';
              
              const newSignal = { ...signal, wave: waveChars.join('') };
              updateSignalAtIndex(contextMenuSignalIndex, newSignal);
              dispatch('structurechange', { newWaveJson: waveJson });
            }
          }
        }
      }
      contextMenuVisible = false;
    }

    function findSignalByIndex(signalIndex: number): WaveSignal | null {
      let currentIndex = 0;
      for (const item of waveJson.signal) {
        if (Array.isArray(item)) {
          // It's a group - iterate through its signals
          for (let i = 1; i < item.length; i++) {
            const subItem = item[i];
            if (currentIndex === signalIndex && subItem && typeof subItem === 'object' && !Array.isArray(subItem) && 'name' in subItem) {
              return subItem as WaveSignal;
            }
            currentIndex++;
          }
        } else if (item && typeof item === 'object' && 'name' in item) {
          // It's a signal
          if (currentIndex === signalIndex) {
            return item as WaveSignal;
          }
          currentIndex++;
        } else {
          // It's a spacer or unknown
          currentIndex++;
        }
      }
      return null;
    }

    function updateSignalAtIndex(signalIndex: number, newSignal: WaveSignal) {
        // Create a new signal array with updated signal
        const newSignals = waveJson.signal.map((item, i) => {
            if (Array.isArray(item)) {
                // It's a group - create a new array with updated signal
                return [
                    item[0],
                    ...item.slice(1).map((subItem, j) => {
                        const subIndex = getSignalFlatIndex(i, j);
                        return subIndex === signalIndex ? newSignal : subItem;
                    })
                ] as WaveGroup;
            } else {
                // It's a signal or spacer
                const flatIndex = getSignalFlatIndex(i);
                return flatIndex === signalIndex ? newSignal : item;
            }
        }) as SignalItem[];

        // Create a new waveJson object
        waveJson = {
            ...waveJson,
            signal: newSignals
        };

        // Notify parent of structure change
        dispatch('structurechange', { newWaveJson: waveJson });
    }

    // Helper to get flat index for a signal in nested structure
    function getSignalFlatIndex(groupIndex: number, subIndex?: number): number {
        let flatIndex = 0;
        for (let i = 0; i < groupIndex; i++) {
            const item = waveJson.signal[i];
            if (Array.isArray(item)) {
                // It's a group - count its signals (excluding group name)
                flatIndex += item.length - 1;
            } else if (item && typeof item === 'object' && 'name' in item) {
                // It's a signal
                flatIndex++;
            } else {
                // It's a spacer
                flatIndex++;
            }
        }
        
        if (subIndex !== undefined) {
            // Add subIndex for signals within the current group
            flatIndex += subIndex;
        } else if (!Array.isArray(waveJson.signal[groupIndex])) {
            // For non-group items, no adjustment needed
        }
        
        return flatIndex;
    }

    // Resize handlers
    function handleResizeStart(event: MouseEvent) {
      isResizing = true;
      resizeStartX = event.clientX;
      resizeStartWidth = nameColumnWidth;
      
      // Close context menus when resizing starts
      contextMenuVisible = false;
      nodeContextMenuVisible = false;
      arrowContextMenuVisible = false;
      
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
          dragImage.style.backgroundColor = 'var(--color-accent-primary)';
        } else if (itemType === 'group') {
          dragImage.textContent = `📁 ${(item as WaveGroup)[0]}`;
          dragImage.style.backgroundColor = 'var(--color-accent-primary)';
        } else {
          dragImage.textContent = '--- SPACER ---';
          dragImage.style.backgroundColor = 'var(--color-text-tertiary)';
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
        
        // Close context menus when scaling
        contextMenuVisible = false;
        nodeContextMenuVisible = false;
        arrowContextMenuVisible = false;
        
        // Determine zoom direction
        const zoomOut = event.deltaY > 0;
        const zoomFactor = 0.1;
        
        // Calculate new scale
        const currentScale = waveJson.config?.hscale ?? 1;
        let newScale = zoomOut 
          ? Math.max(0.25, currentScale - zoomFactor)
          : Math.min(10, currentScale + zoomFactor);
        
        // Round to 2 decimal places for cleaner values
        newScale = Math.round(newScale * 100) / 100;
        
        // Update the waveJson configuration
        if (!waveJson.config) waveJson.config = {};
        waveJson.config.hscale = newScale;
        waveJson = waveJson; // Trigger reactivity
        
        // Dispatch the change event
        dispatch('structurechange', { newWaveJson: waveJson });
      }
      // Check for Shift key for horizontal scrolling
      else if (event.shiftKey) {
        event.preventDefault();
        
        // Close context menus when scrolling
        contextMenuVisible = false;
        nodeContextMenuVisible = false;
        arrowContextMenuVisible = false;
        
        // On macOS with Shift+scroll, deltaY becomes 0 and deltaX contains the scroll value
        // On other platforms, deltaY contains the scroll value that we convert to horizontal
        const scrollAmount = event.deltaX !== 0 ? event.deltaX : event.deltaY;
        const target = event.currentTarget as HTMLElement;
        
        // Find the scrollable container (the diagram content or its parent)
        let scrollContainer: HTMLElement | null = target;
        while (scrollContainer && scrollContainer.scrollWidth <= scrollContainer.clientWidth) {
          const parent: HTMLElement | null = scrollContainer.parentElement;
          if (!parent || parent === document.body) {
            // If we reach the body, use the original target
            scrollContainer = target;
            break;
          }
          scrollContainer = parent;
        }
        
        // Apply horizontal scroll
        if (scrollContainer && scrollAmount !== 0) {
          scrollContainer.scrollLeft += scrollAmount;
        }
      }
      // If no modifier key, allow normal vertical scrolling
    }

    function handleCycleChange(event: CustomEvent<{ signalIndex: number; cycleIndex: number; newChar: string }>) {
      dispatch('cyclechange', event.detail);
    }

    function handleAnnotationStart(event: CustomEvent<{ signalIndex: number; fromCycleIndex: number; toCycleIndex: number; startX: number; startY: number }>) {
      const { signalIndex, fromCycleIndex, toCycleIndex, startX, startY } = event.detail;
      
      // Close context menus when annotation drawing starts
      contextMenuVisible = false;
      nodeContextMenuVisible = false;
      arrowContextMenuVisible = false;
      
      currentAnnotation = {
        signalIndex,
        fromCycleIndex,
        toCycleIndex,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        isSticky: false,
        isActive: true
      };
      
      dispatch('annotationstart', event.detail);
    }

    function handleAnnotationUpdate(event: CustomEvent<{ signalIndex: number; fromCycleIndex: number; toCycleIndex: number; currentX: number; currentY: number; isSticky: boolean }>) {
      if (currentAnnotation && currentAnnotation.isActive) {
        currentAnnotation.currentX = event.detail.currentX;
        currentAnnotation.currentY = event.detail.currentY;
        currentAnnotation.isSticky = event.detail.isSticky;
        
        // Trigger reactivity
        currentAnnotation = currentAnnotation;
      }
      
      dispatch('annotationupdate', event.detail);
    }

    function handleAnnotationEnd(event: CustomEvent<{ signalIndex: number; fromCycleIndex: number; toCycleIndex: number; endX: number; endY: number; isSticky: boolean }>) {
      if (currentAnnotation && currentAnnotation.isActive) {
        // Try to detect if the arrow was dropped on another transition
        const targetTransition = findTransitionAtPosition(event.detail.endX, event.detail.endY);
        
        if (targetTransition || !event.detail.isSticky) {
          // Create and save the annotation
          const newEdge = createWaveEdge(currentAnnotation, targetTransition, event.detail.isSticky);
          if (newEdge) {
            saveAnnotationToWaveJson(newEdge);
          }
        }
        
        currentAnnotation = null;
      }
      
      dispatch('annotationend', event.detail);
    }

    function findTransitionAtPosition(x: number, y: number): { signalIndex: number; fromCycleIndex: number; toCycleIndex: number } | null {
      // Find all transition elements and check if the coordinates overlap
      const transitionElements = document.querySelectorAll('.signal-transition');
      
      for (const element of transitionElements) {
        const rect = element.getBoundingClientRect();
        const diagramContainer = document.querySelector('.diagram-content');
        
        if (diagramContainer) {
          const containerRect = diagramContainer.getBoundingClientRect();
          const relativeX = rect.left - containerRect.left + diagramContainer.scrollLeft;
          const relativeY = rect.top - containerRect.top + diagramContainer.scrollTop;
          
          // Check if the drop position is within this transition's bounds (with some tolerance)
          const tolerance = 10;
          if (x >= relativeX - tolerance && x <= relativeX + rect.width + tolerance &&
              y >= relativeY - tolerance && y <= relativeY + rect.height + tolerance) {
            
            // Extract signal and cycle info from the element's data attributes or DOM structure
            const transitionOverlay = element.closest('.transition-overlay');
            if (transitionOverlay) {
              const signalLane = transitionOverlay.closest('.signal-lane');
              if (signalLane) {
                // Find the signal index from the lane
                const signalIndex = findSignalIndexFromElement(signalLane);
                
                // Extract cycle information from the transition element's attributes or data
                // This is a simplified approach - you might need to adjust based on your actual DOM structure
                const fromCycleIndex = parseInt(element.getAttribute('data-from-cycle') || '0');
                const toCycleIndex = parseInt(element.getAttribute('data-to-cycle') || '1');
                
                if (signalIndex !== -1) {
                  return { signalIndex, fromCycleIndex, toCycleIndex };
                }
              }
            }
          }
        }
      }
      
      return null;
    }

    function findSignalIndexFromElement(signalLaneElement: Element): number {
      // Find the signal index by walking up the DOM and looking at the signal array
      let index = 0;
      let currentElement = signalLaneElement.previousElementSibling;
      
      while (currentElement) {
        if (currentElement.classList.contains('signal-lane') || 
            currentElement.classList.contains('signal-group') ||
            currentElement.classList.contains('signal-spacer')) {
          index++;
        }
        currentElement = currentElement.previousElementSibling;
      }
      
      return index;
    }

    function createWaveEdge(
      annotation: typeof currentAnnotation, 
      targetTransition: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number } | null,
      isSticky: boolean
    ): string | null {
      if (!annotation) return null;
      
      // Generate node identifiers for WaveDrom edges
      const fromNodeId = generateNodeId(annotation.signalIndex, annotation.fromCycleIndex);
      const toNodeId = targetTransition 
        ? generateNodeId(targetTransition.signalIndex, targetTransition.fromCycleIndex)
        : generateNodeId(annotation.signalIndex, annotation.toCycleIndex);
      
      // Determine arrow type based on context
      let arrowType: string;
      
      if (isSticky) {
        // Sticky (Shift held) = spline arrows
        if (targetTransition && targetTransition.signalIndex === annotation.signalIndex) {
          // Same signal, use simple spline
          arrowType = '~>';
        } else {
          // Different signals, use curved spline  
          arrowType = '-~>';
        }
      } else {
        // Normal = sharp/straight arrows
        if (targetTransition && targetTransition.signalIndex === annotation.signalIndex) {
          // Same signal, use simple straight arrow
          arrowType = '->';
        } else {
          // Different signals, use angled straight arrow
          arrowType = '-|->';
        }
      }
      
      return `${fromNodeId}${arrowType}${toNodeId}`;
    }

    function generateNodeId(signalIndex: number, cycleIndex: number): string {
      // Generate a simple node ID - you might want a more sophisticated system
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      const baseId = chars[signalIndex % chars.length];
      return `${baseId}${cycleIndex}`;
    }

    // Two-layer node system:
    // 1. System layer: deterministic generated nodes (always present)
    // 2. User layer: custom named nodes (override system when present)
    
    function generateSystemNodes() {
      let signalIndex = 0;
      
      for (const item of waveJson.signal) {
        const itemType = getItemType(item);
        
        if (itemType === 'signal') {
          const signal = item as WaveSignal;
          
          // Store user-defined nodes if they exist
          const userNodes = signal.node;
          
          // Generate system node string for this signal
          let systemNodeString = '';
          for (let i = 0; i < signal.wave.length; i++) {
            const char = signal.wave[i];
            // Only add nodes at transition points (not continuation dots)
            if (char !== '.' && char !== '|') {
              systemNodeString += generateNodeId(signalIndex, i);
            } else {
              systemNodeString += '.';
            }
          }
          
          // Store both system and user nodes
          signal._systemNodes = systemNodeString;
          if (!signal.node || signal.node === systemNodeString) {
            // If no user nodes or they match system, use system nodes
            signal.node = systemNodeString;
          }
          // Otherwise preserve user-defined nodes
          
          signalIndex++;
        } else if (itemType === 'node-only') {
          // Node-only signals keep their existing nodes (these are typically user-defined)
          signalIndex++;
        } else if (Array.isArray(item)) {
          // Handle groups - iterate through group items
          for (let i = 1; i < item.length; i++) {
            const groupItem = item[i];
            if (groupItem && typeof groupItem === 'object' && !Array.isArray(groupItem) && 'name' in groupItem && 'wave' in groupItem) {
              const signal = groupItem as WaveSignal;
              
              // Store user-defined nodes if they exist
              const userNodes = signal.node;
              
              let systemNodeString = '';
              for (let j = 0; j < signal.wave.length; j++) {
                const char = signal.wave[j];
                if (char !== '.' && char !== '|') {
                  systemNodeString += generateNodeId(signalIndex, j);
                } else {
                  systemNodeString += '.';
                }
              }
              
              // Store both system and user nodes
              signal._systemNodes = systemNodeString;
              if (!signal.node || signal.node === systemNodeString) {
                signal.node = systemNodeString;
              }
              
              signalIndex++;
            } else {
              signalIndex++; // Still count spacers
            }
          }
        } else {
          signalIndex++; // Count spacers and other items
        }
      }
    }

    function handleScroll(event: Event) {
      // Close context menus when scrolling
      contextMenuVisible = false;
      nodeContextMenuVisible = false;
      arrowContextMenuVisible = false;
    }

    function saveAnnotationToWaveJson(edgeString: string) {
      // Generate system nodes for any signals that need them
      generateSystemNodes();
      
      const newWaveJson = {
        ...waveJson,
        edge: [...(waveJson.edge || []), edgeString]
      };
      
      waveJson = newWaveJson;
      dispatch('structurechange', { newWaveJson });
    }

    // Generate system nodes when signals change, but preserve user-defined nodes
    $: {
      if (waveJson.signal) {
        generateSystemNodes();
      }
    }

    function parseEdgeString(edge: string): { fromNode: string; toNode: string; isSticky: boolean; arrowType: string } | null {
      // Parse different WaveDrom edge types, ignoring text labels at the end
      
      // Remove text labels (anything after the last node)
      const edgeWithoutText = edge.replace(/\s+.*$/, '');
      
      // Support both WaveDrom format (single letters) and system format (letter+number)
      const patterns = [
        // Official WaveDrom spline arrows (sticky/curved)
        { regex: /^([a-zA-Z]\d*)(<-~>)([a-zA-Z]\d*)/, isSticky: true },       // bidirectional line to spline
        { regex: /^([a-zA-Z]\d*)(<~>)([a-zA-Z]\d*)/, isSticky: true },        // bidirectional spline
        { regex: /^([a-zA-Z]\d*)(-~>)([a-zA-Z]\d*)/, isSticky: true },        // line to spline arrow
        { regex: /^([a-zA-Z]\d*)(~->)([a-zA-Z]\d*)/, isSticky: true },        // spline to arrow
        { regex: /^([a-zA-Z]\d*)(~>)([a-zA-Z]\d*)/, isSticky: true },         // simple spline arrow
        { regex: /^([a-zA-Z]\d*)(-~)([a-zA-Z]\d*)/, isSticky: true },         // line to spline
        { regex: /^([a-zA-Z]\d*)(~)([a-zA-Z]\d*)/, isSticky: true },          // simple spline
        
        // Official WaveDrom sharp/straight arrows
        { regex: /^([a-zA-Z]\d*)(<-\|->)([a-zA-Z]\d*)/, isSticky: false },    // bidirectional clock arrow
        { regex: /^([a-zA-Z]\d*)(<-\|>)([a-zA-Z]\d*)/, isSticky: false },     // bidirectional with clock
        { regex: /^([a-zA-Z]\d*)(<->)([a-zA-Z]\d*)/, isSticky: false },       // bidirectional arrow
        { regex: /^([a-zA-Z]\d*)(-\|->)([a-zA-Z]\d*)/, isSticky: false },     // clock to arrow
        { regex: /^([a-zA-Z]\d*)(\|->)([a-zA-Z]\d*)/, isSticky: false },      // clock start to arrow
        { regex: /^([a-zA-Z]\d*)(-\|>)([a-zA-Z]\d*)/, isSticky: false },      // clock arrow
        { regex: /^([a-zA-Z]\d*)(->)([a-zA-Z]\d*)/, isSticky: false },        // simple arrow
        { regex: /^([a-zA-Z]\d*)(-\|-)([a-zA-Z]\d*)/, isSticky: false },      // clock line
        { regex: /^([a-zA-Z]\d*)(-\|)([a-zA-Z]\d*)/, isSticky: false },       // line to clock
        { regex: /^([a-zA-Z]\d*)(-)([a-zA-Z]\d*)/, isSticky: false },         // simple line
        
        // Special cases
        { regex: /^([a-zA-Z]\d*)(\+)([a-zA-Z]\d*)/, isSticky: false },        // cross connection
      ];
      
      for (const { regex, isSticky } of patterns) {
        const match = edgeWithoutText.match(regex);
        if (match) {
          const result = { 
            fromNode: match[1], 
            toNode: match[3], 
            isSticky,
            arrowType: match[2]
          };
          return result;
        }
      }
      
      console.warn(`Failed to parse edge: "${edge}"`);
      return null;
    }

    function getNodePosition(nodeId: string): { x: number; y: number } | null {
      // Two-layer node lookup:
      // 1. First check user-defined nodes (like 'a', 'e' from WaveDrom)
      // 2. Fall back to system-generated nodes (like 'a0', 'b2')
      
      // Handle both single letters (WaveDrom) and letter+number (system) formats
      const signalChar = nodeId.length === 1 ? nodeId : nodeId.charAt(0);
      
      // Find the actual signal that contains this node
      let currentSignalIndex = 0;
      let foundSignal = false;
      let signalData = null;
      
      for (const item of waveJson.signal) {
        const itemType = getItemType(item);
        
        if (itemType === 'signal' || itemType === 'node-only') {
          const signal = item as any; // Can be WaveSignal or node-only object
          
          // First check user-defined nodes (primary layer) - single letter format
          if (nodeId.length === 1 && signal.node && typeof signal.node === 'string') {
            for (let i = 0; i < signal.node.length; i++) {
              const nodeAtPosition = signal.node[i];
              if (nodeAtPosition !== '.' && nodeAtPosition === nodeId) {
                foundSignal = true;
                signalData = { signalIndex: currentSignalIndex, signal, cycleIndex: i };
                break;
              }
            }
          }
          
          // If not found in user nodes, check system nodes (fallback layer) - exact match for letter+number
          if (!foundSignal && signal._systemNodes && typeof signal._systemNodes === 'string') {
            // For system nodes, look for exact nodeId match (like "b5")
            const nodeMatch = nodeId.match(/^([a-zA-Z])(\d+)$/);
            if (nodeMatch) {
              const [, letter, position] = nodeMatch;
              const pos = parseInt(position);
              if (pos < signal._systemNodes.length) {
                const expectedNodeId = generateNodeId(currentSignalIndex, pos);
                if (expectedNodeId === nodeId) {
                  foundSignal = true;
                  signalData = { signalIndex: currentSignalIndex, signal, cycleIndex: pos };
                }
              }
            } else {
              // Fallback: check by letter for single character system nodes
              for (let i = 0; i < signal._systemNodes.length; i++) {
                const nodeAtPosition = signal._systemNodes[i];
                if (nodeAtPosition !== '.' && nodeAtPosition === signalChar) {
                  foundSignal = true;
                  signalData = { signalIndex: currentSignalIndex, signal, cycleIndex: i };
                  break;
                }
              }
            }
          }
          
          if (foundSignal) break;
          currentSignalIndex++;
        } else if (itemType === 'spacer') {
          currentSignalIndex++;
        } else if (itemType === 'group') {
          // Handle groups - need to traverse group items
          const group = item as any[];
          for (let i = 1; i < group.length; i++) {
            const groupItem = group[i];
            const groupItemType = getItemType(groupItem);
            
            if (groupItemType === 'signal' || groupItemType === 'node-only') {
              const groupSignal = groupItem as any;
              
              // First check user-defined nodes - single letter format
              if (nodeId.length === 1 && groupSignal.node && typeof groupSignal.node === 'string') {
                for (let j = 0; j < groupSignal.node.length; j++) {
                  const nodeAtPosition = groupSignal.node[j];
                  if (nodeAtPosition !== '.' && nodeAtPosition === nodeId) {
                    foundSignal = true;
                    signalData = { signalIndex: currentSignalIndex, signal: groupSignal, cycleIndex: j };
                    break;
                  }
                }
              }
              
              // If not found, check system nodes - exact match for letter+number
              if (!foundSignal && groupSignal._systemNodes && typeof groupSignal._systemNodes === 'string') {
                const nodeMatch = nodeId.match(/^([a-zA-Z])(\d+)$/);
                if (nodeMatch) {
                  const [, letter, position] = nodeMatch;
                  const pos = parseInt(position);
                  if (pos < groupSignal._systemNodes.length) {
                    const expectedNodeId = generateNodeId(currentSignalIndex, pos);
                    if (expectedNodeId === nodeId) {
                      foundSignal = true;
                      signalData = { signalIndex: currentSignalIndex, signal: groupSignal, cycleIndex: pos };
                    }
                  }
                } else {
                  // Fallback: check by letter
                  for (let j = 0; j < groupSignal._systemNodes.length; j++) {
                    const nodeAtPosition = groupSignal._systemNodes[j];
                    if (nodeAtPosition !== '.' && nodeAtPosition === signalChar) {
                      foundSignal = true;
                      signalData = { signalIndex: currentSignalIndex, signal: groupSignal, cycleIndex: j };
                      break;
                    }
                  }
                }
              }
              
              if (foundSignal) break;
              currentSignalIndex++;
            } else {
              currentSignalIndex++; // Count other items in groups
            }
          }
          
          if (foundSignal) break;
        }
      }
      
      if (!foundSignal || !signalData) {
        console.warn(`Node ${nodeId} not found in any signal`);
        return null;
      }
      
      // Calculate position using the same logic as signal rendering
      const cycleWidth = 40 * hscale;
      const laneHeight = 40;
      const headerOffset = 24;
      
      // X position: nameColumn + cycle position + transition center
      const transitionCenterX = nameColumnWidth + (signalData.cycleIndex + 1) * cycleWidth;
      
      // Y position: header + signal index * lane height + center + phase offset
      let yOffset = 0;
      if (signalData.signal.phase) {
        yOffset = laneHeight * signalData.signal.phase;
      }
      
      const transitionCenterY = headerOffset + signalData.signalIndex * laneHeight + laneHeight / 2 + yOffset;
      
      return { x: transitionCenterX, y: transitionCenterY };
    }
  
    // Note: SVG export functionality can be added here if needed in the future
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
    <div class="diagram-content" role="region" aria-label="Waveform diagram content" on:wheel={handleWheel} on:scroll={handleScroll}>
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
              on:transitiondrag={(e) => dispatch('transitiondrag', e.detail)}
              on:annotationstart={(e) => handleAnnotationStart(e)}
              on:annotationupdate={(e) => handleAnnotationUpdate(e)}
              on:annotationend={(e) => handleAnnotationEnd(e)}
              on:noderightclick={(e) => handleNodeRightClick(e)}
              on:signalreorder={(e) => handleSignalReorder(e)}
              on:dragstart={(e) => handleDragStart(e.detail.event, e.detail.path, e.detail.itemType)}
              on:drop={(e) => handleDrop(e.detail.event, e.detail.targetPath, e.detail.position)}
              on:cyclechange={(e) => handleCycleChange(e)}
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
              on:groupselection={(e) => dispatch('groupselection', e.detail)}
              on:rightclick={(e) => handleRightClick(e)}
              on:signalreorder={(e) => handleSignalReorder(e)}
              on:groupreorder={(e) => handleGroupReorder(e)}
              on:movetogroup={(e) => handleMoveToGroup(e)}
              on:dragstart={(e) => handleDragStart(e.detail.event, e.detail.path, e.detail.itemType)}
              on:drop={(e) => handleDrop(e.detail.event, e.detail.targetPath, e.detail.position)}
              on:cyclechange={(e) => handleCycleChange(e)}
            />
          {:else if itemType === 'spacer'}
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div class="signal-spacer" 
                 class:drag-over-above={spacerDraggedOverPosition[i] === 'above'}
                 class:drag-over-below={spacerDraggedOverPosition[i] === 'below'}
                 draggable="true"
                 role="button"
                 tabindex="0"
                 aria-label="Spacer - drag to reorder"
                 on:dragstart={(e) => handleSpacerDragStart(e, i)}
                 on:dragover={(e) => handleSpacerDragOver(e, i)}
                 on:dragleave={(e) => handleSpacerDragLeave(e, i)}
                 on:drop={(e) => handleSpacerDrop(e, i)}>
              <div class="spacer-name">spacer</div>
              <div class="spacer-wave-area" style="width: {maxCycles * cycleWidth}px;">
                <div class="spacer-vertical-line"></div>
              </div>
            </div>
          {:else if itemType === 'node-only'}
            <!-- Invisible signal for arrow anchor points only -->
            <div class="signal-node-only">
              <div class="node-only-name"></div>
              <div class="node-only-wave-area" style="width: {maxCycles * cycleWidth}px;">
                <!-- Invisible but maintains height for proper spacing -->
              </div>
            </div>
          {:else}
            <div class="signal-unknown">
              Unknown item type at index {i}
            </div>
          {/if}
        {/each}
      </div>
      
      <!-- Persistent Arrows -->
      {#if waveJson.edge && waveJson.edge.length > 0}
        {#key `${hscale}-${nameColumnWidth}`}
          <div class="arrows-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 500;">
            {#each waveJson.edge as edgeString, i}
              {@const edgeData = parseEdgeString(edgeString)}
              {#if edgeData}
                {@const fromPos = getNodePosition(edgeData.fromNode)}
                {@const toPos = getNodePosition(edgeData.toNode)}
                {#if fromPos && toPos}
                  <Arrow
                    mode={edgeString}
                    fromX={fromPos.x}
                    fromY={fromPos.y}
                    toX={toPos.x}
                    toY={toPos.y}
                    arrowIndex={i}
                    {hscale}
                    isSticky={edgeData.isSticky}
                    on:dragstart={handleArrowDragStart}
                    on:dragmove={handleArrowDragMove}
                    on:dragend={handleArrowDragEnd}
                    on:rightclick={handleArrowRightClick}
                    on:modechange={handleArrowModeChange}
                  />
                {/if}
              {/if}
            {/each}
          </div>
        {/key}
      {/if}

      <!-- Annotation Drawing Overlay -->
      {#if currentAnnotation && currentAnnotation.isActive}
        {@const liveArrowScale = Math.min(1 + (hscale - 1) * 0.1, 1.2)}
        {@const liveStrokeWidth = 2 * Math.min(1 + (hscale - 1) * 0.2, 1.4)}
        {@const liveDashPattern = currentAnnotation.isSticky ? `${5 * Math.min(1 + (hscale - 1) * 0.3, 1.5)},${5 * Math.min(1 + (hscale - 1) * 0.3, 1.5)}` : 'none'}
        {@const circleRadius = 4 * Math.min(1 + (hscale - 1) * 0.1, 1.2)}
        {@const circleStrokeWidth = 2 * Math.min(1 + (hscale - 1) * 0.1, 1.2)}
        <div class="annotation-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000;">
          <svg 
            width="100%" 
            height="100%" 
            style="position: absolute; top: 0; left: 0;"
          >
            <defs>
              <marker 
                id="arrowhead" 
                markerWidth={10 * liveArrowScale} 
                markerHeight={7 * liveArrowScale} 
                refX={9 * liveArrowScale} 
                refY={3.5 * liveArrowScale} 
                orient="auto"
                fill={currentAnnotation.isSticky ? '#f59e0b' : '#3b82f6'}
              >
                <polygon points="0 0, {10 * liveArrowScale} {3.5 * liveArrowScale}, 0 {7 * liveArrowScale}" />
              </marker>
            </defs>
            
            <line 
              x1={currentAnnotation.startX}
              y1={currentAnnotation.startY}
              x2={currentAnnotation.currentX}
              y2={currentAnnotation.currentY}
              stroke={currentAnnotation.isSticky ? '#f59e0b' : '#3b82f6'}
              stroke-width={liveStrokeWidth}
              stroke-dasharray={liveDashPattern}
              marker-end="url(#arrowhead)"
            />
            
            <!-- Start point indicator -->
            <circle 
              cx={currentAnnotation.startX}
              cy={currentAnnotation.startY}
              r={circleRadius}
              fill={currentAnnotation.isSticky ? '#f59e0b' : '#3b82f6'}
              stroke="white"
              stroke-width={circleStrokeWidth}
            />
          </svg>
        </div>
      {/if}
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
      isImplicit={contextMenuIsImplicit}
      isExplicit={contextMenuIsExplicit}
      on:setvalue={handleContextMenuSetValue}
      on:close={handleContextMenuClose}
      on:explicitate={handleContextMenuExplicitate}
      on:implicitate={handleContextMenuImplicitate}
    />

    <!-- Node Context Menu -->
    <NodeContextMenu
      visible={nodeContextMenuVisible}
      x={nodeContextMenuX}
      y={nodeContextMenuY}
      nodeId={nodeContextMenuNodeId}
      signalIndex={nodeContextMenuSignalIndex}
      cycleIndex={nodeContextMenuCycleIndex}
      on:setname={handleNodeContextMenuSetName}
      on:close={handleNodeContextMenuClose}
    />

    <!-- Arrow Context Menu -->
    <ArrowContextMenu
      visible={arrowContextMenuVisible}
      x={arrowContextMenuX}
      y={arrowContextMenuY}
      currentMode={arrowContextMenuCurrentMode}
      arrowIndex={arrowContextMenuIndex}
      on:setmode={handleArrowContextMenuSetMode}
      on:settext={handleArrowContextMenuSetText}
      on:delete={handleArrowContextMenuDelete}
      on:close={handleArrowContextMenuClose}
    />
  </div>
  
  <style>
    .waveform-diagram {
      --name-width: 150px; /* Default, will be overridden by inline style */
      --cycle-width: calc(40px * var(--hscale));
      --lane-height: 40px;
      --header-footer-height: 40px;
      
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      background-color: var(--color-bg-elevated);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-md);
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      transition: all 0.2s ease;
    }
  
        .diagram-header,
    .diagram-footer {
      height: var(--header-footer-height);
      background-color: var(--color-bg-secondary);
      border-bottom: 1px solid var(--color-border-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      color: var(--color-text-primary);
      transition: all 0.2s ease;
    }

    .diagram-footer {
      border-bottom: none;
      border-top: 1px solid var(--color-border-primary);
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
      background-color: var(--color-accent-light);
    }

    .signal-spacer.drag-over-above::before {
      content: '';
      position: absolute;
      top: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: var(--color-accent-primary);
      z-index: 10;
    }

    .signal-spacer.drag-over-below::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: var(--color-accent-primary);
      z-index: 10;
    }

    .spacer-name {
      width: var(--name-width);
      display: flex;
      align-items: center;
      padding: 0 16px;
      font-size: 11px;
      color: var(--color-text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
      background-color: transparent;
      transition: color 0.2s ease;
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
        var(--color-text-tertiary) 0,
        var(--color-text-tertiary) 12px,
        transparent 12px,
        transparent 20px
      );
      opacity: 0.9;
      transition: background-image 0.2s ease;
    }

    .spacer-vertical-line {
      width: 1px;
      height: 100%;
      background: transparent;
    }

    .signal-node-only {
      height: var(--lane-height);
      display: flex;
      margin: 2px 0;
      opacity: 0.3; /* Make it semi-transparent to indicate it's invisible */
      border-bottom: 1px solid var(--color-border-primary);
    }

    .node-only-name {
      width: var(--name-width);
      display: flex;
      align-items: center;
      padding: 0 16px;
      font-size: 11px;
      color: var(--color-text-tertiary);
      font-style: italic;
    }

    .node-only-name::after {
      content: "nodes only";
    }

    .node-only-wave-area {
      flex: 1;
      height: 100%;
      position: relative;
      /* Invisible but maintains space for node positioning */
    }
  
    .signal-unknown {
      height: var(--lane-height);
      display: flex;
      align-items: center;
      padding-left: 16px;
      color: var(--color-error);
      background-color: var(--color-error-light);
      border-bottom: 1px solid var(--color-border-primary);
      transition: all 0.2s ease;
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
      background-color: var(--color-accent-light);
    }

    .column-resize-handle.resizing {
      background-color: var(--color-accent-medium);
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
      background-color: var(--color-border-secondary);
      opacity: 0;
      transition: opacity 0.15s ease, background-color 0.2s ease;
    }

    .column-resize-handle:hover::after {
      opacity: 1;
    }

    .column-resize-handle.resizing::after {
      opacity: 1;
      background-color: var(--color-accent-primary);
    }

    /* Visual indicator when at minimum width */
    .column-resize-handle.at-minimum {
      background-color: var(--color-warning-light);
    }

    .column-resize-handle.at-minimum:hover {
      background-color: var(--color-warning-light);
      opacity: 0.8;
    }

    .column-resize-handle.at-minimum::after {
      background-color: #f59e0b;
      opacity: 0.8;
    }

    /* Arrow container styles */
    .arrows-container {
      pointer-events: none; /* Let children handle their own events */
    }

    .arrows-container :global(.arrow-component) {
      pointer-events: auto;
    }
  </style>
  