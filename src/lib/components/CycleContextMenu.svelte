<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let visible: boolean = false;
  export let x: number = 0;
  export let y: number = 0;
  export let signalName: string = '';
  export let cycleIndex: number = 0;
  export let currentValue: string = '';
  export let isImplicit: boolean = false;
  export let isExplicit: boolean = false;

  const dispatch = createEventDispatcher<{
    setvalue: { value: string };
    copy: {};
    paste: {};
    explicitate: {};
    implicitate: {};
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
      case 'explicitate':
        dispatch('explicitate', {});
        break;
      case 'implicitate':
        dispatch('implicitate', {});
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
    
    <!-- Signal Mode Operations -->
    {#if isImplicit || isExplicit}
      <div class="menu-section">
        <div class="section-title">Signal Mode</div>
        {#if isImplicit}
          <button class="menu-item mode-item" on:click={() => handleAction('explicitate')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="7" width="4" height="2" fill="currentColor" opacity="0.6"/>
              <rect x="10" y="7" width="4" height="2" fill="currentColor"/>
              <path d="M8 4 L8 12 M5 9 L8 12 L11 9" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            Explicitate
            <span class="mode-description">Replace dots with values</span>
          </button>
        {/if}
        {#if isExplicit}
          <button class="menu-item mode-item" on:click={() => handleAction('implicitate')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="7" width="4" height="2" fill="currentColor"/>
              <rect x="10" y="7" width="4" height="2" fill="currentColor" opacity="0.6"/>
              <path d="M8 12 L8 4 M5 7 L8 4 L11 7" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            Implicitate
            <span class="mode-description">Use dots for repeating values</span>
          </button>
        {/if}
      </div>

      <div class="menu-separator"></div>
    {/if}
    
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
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
    z-index: 1100;
    min-width: 200px;
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
  }

  .cycle-info {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .current-value {
    font-size: 11px;
    color: var(--color-accent-primary);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: var(--color-accent-light);
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
    color: var(--color-text-tertiary);
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
    color: var(--color-text-primary);
    font-size: inherit;
  }

  .menu-item:hover {
    background-color: var(--color-accent-light);
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
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-primary);
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    color: var(--color-text-primary);
  }

  .menu-separator {
    height: 1px;
    background-color: var(--color-border-primary);
    margin: 4px 0;
  }

  .menu-item svg {
    flex-shrink: 0;
  }

  .mode-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
  }

  .mode-item svg {
    align-self: flex-start;
    margin-bottom: 2px;
  }

  .mode-description {
    font-size: 10px;
    color: var(--color-text-tertiary);
    margin-left: 0;
    font-weight: 400;
  }
</style> 
