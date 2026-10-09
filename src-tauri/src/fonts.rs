//! Installed font families for Settings → Appearance font pickers.

use std::collections::BTreeSet;

/// Family names of every installed font, deduplicated and sorted. Localized
/// names (e.g. CJK families) are included so the picker shows what users know.
#[tauri::command]
pub async fn list_system_fonts() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut db = fontdb::Database::new();
        db.load_system_fonts();
        let mut names = BTreeSet::new();
        for face in db.faces() {
            for (name, _) in &face.families {
                let name = name.trim();
                if !name.is_empty() && !name.starts_with('.') {
                    names.insert(name.to_string());
                }
            }
        }
        names.into_iter().collect()
    })
    .await
    .map_err(|error| error.to_string())
}
