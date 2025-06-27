<script lang="ts">
  import { themeStore } from '$lib/theme-store';
  import { onMount } from 'svelte';

  $: currentTheme = $themeStore;

  function toggleTheme() {
    themeStore.toggleTheme();
  }

  onMount(() => {
    themeStore.init();
  });
</script>

<button
  class="theme-toggle"
  on:click={toggleTheme}
  title={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  aria-label={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
>
  <div class="toggle-container" class:dark={currentTheme === 'dark'}>
    <div class="toggle-track">
      <div class="toggle-thumb" class:dark={currentTheme === 'dark'}>
        {#if currentTheme === 'light'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {/if}
      </div>
    </div>
  </div>
</button>

<style>
  .theme-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius-md);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .theme-toggle:hover {
    background-color: var(--color-accent-light);
  }

  .toggle-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-track {
    width: 44px;
    height: 24px;
    background-color: var(--color-border-secondary);
    border-radius: 12px;
    position: relative;
    transition: all 0.2s ease;
    border: 1px solid var(--color-border-primary);
  }

  .toggle-container.dark .toggle-track {
    background-color: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
  }

  .toggle-thumb {
    width: 18px;
    height: 18px;
    background-color: var(--color-bg-primary);
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    box-shadow: var(--shadow-sm);
  }

  .toggle-thumb.dark {
    transform: translateX(20px);
    color: var(--color-text-inverse);
  }

  .theme-toggle:focus-visible {
    outline: 2px solid var(--color-accent-primary);
    outline-offset: 2px;
  }
</style> 
