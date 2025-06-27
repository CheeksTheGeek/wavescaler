<script lang="ts">
  import { themeStore } from '$lib/theme-store';
  import { onMount } from 'svelte';

  $: currentTheme = $themeStore;
  $: effectiveTheme = themeStore.getEffectiveTheme(currentTheme);

  function cycleTheme() {
    themeStore.cycleTheme();
  }

  function toggleLightDark() {
    // Skip auto mode, toggle directly between light and dark
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    themeStore.setTheme(newTheme);
  }

  function handleClick(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey) {
      // CMD on Mac or Ctrl on Windows/Linux - toggle light/dark only
      toggleLightDark();
    } else {
      // Normal click - cycle through all three states
      cycleTheme();
    }
  }

  function getThemeLabel(theme: typeof currentTheme) {
    switch (theme) {
      case 'auto': return 'Auto (System)';
      case 'light': return 'Light Mode';
      case 'dark': return 'Dark Mode';
      default: return 'Theme';
    }
  }

  function getNextThemeLabel(theme: typeof currentTheme) {
    switch (theme) {
      case 'auto': return 'Switch to Light Mode';
      case 'light': return 'Switch to Dark Mode';
      case 'dark': return 'Switch to Auto Mode';
      default: return 'Cycle Theme';
    }
  }

  function getTooltipText(theme: typeof currentTheme) {
    const current = getThemeLabel(theme);
    const next = getNextThemeLabel(theme);
    return `${current} - Click: ${next} | ⌘+Click: Toggle Light/Dark`;
  }

  onMount(() => {
    themeStore.init();
  });
</script>

<button
  class="theme-toggle"
  on:click={handleClick}
  title="{getTooltipText(currentTheme)}"
  aria-label="{getNextThemeLabel(currentTheme)}"
