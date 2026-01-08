// Plugin loader for JS and WASM plugins
import type { AudionPluginManifest } from './schema';
import { PLUGIN_PERMISSIONS } from './schema';

export interface WasmPluginExports {
  init?: () => void;
  start?: () => void;
  stop?: () => void;
  destroy?: () => void;
  memory?: WebAssembly.Memory;
}

export interface LoadedPlugin {
  manifest: AudionPluginManifest;
  instance: WasmPluginExports | any;
  enabled: boolean;
  grantedPermissions: string[];
  loadedAt: number;
}

export interface PluginRuntimeConfig {
  pluginDir: string;
  onError?: (pluginName: string, error: Error) => void;
  onLoad?: (plugin: LoadedPlugin) => void;
}

export class PluginRuntime {
  plugins: Map<string, LoadedPlugin> = new Map();
  private grantedPermissions: Map<string, string[]> = new Map();
  private config: PluginRuntimeConfig;

  constructor(config: PluginRuntimeConfig) {
    this.config = config;
  }

  // Grant permissions for a plugin
  grantPermissions(pluginName: string, permissions: string[]): void {
    const current = this.grantedPermissions.get(pluginName) || [];
    const combined = [...new Set([...current, ...permissions])];
    this.grantedPermissions.set(pluginName, combined);
  }

  // Revoke all permissions for a plugin
  revokePermissions(pluginName: string): void {
    this.grantedPermissions.delete(pluginName);
  }

  // Check if plugin has a specific permission granted
  hasPermission(pluginName: string, permission: string): boolean {
    const granted = this.grantedPermissions.get(pluginName) || [];
    return granted.includes(permission);
  }

