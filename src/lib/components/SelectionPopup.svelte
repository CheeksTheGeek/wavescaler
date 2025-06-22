<script lang="ts">
  export let visible: boolean = false;
  export let description: string = '';
  export let onClear: () => void = () => {};
</script>

{#if visible && description}
  <div 
    class="selection-popup" 
    role="status" 
    aria-live="polite"
  >
    <div class="popup-content">
      <div class="selection-info">
        <svg width="16" height="16" viewBox="0 0 16 16" class="selection-icon">
          <rect x="2" y="2" width="12" height="12" stroke="currentColor" stroke-width="1.5" fill="none" rx="2"/>
          <path d="M5 8 L7 10 L11 6" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        <span class="selection-text">{description}</span>
      </div>
      <button class="clear-button" on:click={onClear} title="Clear selection" aria-label="Clear selection">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M10.5 3.5 L3.5 10.5 M3.5 3.5 L10.5 10.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .selection-popup {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .popup-content {
    background: #1f2937;
    color: white;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 400px;
    min-width: 200px;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .selection-icon {
    color: #3b82f6;
    flex-shrink: 0;
  }

  .selection-text {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .clear-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    padding: 6px;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .clear-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style> 