>
  <div class="theme-icon" class:auto={currentTheme === 'auto'} class:light={currentTheme === 'light'} class:dark={currentTheme === 'dark'}>
    {#if currentTheme === 'auto'}
      <!-- Auto mode icon: half sun, half moon -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <defs>
          <clipPath id="leftHalf">
            <rect x="0" y="0" width="12" height="24"/>
          </clipPath>
          <clipPath id="rightHalf">
            <rect x="12" y="0" width="12" height="24"/>
          </clipPath>
        </defs>
        
        <!-- Sun (left half) -->
        <g clip-path="url(#leftHalf)" class="sun-half">
          <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.25"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </g>
        
        <!-- Moon (right half) -->
        <g clip-path="url(#rightHalf)" class="moon-half">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" opacity="0.25"/>
        </g>
        
        <!-- Dividing line -->
        <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="0.75" opacity="0.5"/>
      </svg>
    {:else if currentTheme === 'light'}
      <!-- Sun icon for light mode -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.2"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    {:else}
      <!-- Moon icon for dark mode -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" opacity="0.3"/>
      </svg>
    {/if}
  </div>
  
  <!-- Theme indicator dots -->
  <div class="theme-indicators">
    <div class="indicator" class:active={currentTheme === 'auto'} title="Auto"></div>
    <div class="indicator" class:active={currentTheme === 'light'} title="Light"></div>
    <div class="indicator" class:active={currentTheme === 'dark'} title="Dark"></div>
  </div>
</button>

<style>
  .theme-toggle {
    /* High contrast background */
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: var(--radius-lg);
    cursor: pointer;
    padding: 10px;
    margin: 4px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
    min-width: 52px;
    backdrop-filter: blur(12px);
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1), 
      0 2px 4px -1px rgba(0, 0, 0, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .theme-toggle::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(45deg, 
      transparent, 
      rgba(59, 130, 246, 0.1), 
      transparent, 
      rgba(245, 158, 11, 0.1), 
      transparent
    );
    border-radius: var(--radius-lg);
    opacity: 0;
    animation: borderPulse 3s ease-in-out infinite;
    z-index: -1;
  }

  .theme-toggle::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, 
      rgba(59, 130, 246, 0.05) 0%, 
      rgba(245, 158, 11, 0.05) 30%, 
      transparent 60%
    );
    transform: translate(-50%, -50%) scale(0);
    border-radius: 50%;
    animation: radiatingGlow 4s ease-in-out infinite;
    z-index: -1;
  }

  .theme-toggle:hover {
    background: rgba(255, 255, 255, 1);
    border-color: var(--color-accent-primary);
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      0 10px 15px -3px rgba(0, 0, 0, 0.15), 
      0 4px 6px -2px rgba(0, 0, 0, 0.1),
      0 0 0 2px var(--color-accent-light),
      0 0 20px rgba(59, 130, 246, 0.2);
  }

  .theme-toggle:hover::before {
    opacity: 1;
    animation: borderPulse 1.5s ease-in-out infinite;
  }

  .theme-toggle:hover::after {
    animation: radiatingGlow 2s ease-in-out infinite;
  }

  .theme-toggle:active {
    transform: translateY(-1px) scale(1);
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1), 
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .theme-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  .theme-icon.auto {
    color: #1f2937;
    background: linear-gradient(
      45deg, 
      #ea580c 0%, 
      #ea580c 45%, 
      #3730a3 55%, 
      #3730a3 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: autoShimmer 4s ease-in-out infinite;
  }

  .theme-icon.auto .sun-half {
    color: #ea580c;
    stroke: #ea580c;
    stroke-width: 2;
  }

  .theme-icon.auto .moon-half {
    color: #3730a3;
    stroke: #3730a3;
    stroke-width: 2;
  }

  .theme-icon.light {
    color: #ea580c;
    background: radial-gradient(circle, rgba(234, 88, 12, 0.3) 0%, transparent 60%);
    filter: drop-shadow(0 0 12px rgba(234, 88, 12, 0.5)) contrast(1.2);
    animation: breathingLight 3s ease-in-out infinite;
  }

  .theme-icon.dark {
    color: #3730a3;
    background: radial-gradient(circle, rgba(55, 48, 163, 0.3) 0%, transparent 60%);
    filter: drop-shadow(0 0 12px rgba(55, 48, 163, 0.5)) contrast(1.2);
    animation: breathingLight 3s ease-in-out infinite;
  }

  .theme-indicators {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
  }

  .indicator.active {
    background-color: var(--color-accent-primary);
    transform: scale(1.3);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
  }

  .theme-toggle:focus-visible {
    outline: 3px solid var(--color-accent-primary);
    outline-offset: 3px;
  }

  /* Auto mode shimmer animation */
  @keyframes autoShimmer {
    0%, 100% {
      filter: hue-rotate(0deg) brightness(1);
    }
    50% {
      filter: hue-rotate(15deg) brightness(1.1);
    }
  }

  /* Radiating border pulse animation */
  @keyframes borderPulse {
    0%, 100% {
      opacity: 0;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.05);
    }
  }

  /* Radiating glow animation */
  @keyframes radiatingGlow {
    0%, 100% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
    }
    50% {
      transform: translate(-50%, -50%) scale(2);
      opacity: 0.8;
    }
  }

  /* Breathing light animation for icons */
  @keyframes breathingLight {
    0%, 100% {
      filter: brightness(1) blur(0px);
    }
    50% {
      filter: brightness(1.2) blur(0.5px);
    }
  }

  /* Dark mode specific styling for better visibility */
  :global([data-theme="dark"]) .theme-toggle {
    background: rgba(0, 0, 0, 0.85);
    border: 2px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.4), 
      0 2px 4px -1px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  :global([data-theme="dark"]) .theme-toggle::before {
    background: linear-gradient(45deg, 
      transparent, 
      rgba(124, 58, 237, 0.2), 
      transparent, 
      rgba(245, 158, 11, 0.2), 
      transparent
    );
  }

  :global([data-theme="dark"]) .theme-toggle::after {
    background: radial-gradient(circle, 
      rgba(124, 58, 237, 0.1) 0%, 
      rgba(245, 158, 11, 0.1) 30%, 
      transparent 60%
    );
  }

  :global([data-theme="dark"]) .theme-toggle:hover {
    background: rgba(0, 0, 0, 0.95);
    border-color: var(--color-accent-primary);
    box-shadow: 
      0 10px 15px -3px rgba(0, 0, 0, 0.6), 
      0 4px 6px -2px rgba(0, 0, 0, 0.4),
      0 0 0 2px var(--color-accent-light),
      0 0 25px rgba(124, 58, 237, 0.3);
  }

  :global([data-theme="dark"]) .indicator {
    background-color: rgba(255, 255, 255, 0.3);
  }

  :global([data-theme="dark"]) .indicator.active {
    background-color: var(--color-accent-primary);
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.6);
  }

  /* Ensure text color is always visible */
  :global([data-theme="dark"]) .theme-icon.auto {
    color: #f8fafc;
  }

  :global([data-theme="dark"]) .theme-icon.auto .sun-half {
    color: #f59e0b;
    stroke: #f59e0b;
    stroke-width: 2.5;
  }

  :global([data-theme="dark"]) .theme-icon.auto .moon-half {
    color: #7c3aed;
    stroke: #7c3aed;
    stroke-width: 2.5;
  }

  :global([data-theme="dark"]) .theme-icon.light {
    color: #f59e0b;
    filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.8)) contrast(1.5) brightness(1.2);
  }

  :global([data-theme="dark"]) .theme-icon.dark {
    color: #7c3aed;
    filter: drop-shadow(0 0 16px rgba(124, 58, 237, 0.8)) contrast(1.5) brightness(1.2);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .theme-toggle {
      padding: 8px;
      min-width: 44px;
      gap: 6px;
    }
    
    .theme-icon {
      width: 28px;
      height: 28px;
    }
    
    .theme-icon svg {
      width: 18px;
      height: 18px;
    }

    .indicator {
      width: 4px;
      height: 4px;
    }
  }

  /* Tablet responsive design */
  @media (max-width: 1024px) and (min-width: 769px) {
    .theme-toggle {
      padding: 9px;
      min-width: 48px;
    }
    
    .theme-icon {
      width: 30px;
      height: 30px;
    }
    
    .theme-icon svg {
      width: 20px;
      height: 20px;
    }

    .indicator {
      width: 5px;
      height: 5px;
    }
  }
</style> 
