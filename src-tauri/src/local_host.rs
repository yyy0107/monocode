//! The desktop and phones use the same background conversation owner.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager, State};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Prepared {
    endpoint: String,
    token: String,
    projects: Vec<Value>,
    sessions: Vec<Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedHost {
    machine: crate::remote::Machine,
    projects: Vec<Value>,
    sessions: Vec<Value>,
}

fn bundled_runtime(root: &Path) -> Option<(PathBuf, PathBuf)> {
    let entry = root.join("host.mjs");
    let node = if cfg!(windows) {
        root.join("node.exe")
    } else {
        root.join("bin/node")
    };
    (entry.is_file() && node.is_file()).then_some((node, entry))
}

fn runtime(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    #[cfg(debug_assertions)]
    {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or("Missing development directory")?;
        let entry = root.join("build/host/monocode-host.mjs");
        if entry.is_file() {
            return Ok((PathBuf::from("node"), entry));
        }
    }
    if let Ok(resources) = app.path().resource_dir() {
        if let Some(runtime) = bundled_runtime(&resources.join("desktop-host")) {
            return Ok(runtime);
        }
    }
    Err("The shared conversation service is missing from this installation.".into())
}

#[tauri::command(async)]
pub fn shared_host_prepare(
    app: AppHandle,
    state: State<'_, crate::remote::RemoteConnections>,
) -> Result<SharedHost, String> {
    let (node, entry) = runtime(&app)?;
    let desktop = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&desktop).map_err(|e| e.to_string())?;
    let mut command = Command::new(node);
    command
        .arg(entry)
        .arg("desktop")
        .arg("--desktop-data-dir")
        .arg(desktop);
    crate::hide_window_console(&mut command);
    let output = command
        .output()
        .map_err(|e| format!("Could not start shared conversation service: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let prepared: Prepared = serde_json::from_slice(&output.stdout)
        .map_err(|_| "Invalid conversation service response")?;
    let machine = crate::remote::remote_connect(
        app,
        state,
        String::new(),
        prepared.endpoint,
        prepared.token,
    )?;
    Ok(SharedHost {
        machine,
        projects: prepared.projects,
        sessions: prepared.sessions,
    })
}

/// Native worktree deletion must also honor conversations owned by Host.
/// Keep its write lease until Git finishes so another client cannot create a
/// conversation in the checkout between the reference check and removal.
pub fn reserve_worktree_removal(path: &Path) -> Result<Option<rusqlite::Connection>, String> {
    let Some(home) = crate::dirs_home() else {
        return Ok(None);
    };
    worktree_removal_lease(&Path::new(&home).join(".monocode-host/host.db"), path)
}

fn worktree_removal_lease(
    database: &Path,
    path: &Path,
) -> Result<Option<rusqlite::Connection>, String> {
    if !database.is_file() {
        return Ok(None);
    }
    let conn = rusqlite::Connection::open_with_flags(
        database,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
    )
    .map_err(|e| format!("Could not check shared conversations: {e}"))?;
    conn.execute_batch("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE")
        .map_err(|e| format!("Could not reserve shared conversation worktree: {e}"))?;
    let target = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let paths = {
        let mut statement = conn
            .prepare("SELECT json_extract(snapshot, '$.session.cwd') FROM sessions")
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    for cwd in paths {
        let cwd = PathBuf::from(cwd);
        let cwd = cwd.canonicalize().unwrap_or(cwd);
        if cwd.starts_with(&target) {
            return Err("Shared conversations still use this worktree. Delete those conversations before removing it.".into());
        }
    }
    // SQLite rolls back this reservation when the caller drops the connection.
    Ok(Some(conn))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_removal_honors_shared_conversation_references_and_holds_the_write_lease() {
        let root =
            std::env::temp_dir().join(format!("monocode-shared-worktree-{}", uuid::Uuid::new_v4()));
        let tree = root.join("tree");
        std::fs::create_dir_all(tree.join("nested")).unwrap();
        let database = root.join("host.db");
        let writer = rusqlite::Connection::open(&database).unwrap();
        writer
            .execute_batch("CREATE TABLE sessions (snapshot TEXT)")
            .unwrap();
        writer
            .execute(
                "INSERT INTO sessions VALUES (?1)",
                [serde_json::json!({ "session": { "cwd": tree.join("nested") } }).to_string()],
            )
            .unwrap();
        assert!(worktree_removal_lease(&database, &tree)
            .unwrap_err()
            .contains("Shared conversations"));
        writer.execute("DELETE FROM sessions", []).unwrap();
        let lease = worktree_removal_lease(&database, &tree).unwrap();
        writer.busy_timeout(std::time::Duration::ZERO).unwrap();
        assert!(writer
            .execute("INSERT INTO sessions VALUES ('{}')", [])
            .is_err());
        drop(lease);
        assert!(writer
            .execute("INSERT INTO sessions VALUES ('{}')", [])
            .is_ok());
        drop(writer);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn packaged_runtime_requires_both_node_and_host() {
        let root = std::env::temp_dir().join(format!("monocode-runtime-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("bin")).unwrap();
        assert!(bundled_runtime(&root).is_none());
        std::fs::write(root.join("host.mjs"), "").unwrap();
        assert!(bundled_runtime(&root).is_none());
        std::fs::write(
            if cfg!(windows) {
                root.join("node.exe")
            } else {
                root.join("bin/node")
            },
            "",
        )
        .unwrap();
        assert!(bundled_runtime(&root).is_some());
        std::fs::remove_dir_all(root).unwrap();
    }
}
