// wavedrom-editor/src/lib/wavejson-types.ts

/**
 * Represents an individual signal lane in WaveJSON.
 */
export interface WaveSignal {
    name: string;
    wave: string;
    data?: string | string[];
    period?: number;
    phase?: number;
    node?: string;
    // Allow any other properties that might be used by skins or future extensions
    [key: string]: unknown;
  }
  
  /**
   * Represents an empty object used as a spacer in the signal array.
   */
  export type WaveSpacer = Record<string, never>;
  
  /**
   * Represents a group of signals. The first element is the group name,
   * followed by signal items (WaveSignal, nested WaveGroup, or WaveSpacer).
   * Example: ['Group Name', { name: 'sig1', wave: '010' }, ['Nested Group', ...]]
   */
  export type WaveGroup = [string, ...SignalItem[]];
  
  /**
   * Represents an item in the 'signal' array. It can be a signal, a group, or a spacer.
   * Using 'any' for WaveGroup temporarily to break circular dependency during definition.
   * Will be replaced by `Array<string | SignalItem>` effectively.
   */
  export type SignalItem = WaveSignal | WaveGroup | WaveSpacer;
  
  
  /**
   * JsonML is a JSON representation of XML.
   * It can be a simple string, or an array structure:
   * [tagName, attributes?, child1, child2, ...]
   * Children can also be strings or JsonML arrays.
   */
  export type JsonMlPrimitive = string | number | boolean | null;
  export interface JsonMlAttributes {
    [key: string]: JsonMlPrimitive | undefined;
  }
  
  export interface JsonMlElementBase {
    0: string; // tag name
    1?: JsonMlAttributes | JsonMl;
    [index: number]: JsonMl | JsonMlAttributes | undefined;
  }
  
  export type JsonMlElement = JsonMlElementBase & Array<string | JsonMlAttributes | JsonMl>;
  export type JsonMl = string | JsonMlElement;
  
  
  /**
   * Represents the 'head' or 'foot' section of a WaveDrom diagram.
   */
  export interface WaveTextSection {
    text?: JsonMl;
    tick?: number;
    tock?: number;
    every?: number;
    // Allow any other properties
    [key: string]: unknown;
  }
  
  /**
   * Represents the 'config' object in WaveJSON.
   */
  export interface WaveConfig {
    hscale?: number;
    skin?: string;
    head?: WaveTextSection;
    foot?: WaveTextSection;
    // Common but not in basic tutorial, good to have
    hspace?: number;
    vscale?: number;
    // Allow any other properties
    [key: string]: unknown;
  }
  
  /**
   * Represents an edge/arrow definition string.
   * Example: 'a~b text'
   */
  export type WaveEdge = string;
  
  /**
   * The root WaveJSON object structure.
   */
  export interface WaveJson {
    signal: SignalItem[];
    head?: WaveTextSection; // Potentially legacy, prefer config.head
    foot?: WaveTextSection; // Potentially legacy, prefer config.foot
    config?: WaveConfig;
    edge?: WaveEdge[];
    // Allow any other top-level properties
    [key: string]: unknown;
  }
  
  // Re-declare WaveGroup with the fully defined SignalItem to satisfy circularity for practical use,
  // though TypeScript's structural typing usually handles this fine.
  // For clarity, the definition above is what's primarily used by the type checker.
  // export type ExplicitWaveGroup = [string, ...(WaveSignal | ExplicitWaveGroup | WaveSpacer)[]];
  // export type ExplicitSignalItem = WaveSignal | ExplicitWaveGroup | WaveSpacer;
  // export interface ExplicitWaveJson {
  //   signal: ExplicitSignalItem[];
  //   head?: WaveTextSection;
  //   foot?: WaveTextSection;
  //   config?: WaveConfig;
  //   edge?: WaveEdge[];
  //   [key: string]: any;
  // }
  
  // Note: The type system should handle the recursive nature of WaveGroup and SignalItem.
  // The `[key: string]: unknown;` is added to interfaces to allow for extensibility
  // as WaveDrom skins or users might add custom properties.
  // For stricter parsing, these could be removed or made more specific if all properties are known.
  