// wavedrom-editor/src/lib/wavejson-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateWaveJsonString } from './wavejson-generator';
import { parseWaveJson } from './wavejson-parser'; // To verify output
import type { WaveJson, WaveSignal, WaveGroup } from './wavejson-types';

describe('generateWaveJsonString', () => {
  it('should generate a JSON string from a minimal WaveJson object (pretty print)', () => {
    const waveJsonObj: WaveJson = {
      signal: [{ name: 'beta', wave: '10.x' }]
    };
    const result = generateWaveJsonString(waveJsonObj, true);
    expect(result.success).toBe(true);
    expect(result.jsonString).toBeDefined();

    // Check pretty printing (indentation)
    expect(result.jsonString).toContain('\n  '); // Example of expecting indentation
    expect(result.jsonString).toContain('"name": "beta"');

    // Verify by parsing back
    const parsedResult = parseWaveJson(result.jsonString!);
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data).toEqual(waveJsonObj);
  });

  it('should generate a compact JSON string when prettyPrint is false', () => {
    const waveJsonObj: WaveJson = {
      signal: [{ name: 'gamma', wave: '0.1' }]
    };
    const result = generateWaveJsonString(waveJsonObj, false);
    expect(result.success).toBe(true);
    expect(result.jsonString).toBeDefined();
    // Check no newlines/extra spaces for compact output
    expect(result.jsonString).not.toContain('\n');
    expect(result.jsonString).not.toContain('  ');
    expect(result.jsonString).toBe('{"signal":[{"name":"gamma","wave":"0.1"}]}');

    const parsedResult = parseWaveJson(result.jsonString!);
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data).toEqual(waveJsonObj);
  });

  it('should correctly stringify complex objects with groups, config, head, foot', () => {
    const waveJsonObj: WaveJson = {
      signal: [
        { name: 'clk', wave: 'pP' },
        ['MyGroup', 
          { name: 'data', wave: 'x.==.x', data: ['A', 'B'] },
          { name: 'req', wave: '010' }
        ],
        {} // spacer
      ],
      config: { hscale: 3, skin: 'default', head: { text: 'Diagram Title', tick: 0 } },
      foot: { text: 'Footer notes', tock: 5, every: 2 },
      edge: ['data@1 -> req@2 edge text']
    };
    const result = generateWaveJsonString(waveJsonObj, true);
    expect(result.success).toBe(true);
    expect(result.jsonString).toBeDefined();

    const parsedResult = parseWaveJson(result.jsonString!);
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data).toEqual(waveJsonObj); // Main check
  });

  it('should return error if input is not a valid object', () => {
    // @ts-expect-error testing invalid input
    const result = generateWaveJsonString(null, true);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input: not a valid WaveJson object.');
  });

  it('should return error if "signal" property is missing', () => {
    const waveJsonObj = { config: { hscale: 1 } } as unknown as WaveJson; // Cast to test
    const result = generateWaveJsonString(waveJsonObj, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain("'signal' property must be an array and exist.");
  });

  it('should return error if "signal" property is not an array', () => {
    const waveJsonObj = { signal: { name: 'a', wave: '0' } } as unknown as WaveJson;
    const result = generateWaveJsonString(waveJsonObj, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain("'signal' property must be an array and exist.");
  });
  
  it('should handle empty signal array', () => {
    const waveJsonObj: WaveJson = { signal: [] };
    const result = generateWaveJsonString(waveJsonObj, false);
    expect(result.success).toBe(true);
    expect(result.jsonString).toBe('{"signal":[]}');
    const parsedResult = parseWaveJson(result.jsonString!);
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data).toEqual(waveJsonObj);
  });

  // Test for any custom serialization logic if a replacer were used.
  // For now, default JSON.stringify behavior is tested.
});
