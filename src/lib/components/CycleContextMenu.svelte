<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let visible: boolean = false;
  export let x: number = 0;
  export let y: number = 0;
  export let signalName: string = '';
  export let cycleIndex: number = 0;
  export let currentValue: string = '';

  const dispatch = createEventDispatcher<{
    setvalue: { value: string };
    copy: {};
    paste: {};
    close: {};
  }>();

  function handleAction(action: string, value?: string) {
    switch (action) {
      case 'set0':
        dispatch('setvalue', { value: '0' });
        break;
      case 'set1':
        dispatch('setvalue', { value: '1' });
        break;
      case 'setx':
        dispatch('setvalue', { value: 'x' });
        break;
      case 'setz':
        dispatch('setvalue', { value: 'z' });
        break;
      case 'setdata':
        dispatch('setvalue', { value: '=' });
        break;
      case 'copy':
        dispatch('copy', {});
        break;
      case 'paste':
        dispatch('paste', {});
        break;
    }
    dispatch('close', {});
  }

  let isJustOpened = false;

  // Watch for when the menu becomes visible to prevent immediate closing
  $: if (visible) {
    isJustOpened = true;
    // Reset the flag after a short delay
    setTimeout(() => {
      isJustOpened = false;
    }, 100);
  }

  function handleClickOutside(event: MouseEvent) {
    // Don't close if the menu was just opened
    if (isJustOpened) return;
    
    if (visible && !(event.target as Element)?.closest('.cycle-context-menu')) {
      dispatch('close', {});
    }
  }

  function handleContextMenu(event: MouseEvent) {
    // Prevent the browser's default context menu when our menu is visible
    if (visible) {
      event.preventDefault();
    }
  }
</script>

<svelte:window on:click={handleClickOutside} on:mousedown={handleClickOutside} on:contextmenu={handleContextMenu} />

{#if visible}
  <div 
    class="cycle-context-menu" 
    style="left: {x}px; top: {y}px;"
    role="menu"
    tabindex="-1"
    on:click|stopPropagation
    on:mousedown|stopPropagation
    on:keydown={(e) => { if (e.key === 'Escape') dispatch('close', {}); }}
  >
    <div class="context-menu-header">
      <strong>{signalName}</strong>
      <span class="cycle-info">Cycle {cycleIndex}</span>
      {#if currentValue}
        <span class="current-value">Current: {currentValue}</span>
      {/if}
    </div>
    
    <div class="menu-section">
      <div class="section-title">Set Value</div>
      <button class="menu-item value-item" on:click={() => handleAction('set0')}>
        <span class="value-preview">0</span>
        Set to Low (0)
      </button>
      <button class="menu-item value-item" on:click={() => handleAction('set1')}>
        <span class="value-preview">1</span>
        Set to High (1)
      </button>
      <button class="menu-item value-item" on:click={() => handleAction('setx')}>
        <span class="value-preview">X</span>
        Set to Unknown (x)
      </button>
      <button class="menu-item value-item" on:click={() => handleAction('setz')}>
        <span class="value-preview">Z</span>
        Set to High-Z (z)
      </button>
      <button class="menu-item value-item" on:click={() => handleAction('setdata')}>
        <span class="value-preview">=</span>
        Set to Data (=)
      </button>
    </div>

    <div class="menu-separator"></div>
    
    <button class="menu-item" on:click={() => handleAction('copy')}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="3" y="3" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <rect x="5" y="5" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      Copy Value
    </button>
    
    <button class="menu-item" on:click={() => handleAction('paste')}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="4" y="2" width="8" height="12" stroke="currentColor" stroke-width="1.5" fill="none" rx="1"/>
        <path d="M6 2 L6 4 L10 4 L10 2" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      Paste Value
    </button>
  </div>
{/if}

<style>
  .cycle-context-menu {
    position: fixed;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    z-index: 1100;
    min-width: 200px;
    padding: 4px;
    font-size: 14px;
  }

  .context-menu-header {
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 4px;
  }

  .context-menu-header strong {
    display: block;
    font-size: 13px;
    color: #1f2937;
  }

  .cycle-info {
    font-size: 12px;
    color: #6b7280;
  }

  .current-value {
    font-size: 11px;
    color: #3b82f6;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: #dbeafe;
    padding: 2px 4px;
    border-radius: 3px;
    margin-left: 8px;
  }

  .menu-section {
    margin-bottom: 4px;
  }

  .section-title {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.15s ease;
    color: var(--text-color, #1f2937);
    font-size: inherit;
  }

  .menu-item:hover {
    background-color: #f3f4f6;
  }

  .value-item {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .value-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    color: #374151;
  }

  .menu-separator {
    height: 1px;
    background-color: #e5e7eb;
    margin: 4px 0;
  }

  .menu-item svg {
    flex-shrink: 0;
  }
</style> 
