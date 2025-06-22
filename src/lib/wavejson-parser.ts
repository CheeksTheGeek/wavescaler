// wavedrom-editor/src/lib/wavejson-parser.ts

import type { WaveJson } from './wavejson-types';

/**
 * Represents the result of a parsing operation.
 * It can either be a success with the parsed WaveJson data,
 * or an error with an error message.
 */
export interface ParseResult {
  success: boolean;
  data?: WaveJson;
  error?: string;
}

/**
 * Parses a WaveJSON string into a WaveJson object.
 *
 * This version handles both strict JSON and the more flexible WaveDrom format
 * which may have unquoted keys and JavaScript-style object literals.
 *
 * @param jsonString The WaveJSON string to parse.
 * @returns A ParseResult object containing the parsed data or an error message.
 */
export function parseWaveJson(jsonString: string): ParseResult {
  if (!jsonString || jsonString.trim() === '') {
    return { success: false, error: 'Input string is empty or only whitespace.' };
  }

  try {
    let normalizedJson = jsonString.trim();
    
    // Handle JavaScript-style object literal (common in WaveDrom examples)
    if (!normalizedJson.startsWith('{') && !normalizedJson.startsWith('[')) {
      // If it doesn't start with { or [, try wrapping it
      normalizedJson = `{${normalizedJson}}`;
    }
    
    // Try to normalize JavaScript-style syntax to proper JSON
    normalizedJson = normalizeToJson(normalizedJson);
    
    const parsedObject = JSON.parse(normalizedJson);

    // Basic structural check: 'signal' array must exist.
    if (!parsedObject || typeof parsedObject !== 'object' || !Array.isArray(parsedObject.signal)) {
      return {
        success: false,
        error: "Invalid WaveJSON structure: 'signal' property must be an array and exist at the root.",
      };
    }
    
    // Validate basic signal structure
    for (let i = 0; i < parsedObject.signal.length; i++) {
      const item = parsedObject.signal[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        // It's a signal object
        if (Object.keys(item).length > 0 && (!item.name || !item.wave)) {
          console.warn(`Signal at index ${i} missing required 'name' or 'wave' property`);
        }
      }
    }

    return { success: true, data: parsedObject as WaveJson };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { success: false, error: `JSON syntax error: ${e.message}` };
    }
    return { success: false, error: `An unexpected error occurred during parsing: ${(e as Error).message}` };
  }
}

/**
 * Normalize JavaScript-style object literals to proper JSON
 */
function normalizeToJson(str: string): string {
  // Remove JavaScript comments
  str = str.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Add quotes to unquoted keys
  str = str.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  
  // Handle single quotes to double quotes
  str = str.replace(/'/g, '"');
  
  // Handle trailing commas
  str = str.replace(/,(\s*[}\]])/g, '$1');
  
  return str;
}

/**
 * Example of a more detailed (but still manual) validator for a signal object.
 * This is not used in the main parseWaveJson function for brevity but demonstrates
 * how one might start adding more specific checks.
 */
// import type { WaveSignal, SignalItem, WaveGroup, WaveSpacer } from './wavejson-types';

// function isValidWaveSignal(obj: any): obj is WaveSignal {
//   return typeof obj === 'object' && obj !== null &&
//          typeof obj.name === 'string' &&
//          typeof obj.wave === 'string';
// }

// function isValidSignalItem(item: any): item is SignalItem {
//   if (typeof item !== 'object' || item === null) return false;
//   // Check for spacer (empty object)
//   if (Object.keys(item).length === 0) return true;
//   // Check for WaveSignal
//   if (isValidWaveSignal(item)) return true;
//   // Check for WaveGroup (basic check)
//   if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
//     // Further checks for group elements could be added here
//     return true;
//   }
//   return false;
// }

// You could then iterate through parsedObject.signal and validate each item
// if (Array.isArray(parsedObject.signal)) {
//   for (const item of parsedObject.signal) {
//     if (!isValidSignalItem(item)) {
//       // Handle invalid item
//     }
//   }
// }
