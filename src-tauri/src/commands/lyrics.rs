use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get LRC file path for a music file or URL
fn resolve_lrc_path(app: &AppHandle, music_path: &str) -> PathBuf {
    // Check if it's a real local file that exists
    if let Ok(metadata) = fs::metadata(music_path) {
        if metadata.is_file() {
            let path = PathBuf::from(music_path);
            return path.with_extension("lrc");
        }
    }

    // For URLs, custom protocols (tidal:), or invalid paths, use cache
    let mut hasher = DefaultHasher::new();
    music_path.hash(&mut hasher);
    let hash = hasher.finish();

    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let lyrics_dir = app_dir.join("lyrics");

    // Ensure lyrics directory exists
    let _ = fs::create_dir_all(&lyrics_dir);

    lyrics_dir.join(format!("{}.lrc", hash))
}

/// Save LRC file alongside music file or in cache for streams
#[tauri::command]
pub fn save_lrc_file(
    app: AppHandle,
    music_path: String,
    lrc_content: String,
) -> Result<(), String> {
    let lrc_path = resolve_lrc_path(&app, &music_path);

    fs::write(&lrc_path, lrc_content).map_err(|e| format!("Failed to save LRC file: {}", e))?;

    Ok(())
}

/// Load LRC file if it exists
#[tauri::command]
pub fn load_lrc_file(app: AppHandle, music_path: String) -> Result<Option<String>, String> {
    let lrc_path = resolve_lrc_path(&app, &music_path);

    if !lrc_path.exists() {
        return Ok(None);
    }

    let content =
        fs::read_to_string(&lrc_path).map_err(|e| format!("Failed to read LRC file: {}", e))?;

    Ok(Some(content))
}

/// Delete LRC file for a music file
#[tauri::command]
pub fn delete_lrc_file(app: AppHandle, music_path: String) -> Result<bool, String> {
    let lrc_path = resolve_lrc_path(&app, &music_path);

    if !lrc_path.exists() {
        return Ok(false);
    }

    fs::remove_file(&lrc_path).map_err(|e| format!("Failed to delete LRC file: {}", e))?;
    Ok(true)
}

/// Proxy request to Musixmatch API to avoid CORS issues
#[tauri::command]
pub async fn musixmatch_request(
    action: String,
    params: Vec<(String, String)>,
) -> Result<String, String> {
    // Build a client with cookie store and proper redirect policy
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let url = format!("https://apic-desktop.musixmatch.com/ws/1.1/{}", action);

    // Build query string
    let mut query_params: Vec<(String, String)> = params;
    query_params.push(("app_id".to_string(), "web-desktop-app-v1.0".to_string()));
    query_params.push((
        "t".to_string(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
            .to_string(),
    ));

    let response = client
        .get(&url)
        .query(&query_params)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Origin", "https://www.musixmatch.com")
        .header("Referer", "https://www.musixmatch.com/")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(text)
}
