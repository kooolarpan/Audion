import { writable } from 'svelte/store';

export const isFullScreen = writable(false);
export const isMiniPlayer = writable(false);
export const isQueueVisible = writable(false);
export const isSettingsOpen = writable(false);

export function toggleFullScreen() {
    isFullScreen.update(v => !v);
}

export function toggleMiniPlayer() {
    isMiniPlayer.update(v => !v);
}

export function toggleQueue() {
    isQueueVisible.update(v => !v);
}

export function toggleSettings() {
    isSettingsOpen.update(v => !v);
}

export interface ContextMenu {
    visible: boolean;
    x: number;
    y: number;
    items: {
        label: string;
        action: () => void;
        danger?: boolean;
    }[];
}

export const contextMenu = writable<ContextMenu>({
    visible: false,
    x: 0,
    y: 0,
    items: []
});
