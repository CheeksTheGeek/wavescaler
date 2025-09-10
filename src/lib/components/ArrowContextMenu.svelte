<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let visible: boolean = false;
  export let x: number = 0;
  export let y: number = 0;
  export let currentMode: string = '->';
  export let arrowIndex: number = 0;

  const dispatch = createEventDispatcher<{
    setmode: { mode: string };
    settext: { text: string };
    delete: {};
    close: {};
  }>();

  // Official WaveDrom arrow modes only
  const straightModes = [
    { mode: '-', label: 'Line', description: 'Straight line connection' },
    { mode: '-|', label: 'Line to Clock', description: 'Line ending with clock edge' },
    { mode: '-|-', label: 'Line with Clock', description: 'Line with clock markers' },
    { mode: '->', label: 'Arrow', description: 'Simple arrow' },
    { mode: '-|>', label: 'Clock Arrow', description: 'Clock edge to arrow' },
    { mode: '-|->', label: 'Clock to Arrow', description: 'Clock edge to arrow' },
    { mode: '|->', label: 'Start Arrow', description: 'Clock start to arrow' },
    { mode: '<->', label: 'Bidirectional', description: 'Two-way arrow' },
    { mode: '<-|>', label: 'Bi Clock', description: 'Bidirectional with clock' },
    { mode: '<-|->', label: 'Bi Clock Arrow', description: 'Bidirectional clock arrow' },
    { mode: '+', label: 'Cross', description: 'Simple cross marker' },
  ];

  const splineModes = [
    { mode: '~', label: 'Curve', description: 'Curved line connection' },
    { mode: '-~', label: 'Line to Curve', description: 'Straight line to curve' },
    { mode: '~>', label: 'Curved Arrow', description: 'Curved arrow' },
    { mode: '-~>', label: 'Line to Curved Arrow', description: 'Line to curved arrow' },
    { mode: '~->', label: 'Curve to Arrow', description: 'Curve to straight arrow' },
    { mode: '<~>', label: 'Bi Curve', description: 'Bidirectional curve' },
    { mode: '<-~>', label: 'Bi Line Curve', description: 'Bidirectional line to curve' },
  ];

  // Extract current text from the mode string
  $: currentText = extractTextFromMode(currentMode);
  let textInput = '';

  // Update text input when the component opens
  $: if (visible) {
    textInput = currentText;
  }

  function extractTextFromMode(modeString: string): string {
    // Extract text label from edge string like "a->b text label"
    const textMatch = modeString.match(/^[a-zA-Z]\d*[^a-zA-Z\d\s]+[a-zA-Z]\d*\s+(.+)$/);
    return textMatch ? textMatch[1].trim() : '';
  }

  function handleSetMode(mode: string) {
    dispatch('setmode', { mode });
    dispatch('close', {});
  }

  function handleSetText() {
    dispatch('settext', { text: textInput.trim() });
    dispatch('close', {});
  }

  function handleTextKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSetText();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      textInput = currentText; // Reset to original
      dispatch('close', {});
    }
  }

  function handleDelete() {
    dispatch('delete', {});
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
    
    if (visible && !(event.target as Element)?.closest('.arrow-context-menu')) {
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
    class="arrow-context-menu" 
    style="left: {x}px; top: {y}px;"
    role="menu"
    tabindex="-1"
    on:click|stopPropagation
    on:mousedown|stopPropagation
    on:keydown={(e) => { if (e.key === 'Escape') dispatch('close', {}); }}
  >
    <div class="context-menu-header">
      <strong>Arrow Configuration</strong>
      <span class="arrow-info">Index {arrowIndex}</span>
      <span class="current-mode">Current: {currentMode}</span>
    </div>
    
    <!-- Text Label Section -->
    <div class="menu-section">
      <div class="section-title">Text Label</div>
      <div class="text-input-container">
        <input 
          type="text" 
          class="text-input"
          placeholder="Enter text label (optional)"
          bind:value={textInput}
          on:keydown={handleTextKeydown}
          on:click|stopPropagation
        />
        <button 
          class="text-apply-button" 
          on:click={handleSetText}
          disabled={textInput.trim() === currentText}
        >
          Apply
        </button>
      </div>
      {#if currentText}
        <div class="current-text">
          Current: <span class="text-preview">{currentText}</span>
        </div>
      {/if}
    </div>

    <div class="menu-separator"></div>
    
    <div class="menu-section">
      <div class="section-title">Straight Line Modes</div>
      {#each straightModes as { mode, label, description }}
        <button 
          class="menu-item arrow-mode-item" 
          class:current={currentMode === mode}
          on:click={() => handleSetMode(mode)}
        >
          <div class="mode-preview-container">
            <span class="mode-preview">{mode}</span>
            <svg class="mode-icon" width="24" height="16" viewBox="0 0 24 16">
              <defs>
                <marker id="arrowhead-{mode}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto" fill="currentColor">
                  <polygon points="0,0 8,3 0,6" />
                </marker>
                <marker id="arrowhead-start-{mode}" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto" fill="currentColor">
                  <polygon points="8,0 0,3 8,6" />
                </marker>
              </defs>
              {#if mode === '-'}
                <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5"/>
              {:else if mode === '-|'}
                <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" stroke-width="1.5"/>
                <line x1="18" y1="5" x2="18" y2="11" stroke="currentColor" stroke-width="2"/>
              {:else if mode === '-|-'}
                <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5"/>
                <line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="5" x2="16" y2="11" stroke="currentColor" stroke-width="2"/>
              {:else if mode === '->'}
                <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead-{mode})"/>
              {:else if mode === '-|>'}
                <line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1.5"/>
                <line x1="16" y1="5" x2="16" y2="11" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead-{mode})"/>
              {:else if mode === '-|->'}
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5"/>
                <line x1="14" y1="5" x2="14" y2="11" stroke="currentColor" stroke-width="2"/>
                <line x1="14" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead-{mode})"/>
              {:else if mode === '|->'}
                <line x1="2" y1="5" x2="2" y2="11" stroke="currentColor" stroke-width="2"/>
                <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead-{mode})"/>
              {:else if mode === '<->'}
                <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-start="url(#arrowhead-start-{mode})" marker-end="url(#arrowhead-{mode})"/>
              {:else if mode === '<-|>'}
                <line x1="2" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.5" marker-start="url(#arrowhead-start-{mode})"/>
                <line x1="12" y1="5" x2="12" y2="11" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead-{mode})"/>
              {:else if mode === '<-|->'}
                <line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="1.5" marker-start="url(#arrowhead-start-{mode})"/>
                <line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" stroke-width="2"/>
                <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1.5"/>
                <line x1="16" y1="5" x2="16" y2="11" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead-{mode})"/>
              {:else if mode === '+'}
                <line x1="12" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="2"/>
              {/if}
            </svg>
          </div>
          <div class="mode-details">
            <span class="mode-label">{label}</span>
            <span class="mode-description">{description}</span>
          </div>
        </button>
      {/each}
    </div>

    <div class="menu-separator"></div>
    
    <div class="menu-section">
      <div class="section-title">Spline Modes</div>
      {#each splineModes as { mode, label, description }}
        <button 
          class="menu-item arrow-mode-item" 
          class:current={currentMode === mode}
          on:click={() => handleSetMode(mode)}
        >
          <div class="mode-preview-container">
            <span class="mode-preview">{mode}</span>
            <svg class="mode-icon" width="24" height="16" viewBox="0 0 24 16">
              <defs>
                <marker id="arrowhead-spline-{mode}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto" fill="currentColor">
                  <polygon points="0,0 8,3 0,6" />
                </marker>
                <marker id="arrowhead-start-spline-{mode}" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto" fill="currentColor">
                  <polygon points="8,0 0,3 8,6" />
                </marker>
              </defs>
              {#if mode === '~'}
                <path d="M 2 8 Q 12 4 22 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
              {:else if mode === '-~'}
                <line x1="2" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5"/>
                <path d="M 10 8 Q 16 4 22 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
              {:else if mode === '~>'}
                <path d="M 2 8 Q 12 4 22 8" stroke="currentColor" stroke-width="1.5" fill="none" marker-end="url(#arrowhead-spline-{mode})"/>
              {:else if mode === '-~>'}
                <line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="1.5"/>
                <path d="M 8 8 Q 15 4 22 8" stroke="currentColor" stroke-width="1.5" fill="none" marker-end="url(#arrowhead-spline-{mode})"/>
              {:else if mode === '~->'}
                <path d="M 2 8 Q 8 4 14 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <line x1="14" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead-spline-{mode})"/>
              {:else if mode === '<~>'}
                <path d="M 2 8 Q 12 4 22 8" stroke="currentColor" stroke-width="1.5" fill="none" marker-start="url(#arrowhead-start-spline-{mode})" marker-end="url(#arrowhead-spline-{mode})"/>
              {:else if mode === '<-~>'}
                <line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="1.5" marker-start="url(#arrowhead-start-spline-{mode})"/>
                <path d="M 8 8 Q 15 4 22 8" stroke="currentColor" stroke-width="1.5" fill="none" marker-end="url(#arrowhead-spline-{mode})"/>
              {/if}
            </svg>
          </div>
          <div class="mode-details">
            <span class="mode-label">{label}</span>
            <span class="mode-description">{description}</span>
          </div>
        </button>
      {/each}
    </div>

    <div class="menu-separator"></div>
    
    <button class="menu-item delete-item" on:click={handleDelete}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M6 2V1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h4v2H2V2h4ZM4 5v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V5H4Z" fill="currentColor"/>
      </svg>
      Delete Arrow
    </button>
  </div>
{/if}

<style>
  .arrow-context-menu {
    position: fixed;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
    z-index: 1100;
    min-width: 280px;
    max-width: 350px;
    padding: 4px;
    font-size: 14px;
    max-height: 80vh;
    overflow-y: auto;
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

  .arrow-info, .current-mode {
    display: block;
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-bottom: 2px;
  }

  .current-mode {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: var(--color-accent-primary);
    background: var(--color-accent-light);
    padding: 2px 4px;
    border-radius: 3px;
    display: inline-block;
    margin-top: 4px;
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
    gap: 12px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background-color 0.15s ease;
    color: var(--color-text-primary);
    font-size: inherit;
  }

  .menu-item:hover {
    background-color: var(--color-accent-light);
  }

  .menu-item.current {
    background-color: var(--color-accent-light);
    border: 1px solid var(--color-accent-primary);
  }

  .arrow-mode-item {
    padding: 10px 12px;
  }

  .mode-preview-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    min-width: 60px;
  }

  .mode-preview {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-accent-primary);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    text-align: center;
  }

  .mode-icon {
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  .mode-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .mode-label {
    font-weight: 500;
    color: var(--color-text-primary);
    font-size: 13px;
  }

  .mode-description {
    font-size: 11px;
    color: var(--color-text-tertiary);
    line-height: 1.3;
  }

  .menu-separator {
    height: 1px;
    background-color: var(--color-border-primary);
    margin: 4px 0;
  }

  .delete-item {
    color: var(--color-danger, #dc2626);
  }

  .delete-item:hover {
    background-color: var(--color-danger-light, rgba(220, 38, 38, 0.1));
  }

  .delete-item svg {
    flex-shrink: 0;
  }

  /* Text input styles */
  .text-input-container {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
  }

  .text-input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 13px;
    font-family: inherit;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 2px var(--color-accent-light);
  }

  .text-input::placeholder {
    color: var(--color-text-tertiary);
  }

  .text-apply-button {
    padding: 6px 12px;
    background: var(--color-accent-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, opacity 0.15s ease;
    flex-shrink: 0;
  }

  .text-apply-button:hover:not(:disabled) {
    background: var(--color-accent-medium);
  }

  .text-apply-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--color-text-tertiary);
  }

  .current-text {
    padding: 4px 12px 8px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .text-preview {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: var(--color-bg-tertiary);
    padding: 2px 4px;
    border-radius: 2px;
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-primary);
  }
</style>
