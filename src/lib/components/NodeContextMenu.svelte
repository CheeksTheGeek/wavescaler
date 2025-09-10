<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let visible: boolean = false;
  export let x: number = 0;
  export let y: number = 0;
  export let nodeId: string = '';
  export let signalIndex: number = 0;
  export let cycleIndex: number = 0;

  const dispatch = createEventDispatcher<{
    setname: { nodeId: string; nodeName: string };
    close: {};
  }>();

  let nameInput: HTMLInputElement;
  let newNodeName = nodeId;

  // Focus the input when the menu becomes visible
  $: if (visible && nameInput) {
    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 50);
  }

  // Reset the input value when nodeId changes
  $: if (nodeId) {
    newNodeName = nodeId;
  }

  function handleSetName() {
    if (newNodeName && newNodeName.trim()) {
      dispatch('setname', { 
        nodeId,
        nodeName: newNodeName.trim() 
      });
    }
    dispatch('close', {});
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSetName();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dispatch('close', {});
    }
  }

  let isJustOpened = false;

  // Watch for when the menu becomes visible to prevent immediate closing
  $: if (visible) {
    isJustOpened = true;
    newNodeName = nodeId;
    // Reset the flag after a short delay
    setTimeout(() => {
      isJustOpened = false;
    }, 100);
  }

  function handleClickOutside(event: MouseEvent) {
    // Don't close if the menu was just opened
    if (isJustOpened) return;
    
    if (visible && !(event.target as Element)?.closest('.node-context-menu')) {
      dispatch('close', {});
    }
  }

  function handleContextMenu(event: MouseEvent) {
    // Prevent the browser's default context menu when our menu is visible
    if (visible) {
      event.preventDefault();
    }
  }

  function handleWheel(event: WheelEvent) {
    // Close menu on scaling (Ctrl/Cmd + wheel) or horizontal scrolling (Shift + wheel)
    if (visible && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      dispatch('close', {});
    }
  }

  function handleScroll(event: Event) {
    // Close menu on any scrolling
    if (visible) {
      dispatch('close', {});
    }
  }
</script>

<svelte:window on:click={handleClickOutside} on:mousedown={handleClickOutside} on:contextmenu={handleContextMenu} on:wheel={handleWheel} on:scroll={handleScroll} />

{#if visible}
  <div 
    class="node-context-menu" 
    style="left: {x}px; top: {y}px;"
    role="menu"
    tabindex="-1"
    on:click|stopPropagation
    on:mousedown|stopPropagation
    on:keydown={handleKeydown}
  >
    <div class="context-menu-header">
      <strong>Node Configuration</strong>
      <span class="node-info">Signal {signalIndex}, Cycle {cycleIndex}</span>
      <span class="current-id">Current ID: {nodeId}</span>
    </div>
    
    <div class="menu-section">
      <div class="section-title">Node Name</div>
      <div class="input-section">
        <div class="name-input-container">
          <input
            bind:this={nameInput}
            bind:value={newNodeName}
            type="text"
            class="name-input"
            placeholder="Enter node name..."
            on:keydown={handleKeydown}
          />
          <button class="set-name-btn" on:click={handleSetName}>
            Set Name
          </button>
        </div>
        <div class="help-text">
          Use this name to reference this node in arrows and annotations
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .node-context-menu {
    position: fixed;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
    z-index: 1100;
    min-width: 280px;
    padding: 4px;
    font-size: 14px;
  }

  .context-menu-header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border-primary);
    margin-bottom: 4px;
  }

  .context-menu-header strong {
    display: block;
    font-size: 13px;
    color: var(--color-text-primary);
    margin-bottom: 4px;
  }

  .node-info, .current-id {
    display: block;
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-bottom: 2px;
  }

  .menu-section {
    margin-bottom: 4px;
  }

  .section-title {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .input-section {
    padding: 0 12px 8px 12px;
  }

  .name-input-container {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .name-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: inherit;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .name-input:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 2px var(--color-accent-light);
  }

  .set-name-btn {
    padding: 8px 16px;
    background: var(--color-accent-primary);
    color: var(--color-text-inverted);
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .set-name-btn:hover {
    background: var(--color-accent-hover);
  }

  .set-name-btn:active {
    background: var(--color-accent-active);
  }

  .help-text {
    font-size: 12px;
    color: var(--color-text-tertiary);
    font-style: italic;
  }
</style>
