// View store - manages current view/navigation state
import { writable } from 'svelte/store';

export type ViewType =
    | 'tracks'
    | 'albums'
    | 'album-detail'
    | 'artists'
    | 'artist-detail'
    | 'playlists'
    | 'playlist-detail'
    | 'playlist-detail'
    | 'plugins'
    | 'settings';

export interface ViewState {
    type: ViewType;
    id?: number;    // For album/playlist detail views
    name?: string;  // For artist detail views
}

export const currentView = writable<ViewState>({ type: 'tracks' });

// Navigation helpers
export function navigateTo(type: ViewType, id?: number, name?: string): void {
    currentView.set({ type, id, name });
}

export function goToTracks(): void {
    currentView.set({ type: 'tracks' });
}

export function goToAlbums(): void {
    currentView.set({ type: 'albums' });
}

export function goToAlbumDetail(albumId: number): void {
    currentView.set({ type: 'album-detail', id: albumId });
}

export function goToArtists(): void {
    currentView.set({ type: 'artists' });
}

export function goToArtistDetail(artistName: string): void {
    currentView.set({ type: 'artist-detail', name: artistName });
}

export function goToPlaylists(): void {
    currentView.set({ type: 'playlists' });
}

export function goToPlaylistDetail(playlistId: number): void {
    currentView.set({ type: 'playlist-detail', id: playlistId });
}

export function goToPlugins(): void {
    currentView.set({ type: 'plugins' });
}

export function goToSettings(): void {
    currentView.set({ type: 'settings' });
}
