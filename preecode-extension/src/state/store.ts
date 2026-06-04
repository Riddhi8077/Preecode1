import { EventEmitter } from 'node:events';
import { initialPreecodeState, PreecodeState } from './types';

type StoreListener = (state: PreecodeState) => void;

class PreecodeStore {
  private static instance: PreecodeStore;
  private readonly events = new EventEmitter();
  private state: PreecodeState = structuredClone(initialPreecodeState);

  private constructor() {
    this.events.setMaxListeners(100);
  }

  static getInstance(): PreecodeStore {
    if (!PreecodeStore.instance) {
      PreecodeStore.instance = new PreecodeStore();
    }
    return PreecodeStore.instance;
  }

  getState(): PreecodeState {
    return this.state;
  }

  setState(updater: Partial<PreecodeState> | ((state: PreecodeState) => PreecodeState)): PreecodeState {
    this.state = typeof updater === 'function'
      ? updater(this.state)
      : { ...this.state, ...updater };
    this.events.emit('change', this.state);
    return this.state;
  }

  update<K extends keyof PreecodeState>(key: K, value: PreecodeState[K]): PreecodeState {
    this.state = { ...this.state, [key]: value };
    this.events.emit('change', this.state);
    return this.state;
  }

  subscribe(listener: StoreListener): () => void {
    this.events.on('change', listener);
    listener(this.state);
    return () => {
      this.events.off('change', listener);
    };
  }
}

export const preecodeStore = PreecodeStore.getInstance();