  // Load a JS plugin via script tag
  private async loadJsPlugin(manifest: AudionPluginManifest): Promise<LoadedPlugin> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${this.config.pluginDir}/${manifest.name}/${manifest.entry}`;
      script.async = true;
      script.id = `plugin-${manifest.name}`;

      script.onload = () => {
        const instance = (window as any)[manifest.name] || (window as any).AudionPlugin;
        const plugin: LoadedPlugin = {
          manifest,
          instance,
          enabled: true,
          grantedPermissions: this.grantedPermissions.get(manifest.name) || [],
          loadedAt: Date.now()
        };

        // Call init if available
        if (instance?.init) {
          try {
            instance.init(this.getPluginApi(manifest.name));
          } catch (err) {
            this.config.onError?.(manifest.name, err as Error);
          }
        }

        resolve(plugin);
      };

      script.onerror = () => reject(new Error(`Failed to load JS plugin: ${manifest.name}`));
      document.body.appendChild(script);
    });
  }

  // Load a WASM plugin
  private async loadWasmPlugin(manifest: AudionPluginManifest): Promise<LoadedPlugin> {
    const wasmUrl = `${this.config.pluginDir}/${manifest.name}/${manifest.entry}`;

    try {
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText}`);
      }

      const wasmBuffer = await response.arrayBuffer();
      const imports = {
        audion: this.getWasmImports(manifest.name),
        env: this.getWasmEnv()
      };

      const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);
      const exports = instance.exports as WasmPluginExports;

      const plugin: LoadedPlugin = {
        manifest,
        instance: exports,
        enabled: true,
        grantedPermissions: this.grantedPermissions.get(manifest.name) || [],
        loadedAt: Date.now()
      };

      // Call lifecycle hooks
      if (exports.init) {
        exports.init();
      }

      return plugin;
    } catch (err) {
      this.config.onError?.(manifest.name, err as Error);
      throw err;
    }
  }

  // Get WASM imports based on granted permissions
  private getWasmImports(pluginName: string): Record<string, Function> {
    const api: Record<string, Function> = {};

    if (this.hasPermission(pluginName, 'player:control')) {
      api.play = () => this.callHost('player.play');
      api.pause = () => this.callHost('player.pause');
      api.seek = (time: number) => this.callHost('player.seek', time);
      api.next = () => this.callHost('player.next');
      api.prev = () => this.callHost('player.prev');
    }

    if (this.hasPermission(pluginName, 'player:read')) {
      api.getCurrentTime = () => this.callHost('player.getCurrentTime');
      api.getDuration = () => this.callHost('player.getDuration');
      api.isPlaying = () => this.callHost('player.isPlaying');
    }

    if (this.hasPermission(pluginName, 'library:read')) {
      api.getTracks = () => this.callHost('library.getTracks');
      api.getPlaylists = () => this.callHost('library.getPlaylists');
    }

    if (this.hasPermission(pluginName, 'ui:inject')) {
      api.injectUI = (slot: string, html: string) => this.callHost('ui.inject', slot, html);
    }

    if (this.hasPermission(pluginName, 'storage:local')) {
      api.storageGet = (key: string) => this.callHost('storage.get', pluginName, key);
      api.storageSet = (key: string, value: string) => this.callHost('storage.set', pluginName, key, value);
    }

    // Log for ungated functions
    api.log = (ptr: number, len: number) => {
      // For WASM string handling, we'd need memory access
      console.log(`[Plugin:${pluginName}] log called`);
    };

    return api;
  }

  // Minimal WASM env imports
  private getWasmEnv(): Record<string, Function> {
    return {
      abort: () => { throw new Error('WASM aborted'); }
    };
  }

  // Host function call dispatcher (to be implemented with actual APIs)
  private callHost(method: string, ...args: any[]): any {
    // This will be connected to actual Audion APIs
    console.log(`[PluginRuntime] Host call: ${method}`, args);
    return null;
  }

  // Get API surface for JS plugins
  private getPluginApi(pluginName: string): Record<string, any> {
    const api: Record<string, any> = {
      version: '1.0.0',
      pluginName
    };

    if (this.hasPermission(pluginName, 'player:control')) {
      api.player = {
        play: () => this.callHost('player.play'),
        pause: () => this.callHost('player.pause'),
        seek: (time: number) => this.callHost('player.seek', time),
        next: () => this.callHost('player.next'),
        prev: () => this.callHost('player.prev')
      };
    }

    if (this.hasPermission(pluginName, 'player:read')) {
      api.player = {
        ...api.player,
        getCurrentTime: () => this.callHost('player.getCurrentTime'),
        getDuration: () => this.callHost('player.getDuration'),
        isPlaying: () => this.callHost('player.isPlaying'),
        getCurrentTrack: () => this.callHost('player.getCurrentTrack')
      };
    }

    if (this.hasPermission(pluginName, 'storage:local')) {
      api.storage = {
        get: (key: string) => this.callHost('storage.get', pluginName, key),
        set: (key: string, value: any) => this.callHost('storage.set', pluginName, key, value)
      };
    }

    return api;
  }

  // Main load function
  async loadPlugin(manifest: AudionPluginManifest): Promise<LoadedPlugin> {
    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin already loaded: ${manifest.name}`);
    }

    let plugin: LoadedPlugin;

    if (manifest.type === 'js') {
      plugin = await this.loadJsPlugin(manifest);
    } else if (manifest.type === 'wasm') {
      plugin = await this.loadWasmPlugin(manifest);
    } else {
      throw new Error(`Unknown plugin type: ${(manifest as any).type}`);
    }

    this.plugins.set(manifest.name, plugin);
    this.config.onLoad?.(plugin);

    return plugin;
  }

  // Unload a plugin
  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    // Call destroy lifecycle hook
    if (plugin.manifest.type === 'wasm' && plugin.instance.destroy) {
      plugin.instance.destroy();
    } else if (plugin.manifest.type === 'js' && plugin.instance?.destroy) {
      plugin.instance.destroy();
    }

    // Remove script tag for JS plugins
    if (plugin.manifest.type === 'js') {
      const script = document.getElementById(`plugin-${name}`);
      script?.remove();
    }

    this.plugins.delete(name);
  }

  // Enable plugin
  enablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    plugin.enabled = true;

    if (plugin.instance?.start) {
      plugin.instance.start();
    }

    return true;
  }

  // Disable plugin
  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    plugin.enabled = false;

    if (plugin.instance?.stop) {
      plugin.instance.stop();
    }

    return true;
  }

  // Load all plugins from manifests
  async loadAll(manifests: AudionPluginManifest[]): Promise<void> {
    for (const manifest of manifests) {
      try {
        await this.loadPlugin(manifest);
      } catch (err) {
        this.config.onError?.(manifest.name, err as Error);
      }
    }
  }

  // Get all loaded plugins
  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  // Get a specific plugin
  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }
}
