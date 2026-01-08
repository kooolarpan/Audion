// Plugin manifest schema for JS and WASM plugins

export type PluginCategory = 'audio' | 'ui' | 'lyrics' | 'library' | 'utility';
export type PluginType = 'js' | 'wasm';

export interface AudionPluginManifest {
  name: string;
  version: string;
  author: string;
  description?: string;
  repo?: string;
  manifest_url?: string;
  type: PluginType;
  entry: string; // JS: entry .js file, WASM: entry .wasm file
  permissions: string[];
  ui_slots?: string[]; // UI injection points
  icon?: string;
  homepage?: string;
  category?: PluginCategory;
  tags?: string[];
  min_version?: string; // Minimum Audion version required
  license?: string;
}

// Permission definitions with human-readable descriptions
export const PLUGIN_PERMISSIONS: Record<string, string> = {
  'player:control': 'Control playback (play, pause, seek, skip)',
  'player:read': 'Read current playback state and queue',
  'library:read': 'Read library tracks, albums, and playlists',
  'library:write': 'Modify library and playlists',
  'ui:inject': 'Inject custom UI elements into the app',
  'network:fetch': 'Make network requests to external services',
  'storage:local': 'Store and read local plugin data',
  'lyrics:read': 'Read lyrics data',
  'lyrics:write': 'Modify and save lyrics',
  'system:notify': 'Show system notifications',
} as const;

export const ALL_PERMISSIONS = Object.keys(PLUGIN_PERMISSIONS);

// Validate manifest schema
export function validateManifest(manifest: unknown): manifest is AudionPluginManifest {
  if (!manifest || typeof manifest !== 'object') return false;

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.name !== 'string' || !m.name) return false;
  if (typeof m.version !== 'string' || !m.version) return false;
  if (typeof m.author !== 'string' || !m.author) return false;
  if (m.type !== 'js' && m.type !== 'wasm') return false;
  if (typeof m.entry !== 'string' || !m.entry) return false;
  if (!Array.isArray(m.permissions)) return false;

  // Validate permissions are known
  for (const perm of m.permissions) {
    if (typeof perm !== 'string') return false;
  }

  // Optional field types
  if (m.description !== undefined && typeof m.description !== 'string') return false;
  if (m.repo !== undefined && typeof m.repo !== 'string') return false;
  if (m.manifest_url !== undefined && typeof m.manifest_url !== 'string') return false;
  if (m.icon !== undefined && typeof m.icon !== 'string') return false;
  if (m.homepage !== undefined && typeof m.homepage !== 'string') return false;
  if (m.license !== undefined && typeof m.license !== 'string') return false;
  if (m.min_version !== undefined && typeof m.min_version !== 'string') return false;

  if (m.category !== undefined) {
    const validCategories = ['audio', 'ui', 'lyrics', 'library', 'utility'];
    if (!validCategories.includes(m.category as string)) return false;
  }

  if (m.ui_slots !== undefined && !Array.isArray(m.ui_slots)) return false;
  if (m.tags !== undefined && !Array.isArray(m.tags)) return false;

  return true;
}

// Check if permission is valid
export function isValidPermission(permission: string): boolean {
  return permission in PLUGIN_PERMISSIONS;
}

// Get permission description
export function getPermissionDescription(permission: string): string {
  return PLUGIN_PERMISSIONS[permission] || 'Unknown permission';
}

// Example manifest
export const exampleManifest: AudionPluginManifest = {
  name: 'Sample Plugin',
  version: '1.0.0',
  author: 'Community',
  description: 'A sample plugin for Audion',
  repo: 'https://github.com/audion-plugins/sample-plugin',
  manifest_url: 'https://raw.githubusercontent.com/audion-plugins/sample-plugin/main/plugin.json',
  type: 'js',
  entry: 'index.js',
  permissions: ['player:control', 'ui:inject'],
  ui_slots: ['sidebar', 'playerbar'],
  icon: 'icon.png',
  homepage: 'https://audion-plugins.github.io/sample-plugin',
  category: 'utility',
  tags: ['sample', 'demo'],
  license: 'MIT'
};
