<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let visible: boolean = false;
  export let selectedCount: number = 0;

  const dispatch = createEventDispatcher<{
    setvalue: { value: string };
    copy: {};
    paste: {};
    delete: {};
    duplicate: {};
    invert: {};
    clear: {};
  }>();

  let customValue = '';

  function handleSetValue(value: string) {
    dispatch('setvalue', { value });
    customValue = '';
  }

  const quickValues = ['0', '1', 'x', 'z', '='];
</script>

{#if visible}
  <div 
    class="selection-toolbar" 
    role="dialog" 
    aria-label="Selection toolbar with editing actions"
    tabindex="-1"
    on:click|stopPropagation
    on:keydown={(e) => { if (e.key === 'Escape') dispatch('clear'); }}
  >
    <div class="toolbar-header">
      <h3>Selection Actions</h3>
      <span class="selection-count">{selectedCount} cell{selectedCount === 1 ? '' : 's'}</span>
    </div>

    <div class="toolbar-section">
      <h4>Set Value</h4>
      <div class="quick-values">
        {#each quickValues as value}
          <button class="quick-value-btn" on:click={() => handleSetValue(value)}>
            {value}
          </button>
        {/each}
      </div>
      <div class="custom-value">
        <input 
          type="text" 
          placeholder="Custom value..."
          bind:value={customValue}
          class="custom-input"
          maxlength="1"
        />
        <button 
          class="apply-btn"
          disabled={!customValue.trim()}
          on:click={() => handleSetValue(customValue)}
        >
          Apply
        </button>
      </div>
    </div>

    <div class="toolbar-section">
      <h4>Edit Actions</h4>
      <button class="action-btn" on:click={() => dispatch('copy')}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="3" y="3" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <rect x="5" y="5" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Copy
      </button>
      <button class="action-btn" on:click={() => dispatch('paste')}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="4" y="2" width="8" height="12" stroke="currentColor" stroke-width="1.5" fill="none" rx="1"/>
          <path d="M6 2 L6 4 L10 4 L10 2" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Paste
      </button>
      <button class="action-btn" on:click={() => dispatch('duplicate')}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M6 2 L10 2 M8 2 L8 6 M6 14 L10 14 M8 10 L8 14" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Duplicate
      </button>
    </div>

    <div class="toolbar-section">
      <h4>Transform</h4>
      <button class="action-btn" on:click={() => dispatch('invert')}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M2 8 L14 8 M8 2 L8 14" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Invert
      </button>
    </div>

    <div class="toolbar-section">
      <button class="action-btn danger" on:click={() => dispatch('delete')}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M3 6 L13 6 M5 6 L5 13 L11 13 L11 6 M7 3 L9 3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Delete
      </button>
      <button class="action-btn secondary" on:click={() => dispatch('clear')}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M10.5 5.5 L5.5 10.5 M5.5 5.5 L10.5 10.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        Clear Selection
      </button>
    </div>
  </div>
{/if}

<style>
  .selection-toolbar {
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    padding: 16px;
    width: 220px;
    max-height: 70vh;
    overflow-y: auto;
    z-index: 900;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  .toolbar-header {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .toolbar-header h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .selection-count {
    font-size: 12px;
    color: #6b7280;
  }

  .toolbar-section {
    margin-bottom: 16px;
  }

  .toolbar-section h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  .quick-values {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    margin-bottom: 8px;
  }

  .quick-value-btn {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 8px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #374151;
  }

  .quick-value-btn:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
  }

  .custom-value {
    display: flex;
    gap: 6px;
  }

  .custom-input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    text-align: center;
  }

  .custom-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }

  .apply-btn {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .apply-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .apply-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    margin-bottom: 4px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #374151;
  }

  .action-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .action-btn.danger {
    color: #dc2626;
    border-color: #fca5a5;
  }

  .action-btn.danger:hover {
    background: #fef2f2;
    border-color: #f87171;
  }

  .action-btn.secondary {
    color: #6b7280;
  }

  .action-btn.secondary:hover {
    background: #f9fafb;
  }

  .action-btn svg {
    flex-shrink: 0;
  }
</style> 
