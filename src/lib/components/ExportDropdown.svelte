<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let buttonRef: HTMLButtonElement | null = null;

  const dispatch = createEventDispatcher<{
    export: { format: 'json' | 'svg' | 'png' | 'jpeg' };
  }>();

  function handleExport(format: 'json' | 'svg' | 'png' | 'jpeg') {
    dispatch('export', { format });
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (isOpen && buttonRef && !buttonRef.contains(event.target as Node)) {
      isOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="export-dropdown" class:open={isOpen}>
  <div class="dropdown-menu">
    <button class="dropdown-item" on:click={() => handleExport('json')}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M3 3h10v2H3zM3 7h7v2H3zM3 11h5v2H3z" stroke="none" fill="currentColor"/>
      </svg>
      WaveJSON
    </button>
    <button class="dropdown-item" on:click={() => handleExport('svg')}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M14 4v8H2V4h12m1-1H1v10h14V3z" stroke="none" fill="currentColor"/>
        <path d="M4 8h8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      SVG
    </button>
    <button class="dropdown-item" on:click={() => handleExport('png')}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M14 4v8H2V4h12m1-1H1v10h14V3z" stroke="none" fill="currentColor"/>
        <path d="M4 6h8M4 8h8M4 10h8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      PNG
    </button>
    <button class="dropdown-item" on:click={() => handleExport('jpeg')}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M14 4v8H2V4h12m1-1H1v10h14V3z" stroke="none" fill="currentColor"/>
        <path d="M4 6l8 0M4 8l8 0M4 10l8 0" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      JPEG
    </button>
  </div>
</div>

<style>
  .export-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    z-index: 1000;
    margin-top: 0.25rem;
    display: none;
  }

  .export-dropdown.open {
    display: block;
  }

  .dropdown-menu {
    width: 100%;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 1rem;
    color: var(--text-1);
    background: var(--surface-1);
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    line-height: 1.25rem;
    transition: background-color 0.2s;
  }

  .dropdown-item:hover {
    background: var(--surface-2);
  }

  .dropdown-item:active {
    background: var(--surface-3);
  }

  .dropdown-item svg {
    flex-shrink: 0;
    color: var(--text-2);
  }

  /* Add a subtle separator between items */
  .dropdown-item:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .dropdown-content {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 160px;
    background: rgba(108, 114, 127, 0.5);
    backdrop-filter: blur(30px);
    border-radius: 8px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 1000;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
  }

  .dropdown-content.show {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .dropdown-item {
    padding: 12px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-color);
    transition: background-color 0.2s ease;
  }

  .dropdown-item:hover {
    background: rgba(108, 114, 127, 0.3);
  }

  .dropdown-item:first-child {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .dropdown-item:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  .dropdown-item:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
</style> 
