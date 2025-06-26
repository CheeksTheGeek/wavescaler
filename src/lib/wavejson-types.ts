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
  
  // Tree path utilities for robust drag-and-drop
export interface TreePath {
  path: number[]; // Array of indices representing the path to an item
  type: 'signal' | 'group' | 'spacer';
}

export interface DragDropContext {
  item: SignalItem;
  sourcePath: TreePath;
  targetPath: TreePath;
  insertPosition: 'before' | 'after' | 'inside'; // 'inside' only valid for groups
}

// Helper function to perform tree operations on WaveJSON structure
export class WaveTreeManager {
  static getItemAtPath(signal: SignalItem[], path: number[]): SignalItem | null {
    let current: SignalItem[] = signal;
    
    for (let i = 0; i < path.length; i++) {
      const index = path[i];
      
      if (index >= current.length) return null;
      
      const item = current[index];
      
      // If this is the last index in the path, return the item
      if (i === path.length - 1) {
        return item;
      }
      
      // Otherwise, the item must be a group to continue
      if (!Array.isArray(item)) return null;
      
      // Move to the group's children (skip the group name)
      current = item.slice(1) as SignalItem[];
    }
    
    return null;
  }

  static moveItem(signal: SignalItem[], sourcePath: number[], targetPath: number[], position: 'before' | 'after' | 'inside'): SignalItem[] {
    // Don't move if source and target are the same
    if (JSON.stringify(sourcePath) === JSON.stringify(targetPath)) {
      return signal;
    }
    
    // First, get the item to move
    const itemToMove = this.getItemAtPath(signal, sourcePath);
    if (!itemToMove) return signal;
    
    // Create a deep clone to work with
    const result = structuredClone(signal);
    
    // Remove the item from its current location
    this.removeItemAtPathMutable(result, sourcePath);
    
    // Adjust target path if necessary (if source was before target at same level)
    const adjustedTargetPath = this.adjustPathAfterRemoval(targetPath, sourcePath);
    
    // Insert the item at the new location
    this.insertItemAtPathMutable(result, adjustedTargetPath, itemToMove, position);
    
    return result;
  }

  private static adjustPathAfterRemoval(targetPath: number[], removedPath: number[]): number[] {
    // If the removed item was before the target at the same level, adjust the target index
    if (removedPath.length === targetPath.length) {
      // Same level - check if same parent path
      let sameParent = true;
      for (let i = 0; i < removedPath.length - 1; i++) {
        if (removedPath[i] !== targetPath[i]) {
          sameParent = false;
          break;
        }
      }
      
      if (sameParent && removedPath[removedPath.length - 1] < targetPath[targetPath.length - 1]) {
        const adjustedPath = [...targetPath];
        adjustedPath[adjustedPath.length - 1]--;
        return adjustedPath;
      }
    }
    
    return targetPath;
  }

  private static removeItemAtPathMutable(signal: SignalItem[], path: number[]): void {
    if (path.length === 1) {
      signal.splice(path[0], 1);
      return;
    }
    
    // Navigate to the parent container
    let current: SignalItem[] = signal;
    
    for (let i = 0; i < path.length - 1; i++) {
      const index = path[i];
      const item = current[index];
      
      if (Array.isArray(item)) {
        // This is a group
        const group = item as WaveGroup;
        
        if (i === path.length - 2) {
          // This is the direct parent of the item to remove
          // Remove from group children (offset by 1 for group name)
          group.splice(path[path.length - 1] + 1, 1);
          return;
        } else {
          // Continue navigation - move to group children
          current = group.slice(1) as SignalItem[];
        }
      }
    }
    
    // Remove the final item (this handles non-group containers)
    current.splice(path[path.length - 1], 1);
  }

  private static insertItemAtPathMutable(signal: SignalItem[], path: number[], item: SignalItem, position: 'before' | 'after' | 'inside'): void {
    if (path.length === 0) {
      // Insert at root level
      if (position === 'before') {
        signal.unshift(item);
      } else {
        signal.push(item);
      }
      return;
    }
    
    if (path.length === 1) {
      // Insert at root level with specific position
      const index = path[0];
      if (position === 'inside') {
        // Can only insert inside groups
        const targetItem = signal[index];
        if (Array.isArray(targetItem)) {
          (targetItem as WaveGroup).push(item);
        }
      } else if (position === 'before') {
        signal.splice(index, 0, item);
      } else { // after
        signal.splice(index + 1, 0, item);
      }
      return;
    }
    
    // Navigate to the parent container
    let current: SignalItem[] = signal;
    
    for (let i = 0; i < path.length - 1; i++) {
      const index = path[i];
      const targetItem = current[index];
      
      if (Array.isArray(targetItem)) {
        const group = targetItem as WaveGroup;
        
        // For the final step, handle group insertion specially
        if (i === path.length - 2) {
          const finalIndex = path[path.length - 1];
          if (position === 'inside') {
            // Insert inside the target group at finalIndex
            const targetGroup = group[finalIndex + 1]; // +1 to skip group name
            if (Array.isArray(targetGroup)) {
              (targetGroup as WaveGroup).push(item);
            }
          } else if (position === 'before') {
            group.splice(finalIndex + 1, 0, item); // +1 to skip group name
          } else { // after
            group.splice(finalIndex + 2, 0, item); // +2 to skip group name and target item
          }
          return;
        } else {
          // Continue navigation - move to group children
          current = group.slice(1) as SignalItem[];
        }
      }
    }
    
    // Handle final insertion for non-group containers
    const finalIndex = path[path.length - 1];
    if (position === 'inside') {
      // Insert inside the target (which must be a group)
      const targetItem = current[finalIndex];
      if (Array.isArray(targetItem)) {
        (targetItem as WaveGroup).push(item);
      }
    } else if (position === 'before') {
      current.splice(finalIndex, 0, item);
    } else { // after
      current.splice(finalIndex + 1, 0, item);
    }
  }
}
  