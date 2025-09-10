<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let mode: string = '->'; // Full WaveDrom edge string (e.g., 'a->b t1', 'g<->h 3 ms')
  export let fromX: number;
  export let fromY: number;
  export let toX: number;
  export let toY: number;
  export let arrowIndex: number;
  export let hscale: number = 1;
  export let isSticky: boolean = false; // Whether this arrow is "sticky" (red dashed)

  const dispatch = createEventDispatcher<{
    dragstart: { arrowIndex: number; x: number; y: number };
    dragmove: { arrowIndex: number; x: number; y: number; deltaX: number; deltaY: number };
    dragend: { arrowIndex: number };
    rightclick: { arrowIndex: number; x: number; y: number };
    modechange: { arrowIndex: number; newMode: string };
  }>();

  // Parse the full edge string to extract arrow type and text label
  $: edgeData = parseEdgeString(mode);
  $: arrowType = edgeData.arrowType;
  $: textLabel = edgeData.textLabel;
  
  // Parse the arrow mode to determine characteristics
  $: arrowData = parseArrowMode(arrowType);
  $: isSpline = arrowData.isSpline;
  $: hasStartMarker = arrowData.hasStartMarker;
  $: hasEndMarker = arrowData.hasEndMarker;
  $: hasClockMarker = arrowData.hasClockMarker;
  $: isBidirectional = arrowData.isBidirectional;
  $: isCross = arrowData.isCross;
  $: isLineOnly = arrowData.isLineOnly;

  // Professional styling based on WaveDrom official look
  $: strokeWidth = isSticky ? 1.5 : 1.5; // Consistent line weight like official WaveDrom
  $: arrowScale = 1.0; // Keep arrow heads properly sized
  $: dashPattern = isSticky ? '3,3' : 'none'; // Subtle dashing for sticky arrows
  $: curveOffset = isSpline ? 25 * Math.min(hscale, 2) : 0; // Scale curve with diagram
  
  // Yellow color scheme for arrows
  $: strokeColor = isSticky ? '#f59e0b' : '#f51e0b'; // Yellow for all arrows
  $: fillColor = strokeColor;
  $: textColor = '#000000'; // Black text for readability

  // Calculate path for the arrow
  $: pathData = calculatePath(fromX, fromY, toX, toY, isSpline, hasClockMarker, curveOffset);

  // Dragging state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  function parseEdgeString(edgeString: string): { arrowType: string; textLabel: string } {
    // Parse WaveDrom edge string: 'nodeA->nodeB text label'
    // First strip any text label from the end
    const textMatch = edgeString.match(/^([a-zA-Z]\d*[^a-zA-Z\d\s]+[a-zA-Z]\d*)\s+(.+)$/);
    if (textMatch) {
      // Found text label
      const arrowPart = textMatch[1].trim();
      const textLabel = textMatch[2].trim();
      
      // Extract just the arrow type (between nodes) - handle node IDs with numbers
      const arrowTypeMatch = arrowPart.match(/^[a-zA-Z]\d*([^a-zA-Z\d]+)[a-zA-Z]\d*$/);
      const arrowType = arrowTypeMatch ? arrowTypeMatch[1] : '->';
      
      return { arrowType, textLabel };
    } else {
      // No text label, extract arrow type - handle node IDs with numbers
      const arrowTypeMatch = edgeString.match(/^[a-zA-Z]\d*([^a-zA-Z\d]+)[a-zA-Z]\d*$/);
      const arrowType = arrowTypeMatch ? arrowTypeMatch[1] : '->';
      return { arrowType, textLabel: '' };
    }
  }

  function parseArrowMode(arrowType: string) {
    return {
      isSpline: arrowType.includes('~'),
      hasStartMarker: arrowType.startsWith('|') || arrowType.startsWith('<'),
      hasEndMarker: arrowType.endsWith('>'),
      hasClockMarker: arrowType.includes('-|-') || arrowType.includes('-|>') || arrowType.includes('-~>') || arrowType.includes('-|'),
      isBidirectional: arrowType.includes('<') && arrowType.includes('>'),
      isCross: arrowType === '+',
      isLineOnly: arrowType === '-' || arrowType === '~' || arrowType === '-|' || arrowType === '-|-' || arrowType === '-~',
    };
  }

  function calculatePath(fromX: number, fromY: number, toX: number, toY: number, isSpline: boolean, hasClockMarker: boolean, curveOffset: number): string {
    if (hasClockMarker && !isSpline) {
      // L-shaped path for clock signals
      return `M ${fromX} ${fromY} L ${toX} ${fromY} L ${toX} ${toY}`;
    } else if (isSpline) {
      // Curved path
      const controlX = (fromX + toX) / 2;
      const controlY = fromY - curveOffset;
      return `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
    } else {
      // Straight line
      return `M ${fromX} ${fromY} L ${toX} ${toY}`;
    }
  }

  function handleMouseDown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    
    dispatch('dragstart', { 
      arrowIndex, 
      x: event.clientX, 
      y: event.clientY 
    });
    
    // Add global listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;
    
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    
    dispatch('dragmove', { 
      arrowIndex, 
      x: event.clientX, 
      y: event.clientY, 
      deltaX, 
      deltaY 
    });
  }

  function handleMouseUp(event: MouseEvent) {
    if (!isDragging) return;
    
    isDragging = false;
    
    dispatch('dragend', { arrowIndex });
    
    // Remove global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
  }

  function handleRightClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    dispatch('rightclick', { 
      arrowIndex, 
      x: event.clientX, 
      y: event.clientY 
    });
  }

  function handleDoubleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Toggle between spline and straight on double-click
    const newMode = toggleArrowType(mode);
    dispatch('modechange', { arrowIndex, newMode });
  }

  function toggleArrowType(currentMode: string): string {
    // Parse the current mode to extract arrow type
    const edgeData = parseEdgeString(currentMode);
    if (!edgeData) return currentMode;
    
    // Extract node information from the full edge string
    const nodeMatch = currentMode.match(/^([a-zA-Z]\d*)[^a-zA-Z\d]+([a-zA-Z]\d*)(\s+(.+))?$/);
    if (!nodeMatch) return currentMode;
    const [, fromNode, toNode, , textLabel] = nodeMatch;
    
    // Define valid transformations
    let newArrowType = edgeData.arrowType;
    
    if (edgeData.arrowType.includes('~')) {
      // Convert spline to straight - only valid patterns
      if (edgeData.arrowType === '~>') newArrowType = '->';
      else if (edgeData.arrowType === '-~>') newArrowType = '-|>';
      else if (edgeData.arrowType === '~') newArrowType = '-';
      else if (edgeData.arrowType === '<~>') newArrowType = '<->';
      else if (edgeData.arrowType === '<-~>') newArrowType = '<-|>';
      else if (edgeData.arrowType === '~->') newArrowType = '-|->';
    } else {
      // Convert straight to spline - only valid patterns
      if (edgeData.arrowType === '->') newArrowType = '~>';
      else if (edgeData.arrowType === '-|>') newArrowType = '-~>';
      else if (edgeData.arrowType === '-') newArrowType = '~';
      else if (edgeData.arrowType === '<->') newArrowType = '<~>';
      else if (edgeData.arrowType === '<-|>') newArrowType = '<-~>';
      else if (edgeData.arrowType === '-|->') newArrowType = '~->';
    }
    
    // Reconstruct the full edge string
    return textLabel 
      ? `${fromNode}${newArrowType}${toNode} ${textLabel}`
      : `${fromNode}${newArrowType}${toNode}`;
  }

  // Generate unique marker IDs to avoid conflicts
  $: markerId = `arrow-marker-${arrowIndex}`;
  $: startMarkerId = `arrow-start-marker-${arrowIndex}`;
  
  // Calculate text positioning
  $: midX = (fromX + toX) / 2;
  $: midY = (fromY + toY) / 2;
  $: textOffsetY = isSpline ? -curveOffset / 2 - 8 : (fromY < toY ? -8 : 8);
</script>

<div 
  class="arrow-component"
  class:dragging={isDragging}
  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: auto; z-index: 500;"
>
  <!-- Arrow SVG -->
  <svg 
    width="100%" 
    height="100%" 
    style="position: absolute; top: 0; left: 0; overflow: visible;"
  >
    <defs>
      <!-- Professional arrowhead design -->
      {#if hasEndMarker}
        <marker 
          id={markerId}
          markerWidth="8" 
          markerHeight="6" 
          refX="7" 
          refY="3" 
          orient="auto"
          fill={fillColor}
        >
          <polygon points="0,0 8,3 0,6" />
        </marker>
      {/if}
      
      <!-- Start marker (for bidirectional arrows) -->
      {#if hasStartMarker}
        <marker 
          id={startMarkerId}
          markerWidth="8" 
          markerHeight="6" 
          refX="1" 
          refY="3" 
          orient="auto"
          fill={fillColor}
        >
          <polygon points="8,0 0,3 8,6" />
        </marker>
      {/if}
    </defs>
    
    {#if isCross}
      <!-- Cross marker with professional styling -->
      {@const centerX = (fromX + toX) / 2}
      {@const centerY = (fromY + toY) / 2}
      {@const crossSize = 6}
      <g 
        class="arrow-path cross-marker"
        class:interactive={!isDragging}
        style="cursor: {isDragging ? 'grabbing' : 'grab'};"
        role="button"
        aria-label="Cross connection arrow"
        tabindex="0"
        on:mousedown={handleMouseDown}
        on:contextmenu={handleRightClick}
        on:dblclick={handleDoubleClick}
      >
        <line 
          x1={centerX - crossSize} y1={centerY - crossSize}
          x2={centerX + crossSize} y2={centerY + crossSize}
          stroke={strokeColor} stroke-width={strokeWidth}
          stroke-linecap="round"
        />
        <line 
          x1={centerX - crossSize} y1={centerY + crossSize}
          x2={centerX + crossSize} y2={centerY - crossSize}
          stroke={strokeColor} stroke-width={strokeWidth}
          stroke-linecap="round"
        />
        <!-- Invisible wider area for interaction -->
        <circle 
          cx={centerX} cy={centerY} r="12"
          fill="transparent"
          class="arrow-interaction-area"
          role="button"
          aria-label="Cross connection interaction area"
          tabindex="0"
          on:mousedown={handleMouseDown}
          on:contextmenu={handleRightClick}
          on:dblclick={handleDoubleClick}
        />
      </g>
    {:else}
      <!-- Main arrow path with professional styling -->
      <path 
        d={pathData}
        stroke={strokeColor}
        stroke-width={strokeWidth}
        fill="none"
        stroke-dasharray={dashPattern}
        stroke-linecap="round"
        stroke-linejoin="round"
        marker-end={hasEndMarker ? `url(#${markerId})` : 'none'}
        marker-start={hasStartMarker ? `url(#${startMarkerId})` : 'none'}
        class="arrow-path"
        class:interactive={!isDragging}
        style="cursor: {isDragging ? 'grabbing' : 'grab'};"
        role="button"
        aria-label="Timing diagram arrow"
        tabindex="0"
        on:mousedown={handleMouseDown}
        on:contextmenu={handleRightClick}
        on:dblclick={handleDoubleClick}
      />
      
      <!-- Invisible wider path for easier interaction -->
      <path 
        d={pathData}
        stroke="transparent"
        stroke-width="12"
        fill="none"
        class="arrow-interaction-area"
        style="cursor: {isDragging ? 'grabbing' : 'grab'};"
        role="button"
        aria-label="Arrow interaction area"
        tabindex="0"
        on:mousedown={handleMouseDown}
        on:contextmenu={handleRightClick}
        on:dblclick={handleDoubleClick}
      />
    {/if}
  </svg>
  
  <!-- Professional text label -->
  {#if textLabel}
    <div 
      class="arrow-text-label"
      style="
        position: absolute; 
        left: {midX}px; 
        top: {midY + textOffsetY}px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 501;
      "
    >
      <div class="text-background">
        {textLabel}
      </div>
    </div>
  {/if}
</div>

<style>
  .arrow-component {
    pointer-events: auto;
  }

  /* Professional arrow styling matching WaveDrom */
  .arrow-path {
    transition: stroke-width 0.15s ease, opacity 0.15s ease;
  }

  .arrow-path.interactive:hover {
    stroke-width: 2px;
    opacity: 0.7;
  }

  .arrow-component.dragging .arrow-path {
    opacity: 0.8;
  }

  .cross-marker.interactive:hover line {
    stroke-width: 2px;
    opacity: 0.7;
  }

  .arrow-interaction-area {
    pointer-events: all;
  }

  .arrow-path, .arrow-interaction-area {
    cursor: grab;
  }

  .arrow-component.dragging .arrow-path, 
  .arrow-component.dragging .arrow-interaction-area {
    cursor: grabbing;
  }

  /* Professional text label styling */
  .arrow-text-label {
    font-family: 'Arial', 'Helvetica', sans-serif;
    font-size: 11px;
    font-weight: normal;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }

  .text-background {
    background-color: white;
    color: black;
    padding: 1px 3px;
    border-radius: 2px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.1);
    font-size: 11px;
    line-height: 1.2;
  }

  /* High DPI / Retina display optimizations */
  @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    .arrow-path {
      shape-rendering: geometricPrecision;
    }
    
    .text-background {
      font-size: 10px;
    }
  }
</style>
