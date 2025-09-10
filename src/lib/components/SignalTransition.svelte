<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let fromCycle: {
    cycleIndex: number;
    originalChar: string;
    effectiveChar: string;
    isInteractive: boolean;
    dataValue?: string;
  };
  export let toCycle: {
    cycleIndex: number;
    originalChar: string;
    effectiveChar: string;
    isInteractive: boolean;
    dataValue?: string;
  };
  export let hscale: number = 1;
  export let signalIndex: number;
  export let fromUnderlyingSignal: string | null = null;
  export let toUnderlyingSignal: string | null = null;

  const dispatch = createEventDispatcher<{
    transitionclick: { fromCycleIndex: number; toCycleIndex: number };
    transitiondrag: { fromCycleIndex: number; toCycleIndex: number; deltaX: number; dragMode: 'default' | 'extend' };
    annotationstart: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number; startX: number; startY: number };
    annotationupdate: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number; currentX: number; currentY: number; isSticky: boolean };
    annotationend: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number; endX: number; endY: number; isSticky: boolean };
    noderightclick: { signalIndex: number; cycleIndex: number; nodeId: string; x: number; y: number };
  }>();

  // Drag state
  let isDragging = false;
  let isHovering = false;
  let dragStartX = 0;
  let dragMode: 'default' | 'extend' = 'default';
  let dragDelta = 0;
  let currentMouseX = 0;
  let dragRailContainer: HTMLElement;
  
  // Annotation drawing state
  let isDrawingAnnotation = false;
  let annotationStartX = 0;
  let annotationStartY = 0;
  let annotationCurrentX = 0;
  let annotationCurrentY = 0;
  let isAnnotationSticky = false;
  
  // Global drag tracking key based on transition position
  const dragKey = `transition_${fromCycle.cycleIndex}_${toCycle.cycleIndex}`;
  
  // Check if this specific transition is being dragged globally
  $: isGloballyDragging = typeof window !== 'undefined' && (window as any).transitionDragActive === dragKey;
  
  // Show drag rail if locally dragging OR if this transition is globally being dragged
  $: showDragRail = isDragging || isGloballyDragging;

  // Use the same positioning logic as SignalCycle to ensure perfect alignment
  $: fullCycleWidth = 40 * hscale;
  $: transitionWidth = 8 * hscale;
  $: halfTransitionWidth = transitionWidth / 2;
  
  // Drag rail configuration - align with grid
  $: maxDragRange = 8; // Maximum cycles in each direction  
  $: railWidth = (maxDragRange * 2 + 1) * fullCycleWidth; // Total rail width
  $: railStartX = -maxDragRange * fullCycleWidth; // Relative to transition
  
  // Calculate snap positions relative to the current transition position  
  $: snapPositions = Array.from({ length: maxDragRange * 2 + 1 }, (_, i) => {
    const cycleOffset = i - maxDragRange; // -maxDragRange to +maxDragRange
    const targetCycleIndex = fromCycle.cycleIndex + 1 + cycleOffset; // Target cycle boundary
    
    return {
      cycleOffset,
      targetCycleIndex,
      isValid: (dragMode === 'extend' ? cycleOffset >= 0 : true) && targetCycleIndex >= 0 // Don't allow negative cycle indices
    };
  });
  
  // Find the nearest snap position
  $: nearestSnapPosition = isDragging ? findNearestSnapPosition(currentMouseX - dragStartX) : null;
  
  function findNearestSnapPosition(deltaX: number) {
    let nearest = snapPositions[0];
    let minDistance = Math.abs(deltaX - nearest.cycleOffset * fullCycleWidth);
    
    for (const pos of snapPositions) {
      if (!pos.isValid) continue;
      
      const distance = Math.abs(deltaX - pos.cycleOffset * fullCycleWidth);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = pos;
      }
    }
    
    return nearest;
  }
  
  // Calculate signal line positions for perfect alignment
  function getSignalLinePosition(cycle: typeof fromCycle, hasLeftTransition: boolean, hasRightTransition: boolean): { y: number; left: number; width: number; topY: number; bottomY: number } {
    // Get visual representation for the cycle, with gap handling for transitions
    function getCycleType(c: typeof cycle, underlyingSignal: string | null): 'high' | 'low' | 'x' | 'z' | 'data' | 'clock' | 'gap' | 'empty' | 'unknown' {
      const char = c.effectiveChar;
      
      // For gap cycles in transitions, use the underlying signal type for proper alignment
      if (char === '|' && underlyingSignal) {
        const underlyingChar = underlyingSignal;
        if (underlyingChar === '1' || underlyingChar === 'h' || underlyingChar === 'H' || underlyingChar === 'P') return 'high';
        if (underlyingChar === '0' || underlyingChar === 'l' || underlyingChar === 'L' || underlyingChar === 'N') return 'low';
        if (underlyingChar === 'x') return 'x';
        if (underlyingChar === 'z') return 'z';
        if (['=', '2', '3', '4', '5'].includes(underlyingChar)) return 'data';
        if (['p', 'P', 'n', 'N', 'h', 'l', 'H', 'L'].includes(underlyingChar)) return 'clock';
        return 'unknown';
      }
      
      if (char === '1' || char === 'h' || char === 'H' || char === 'P') return 'high';
      if (char === '0' || char === 'l' || char === 'L' || char === 'N') return 'low';
      if (char === 'x') return 'x';
      if (char === 'z') return 'z';
      if (['=', '2', '3', '4', '5'].includes(char)) return 'data';
      if (['p', 'P', 'n', 'N', 'h', 'l', 'H', 'L'].includes(char)) return 'clock';
      if (char === '|') return 'gap'; // Fallback for gaps without underlying signal info
      if (char === '') return 'empty';
      return 'unknown';
    }

    const underlyingSignal = cycle === fromCycle ? fromUnderlyingSignal : toUnderlyingSignal;
    const type = getCycleType(cycle, underlyingSignal);
    const cycleHeight = 40;
    
    // Get Y position (same logic as SignalCycle.getSignalLinePosition)
    let yPercent: number;
    let topY: number;
    let bottomY: number;
    
    switch (type) {
      case 'high':
        yPercent = 20; // 20% from top
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // For high signals, top and bottom are the same (line)
        break;
      case 'low':
        yPercent = 80; // 80% from top (20% from bottom)
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // For low signals, top and bottom are the same (line)
        break;
      case 'data':
        yPercent = 50; // Middle
        // For data signals, use the actual visual boundaries (70% height centered at 50%)
        const dataHeight = cycleHeight * 0.7;
        const centerY = (yPercent / 100) * cycleHeight;
        topY = centerY - dataHeight / 2;
        bottomY = centerY + dataHeight / 2;
        break;
      case 'x':
        yPercent = 50; // Middle
        // For x signals, use the visual boundaries (70% height centered at 50%)
        const xHeight = cycleHeight * 0.7;
        const xCenterY = (yPercent / 100) * cycleHeight;
        topY = xCenterY - xHeight / 2;
        bottomY = xCenterY + xHeight / 2;
        break;
      case 'z':
        yPercent = 50; // Middle
        // For z signals, use the visual boundaries (60% height centered at 50%)
        const zHeight = cycleHeight * 0.6;
        const zCenterY = (yPercent / 100) * cycleHeight;
        topY = zCenterY - zHeight / 2;
        bottomY = zCenterY + zHeight / 2;
        break;
      case 'clock':
        yPercent = 50; // Middle
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // For clock signals, treat as line for now
        break;
      case 'gap':
        // For gap cycles, we need to get the underlying signal type for proper transition alignment
        // Since we don't have access to the underlying signal info here, we'll use middle positioning
        // This should be improved by passing underlying signal information from the parent
        yPercent = 50; // Middle
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // Treat as line for now
        break;
      default:
        yPercent = 50; // Middle
        topY = (yPercent / 100) * cycleHeight;
        bottomY = topY; // For unknown signals, treat as line
        break;
    }
    
    const y = (yPercent / 100) * cycleHeight;
    
    // Calculate signal line width and position (same logic as SignalCycle)
    // Account for adjacent transitions that shorten the signal lines
    const leftOffset = hasLeftTransition ? halfTransitionWidth : 0;
    const rightOffset = hasRightTransition ? halfTransitionWidth : 0;
    const signalLineWidth = fullCycleWidth - leftOffset - rightOffset;
    const signalLineLeft = leftOffset;
    
    return {
      y,
      left: signalLineLeft,
      width: signalLineWidth,
      topY,
      bottomY
    };
  }

  // Get visual representation for the cycle with underlying signal support
  function getCycleTypeWithUnderlying(cycle: typeof fromCycle): 'high' | 'low' | 'x' | 'z' | 'data' | 'clock' | 'gap' | 'empty' | 'unknown' {
    const char = cycle.effectiveChar;
    
    // For gap cycles, use the underlying signal type
    if (char === '|') {
      const underlyingSignal = cycle === fromCycle ? fromUnderlyingSignal : toUnderlyingSignal;
      if (underlyingSignal) {
        if (underlyingSignal === '1' || underlyingSignal === 'h' || underlyingSignal === 'H' || underlyingSignal === 'P') return 'high';
        if (underlyingSignal === '0' || underlyingSignal === 'l' || underlyingSignal === 'L' || underlyingSignal === 'N') return 'low';
        if (underlyingSignal === 'x') return 'x';
        if (underlyingSignal === 'z') return 'z';
        if (['=', '2', '3', '4', '5'].includes(underlyingSignal)) return 'data';
        if (['p', 'P', 'n', 'N', 'h', 'l', 'H', 'L'].includes(underlyingSignal)) return 'clock';
      }
      return 'gap'; // Fallback
    }
    
    if (char === '1' || char === 'h' || char === 'H' || char === 'P') return 'high';
    if (char === '0' || char === 'l' || char === 'L' || char === 'N') return 'low';
    if (char === 'x') return 'x';
    if (char === 'z') return 'z';
    if (['=', '2', '3', '4', '5'].includes(char)) return 'data';
    if (['p', 'P', 'n', 'N', 'h', 'l', 'H', 'L'].includes(char)) return 'clock';
    if (char === '') return 'empty';
    return 'unknown';
  }

  function getTransitionType(): 'rising' | 'falling' | 'cross' | 'none' {
    const fromType = getCycleTypeWithUnderlying(fromCycle);
    const toType = getCycleTypeWithUnderlying(toCycle);
    
    // No transition if from/to empty
    if (fromType === 'empty' || toType === 'empty') {
      return 'none';
    }
    
    // For data signals, check if the actual data values are different
    if (fromType === 'data' && toType === 'data') {
      if (fromCycle.dataValue !== toCycle.dataValue) {
        return 'cross'; // Different data values need cross transition
      } else {
        return 'none'; // Same data value, no transition needed
      }
    }
    
    // No transition if same type and not data
    if (fromType === toType) {
      return 'none';
    }
    
    // Rising edge: low to high
    if (fromType === 'low' && toType === 'high') return 'rising';
    
    // Falling edge: high to low
    if (fromType === 'high' && toType === 'low') return 'falling';
    
    // All other transitions are crosses (including data transitions)
    return 'cross';
  }

  function needsCleanCrossTransition(): boolean {
    const fromType = getCycleTypeWithUnderlying(fromCycle);
    const toType = getCycleTypeWithUnderlying(toCycle);
    
    // Need clean cross when transitioning to/from undefined (x) or data signals
    return (fromType === 'x' || toType === 'x' || 
            fromType === 'data' || toType === 'data' ||
            fromType === 'z' || toType === 'z');
  }

  function hasDataTransition(): boolean {
    const fromType = getCycleTypeWithUnderlying(fromCycle);
    const toType = getCycleTypeWithUnderlying(toCycle);
    
    return fromType === 'data' || toType === 'data';
  }

  function handleClick(event: MouseEvent) {
    if (!isDragging) {
      dispatch('transitionclick', {
        fromCycleIndex: fromCycle.cycleIndex,
        toCycleIndex: toCycle.cycleIndex
      });
    }
  }

  function handleMouseEnter() {
    isHovering = true;
  }

  function handleMouseLeave() {
    if (!isDragging) {
      isHovering = false;
    }
  }

  function handleMouseDown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Check if this is a transition move operation (Ctrl/Cmd held)
    if (event.metaKey || event.ctrlKey) {
      // Start transition dragging mode
      isDragging = true;
      dragStartX = event.clientX;
      currentMouseX = event.clientX;
      dragMode = event.shiftKey ? 'extend' : 'default';
      dragDelta = 0;

      // Mark this transition as being dragged globally
      if (typeof window !== 'undefined') {
        (window as any).transitionDragActive = dragKey;
      }

      // Add global mouse event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    } else {
      // Prepare for potential annotation drawing, but don't start yet
      // Store initial position and add listeners to detect drag vs click
      annotationStartX = event.clientX;
      annotationStartY = event.clientY;
      isAnnotationSticky = event.shiftKey;
      
      // Add global mouse event listeners to detect movement
      document.addEventListener('mousemove', handlePotentialAnnotationMove);
      document.addEventListener('mouseup', handleAnnotationMouseUp);
      document.body.style.userSelect = 'none';
    }
  }

  function handleMouseMove(event: MouseEvent) {
    // Check if dragging locally or if this transition is globally being dragged
    if (!isDragging && !isGloballyDragging) return;
    
    currentMouseX = event.clientX;
    const rawDelta = currentMouseX - dragStartX;
    
    // Find nearest snap position
    const nearestSnap = findNearestSnapPosition(rawDelta);
    const snappedDelta = nearestSnap.cycleOffset;
    
    // Update drag delta for visual feedback, but don't dispatch changes yet
    if (snappedDelta !== dragDelta) {
      dragDelta = snappedDelta;
      // Note: No dispatch here - we only show preview in the rail
    }
  }

  function handleMouseUp(event: MouseEvent) {
    if (isDragging) {
      // Apply the drag change only on drop if there was a valid movement
      const finalDelta = dragDelta;
      const finalNearestSnap = findNearestSnapPosition(currentMouseX - dragStartX);
      
      if (finalNearestSnap.isValid && Math.abs(finalDelta) >= 1) {
        dispatch('transitiondrag', {
          fromCycleIndex: fromCycle.cycleIndex,
          toCycleIndex: toCycle.cycleIndex,
          deltaX: finalDelta,
          dragMode
        });
      }
      
      // Reset drag state
      isDragging = false;
      isHovering = false;
      dragDelta = 0;
      currentMouseX = 0;
      
      // Clear global drag state
      if (typeof window !== 'undefined') {
        delete (window as any).transitionDragActive;
      }
      
      // Remove global mouse event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    } else if (isDrawingAnnotation) {
      endAnnotationDrawing(event);
    }
  }

  function handlePotentialAnnotationMove(event: MouseEvent) {
    const deltaX = Math.abs(event.clientX - annotationStartX);
    const deltaY = Math.abs(event.clientY - annotationStartY);
    const threshold = 3; // Minimum pixels to start annotation drawing
    
    if (deltaX > threshold || deltaY > threshold) {
      // User is dragging, start annotation drawing
      document.removeEventListener('mousemove', handlePotentialAnnotationMove);
      document.removeEventListener('mouseup', handleAnnotationMouseUp);
      startAnnotationDrawing(event);
    }
  }

  function handleAnnotationMouseUp(event: MouseEvent) {
    // User released mouse without dragging - this is just a click, do nothing
    document.removeEventListener('mousemove', handlePotentialAnnotationMove);
    document.removeEventListener('mouseup', handleAnnotationMouseUp);
    document.body.style.userSelect = '';
  }

  function handleRightClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Generate node ID for this transition
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const nodeId = `${chars[signalIndex] || 'a'}${fromCycle.cycleIndex}`;
    
    // Dispatch event to show node context menu
    dispatch('noderightclick', {
      signalIndex,
      cycleIndex: fromCycle.cycleIndex,
      nodeId,
      x: event.clientX,
      y: event.clientY
    });
  }

  function startAnnotationDrawing(event: MouseEvent) {
    isDrawingAnnotation = true;
    // isAnnotationSticky was already set in handleMouseDown
    
    // Get the position relative to the diagram container, accounting for scaling
    const diagramContainer = document.querySelector('.diagram-content');
    if (diagramContainer) {
      const containerRect = diagramContainer.getBoundingClientRect();
      
      // Find the transition element by looking for the one with our data attributes
      const transitionElement = document.querySelector(`[data-from-cycle="${fromCycle.cycleIndex}"][data-to-cycle="${toCycle.cycleIndex}"]`) as HTMLElement;
      
      if (transitionElement) {
        const transitionRect = transitionElement.getBoundingClientRect();
        
        // Calculate the center of the transition as the starting point
        const centerX = transitionRect.left + transitionRect.width / 2;
        const centerY = transitionRect.top + transitionRect.height / 2;
        
        // Convert to diagram-relative coordinates
        annotationStartX = centerX - containerRect.left + diagramContainer.scrollLeft;
        annotationStartY = centerY - containerRect.top + diagramContainer.scrollTop;
      } else {
        // Fallback: convert the stored viewport coordinates to diagram coordinates
        const storedViewportX = annotationStartX;
        const storedViewportY = annotationStartY;
        annotationStartX = storedViewportX - containerRect.left + diagramContainer.scrollLeft;
        annotationStartY = storedViewportY - containerRect.top + diagramContainer.scrollTop;
      }
      
      // Set current position to the current mouse position
      annotationCurrentX = event.clientX - containerRect.left + diagramContainer.scrollLeft;
      annotationCurrentY = event.clientY - containerRect.top + diagramContainer.scrollTop;
      
    } else {
      // Fallback to viewport coordinates
      annotationCurrentX = event.clientX;
      annotationCurrentY = event.clientY;
    }
    
    // Add global mouse event listeners for annotation drawing
    document.addEventListener('mousemove', handleAnnotationMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';
    
    dispatch('annotationstart', {
      signalIndex,
      fromCycleIndex: fromCycle.cycleIndex,
      toCycleIndex: toCycle.cycleIndex,
      startX: annotationStartX,
      startY: annotationStartY
    });
  }
  
  function handleAnnotationMouseMove(event: MouseEvent) {
    if (!isDrawingAnnotation) return;
    
    // Get the position relative to the diagram container
    const diagramContainer = document.querySelector('.diagram-content');
    if (diagramContainer) {
      const containerRect = diagramContainer.getBoundingClientRect();
      annotationCurrentX = event.clientX - containerRect.left + diagramContainer.scrollLeft;
      annotationCurrentY = event.clientY - containerRect.top + diagramContainer.scrollTop;
    } else {
      // Fallback to viewport coordinates
      annotationCurrentX = event.clientX;
      annotationCurrentY = event.clientY;
    }
    
    isAnnotationSticky = event.shiftKey;
    
    dispatch('annotationupdate', {
      signalIndex,
      fromCycleIndex: fromCycle.cycleIndex,
      toCycleIndex: toCycle.cycleIndex,
      currentX: annotationCurrentX,
      currentY: annotationCurrentY,
      isSticky: isAnnotationSticky
    });
  }
  
  function endAnnotationDrawing(event: MouseEvent) {
    if (!isDrawingAnnotation) return;
    
    // Get the final position relative to the diagram container
    const diagramContainer = document.querySelector('.diagram-content');
    let endX, endY;
    if (diagramContainer) {
      const containerRect = diagramContainer.getBoundingClientRect();
      endX = event.clientX - containerRect.left + diagramContainer.scrollLeft;
      endY = event.clientY - containerRect.top + diagramContainer.scrollTop;
    } else {
      // Fallback to viewport coordinates
      endX = event.clientX;
      endY = event.clientY;
    }
    
    dispatch('annotationend', {
      signalIndex,
      fromCycleIndex: fromCycle.cycleIndex,
      toCycleIndex: toCycle.cycleIndex,
      endX: endX,
      endY: endY,
      isSticky: isAnnotationSticky
    });
    
    // Reset annotation state
    isDrawingAnnotation = false;
    isAnnotationSticky = false;
    annotationStartX = 0;
    annotationStartY = 0;
    annotationCurrentX = 0;
    annotationCurrentY = 0;
    
    // Remove global mouse event listeners
    document.removeEventListener('mousemove', handleAnnotationMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  $: transitionType = getTransitionType();
  $: fromSignalPos = getSignalLinePosition(fromCycle, true, true); // fromCycle has transitions on both sides
  $: toSignalPos = getSignalLinePosition(toCycle, true, true); // toCycle has transitions on both sides
  $: isCleanCross = needsCleanCrossTransition();
  $: isDataTransition = hasDataTransition();
  
  // Calculate transition geometry using exact signal line endpoints
  $: fromX = fromSignalPos.left + fromSignalPos.width; // End of from signal line
  $: toX = toSignalPos.left; // Start of to signal line
  $: fromY = fromSignalPos.y;
  $: toY = toSignalPos.y;
  $: deltaX = toX - fromX;
  $: deltaY = toY - fromY;
  
  // For cross transitions, use the actual visual boundaries instead of fixed offsets
  $: fromTopY = fromSignalPos.topY;
  $: fromBottomY = fromSignalPos.bottomY;
  $: toTopY = toSignalPos.topY;
  $: toBottomY = toSignalPos.bottomY;
  
  // Calculate cross line start and end positions - connect to actual signal line endpoints
  $: crossStartX = 0; // Start at the beginning of transition area
  $: crossEndX = transitionWidth; // End at the end of transition area
  $: crossWidth = crossEndX - crossStartX;
  
  // Calculate cross line angles and lengths using actual signal boundaries
  $: crossLine1StartY = fromTopY;
  $: crossLine1EndY = toBottomY;
  $: crossLine2StartY = fromBottomY;
  $: crossLine2EndY = toTopY;
  
  $: crossLine1DeltaY = crossLine1EndY - crossLine1StartY;
  $: crossLine2DeltaY = crossLine2EndY - crossLine2StartY;
  
  $: crossLine1Angle = Math.atan2(crossLine1DeltaY, crossWidth) * (180 / Math.PI);
  $: crossLine2Angle = Math.atan2(crossLine2DeltaY, crossWidth) * (180 / Math.PI);
  
  $: crossLine1Length = Math.sqrt(crossWidth * crossWidth + crossLine1DeltaY * crossLine1DeltaY);
  $: crossLine2Length = Math.sqrt(crossWidth * crossWidth + crossLine2DeltaY * crossLine2DeltaY);
  
  // For regular rising/falling transitions, force a visual separation if needed
  $: adjustedDeltaY = (transitionType === 'cross' && Math.abs(deltaY) < 1) ? 8 : deltaY;
  $: lineAngle = Math.atan2(adjustedDeltaY, transitionWidth) * (180 / Math.PI);
  $: lineLength = Math.sqrt(transitionWidth * transitionWidth + adjustedDeltaY * adjustedDeltaY);

  // Calculate drag handle position (center of transition)
  $: dragHandleY = (fromY + toY) / 2;
</script>

{#if transitionType !== 'none'}
  <div 
    class="signal-transition {transitionType}"
    class:interactive={true}
    class:data-transition={isDataTransition}
    class:hovering={isHovering}
    class:dragging={isDragging}
    data-from-cycle={fromCycle.cycleIndex}
    data-to-cycle={toCycle.cycleIndex}
    style="
      width: {transitionWidth}px;
      --from-y: {fromY}px;
      --to-y: {toY}px;
      --line-angle: {lineAngle}deg;
      --line-length: {lineLength}px;
      --cross-line-1-start-y: {crossLine1StartY}px;
      --cross-line-1-end-y: {crossLine1EndY}px;
      --cross-line-1-angle: {crossLine1Angle}deg;
      --cross-line-1-length: {crossLine1Length}px;
      --cross-line-2-start-y: {crossLine2StartY}px;
      --cross-line-2-end-y: {crossLine2EndY}px;
      --cross-line-2-angle: {crossLine2Angle}deg;
      --cross-line-2-length: {crossLine2Length}px;
      --is-clean-cross: {isCleanCross ? 1 : 0};
      --cycle-height: {40}px;
      --drag-handle-y: {dragHandleY}px;
      --rail-width: {railWidth}px;
      --rail-start-x: {railStartX}px;
    "
    on:click={handleClick}
    on:mousedown={handleMouseDown}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:contextmenu={handleRightClick}
    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(new MouseEvent('click')); } }}
    role="button"
    tabindex="0"
    title="Transition: {fromCycle.effectiveChar} → {toCycle.effectiveChar} (drag to modify timing, right-click to name)"
  >
    <!-- Rising transition -->
    {#if transitionType === 'rising'}
      <div class="transition-line rising"></div>
    <!-- Falling transition -->
    {:else if transitionType === 'falling'}
      <div class="transition-line falling"></div>
    <!-- Cross transition (for data/unknown changes) -->
    {:else if transitionType === 'cross'}
      <div class="cross-transition">
        <!-- Fill triangles to match adjacent signal patterns -->
        <div class="cross-fill-left {getCycleTypeWithUnderlying(fromCycle)}"></div>
        <div class="cross-fill-right {getCycleTypeWithUnderlying(toCycle)}"></div>
        
        <div class="cross-line cross-line-1"></div>
        <div class="cross-line cross-line-2"></div>
      </div>
    {/if}
    
    <!-- Drag handle (thick dot) -->
    <div class="drag-handle" style="top: var(--drag-handle-y);"></div>
    
    <!-- Drag rail (only visible during dragging) -->
    {#if showDragRail}
      <div 
        class="drag-rail" 
        style="
          width: var(--rail-width); 
          left: var(--rail-start-x); 
          top: var(--drag-handle-y);
        "
        bind:this={dragRailContainer}
      >
        <!-- Rail track -->
        <div class="rail-track"></div>
        
        <!-- Snap points -->
        {#each snapPositions as snapPos}
          <div 
            class="snap-point"
            class:active={nearestSnapPosition?.cycleOffset === snapPos.cycleOffset}
            class:invalid={!snapPos.isValid}
            style="left: {(snapPos.cycleOffset + maxDragRange) * fullCycleWidth + halfTransitionWidth}px;"
          >
            <div class="snap-point-dot"></div>
            {#if Math.abs(snapPos.cycleOffset) <= 3}
              <div class="snap-point-label">
                {#if snapPos.cycleOffset === 0}
                  Current
                {:else}
                  {snapPos.cycleOffset > 0 ? '+' : ''}{snapPos.cycleOffset}
                {/if}
              </div>
            {/if}
          </div>
        {/each}
        
        <!-- Current position indicator -->
        {#if nearestSnapPosition}
          <div 
            class="position-indicator"
            style="left: {(nearestSnapPosition.cycleOffset + maxDragRange) * fullCycleWidth + halfTransitionWidth}px;"
          ></div>
        {/if}
        
        <!-- Mode indicator -->
        <div class="mode-indicator">
          <span class="mode-label">{dragMode === 'extend' ? 'EXTEND' : 'DEFAULT'}</span>
          {#if dragMode === 'extend'}
            <span class="mode-hint">→ Release to push forward</span>
          {:else}
            <span class="mode-hint">↔ Release to take over</span>
          {/if}
          {#if nearestSnapPosition && Math.abs(nearestSnapPosition.cycleOffset) >= 1}
            <span class="drop-preview">Drop to move {nearestSnapPosition.cycleOffset > 0 ? '+' : ''}{nearestSnapPosition.cycleOffset} cycles</span>
          {:else}
            <span class="drop-preview">Drag to cycle boundaries</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .signal-transition {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    cursor: pointer;
    transition: background-color 0.15s ease;
    /* Optimize for smooth rendering and scaling */
    will-change: transform;
    transform: translateZ(0); /* Force hardware acceleration */
    contain: layout style;
  }

  .signal-transition.interactive:hover {
    background-color: rgba(37, 99, 235, 0.05);
    border-radius: 2px;
  }

  .signal-transition.hovering {
    background-color: rgba(37, 99, 235, 0.1);
    border-radius: 2px;
  }

  .signal-transition.dragging {
    background-color: rgba(37, 99, 235, 0.15);
    cursor: ew-resize;
  }

  .signal-transition:focus {
    outline: 2px solid var(--color-accent-primary);
    outline-offset: 1px;
    border-radius: var(--radius-sm);
  }

  /* Drag handle (thick dot) */
  .drag-handle {
    position: absolute;
    left: 50%;
    width: 8px;
    height: 8px;
    background-color: var(--color-accent-primary);
    border: 2px solid white;
    border-radius: 50%;
    transform: translateX(-50%) translateY(-50%);
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .signal-transition.hovering .drag-handle,
  .signal-transition.dragging .drag-handle {
    opacity: 1;
  }

  .signal-transition.dragging .drag-handle {
    background-color: var(--color-accent-medium);
    transform: translateX(-50%) translateY(-50%) scale(1.2);
  }

  /* Drag rail */
  .drag-rail {
    position: absolute;
    height: 60px;
    transform: translateY(-50%);
    pointer-events: none;
    z-index: 50;
    opacity: 0;
    animation: railFadeIn 0.2s ease forwards;
  }

  @keyframes railFadeIn {
    from { opacity: 0; transform: translateY(-50%) scale(0.9); }
    to { opacity: 1; transform: translateY(-50%) scale(1); }
  }

  .rail-track {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, 
      rgba(37, 99, 235, 0.3) 0%, 
      rgba(37, 99, 235, 0.6) 50%, 
      rgba(37, 99, 235, 0.3) 100%
    );
    border-radius: 1px;
    transform: translateY(-50%);
  }

  .snap-point {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    transform: translateX(-50%) translateY(-50%);
    transition: all 0.15s ease;
  }

  .snap-point.invalid {
    opacity: 0.3;
  }

  .snap-point-dot {
    width: 100%;
    height: 100%;
    background-color: var(--color-accent-primary);
    border: 1px solid white;
    border-radius: 50%;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .snap-point.active .snap-point-dot {
    background-color: var(--color-accent-medium);
    transform: scale(1.3);
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.4);
  }

  .snap-point.invalid .snap-point-dot {
    background-color: var(--color-text-tertiary);
    border-color: var(--color-bg-secondary);
  }

  .snap-point-label {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background-color: var(--color-bg-primary);
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid var(--color-border);
    white-space: nowrap;
    opacity: 0.8;
    transition: opacity 0.15s ease;
  }

  .snap-point.active .snap-point-label {
    opacity: 1;
    color: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
    font-weight: 600;
  }

  .position-indicator {
    position: absolute;
    top: 50%;
    width: 3px;
    height: 30px;
    background-color: var(--color-accent-primary);
    border-radius: 2px;
    transform: translateX(-50%) translateY(-50%);
    box-shadow: 0 0 8px rgba(37, 99, 235, 0.5);
    animation: indicatorPulse 1s ease-in-out infinite alternate;
  }

  @keyframes indicatorPulse {
    from { opacity: 0.8; transform: translateX(-50%) translateY(-50%) scaleY(1); }
    to { opacity: 1; transform: translateX(-50%) translateY(-50%) scaleY(1.1); }
  }

  .mode-indicator {
    position: absolute;
    top: -35px;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-accent-primary);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-accent-primary);
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .mode-label {
    display: block;
    text-align: center;
  }

  .mode-hint {
    display: block;
    font-size: 9px;
    font-weight: 400;
    color: var(--color-text-secondary);
    text-align: center;
    margin-top: 1px;
  }

  .drop-preview {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-accent-primary);
    text-align: center;
    margin-top: 2px;
    border-top: 1px solid var(--color-border-secondary);
    padding-top: 2px;
  }

  /* Transition lines with calculated positioning */
  .transition-line {
    position: absolute;
    height: 2px;
    background-color: var(--color-signal-high);
    left: 0;
    top: var(--from-y);
    width: var(--line-length);
    transform-origin: left center;
    transform: translateY(-1px) rotate(var(--line-angle));
    transition: background-color 0.2s ease;
  }

  /* Rising and falling edge positioning is handled by CSS calc in parent styles */

  /* Cross transition container */
  .cross-transition {
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* Triangular fill areas for cross transitions */
  .cross-fill-left, .cross-fill-right {
    position: absolute;
    z-index: 1;
  }

  .cross-fill-left {
    left: -2px; /* Extend slightly left to overlap with signal shape */
    width: calc(50% + 4px); /* Extra width to ensure overlap */
    clip-path: polygon(0 0, calc(100% - 4px) 50%, 0 100%);
  }

  .cross-fill-right {
    right: -2px; /* Extend slightly right to overlap with signal shape */
    width: calc(50% + 4px); /* Extra width to ensure overlap */
    clip-path: polygon(4px 50%, 100% 0, 100% 100%);
  }

  /* Data signal fills */
  .cross-fill-left.data, .cross-fill-right.data {
    background-color: var(--color-signal-data-bg);
    border-top: 2px solid var(--color-signal-high);
    border-bottom: 2px solid var(--color-signal-high);
    height: 70%;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .cross-fill-left.data {
    top: var(--from-y);
    transform: translateY(-50%);
  }

  .cross-fill-right.data {
    top: var(--to-y);
    transform: translateY(-50%);
  }

  /* X pattern fills */
  .cross-fill-left.x, .cross-fill-right.x {
    background-image: 
      radial-gradient(circle at 25% 25%, var(--color-signal-unknown) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, var(--color-signal-unknown) 0.5px, transparent 0.5px),
      radial-gradient(circle at 25% 75%, var(--color-signal-unknown) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 75%, var(--color-signal-unknown) 0.5px, transparent 0.5px);
    background-size: 6px 6px;
    opacity: 0.6;
    border-top: 2px solid var(--color-signal-high);
    border-bottom: 2px solid var(--color-signal-high);
    height: 70%;
    transition: background-image 0.2s ease, border-color 0.2s ease;
  }

  .cross-fill-left.x {
    top: var(--from-y);
    transform: translateY(-50%);
  }

  .cross-fill-right.x {
    top: var(--to-y);
    transform: translateY(-50%);
  }

  /* Z-state fills */
  .cross-fill-left.z, .cross-fill-right.z {
    background-image: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 4px,
        var(--color-warning) 4px,
        var(--color-warning) 6px
      );
    opacity: 0.8;
    border-top: 2px solid var(--color-signal-high);
    border-bottom: 2px solid var(--color-signal-high);
    height: 60%;
    transition: background-image 0.2s ease, border-color 0.2s ease;
  }

  .cross-fill-left.z {
    top: var(--from-y);
    transform: translateY(-50%);
  }

  .cross-fill-right.z {
    top: var(--to-y);
    transform: translateY(-50%);
  }

  /* High/Low signal fills - no special fill needed as they're just lines */
  .cross-fill-left.high, .cross-fill-right.high,
  .cross-fill-left.low, .cross-fill-right.low {
    display: none; /* No fill needed for line signals */
  }

  .cross-line {
    position: absolute;
    height: 2px;
    background-color: var(--color-signal-high);
    left: 0;
    transform-origin: left center;
    width: var(--line-length);
    /* Ensure clean lines for pattern compatibility */
    z-index: 2;
    transition: background-color 0.2s ease;
  }

  .cross-line-1 {
    top: var(--cross-line-1-start-y);
    transform: translateY(-1px) rotate(var(--cross-line-1-angle));
    width: var(--cross-line-1-length);
  }

  .cross-line-2 {
    top: var(--cross-line-2-start-y);
    transform: translateY(-1px) rotate(var(--cross-line-2-angle));
    width: var(--cross-line-2-length);
  }

  /* Enhanced styling for data transitions */
  .signal-transition.data-transition .cross-line {
    /* Slightly thicker lines for data transitions to make them more visible */
    height: 2.2px;
    /* Ensure they connect precisely to data signal edges */
    z-index: 3;
  }

  .signal-transition.data-transition .cross-line-1 {
    /* Precise positioning for data signal connection */
    top: var(--cross-line-1-start-y);
    transform: translateY(-1.25px) rotate(var(--cross-line-1-angle));
    width: var(--cross-line-1-length);
  }

  .signal-transition.data-transition .cross-line-2 {
    /* Precise positioning for data signal connection */
    top: var(--cross-line-2-start-y);
    transform: translateY(-1.25px) rotate(var(--cross-line-2-angle));
    width: var(--cross-line-2-length);
  }

  /* Enhanced interactivity */
  .signal-transition.interactive {
    border: 1px solid transparent;
  }

  .signal-transition.interactive:hover {
    border-color: var(--color-accent-light);
  }

  .signal-transition.interactive:active {
    background-color: var(--color-accent-medium);
    border-color: var(--color-accent-primary);
  }
</style> 
