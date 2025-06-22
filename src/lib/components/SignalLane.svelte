<script lang="ts">
    import type { WaveSignal } from '$lib/wavejson-types';
    import { createEventDispatcher } from 'svelte';
  
    export let signal: WaveSignal;
    export let signalIndex: number; // Index of this signal in the parent's array, for updates
    export let y: number; // Top y position for this lane
    export let nameWidth: number;
    export let cycleWidth: number;
    export let laneHeight: number;
    export let hscale: number;
    export let maxCycles: number;
  
    const dispatch = createEventDispatcher<{
      waveformchange: { signalIndex: number; cycleIndex: number; newChar: string };
      wavestringchange: { signalIndex: number; newWaveString: string};
    }>();
  
    interface RenderedCycle {
      type: 'low' | 'high' | 'x' | 'z' | 'data' | 'clk' | 'gap' | 'empty' | 'unknown';
      char: string; // The original character from wave string ('', '.', '0', '1', 'x', etc.)
      effectiveChar: string; // The character being rendered ('0', '1', 'x', etc. - never '.')
      x: number;
      pathD: string;
      cssClass: string;
      text?: string;
      textX?: number;
      textY?: number;
      rectX?: number;
      rectY?: number;
      rectWidth?: number;
      rectHeight?: number;
      isInteractive: boolean;
      cycleIndex: number;
    }
  
    let renderedCycles: RenderedCycle[] = [];
  
    let isDragging = false;
    let dragStartCycleIndex = -1;
    let dragPaintChar: string | null = null; // The char ('0' or '1') to "paint" with during drag
    let lastDragAppliedCycle = -1;
  
  
    function getCycleVisuals(
      charToRender: string, // Effective char for visuals ('0', '1', 'x', etc.)
      originalChar: string, // From wave string (can be '.', '', '0', etc.)
      prevEffectiveChar: string | null,
      currentX: number,
      laneY: number,
      cycleW: number,
      laneH: number
    ): { pathD: string; cssClass: string; type: RenderedCycle['type']} {
      const topY = laneY + laneH * 0.15;
      const midY = laneY + laneH * 0.5;
      const bottomY = laneY + laneH * 0.85;
      let pathD = '';
      let cssClass = 'wave-unknown';
      let type: RenderedCycle['type'] = 'unknown';
  
      if (prevEffectiveChar && prevEffectiveChar !== charToRender) {
          if ((prevEffectiveChar === '0' || prevEffectiveChar === 'l' || prevEffectiveChar === 'L') && (charToRender === '1' || charToRender === 'h' || charToRender === 'H' || charToRender === 'P')) pathD += `M ${currentX} ${bottomY} L ${currentX} ${topY} `;
          else if ((prevEffectiveChar === '1' || prevEffectiveChar === 'h' || prevEffectiveChar === 'H' || prevEffectiveChar === 'P') && (charToRender === '0' || charToRender === 'l' || charToRender === 'L' || charToRender === 'N')) pathD += `M ${currentX} ${topY} L ${currentX} ${bottomY} `;
          else if (['x','z','=','2','3','4','5','p','n'].includes(prevEffectiveChar) && (charToRender === '1' || charToRender === 'h' || charToRender === 'H' || charToRender === 'P')) pathD += `M ${currentX} ${midY} L ${currentX} ${topY} `;
          else if (['x','z','=','2','3','4','5','p','n'].includes(prevEffectiveChar) && (charToRender === '0' || charToRender === 'l' || charToRender === 'L' || charToRender === 'N')) pathD += `M ${currentX} ${midY} L ${currentX} ${bottomY} `;
          else if ((prevEffectiveChar === '1' || prevEffectiveChar === 'h' || prevEffectiveChar === 'H' || prevEffectiveChar === 'P') && ['x','z','=','2','3','4','5','p','n', ''].includes(charToRender)) pathD += `M ${currentX} ${topY} L ${currentX} ${midY} `; // Allow transition to mid for empty
          else if ((prevEffectiveChar === '0' || prevEffectiveChar === 'l' || prevEffectiveChar === 'L' || prevEffectiveChar === 'N') && ['x','z','=','2','3','4','5','p','n', ''].includes(charToRender)) pathD += `M ${currentX} ${bottomY} L ${currentX} ${midY} `; // Allow transition to mid for empty
      }
  
      const startPathX = currentX;
      const endPathX = currentX + cycleW;
  
      switch (charToRender) {
        case '0': pathD += `M ${startPathX} ${bottomY} H ${endPathX}`; cssClass = 'wave-low'; type = 'low'; break;
        case '1': pathD += `M ${startPathX} ${topY} H ${endPathX}`; cssClass = 'wave-high'; type = 'high'; break;
        case 'x':
          const padX = cycleW * 0.1;
          pathD += `M ${startPathX + padX} ${topY + padX*0.5} L ${endPathX - padX} ${bottomY - padX*0.5} ` +
                   `M ${startPathX + padX} ${bottomY - padX*0.5} L ${endPathX - padX} ${topY + padX*0.5}`;
          cssClass = 'wave-x'; type = 'x'; break;
        case 'z': pathD += `M ${startPathX} ${midY} H ${endPathX}`; cssClass = 'wave-z'; type = 'z'; break;
        case '=': case '2': case '3': case '4': case '5':
          pathD += `M ${startPathX} ${midY} H ${endPathX}`; cssClass = 'wave-data-line'; type = 'data'; break;
        case 'p': pathD += `M ${startPathX} ${midY} L ${startPathX} ${topY} L ${startPathX + cycleW/2} ${topY} L ${startPathX + cycleW/2} ${bottomY} L ${endPathX} ${bottomY} L ${endPathX} ${midY}`; cssClass = 'wave-clock wave-pclk'; type = 'clk'; break;
        case 'P': pathD += `M ${startPathX} ${topY} L ${startPathX + cycleW/2} ${topY} L ${startPathX + cycleW/2} ${bottomY} L ${endPathX} ${bottomY}`; cssClass = 'wave-clock wave-Pclk'; type = 'clk'; break;
        case 'n': pathD += `M ${startPathX} ${midY} L ${startPathX} ${bottomY} L ${startPathX + cycleW/2} ${bottomY} L ${startPathX + cycleW/2} ${topY} L ${endPathX} ${topY} L ${endPathX} ${midY}`; cssClass = 'wave-clock wave-nclk'; type = 'clk'; break;
        case 'N': pathD += `M ${startPathX} ${bottomY} L ${startPathX + cycleW/2} ${bottomY} L ${startPathX + cycleW/2} ${topY} L ${endPathX} ${topY}`; cssClass = 'wave-clock wave-Nclk'; type = 'clk'; break;
        case 'h': pathD += `M ${startPathX} ${topY} H ${endPathX}`; cssClass = 'wave-high wave-clock'; type = 'clk'; break;
        case 'l': pathD += `M ${startPathX} ${bottomY} H ${endPathX}`; cssClass = 'wave-low wave-clock'; type = 'clk'; break;
        case 'H': pathD += `M ${startPathX} ${topY} H ${endPathX}`; cssClass = 'wave-high wave-clock'; type = 'clk'; break;
        case 'L': pathD += `M ${startPathX} ${bottomY} H ${endPathX}`; cssClass = 'wave-low wave-clock'; type = 'clk'; break;
        case '|':
          pathD = `M ${startPathX + cycleW*0.48} ${laneY + laneH*0.2} L ${startPathX + cycleW*0.48} ${laneY + laneH*0.8} ` +
                  `M ${startPathX + cycleW*0.52} ${laneY + laneH*0.2} L ${startPathX + cycleW*0.52} ${laneY + laneH*0.8}`;
          cssClass = 'wave-gap'; type = 'gap'; break;
        case '': // Empty cycle (beyond wave string length)
          pathD = `M ${startPathX} ${midY} H ${endPathX}`; // Draw a faint mid-line for empty draggable space
          cssClass = 'wave-empty-interactive'; type = 'empty'; break;
        default: // Unknown character
          pathD = `M ${startPathX} ${midY} L ${endPathX} ${midY}`; cssClass = 'wave-unknown'; type = 'unknown'; break;
      }
      return { pathD, cssClass, type };
    }
  
    $: {
      const newCycles: RenderedCycle[] = [];
      const waveChars = signal.wave.split('');
      let dataIndex = 0;
      const dataArray = Array.isArray(signal.data) ? signal.data : (typeof signal.data === 'string' ? signal.data.split(/\s+/) : []);
      let effectivePrevChar: string | null = null;
  
      for (let i = 0; i < maxCycles; i++) {
        const currentX = nameWidth + i * cycleWidth;
        const originalChar = i < waveChars.length ? waveChars[i] : '';
        let effectiveChar = originalChar;
  
        if (originalChar === '.') {
          effectiveChar = effectivePrevChar || ''; // Use last known state, or empty if unknown
        }
        
        const visuals = getCycleVisuals(effectiveChar, originalChar, effectivePrevChar, currentX, y, cycleWidth, laneHeight);
        
        const isCycleInteractive = (effectiveChar === '0' || effectiveChar === '1' || effectiveChar === '');
        
        const cycleElement: RenderedCycle = {
          type: visuals.type,
          char: originalChar,
          effectiveChar: effectiveChar,
          x: currentX,
          pathD: visuals.pathD,
          cssClass: visuals.cssClass,
          isInteractive: isCycleInteractive,
          cycleIndex: i,
        };
  
        if (['=', '2', '3', '4', '5'].includes(effectiveChar)) {
          cycleElement.rectX = currentX;
          cycleElement.rectY = y + laneHeight * 0.1;
          cycleElement.rectWidth = cycleWidth;
          cycleElement.rectHeight = laneHeight * 0.8;
          if (['=', '2', '3', '4', '5'].includes(originalChar)) { // Only take data if original char is data type
              cycleElement.text = dataArray[dataIndex] || '';
              dataIndex++;
          } else if (originalChar === '.' && ['=', '2', '3', '4', '5'].includes(effectivePrevChar || '')) {
              // Find what data this dot extends
              let k = i - 1, dataValIdx = -1;
              while(k >= 0) {
                  if (['=', '2', '3', '4', '5'].includes(waveChars[k])) { dataValIdx = k; break; }
                  if (waveChars[k] !== '.') break; // Stop if not a dot or data char
                  k--;
              }
              if(dataValIdx !== -1) {
                  let count = 0;
                  for(let c=0; c<=dataValIdx; c++) if(['=', '2', '3', '4', '5'].includes(waveChars[c])) count++;
                  cycleElement.text = dataArray[count-1] || '';
              } else {
                  cycleElement.text = '...'; // Fallback for dot extending data
              }
          }
          cycleElement.textX = currentX + cycleWidth / 2;
          cycleElement.textY = y + laneHeight / 2;
          cycleElement.cssClass = `${visuals.cssClass} wave-data-box`;
        }
        newCycles.push(cycleElement);
  
        if (originalChar !== '.') {
          effectivePrevChar = originalChar; // This becomes the new prev for next cycle
        }
        // If originalChar is '.', effectivePrevChar remains what it was from the char that '.' is extending
      }
      renderedCycles = newCycles;
    }
  
    function handleMouseDown(event: MouseEvent, cycle: RenderedCycle) {
      if (!cycle.isInteractive) return;
  
      isDragging = true;
      dragStartCycleIndex = cycle.cycleIndex;
      
      // Determine what state to "paint" with
      if (cycle.effectiveChar === '0') dragPaintChar = '1';
      else if (cycle.effectiveChar === '1') dragPaintChar = '0';
      else dragPaintChar = '1'; // Default to '1' for empty or other interactive states
  
      lastDragAppliedCycle = cycle.cycleIndex;
      updateWaveString(cycle.cycleIndex, dragPaintChar);
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  
    function handleMouseMove(event: MouseEvent) {
      if (!isDragging || dragPaintChar === null) return;
  
      const svgEl = (event.currentTarget as Window).document.querySelector('.signal-lane[data-signal-name="' + signal.name + '"]');
      if (!svgEl) return;
      const svgRect = svgEl.closest('svg')?.getBoundingClientRect();
      if (!svgRect) return;
      
      const mouseXInSvg = event.clientX - svgRect.left;
      const waveStartX = nameWidth; // Assuming nameWidth is where wave area starts
      if (mouseXInSvg < waveStartX) return;
  
      const currentCycleIndex = Math.floor((mouseXInSvg - waveStartX) / cycleWidth);
  
      if (currentCycleIndex >= 0 && currentCycleIndex < maxCycles && currentCycleIndex !== lastDragAppliedCycle) {
          const start = Math.min(lastDragAppliedCycle, currentCycleIndex);
          const end = Math.max(lastDragAppliedCycle, currentCycleIndex);
  
          for (let i = start; i <= end; i++) {
              if (i === dragStartCycleIndex && lastDragAppliedCycle === dragStartCycleIndex && start === end) continue;
              
              const targetCycle = renderedCycles[i];
              if (targetCycle && targetCycle.isInteractive) {
                   updateWaveString(i, dragPaintChar);
              }
          }
         lastDragAppliedCycle = currentCycleIndex;
      }
    }
  
    function handleMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      dragStartCycleIndex = -1;
      dragPaintChar = null;
      lastDragAppliedCycle = -1;
      
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
  
      dispatch('wavestringchange', { signalIndex, newWaveString: signal.wave });
    }
  
    function updateWaveString(cycleIdx: number, newChar: string) {
      let waveChars = signal.wave.split('');
      let currentLength = waveChars.length;
  
      // Pad if necessary
      if (cycleIdx >= currentLength) {
          let padChar = '.';
          if (currentLength > 0 && waveChars[currentLength-1] !== '.') {
              padChar = waveChars[currentLength-1]; // Extend with the last non-dot character
          }
          for (let i = currentLength; i < cycleIdx; i++) {
              waveChars.push(padChar);
          }
      }
      
      if (waveChars[cycleIdx] !== newChar) {
          waveChars[cycleIdx] = newChar;
          signal.wave = waveChars.join(''); 
          dispatch('waveformchange', { signalIndex, cycleIndex: cycleIdx, newChar });
      } else if (cycleIdx >= currentLength && newChar === (waveChars[cycleIdx-1] || '.')) {
          // If we are setting a new char at the end that is same as previous (like extending),
          // ensure wave string is actually updated if it was shorter.
          signal.wave = waveChars.join('');
           // No dispatch for waveformchange as the effective state might not have changed,
           // but wavestringchange on mouseup will send the final string.
      }
    }
  
    const textY = y + laneHeight / 2;
  </script>
  
    <g class="signal-lane" data-signal-name={signal.name} on:mouseup={handleMouseUp} role="button" tabindex="0" aria-label="Signal lane for {signal.name}">
    <text x="5" y="{textY}" class="signal-name">{signal.name}</text>

    {#each renderedCycles as cycle (cycle.cycleIndex)}
      {#if cycle.isInteractive}
        <rect
          class="interaction-rect"
          x={cycle.x}
          y={y}
          width={cycleWidth}
          height={laneHeight}
          fill="transparent"
          on:mousedown={(e) => handleMouseDown(e, cycle)}
          style="cursor: pointer;"
          role="button"
          tabindex="0"
          aria-label="Toggle signal state at cycle {cycle.cycleIndex}"
        />
      {/if}
      <path d="{cycle.pathD}" class="wave-segment {cycle.cssClass}" />
      {#if cycle.rectWidth}
        <rect
          x="{cycle.rectX}"
          y="{cycle.rectY}"
          width="{cycle.rectWidth}"
          height="{cycle.rectHeight}"
          class="data-rect {cycle.cssClass.includes('wave-data-box') ? '' : cycle.cssClass}" 
        />
        {#if cycle.text}
        <text
          x="{cycle.textX}"
          y="{cycle.textY}"
          class="data-text"
          dominant-baseline="middle"
          text-anchor="middle"
          font-size="{Math.min(10 * hscale, cycleWidth / (cycle.text.length || 1) * 1.5, laneHeight * 0.5)}"
        >
          {cycle.text}
        </text>
        {/if}
      {/if}
    {/each}
  </g>
  
  <style>
    .signal-name {
      fill: #222;
      font-family: inherit;
      user-select: none;
    }
    .wave-segment {
      stroke-width: 1.75; 
      fill: none;
      stroke-linecap: butt; 
      stroke-linejoin: bevel; 
      pointer-events: none; 
    }
    .wave-low { stroke: #0000FF; }
    .wave-high { stroke: #0000FF; }
    .wave-x { stroke: #FF0000; } 
    .wave-z { stroke: #FFA500; } 
    .wave-data-line { stroke: #808080; } /* Renamed from wave-data for clarity */
    .wave-clock { stroke: #008000; } 
    .wave-gap {
      stroke: #BBB;
      stroke-dasharray: 2, 2;
      stroke-width: 1;
    }
    .wave-unknown { stroke: #CCC; }
    .wave-empty-interactive { /* For empty but draggable slots */
      stroke: #DDD; /* Faint line to show draggable area */
      stroke-dasharray: 1, 3;
    }
    .wave-empty { stroke: none; } /* For non-interactive empty (if any) */
  
  
    .data-rect {
      fill: #f0f0f8; 
      stroke: #555;
      stroke-width: 0.5;
      pointer-events: none;
    }
    .data-text {
      fill: #111;
      font-family: inherit;
      pointer-events: none;
      user-select: none;
    }
    .interaction-rect:hover {
      fill: rgba(0,0,0,0.05); /* Visual feedback on hover */
    }
  </style>
  