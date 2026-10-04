use serde::Serialize;
use serde_json::Value;
use std::fs::{self, File, Metadata};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const MAX_BYTES: u64 = 64 * 1024 * 1024;
const MAX_FILES: usize = 5000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionFile {
    pub(crate) provider: String,
    pub(crate) provider_session_id: String,
    pub(crate) cwd: String,
    pub(crate) path: String,
    pub(crate) revision: String,
    pub(crate) modified_at: u64,
}

#[derive(Default, Serialize)]
pub struct NativeSessionListing {
    sessions: Vec<NativeSessionFile>,
    warnings: Vec<String>,
}

fn revision(meta: &Metadata) -> Result<String, String> {
    let modified = meta.modified().map_err(|e| e.to_string())?;
    let nanos = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    Ok(format!("{}:{nanos}", meta.len()))
}

fn roots() -> Result<Vec<(&'static str, PathBuf)>, String> {
    let home = crate::dirs_home().ok_or("Cannot locate home directory")?;
    let codex = std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(&home).join(".codex"));
    let pi = std::env::var_os("PI_CODING_AGENT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(&home).join(".pi/agent"));
    let pi_sessions = std::env::var_os("PI_CODING_AGENT_SESSION_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| pi.join("sessions"));
    Ok(vec![("codex", codex.join("sessions")), ("pi", pi_sessions)])
}

fn header(path: &Path, provider: &str) -> Result<(String, String), String> {
    let mut first = String::new();
    BufReader::new(File::open(path).map_err(|e| e.to_string())?)
        .take(65536)
        .read_line(&mut first)
        .map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&first).map_err(|e| e.to_string())?;
    let value = match (provider, value.get("type").and_then(Value::as_str)) {
        ("codex", Some("session_meta")) => &value["payload"],
        ("pi", Some("session")) if value["version"].as_u64() == Some(3) => &value,
        _ => return Err("Unsupported native session format".into()),
    };
    let id = value["id"]
        .as_str()
        .filter(|id| {
            !id.is_empty()
                && id.len() <= 128
                && id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
        .ok_or("Invalid native session id")?;
    let cwd = value["cwd"]
        .as_str()
        .filter(|cwd| Path::new(cwd).is_absolute())
        .ok_or("Native session has no absolute working directory")?;
    Ok((id.into(), cwd.replace('\\', "/")))
}

fn scan(
    provider: &str,
    dir: &Path,
    depth: usize,
    seen: &mut usize,
    out: &mut NativeSessionListing,
) {
    if depth > 4 || *seen >= MAX_FILES {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return,
        Err(e) => {
            out.warnings.push(format!("{}: {e}", dir.display()));
            return;
        }
    };
    for entry in entries {
        if *seen >= MAX_FILES {
            break;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => {
                out.warnings.push(e.to_string());
                continue;
            }
        };
        let path = entry.path();
        let kind = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        if kind.is_dir() {
            scan(provider, &path, depth + 1, seen, out);
            continue;
        }
        if !kind.is_file() || path.extension().and_then(|v| v.to_str()) != Some("jsonl") {
            continue;
        }
        *seen += 1;
        let result: Result<NativeSessionFile, String> = (|| {
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            if meta.len() > MAX_BYTES {
                return Err("Native session exceeds 64 MiB".into());
            }
            let (id, cwd) = header(&path, provider)?;
            Ok(NativeSessionFile {
                provider: provider.into(),
                provider_session_id: id,
                cwd,
                path: path.to_string_lossy().replace('\\', "/"),
                revision: revision(&meta)?,
                modified_at: meta
                    .modified()
                    .map_err(|e| e.to_string())?
                    .duration_since(UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis() as u64,
            })
        })();
        match result {
            Ok(session) => out.sessions.push(session),
            Err(e) => out.warnings.push(format!("{}: {e}", path.display())),
        }
    }
}

#[tauri::command]
pub async fn native_sessions_list() -> Result<NativeSessionListing, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut out = NativeSessionListing::default();
        let mut seen = 0;
        for (provider, root) in roots()? {
            scan(provider, &root, 0, &mut seen, &mut out);
        }
        if seen >= MAX_FILES {
            out.warnings
                .push("Native session scan reached the 5000-file limit".into());
        }
        out.sessions
            .sort_by_key(|file| std::cmp::Reverse(file.modified_at));
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn read(path: &Path, expected_revision: &str) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let before = file.metadata().map_err(|e| e.to_string())?;
    if before.len() > MAX_BYTES {
        return Err("Native session exceeds 64 MiB".into());
    }
    if revision(&before)? != expected_revision {
        return Err("Native session changed; refresh and try again".into());
    }
    let mut content = String::new();
    file.by_ref()
        .take(MAX_BYTES + 1)
        .read_to_string(&mut content)
        .map_err(|e| e.to_string())?;
    if content.len() as u64 > MAX_BYTES
        || revision(&file.metadata().map_err(|e| e.to_string())?)? != expected_revision
    {
        return Err("Native session changed while reading; try again".into());
    }
    Ok(content)
}

#[tauri::command]
pub async fn native_session_read(path: String, revision: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path)
            .canonicalize()
            .map_err(|e| e.to_string())?;
        let allowed = roots()?
            .iter()
            .any(|(_, root)| root.canonicalize().is_ok_and(|root| path.starts_with(root)));
        if !allowed || path.extension().and_then(|v| v.to_str()) != Some("jsonl") {
            return Err("Not a native session in a configured source directory".into());
        }
        read(&path, &revision)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scans_supported_headers_and_reports_bad_files() {
        let dir = std::env::temp_dir().join(format!("monocode-native-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(dir.join("nested")).unwrap();
        fs::write(
            dir.join("nested/good.jsonl"),
            "{\"type\":\"session\",\"version\":3,\"id\":\"pi-id\",\"cwd\":\"/repo\"}\n",
        )
        .unwrap();
        fs::write(dir.join("bad.jsonl"), "bad\n").unwrap();
        let mut listing = NativeSessionListing::default();
        scan("pi", &dir, 0, &mut 0, &mut listing);
        assert_eq!(listing.sessions.len(), 1);
        assert_eq!(listing.sessions[0].provider_session_id, "pi-id");
        assert_eq!(listing.warnings.len(), 1);
        let file = &listing.sessions[0];
        assert!(read(Path::new(&file.path), &file.revision).is_ok());
        fs::write(&file.path, "changed").unwrap();
        assert!(read(Path::new(&file.path), &file.revision).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}

/// Validate the configured source and return current metadata without changing history.
pub(crate) fn source_file(
    path: &str,
    provider_session_id: &str,
) -> Result<NativeSessionFile, String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let provider = roots()?
        .into_iter()
        .find_map(|(provider, root)| {
            root.canonicalize()
                .ok()
                .filter(|root| path.starts_with(root))
                .map(|_| provider)
        })
        .ok_or("Not a native session in a configured source directory")?;
    if path.extension().and_then(|v| v.to_str()) != Some("jsonl") {
        return Err("Not a native session file".into());
    }
    let (id, cwd) = header(&path, provider)?;
    if id != provider_session_id {
        return Err("Native session identity changed".into());
    }
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_BYTES {
        return Err("Native session exceeds 64 MiB".into());
    }
    Ok(NativeSessionFile {
        provider: provider.into(),
        provider_session_id: id,
        cwd,
        path: path.to_string_lossy().replace('\\', "/"),
        revision: revision(&meta)?,
        modified_at: meta
            .modified()
            .map_err(|e| e.to_string())?
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as u64,
    })
}

#[derive(Serialize)]
pub struct NativeSessionProbe {
    file: NativeSessionFile,
    access: crate::native_access::NativeAccess,
}

#[tauri::command(async)]
pub fn native_session_probe(
    app: tauri::AppHandle,
    host: tauri::State<'_, crate::harness::HarnessHost>,
    leases: tauri::State<'_, crate::native_access::NativeLeases>,
    session_id: String,
    path: String,
    provider_session_id: String,
    own_operation_active: Option<bool>,
) -> Result<NativeSessionProbe, String> {
    let file = source_file(&path, &provider_session_id)?;
    let access = crate::native_access::probe_source(
        &app,
        &host,
        &leases,
        &file,
        &session_id,
        own_operation_active.unwrap_or(false),
    );
    Ok(NativeSessionProbe { file, access })
}
