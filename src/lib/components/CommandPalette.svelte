<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { commandPaletteStore, filteredCommands, selectedCommandIndex } from '$lib/command-palette/store';
  import type { CommandContext } from '$lib/command-palette/types';
  
  export let context: CommandContext;
  
  let searchInput: HTMLInputElement;
  let commandListContainer: HTMLElement;
  let searchQuery = '';
  
  // Subscribe to store state
  $: isOpen = $commandPaletteStore.isOpen;
  $: commands = $filteredCommands;
  $: selectedIndex = $selectedCommandIndex;
  
  // Auto-focus search input when opened
  $: if (isOpen && searchInput) {
    searchInput.focus();
  }
  
  // Track previous search query to avoid unnecessary updates
  let previousSearchQuery = '';
  
  // Update search and filter commands only when search query actually changes
  $: if (isOpen && searchQuery !== previousSearchQuery) {
    commandPaletteStore.setSearchQuery(searchQuery, context);
    previousSearchQuery = searchQuery;
  }
  
  // Scroll selected item into view
  $: if (commandListContainer && selectedIndex >= 0) {
    const selectedElement = commandListContainer.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (!$commandPaletteStore.isOpen) return;
    
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        commandPaletteStore.close();
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        commandPaletteStore.selectNext();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        commandPaletteStore.selectPrevious();
        break;
        
      case 'Enter':
        event.preventDefault();
        executeSelectedCommand();
        break;
        
      case 'Tab':
        event.preventDefault();
        if (event.shiftKey) {
          commandPaletteStore.selectPrevious();
        } else {
          commandPaletteStore.selectNext();
        }
        break;
    }
  }
  
  function executeSelectedCommand() {
    const selectedCommand = commandPaletteStore.getSelectedCommand();
    if (selectedCommand) {
      executeCommand(selectedCommand);
    }
  }
  
  async function executeCommand(command: any) {
    try {
      await command.execute(context);
      commandPaletteStore.close();
    } catch (error) {
      console.error('Command execution failed:', error);
      // TODO: Show error toast/notification
    }
  }
  
  function handleCommandClick(command: any, index: number) {
    commandPaletteStore.setSelectedIndex(index);
    executeCommand(command);
  }
  
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      commandPaletteStore.close();
    }
  }
  
  // Initialize commands when palette opens (handled by store now)
  
  // Global keyboard listener
  onMount(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      // CMD+K or Ctrl+K to open command palette
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        commandPaletteStore.toggle(context);
        return;
      }
      
      // Handle navigation when open - call handleKeydown directly
      if ($commandPaletteStore.isOpen) {
        handleKeydown(event);
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeydown);
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown);
    };
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    commandPaletteStore.close();
  });
</script>



{#if isOpen}
  <!-- Overlay -->
  <div 
    class="command-palette-overlay"
    on:click={handleOverlayClick}
    role="presentation"
  >
    <!-- Command Palette Container -->
    <div class="command-palette" role="dialog" aria-label="Command palette">
      <!-- Search Input -->
      <div class="search-container">
        <div class="search-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM20 20l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command or search..."
          class="search-input"
          autocomplete="off"
          spellcheck="false"
          on:keydown={(e) => {
            // Let arrow keys bubble up to be handled by global handler
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
              // Don't handle these keys in the input, let them bubble up
              return;
            }
          }}
        />
        <div class="search-shortcut">
          <kbd>⌘K</kbd>
        </div>
      </div>
      
      <!-- Command List -->
      <div class="command-list-container">
        {#if commands.length > 0}
          <div 
            bind:this={commandListContainer}
            class="command-list" 
            role="listbox"
            aria-label="Available commands"
          >
            {#each commands as command, index}
              <button
                class="command-item"
                class:selected={index === selectedIndex}
                on:click={() => handleCommandClick(command, index)}
                role="option"
                aria-selected={index === selectedIndex}
                tabindex="-1"
              >
                <div class="command-icon">
                  {command.icon || '⚡'}
                </div>
                <div class="command-content">
                  <div class="command-title">{command.title}</div>
                  {#if command.description}
                    <div class="command-description">{command.description}</div>
                  {/if}
                </div>
                {#if command.shortcut}
                  <div class="command-shortcut">
                    <kbd>{command.shortcut}</kbd>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <div class="no-commands">
            <div class="no-commands-icon">🔍</div>
            <div class="no-commands-text">No commands found</div>
            <div class="no-commands-subtext">
              Try a different search term
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Footer -->
      <div class="command-palette-footer">
        <div class="footer-hint">
          <kbd>↑</kbd><kbd>↓</kbd> to navigate
          <kbd>↵</kbd> to select
          <kbd>esc</kbd> to close
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .command-palette-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--color-bg-overlay);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .command-palette {
    background: var(--color-bg-elevated);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--color-border-primary);
    width: 100%;
    max-width: 640px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideIn 0.15s ease-out;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  .search-container {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border-primary);
    gap: 12px;
  }
  
  .search-icon {
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }
  
  .search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 16px;
    color: var(--color-text-primary);
    background: transparent;
  }
  
  .search-input::placeholder {
    color: var(--color-text-placeholder);
  }
  
  .search-shortcut {
    flex-shrink: 0;
  }
  
  .command-list-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .command-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  .command-item {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    gap: 12px;
    transition: all 0.1s ease;
    text-align: left;
  }
  
  .command-item:hover,
  .command-item.selected {
    background-color: var(--color-bg-tertiary);
  }
  
  .command-item.selected {
    background-color: var(--color-accent-light);
    border: 1px solid var(--color-accent-primary);
  }
  
  .command-icon {
    font-size: 18px;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .command-content {
    flex: 1;
    min-width: 0;
  }
  
  .command-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    line-height: 1.3;
  }
  
  .command-description {
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.3;
    margin-top: 2px;
  }
  
  .command-shortcut {
    flex-shrink: 0;
  }
  
  .no-commands {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }
  
  .no-commands-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.5;
  }
  
  .no-commands-text {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
  }
  
  .no-commands-subtext {
    font-size: 14px;
    color: var(--color-text-tertiary);
  }
  
  .command-palette-footer {
    border-top: 1px solid var(--color-border-primary);
    padding: 12px 20px;
    background-color: var(--color-bg-secondary);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }
  
  .footer-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
  
  kbd {
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-secondary);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", monospace;
    color: var(--color-text-secondary);
    box-shadow: var(--shadow-sm);
  }
  
  /* Scrollbar styling */
  .command-list::-webkit-scrollbar {
    width: 6px;
  }
  
  .command-list::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .command-list::-webkit-scrollbar-thumb {
    background-color: var(--color-border-secondary);
    border-radius: 3px;
  }
  
  .command-list::-webkit-scrollbar-thumb:hover {
    background-color: var(--color-border-hover);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .command-palette-overlay {
      padding: 20px;
      padding-top: 10vh;
    }
    
    .command-palette {
      max-height: 80vh;
    }
    
    .search-container {
      padding: 12px 16px;
    }
    
    .command-item {
      padding: 10px 12px;
    }
  }
</style> 
