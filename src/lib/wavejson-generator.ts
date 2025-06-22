// wavedrom-editor/src/lib/wavejson-generator.ts
import type { WaveJson } from './wavejson-types';

/**
 * Represents the result of a generation operation.
 */
export interface GenerateResult {
  success: boolean;
  jsonString?: string;
  error?: string;
}

/**
 * Generates a WaveJSON string from a WaveJson object.
 *
 * @param waveJsonObject The WaveJson object to stringify.
 * @param prettyPrint Whether to format the output JSON string with indentation. Defaults to true.
 * @returns A GenerateResult object containing the JSON string or an error message.
 */
export function generateWaveJsonString(waveJsonObject: WaveJson, prettyPrint: boolean = true): GenerateResult {
  if (!waveJsonObject || typeof waveJsonObject !== 'object') {
    return { success: false, error: 'Invalid input: not a valid WaveJson object.' };
  }

  // Basic validation: ensure 'signal' array exists, as it's mandatory.
  // This check helps catch fundamentally malformed inputs before stringifying.
  if (!waveJsonObject.signal || !Array.isArray(waveJsonObject.signal)) {
    return {
      success: false,
      error: "Invalid WaveJson object structure: 'signal' property must be an array and exist.",
    };
  }

  // One could add more structural validations here if needed, e.g.,
  // checking if signal items have 'name' and 'wave' if they are WaveSignal objects, etc.
  // However, if the WaveJson object is correctly typed and managed by the application,
  // such deep validation might be redundant at the generation stage.

  try {
    // The replacer function can be used to customize the serialization process.
    // For example, to remove temporary internal properties or to ensure specific formatting
    // for certain data types if necessary. For now, a null replacer is used, meaning
    // default serialization behavior for all properties.
    const replacer = null; // No custom replacer for now.

    const jsonString = JSON.stringify(waveJsonObject, replacer, prettyPrint ? 2 : undefined);
    return { success: true, jsonString: jsonString };
  } catch (e) {
    // Catching potential errors during stringification.
    // TypeError can occur with circular references, though our WaveJson types are not inherently circular
    // in a way that typically trips up JSON.stringify unless objects are manually mishandled.
    if (e instanceof TypeError) {
      return { success: false, error: `JSON stringify error (possibly circular structure or invalid value): ${e.message}` };
    }
    // Catch any other unexpected errors.
    return { success: false, error: `An unexpected error occurred during JSON generation: ${(e as Error).message}` };
  }
}

/**
 * Example of a replacer function that could be used with JSON.stringify.
 * This is not currently used in generateWaveJsonString but serves as an illustration.
 *
 * function customReplacer(key: string, value: any): any {
 *   // Example: Skip any properties that are functions (JSON.stringify does this by default for root properties)
 *   if (typeof value === 'function') {
 *     return undefined;
 *   }
 *   // Example: Ensure all undefined array elements become null (JSON.stringify does this for arrays)
 *   // if (Array.isArray(value)) {
 *   //   return value.map(item => item === undefined ? null : item);
 *   // }
 *
 *   // Example: Remove any property starting with an underscore (convention for private/internal)
 *   if (typeof key === 'string' && key.startsWith('_')) {
 *     return undefined;
 *   }
 *   return value;
 * }
 *
 * To use it:
 * const jsonString = JSON.stringify(waveJsonObject, customReplacer, prettyPrint ? 2 : undefined);
 */
