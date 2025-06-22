// wavescaler/src/lib/wavejson-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseWaveJson } from './wavejson-parser';
import type { WaveSignal, WaveGroup } from './wavejson-types';

describe('parseWaveJson', () => {
  it('should parse a minimal valid WaveJSON string', () => {
    const jsonString = '{ "signal": [{ "name": "alfa", "wave": "01." }] }';
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.signal).toHaveLength(1);
    const signal = result.data?.signal[0] as WaveSignal;
    expect(signal.name).toBe('alfa');
    expect(signal.wave).toBe('01.');
    expect(result.error).toBeUndefined();
  });

  it('should parse a WaveJSON string with multiple signals and data', () => {
    const jsonString = `{
      "signal": [
        { "name": "clk", "wave": "p..." },
        { "name": "bus", "wave": "x.==.=x", "data": ["head", "body", "tail"] }
      ]
    }`;
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(true);
    expect(result.data?.signal).toHaveLength(2);
    const busSignal = result.data?.signal[1] as WaveSignal;
    expect(busSignal.name).toBe('bus');
    expect(busSignal.wave).toBe('x.==.=x');
    expect(busSignal.data).toEqual(['head', 'body', 'tail']);
  });

  it('should parse WaveJSON with groups', () => {
    const jsonString = `{
      "signal": [
        ["Group1", { "name": "sigA", "wave": "01" }]
      ]
    }`;
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(true);
    expect(result.data?.signal).toHaveLength(1);
    const group = result.data?.signal[0] as WaveGroup;
    expect(Array.isArray(group)).toBe(true);
    expect(group[0]).toBe('Group1');
    expect((group[1] as WaveSignal).name).toBe('sigA');
  });

  it('should parse WaveJSON with config, head, and foot', () => {
    const jsonString = `{
      "signal": [{ "name": "a", "wave": "0" }],
      "config": { "hscale": 2, "skin": "narrow" },
      "head": { "text": "Header" },
      "foot": { "tock": 1 }
    }`;
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(true);
    expect(result.data?.config?.hscale).toBe(2);
    expect(result.data?.config?.skin).toBe('narrow');
    expect(result.data?.head?.text).toBe('Header');
    expect(result.data?.foot?.tock).toBe(1);
  });

  it('should return error for invalid JSON syntax', () => {
    const jsonString = '{ "signal": [{ "name": "alfa", "wave": "01." ], }'; // trailing comma
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain('JSON syntax error');
  });

  it('should return error if "signal" property is missing', () => {
    const jsonString = '{ "config": { "hscale": 1 } }';
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(false);
    expect(result.error).toContain("'signal' property must be an array");
  });

  it('should return error if "signal" property is not an array', () => {
    const jsonString = '{ "signal": { "name": "alfa", "wave": "01." } }';
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(false);
    expect(result.error).toContain("'signal' property must be an array");
  });

  it('should return error for empty string input', () => {
    const result = parseWaveJson('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Input string is empty or only whitespace.');
  });
  
  it('should handle WaveJSON with spacers', () => {
    const jsonString = `{ "signal": [ { "name": "a", "wave": "0" }, {}, { "name": "b", "wave": "1" } ] }`;
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(true);
    expect(result.data?.signal).toHaveLength(3);
    expect(result.data?.signal[1]).toEqual({}); // Spacer
  });
  
  it('should handle nested groups', () => {
    const jsonString = `{
      "signal": [
        ["G1",
          { "name": "s1", "wave": "0" },
          ["G2", { "name": "s2", "wave": "1" }]
        ]
      ]
    }`;
    const result = parseWaveJson(jsonString);
    expect(result.success).toBe(true);
    const g1 = result.data?.signal[0] as WaveGroup;
    expect(g1[0]).toBe('G1');
    const s1 = g1[1] as WaveSignal;
    expect(s1.name).toBe('s1');
    const g2 = g1[2] as WaveGroup;
    expect(g2[0]).toBe('G2');
    const s2 = g2[1] as WaveSignal;
    expect(s2.name).toBe('s2');
  });

});
