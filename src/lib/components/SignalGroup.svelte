<script lang="ts">
    import type { WaveGroup, SignalItem, WaveSignal, WaveSpacer } from '$lib/wavejson-types';
    import SignalLane from './SignalLane.svelte';
    import { createEventDispatcher } from 'svelte';
    // Recursive type for svelte:self, not strictly needed for TS but good for clarity
    // type SignalGroupComponent = typeof import('./SignalGroup.svelte').default;
  
            export let group: WaveGroup;
    export let parentIndex: number;
    export let maxCycles: number;
    export let hscale: number = 1;
    export let level: number = 0;
    export let getItemType: (item: SignalItem) => 'signal' | 'group' | 'spacer' | 'unknown';
    export let isCellSelected: (signalIndex: number, cycleIndex: number) => boolean = () => false;
    export let signalIndexMap: Map<any, number>;

    const dispatch = createEventDispatcher<{
      signalchange: { signalIndex: number; newSignal: WaveSignal };
      structurechange: { newWaveJson: any };
      groupchange: { groupIndex: number; newGroup: WaveGroup };
      cellselection: { signalIndex: number; cycleIndex: number; shiftKey: boolean };
      rightclick: { signalIndex: number; cycleIndex: number; x: number; y: number; currentValue: string };
      transitionclick: { signalIndex: number; fromCycleIndex: number; toCycleIndex: number };
      signalreorder: { fromIndex: number; toIndex: number };
      groupreorder: { fromIndex: number; toIndex: number };
      movetogroup: { fromIndex: number; toGroupIndex: number; itemType: 'signal' | 'group' | 'spacer' };
    }>();
  
    // Define 20 major colors for round-robin selection
    const BACKGROUND_COLORS = [
      'rgba(139, 92, 246, 0.1)',   // Purple
      'rgba(59, 130, 246, 0.1)',   // Blue
      'rgba(16, 185, 129, 0.1)',   // Green
      'rgba(245, 158, 11, 0.1)',   // Yellow
      'rgba(239, 68, 68, 0.1)',    // Red
      'rgba(236, 72, 153, 0.1)',   // Pink
      'rgba(20, 184, 166, 0.1)',   // Teal
      'rgba(168, 85, 247, 0.1)',   // Violet
      'rgba(34, 197, 94, 0.1)',    // Emerald
      'rgba(249, 115, 22, 0.1)',   // Orange
      'rgba(156, 163, 175, 0.1)',  // Gray
      'rgba(6, 182, 212, 0.1)',    // Cyan
      'rgba(132, 204, 22, 0.1)',   // Lime
      'rgba(217, 119, 6, 0.1)',    // Amber
      'rgba(190, 18, 60, 0.1)',    // Rose
      'rgba(147, 51, 234, 0.1)',   // Purple variant
      'rgba(37, 99, 235, 0.1)',    // Blue variant
      'rgba(5, 150, 105, 0.1)',    // Green variant
      'rgba(202, 138, 4, 0.1)',    // Yellow variant
      'rgba(220, 38, 127, 0.1)'    // Pink variant
    ];

      $: groupName = group[0];
  $: groupItems = group.slice(1) as SignalItem[];
  
  // Deterministic color selection based on group name and parent index
  $: groupColorIndex = (groupName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + parentIndex) % BACKGROUND_COLORS.length;
  $: groupBackgroundColor = BACKGROUND_COLORS[groupColorIndex];
  
  // Create a more opaque version for the header (increase opacity by 20%)
  $: groupHeaderColor = (() => {
    const baseColor = BACKGROUND_COLORS[groupColorIndex];
    // Extract the rgba values and increase opacity from 0.1 to 0.3
    return baseColor.replace('0.1)', '0.3)');
  })();

    let isCollapsed = false;
    let isEditingName = false;
    let nameInput = '';
    
    // Drag and drop state
    let isDragging = false;
    let draggedOverPosition: 'above' | 'below' | null = null;

    function toggleCollapse() {
      isCollapsed = !isCollapsed;
    }

    function startEditingName() {
      isEditingName = true;
      nameInput = groupName;
    }

    function finishEditingName() {
      if (nameInput.trim() && nameInput !== groupName) {
        const newGroup: WaveGroup = [nameInput.trim(), ...groupItems];
        dispatch('groupchange', { groupIndex: parentIndex, newGroup });
      }
      isEditingName = false;
    }

    function handleNameKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        finishEditingName();
      } else if (event.key === 'Escape') {
        isEditingName = false;
      }
    }

    function handleSignalChange(event: CustomEvent<{ signalIndex: number; newSignal: WaveSignal }>) {
      // Re-dispatch the signal change event up the component tree
      dispatch('signalchange', event.detail);
    }

    function handleNestedGroupChange(event: CustomEvent<{ groupIndex: number; newGroup: WaveGroup }>) {
      // Update the nested group and dispatch the change
      const newGroupItems = [...groupItems];
      newGroupItems[event.detail.groupIndex] = event.detail.newGroup;
      const newGroup: WaveGroup = [groupName, ...newGroupItems];
      dispatch('groupchange', { groupIndex: parentIndex, newGroup });
    }

    function addSignalToGroup() {
      // Generate a unique signal name within this group
      const existingSignalNames = new Set<string>();
      
      // Collect all existing signal names in this group
      function collectSignalNames(items: SignalItem[]) {
        for (const item of items) {
          if (Array.isArray(item)) {
            // It's a nested group
            collectSignalNames(item.slice(1) as SignalItem[]);
          } else if (item && typeof item === 'object' && 'name' in item) {
            // It's a signal
            existingSignalNames.add((item as WaveSignal).name);
          }
        }
      }
      
      collectSignalNames(groupItems);
      
      // Generate a unique name
      const baseNames = ['sig', 'data', 'ctrl', 'addr', 'enable', 'valid', 'ready'];
      let newSignalName = '';
      
      // Try base names first
      for (const baseName of baseNames) {
        if (!existingSignalNames.has(baseName)) {
          newSignalName = baseName;
          break;
        }
      }
      
      // If all base names are taken, use numbered naming
      if (!newSignalName) {
        let counter = 1;
        while (existingSignalNames.has(`sig${counter}`)) {
          counter++;
        }
        newSignalName = `sig${counter}`;
      }
      
      // Create the new signal
      const newSignal: WaveSignal = {
        name: newSignalName,
        wave: '0..1..0.'  // Default wave pattern
      };
      
      // Add the signal to the group
      const newGroupItems = [...groupItems, newSignal];
      const newGroup: WaveGroup = [groupName, ...newGroupItems];
      
      // Dispatch the change
      dispatch('groupchange', { groupIndex: parentIndex, newGroup });
    }

    // Drag and drop handlers for the group itself
    function handleGroupDragStart(event: DragEvent) {
      isDragging = true;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', parentIndex.toString());
        event.dataTransfer.setData('application/group', 'true');
        // Note: Groups at top level don't have a parent group index, so we don't set it
        
        // Create a custom drag image
        const dragImage = document.createElement('div');
        dragImage.textContent = `📁 ${groupName}`;
        dragImage.style.padding = '4px 8px';
        dragImage.style.backgroundColor = '#3b82f6';
        dragImage.style.color = 'white';
        dragImage.style.borderRadius = '4px';
        dragImage.style.fontSize = '12px';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // Clean up drag image after a short delay
        setTimeout(() => {
          document.body.removeChild(dragImage);
        }, 0);
      }
    }

    function handleGroupDragEnd(event: DragEvent) {
      isDragging = false;
      draggedOverPosition = null;
    }

    function handleGroupDragOver(event: DragEvent) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      
      // Determine if dragging over top or bottom half
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      draggedOverPosition = event.clientY < middleY ? 'above' : 'below';
    }

    function handleGroupDragLeave(event: DragEvent) {
      draggedOverPosition = null;
    }

    function handleGroupDrop(event: DragEvent) {
      event.preventDefault();
      draggedOverPosition = null;
      
      if (event.dataTransfer) {
        const fromIndexStr = event.dataTransfer.getData('text/plain');
        const fromIndex = parseInt(fromIndexStr, 10);
        const isGroup = event.dataTransfer.getData('application/group') === 'true';
        const isSpacer = event.dataTransfer.getData('application/spacer') === 'true';
        const isFromGroup = event.dataTransfer.getData('application/fromGroup') === 'true';
        
        if (!isNaN(fromIndex) && fromIndex !== parentIndex) {
          // Calculate the target index based on drop position
          let toIndex = parentIndex;
          if (draggedOverPosition === 'below' || 
              (draggedOverPosition === null && event.clientY > (event.currentTarget as HTMLElement).getBoundingClientRect().top + (event.currentTarget as HTMLElement).getBoundingClientRect().height / 2)) {
            toIndex = parentIndex + 1;
          }
          
          // Adjust for the fact that removing an item shifts indices
          if (fromIndex < toIndex) {
            toIndex--;
          }
          
          if (isGroup) {
            dispatch('groupreorder', { fromIndex, toIndex });
          } else {
            dispatch('signalreorder', { fromIndex, toIndex });
          }
        }
      }
      
      isDragging = false;
    }

    // Internal reordering within the group
    function handleInternalReorder(event: CustomEvent<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = event.detail;
      
      if (fromIndex === toIndex) return; // No change needed
      
      // Create a new group items array with reordered items
      const newGroupItems = [...groupItems];
      
      // Remove the item from its current position
      const [movedItem] = newGroupItems.splice(fromIndex, 1);
      
      // Ensure item maintains its proper structure based on type
      let itemToMove = movedItem;
      const itemType = getItemType(movedItem);
      
      if (itemType === 'spacer') {
        // For spacers, ensure they maintain their empty object structure
        itemToMove = {};
      } else if (itemType === 'signal') {
        // For signals, ensure they maintain their signal structure
        itemToMove = { ...movedItem } as WaveSignal;
      } else if (itemType === 'group') {
        // For groups, ensure they maintain their array structure
        itemToMove = [...movedItem] as WaveGroup;
      }
      
      // Insert it at the new position
      newGroupItems.splice(toIndex, 0, itemToMove);
      
      // Update the group structure
      const newGroup: WaveGroup = [groupName, ...newGroupItems];
      
      // Dispatch the change
      dispatch('groupchange', { groupIndex: parentIndex, newGroup });
    }

    // Spacer drag and drop handlers for items inside the group
    function handleSpacerDragStart(event: DragEvent, spacerIndex: number) {
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', spacerIndex.toString());
        event.dataTransfer.setData('application/spacer', 'true');
        event.dataTransfer.setData('application/groupIndex', parentIndex.toString());
        
        // Create a custom drag image
        const dragImage = document.createElement('div');
        dragImage.textContent = '--- SPACER ---';
        dragImage.style.padding = '4px 8px';
        dragImage.style.backgroundColor = '#6b7280';
        dragImage.style.color = 'white';
        dragImage.style.borderRadius = '4px';
        dragImage.style.fontSize = '12px';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // Clean up drag image after a short delay
        setTimeout(() => {
          document.body.removeChild(dragImage);
        }, 0);
      }
    }

    function handleSpacerDragOver(event: DragEvent, spacerIndex: number) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }

    function handleSpacerDragLeave(event: DragEvent, spacerIndex: number) {
      // No specific action needed for leave in this context
    }

    function handleSpacerDrop(event: DragEvent, spacerIndex: number) {
      event.preventDefault();
      
      if (event.dataTransfer) {
        const fromIndexStr = event.dataTransfer.getData('text/plain');
        const fromIndex = parseInt(fromIndexStr, 10);
        
        if (!isNaN(fromIndex) && fromIndex !== spacerIndex) {
          // Calculate the target index based on drop position
          let toIndex = spacerIndex;
          if (event.clientY > (event.currentTarget as HTMLElement).getBoundingClientRect().top + (event.currentTarget as HTMLElement).getBoundingClientRect().height / 2) {
            toIndex = spacerIndex + 1;
          }
          
          // Adjust for the fact that removing an item shifts indices
          if (fromIndex < toIndex) {
            toIndex--;
          }
          
          handleInternalReorder({ detail: { fromIndex, toIndex } } as CustomEvent<{ fromIndex: number; toIndex: number }>);
        }
      }
    }

    // Group content drop handlers for cross-context moves
    function handleGroupContentDragOver(event: DragEvent) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }

    function handleGroupContentDrop(event: DragEvent) {
      event.preventDefault();
      
      if (event.dataTransfer) {
        const fromIndexStr = event.dataTransfer.getData('text/plain');
        const fromIndex = parseInt(fromIndexStr, 10);
        const isGroup = event.dataTransfer.getData('application/group') === 'true';
        const isSpacer = event.dataTransfer.getData('application/spacer') === 'true';
        const isFromSameGroup = event.dataTransfer.getData('application/groupIndex') === parentIndex.toString();
        
        if (!isNaN(fromIndex) && !isFromSameGroup) {
          // This is a cross-context move - moving an item from outside into this group
          // We need to dispatch a special event to handle this at the top level
          dispatch('movetogroup', { 
            fromIndex, 
            toGroupIndex: parentIndex, 
            itemType: isGroup ? 'group' : isSpacer ? 'spacer' : 'signal'
          });
        }
      }
    }


  
  </script>
  
  <div class="signal-group" 
       class:dragging={isDragging}
       class:drag-over-above={draggedOverPosition === 'above'}
       class:drag-over-below={draggedOverPosition === 'below'}
       style="--level: {level}">
    <!-- Group Header -->
    <div class="group-header" 
         style="background-color: {groupHeaderColor}; width: {150 + (maxCycles * 40 * hscale)}px;"
         draggable="true"
         on:dragstart={handleGroupDragStart}
         on:dragend={handleGroupDragEnd}
         on:dragover={handleGroupDragOver}
         on:dragleave={handleGroupDragLeave}
         on:drop={handleGroupDrop}>
      <div class="group-name-container">
              <button 
        class="collapse-button"
        on:click={toggleCollapse}
        title={isCollapsed ? 'Expand group' : 'Collapse group'}
        aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
      >
          <svg width="12" height="12" viewBox="0 0 12 12" class:collapsed={isCollapsed}>
            <path d="M4 2 L8 6 L4 10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        {#if isEditingName}
          <input
            type="text"
            class="group-name-input"
            bind:value={nameInput}
            on:blur={finishEditingName}
            on:keydown={handleNameKeydown}
            autofocus
          />
        {:else}
          <div class="group-name-display">
            <span class="group-name-text">{groupName}</span>
            <button 
              class="edit-group-name-button"
              on:click={startEditingName}
              title="Edit group name"
              aria-label="Edit group name"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M8.5 1.5 L10.5 3.5 L3.5 10.5 L1.5 11 L2 8.5 L8.5 1.5 Z M7.5 2.5 L9.5 4.5" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        {/if}

        <!-- Add signal button moved next to group name -->
        <button 
          class="add-signal-button"
          title="Add signal to group"
          aria-label="Add signal to group"
          on:click|stopPropagation={addSignalToGroup}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M7 2 L7 12 M2 7 L12 7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Group Content -->
    {#if !isCollapsed}
      <div class="group-content" 
           style="--group-bg-color: {groupBackgroundColor}; width: {150 + (maxCycles * 40 * hscale)}px;"
           on:dragover={handleGroupContentDragOver}
           on:drop={handleGroupContentDrop}>
        {#each groupItems as item, index (index)}
          {@const itemType = getItemType(item)}

          {#if itemType === 'signal'}
            <SignalLane
              signal={item as WaveSignal}
              signalIndex={signalIndexMap.get(item) ?? index}
              localIndex={index}
              parentGroupIndex={parentIndex}
              {maxCycles}
              {hscale}
              {isCellSelected}
              on:signalchange={handleSignalChange}
              on:cellselection={(e) => dispatch('cellselection', e.detail)}
              on:rightclick={(e) => dispatch('rightclick', e.detail)}
              on:transitionclick={(e) => dispatch('transitionclick', e.detail)}
              on:signalreorder={handleInternalReorder}
            />
          {:else if itemType === 'group'}
            <svelte:self
              group={item as WaveGroup}
              parentIndex={index}
              {maxCycles}
              {hscale}
              level={level + 1}
              {getItemType}
              {isCellSelected}
              {signalIndexMap}
              on:signalchange={handleSignalChange}
              on:groupchange={handleNestedGroupChange}
              on:cellselection={(e) => dispatch('cellselection', e.detail)}
              on:rightclick={(e) => dispatch('rightclick', e.detail)}
              on:transitionclick={(e) => dispatch('transitionclick', e.detail)}
              on:signalreorder={handleInternalReorder}
              on:groupreorder={handleInternalReorder}
            />
          {:else if itemType === 'spacer'}
            <div class="group-spacer" 
                 draggable="true"
                 on:dragstart={(e) => handleSpacerDragStart(e, index)}
                 on:dragover={(e) => handleSpacerDragOver(e, index)}
                 on:dragleave={(e) => handleSpacerDragLeave(e, index)}
                 on:drop={(e) => handleSpacerDrop(e, index)}>
              <div class="spacer-name">spacer</div>
              <div class="spacer-wave-area" style="width: {maxCycles * 40 * hscale}px;">
                <div class="spacer-vertical-line"></div>
              </div>
            </div>
          {:else if itemType === 'unknown'}
            <div class="group-unknown">
              Unknown item type in group
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
  
  <style>
    .signal-group {
      --indent: calc(var(--level) * 20px);
      border-left: 2px solid #e5e7eb;
      margin-left: var(--indent);
      transition: all 0.15s ease;
      position: relative;
    }

    .signal-group.dragging {
      opacity: 0.5;
    }

    .signal-group.drag-over-above::before {
      content: '';
      position: absolute;
      top: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: #3b82f6;
      z-index: 10;
    }

    .signal-group.drag-over-below::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 4px;
      background-color: #3b82f6;
      z-index: 10;
    }

    .group-header {
      height: var(--lane-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: transparent;
      border-bottom: 1px solid var(--border-color);
      padding-right: 8px;
      cursor: grab;
      transition: background-color 0.15s ease;
    }

    .group-header:active {
      cursor: grabbing;
    }

    .group-header:hover {
      background-color: rgba(59, 130, 246, 0.05);
    }

    .group-name-container {
      width: var(--name-width);
      display: flex;
      align-items: center;
      padding: 0 8px;
      gap: 8px;
      flex-shrink: 0;
    }

    .collapse-button {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      color: #6b7280;
      transition: all 0.15s ease;
    }

    .collapse-button:hover {
      background-color: #e5e7eb;
      color: #374151;
    }

    .collapse-button svg {
      transition: transform 0.15s ease;
    }

    .collapse-button svg.collapsed {
      transform: rotate(0deg); /* Right arrow when collapsed */
    }

    .collapse-button svg:not(.collapsed) {
      transform: rotate(90deg); /* Down arrow when expanded */
    }

    .group-name-display {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 1;
      gap: 8px;
    }

    .group-name-text {
      color: var(--text-color);
      font-weight: 600;
      font-size: 13px;
      flex: 1;
      text-align: left;
    }

    .edit-group-name-button {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      color: #6b7280;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .edit-group-name-button:hover {
      background-color: #e5e7eb;
      color: #374151;
    }

    .group-name-input {
      flex: 1;
      border: 1px solid #3b82f6;
      border-radius: 4px;
      padding: 4px 8px;
      font: inherit;
      font-weight: 600;
      font-size: 13px;
      background-color: white;
    }

    .group-name-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    }

    .add-signal-button {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      color: #6b7280;
      transition: all 0.15s ease;
      margin-left: 4px;
    }

    .add-signal-button:hover {
      background-color: #e5e7eb;
      color: #374151;
    }

    .group-content {
      background-color: var(--group-bg-color);
    }

    .group-spacer {
      height: calc(var(--lane-height) * 0.6);
      display: flex;
      margin: 2px 0;
      cursor: grab;
      transition: all 0.15s ease;
      position: relative;
    }

    .group-spacer:active {
      cursor: grabbing;
    }

    .group-spacer:hover {
      background-color: rgba(59, 130, 246, 0.05);
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

    .group-unknown {
      height: var(--lane-height);
      display: flex;
      align-items: center;
      padding-left: 16px;
      color: #dc2626;
      background-color: #fef2f2;
      border-bottom: 1px solid var(--border-color);
    }
  </style>
  