// Plugin state store
import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { AudionPluginManifest } from '../plugins/schema';
import type { MarketplacePlugin } from '../plugins/marketplace';
import { fetchMarketplacePlugins, searchPlugins, filterByCategory } from '../plugins/marketplace';

// Types matching Rust backend
export interface PluginInfo {
    name: string;
    enabled: boolean;
    manifest: AudionPluginManifest;
    granted_permissions: string[];
}

export interface PluginStoreState {
    installed: PluginInfo[];
    marketplace: MarketplacePlugin[];
    communityUrls: string[];
    loading: boolean;
    error: string | null;
    searchQuery: string;
    categoryFilter: string;
    activeTab: 'curated' | 'community' | 'installed';
}

// Initial state
const initialState: PluginStoreState = {
    installed: [],
    marketplace: [],
    communityUrls: [],
    loading: false,
    error: null,
    searchQuery: '',
    categoryFilter: 'all',
    activeTab: 'curated'
};

// Create the store
function createPluginStore() {
    const { subscribe, set, update } = writable<PluginStoreState>(initialState);

    let pluginDir: string = '';

    return {
        subscribe,

        // Initialize the store
        async init() {
            update(s => ({ ...s, loading: true, error: null }));

            try {
                // Get plugin directory from backend
                pluginDir = await invoke<string>('get_plugin_dir');

                // Load installed plugins
                const installed = await invoke<PluginInfo[]>('list_plugins', { pluginDir });

                update(s => ({
                    ...s,
                    installed,
                    loading: false
                }));
            } catch (err) {
                update(s => ({
                    ...s,
                    loading: false,
                    error: `Failed to initialize: ${err}`
                }));
            }
        },

        // Refresh marketplace plugins
        async refreshMarketplace() {
            update(s => ({ ...s, loading: true, error: null }));

            try {
                const state = get({ subscribe });
                const marketplace = await fetchMarketplacePlugins(state.communityUrls);

                update(s => ({
                    ...s,
                    marketplace,
                    loading: false
                }));
            } catch (err) {
                update(s => ({
                    ...s,
                    loading: false,
                    error: `Failed to fetch marketplace: ${err}`
                }));
            }
        },

        // Add community plugin URL
        addCommunityUrl(url: string) {
            update(s => ({
                ...s,
                communityUrls: [...s.communityUrls, url]
            }));
        },

        // Remove community plugin URL
        removeCommunityUrl(url: string) {
            update(s => ({
                ...s,
                communityUrls: s.communityUrls.filter(u => u !== url)
            }));
        },

        // Install a plugin
        async installPlugin(plugin: MarketplacePlugin): Promise<boolean> {
            if (!plugin.repo) {
                update(s => ({ ...s, error: 'Plugin has no repository URL' }));
                return false;
            }

            update(s => ({ ...s, loading: true, error: null }));

            try {
                const info = await invoke<PluginInfo>('install_plugin', {
                    repoUrl: plugin.repo,
                    pluginDir
                });

                update(s => ({
                    ...s,
                    installed: [...s.installed, info],
                    loading: false
                }));

                return true;
            } catch (err) {
                update(s => ({
                    ...s,
                    loading: false,
                    error: `Failed to install: ${err}`
                }));
                return false;
            }
        },

        // Uninstall a plugin
        async uninstallPlugin(name: string): Promise<boolean> {
            update(s => ({ ...s, loading: true, error: null }));

            try {
                await invoke('uninstall_plugin', { name, pluginDir });

                update(s => ({
                    ...s,
                    installed: s.installed.filter(p => p.name !== name),
                    loading: false
                }));

                return true;
            } catch (err) {
                update(s => ({
                    ...s,
                    loading: false,
                    error: `Failed to uninstall: ${err}`
                }));
                return false;
            }
        },

        // Enable a plugin
        async enablePlugin(name: string): Promise<boolean> {
            try {
                await invoke('enable_plugin', { name, pluginDir });

                update(s => ({
                    ...s,
                    installed: s.installed.map(p =>
                        p.name === name ? { ...p, enabled: true } : p
                    )
                }));

                return true;
            } catch (err) {
                update(s => ({ ...s, error: `Failed to enable: ${err}` }));
                return false;
            }
        },

        // Disable a plugin
        async disablePlugin(name: string): Promise<boolean> {
            try {
                await invoke('disable_plugin', { name, pluginDir });

                update(s => ({
                    ...s,
                    installed: s.installed.map(p =>
                        p.name === name ? { ...p, enabled: false } : p
                    )
                }));

                return true;
            } catch (err) {
                update(s => ({ ...s, error: `Failed to disable: ${err}` }));
                return false;
            }
        },

        // Grant permissions to a plugin
        async grantPermissions(name: string, permissions: string[]): Promise<boolean> {
            try {
                await invoke('grant_permissions', { name, pluginDir, permissions });

                update(s => ({
                    ...s,
                    installed: s.installed.map(p =>
                        p.name === name
                            ? { ...p, granted_permissions: [...new Set([...p.granted_permissions, ...permissions])] }
                            : p
                    )
                }));

                return true;
            } catch (err) {
                update(s => ({ ...s, error: `Failed to grant permissions: ${err}` }));
                return false;
            }
        },

        // Revoke permissions from a plugin
        async revokePermissions(name: string, permissions: string[]): Promise<boolean> {
            try {
                await invoke('revoke_permissions', { name, pluginDir, permissions });

                update(s => ({
                    ...s,
                    installed: s.installed.map(p =>
                        p.name === name
                            ? { ...p, granted_permissions: p.granted_permissions.filter(perm => !permissions.includes(perm)) }
                            : p
                    )
                }));

                return true;
            } catch (err) {
                update(s => ({ ...s, error: `Failed to revoke permissions: ${err}` }));
                return false;
            }
        },

        // Set search query
        setSearchQuery(query: string) {
            update(s => ({ ...s, searchQuery: query }));
        },

        // Set category filter
        setCategoryFilter(category: string) {
            update(s => ({ ...s, categoryFilter: category }));
        },

        // Set active tab
        setActiveTab(tab: 'curated' | 'community' | 'installed') {
            update(s => ({ ...s, activeTab: tab }));
        },

        // Clear error
        clearError() {
            update(s => ({ ...s, error: null }));
        },

        // Check if a plugin is installed
        isInstalled(name: string): boolean {
            const state = get({ subscribe });
            return state.installed.some(p => p.name === name);
        },

        // Get plugin by name
        getInstalledPlugin(name: string): PluginInfo | undefined {
            const state = get({ subscribe });
            return state.installed.find(p => p.name === name);
        }
    };
}

export const pluginStore = createPluginStore();

// Derived stores for filtered views
export const filteredMarketplace = derived(
    pluginStore,
    ($store) => {
        let plugins = $store.marketplace;

        // Apply search
        if ($store.searchQuery) {
            plugins = searchPlugins(plugins, $store.searchQuery);
        }

        // Apply category filter
        plugins = filterByCategory(plugins, $store.categoryFilter);

        return plugins;
    }
);

export const curatedPlugins = derived(
    filteredMarketplace,
    ($plugins) => $plugins.filter(p => p.curated)
);

export const communityPlugins = derived(
    filteredMarketplace,
    ($plugins) => $plugins.filter(p => !p.curated)
);

export const enabledPlugins = derived(
    pluginStore,
    ($store) => $store.installed.filter(p => p.enabled)
);
