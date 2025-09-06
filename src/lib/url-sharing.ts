import type { WaveJson } from './wavejson-types';

/**
 * Convert a WaveJson object to a JavaScript-style string (as used by WaveDrom)
 * This creates a more compact representation than strict JSON
 */
function waveJsonToJsString(waveJson: WaveJson): string {
  const jsString = JSON.stringify(waveJson, null, 0)
    // Convert strict JSON to JavaScript-style object notation
    .replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1:')  // Remove quotes from property names
    .replace(/"/g, "'");  // Convert double quotes to single quotes
  
  return jsString;
}

/**
 * Convert a JavaScript-style string back to WaveJson
 */
function jsStringToWaveJson(jsString: string): WaveJson {
  // Convert JavaScript-style object notation back to strict JSON
  const jsonString = jsString
    .replace(/'/g, '"')  // Convert single quotes to double quotes
    .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":');  // Add quotes to property names
  
  return JSON.parse(jsonString);
}

/**
 * Create a shareable URL with the WaveJSON data encoded in the URL parameter
 */
export function createShareableUrl(waveJson: WaveJson): string {
  const jsString = waveJsonToJsString(waveJson);
  const encodedData = encodeURIComponent(jsString);
  
  // Get the current URL without search parameters
  const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
  
  return `${baseUrl}?waveform=${encodedData}`;
}

/**
 * Extract WaveJSON data from URL parameters
 */
export function loadWaveJsonFromUrl(): WaveJson | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  const waveformData = urlParams.get('waveform');
  
  if (!waveformData) return null;
  
  try {
    const decodedData = decodeURIComponent(waveformData);
    return jsStringToWaveJson(decodedData);
  } catch (error) {
    console.error('Failed to parse waveform data from URL:', error);
    return null;
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Update the browser URL without reloading the page
 */
export function updateUrlWithWaveJson(waveJson: WaveJson): void {
  const shareableUrl = createShareableUrl(waveJson);
  const url = new URL(shareableUrl);
  
  // Update the URL in the address bar without reloading
  window.history.replaceState(null, '', url.search);
}

/**
 * Clear the waveform parameter from the URL
 */
export function clearUrlWaveform(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('waveform');
  window.history.replaceState(null, '', url.search ? url.search : window.location.pathname);
}
