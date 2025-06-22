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
 * This initial version performs basic JSON parsing.
 * For robust validation against the WaveJson types, a schema validation
 * library (e.g., Zod, io-ts, Ajv) or manual type guards would be beneficial
 * for production use.
 *
 * @param jsonString The WaveJSON string to parse.
 * @returns A ParseResult object containing the parsed data or an error message.
 */
export function parseWaveJson(jsonString: string): ParseResult {
  if (!jsonString || jsonString.trim() === '') {
    return { success: false, error: 'Input string is empty or only whitespace.' };
  }

  try {
    const parsedObject = JSON.parse(jsonString);

    // Basic structural check: 'signal' array must exist.
    if (!parsedObject || typeof parsedObject !== 'object' || !Array.isArray(parsedObject.signal)) {
      return {
        success: false,
        error: "Invalid WaveJSON structure: 'signal' property must be an array and exist at the root.",
      };
    }
    
    // At this point, we assume the object largely conforms to WaveJson.
    // More detailed validation could be added here or by using a schema validator.
    // For example, checking types of 'name' and 'wave' in signal objects.

    return { success: true, data: parsedObject as WaveJson };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { success: false, error: `JSON syntax error: ${e.message}` };
    }
    return { success: false, error: `An unexpected error occurred during parsing: ${(e as Error).message}` };
  }
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
