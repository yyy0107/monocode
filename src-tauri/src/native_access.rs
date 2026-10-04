//! Conservative native-session ownership: observe external CLIs and serialize
//! MonoCode writers. Native CLIs do not participate in this advisory lease.
use crate::native_sessions::NativeSessionFile;
use serde::Serialize;
#[cfg(target_os = "linux")]
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::File;
#[cfg(target_os = "linux")]
use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAccess {
    pub state: &'static str,
    pub reason: &'static str,
    pub checked_at: u64,
    pub path: String,
}

fn status(source: &NativeSessionFile, state: &'static str, reason: &'static str) -> NativeAccess {
    NativeAccess {
        state,
        reason,
        checked_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        path: source.path.clone(),
    }
}

struct Lease {
    _file: File,
    path: String,
    token: String,
}
#[derive(Default)]
pub struct NativeLeases {
    owners: Mutex<HashMap<String, Lease>>,
}

#[cfg(target_os = "linux")]
fn lock_path(root: &Path, source: &NativeSessionFile) -> PathBuf {
    let digest = Sha256::digest(source.path.as_bytes());
    root.join(format!("{digest:x}.lock"))
}

#[cfg(target_os = "linux")]
fn exclusive(root: &Path, source: &NativeSessionFile) -> Result<File, String> {
    use std::os::fd::AsRawFd;
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(lock_path(root, source))
        .map_err(|e| e.to_string())?;
    // flock belongs to this open file description; drop releases it even on crash.
    if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err("Native session is in use by another MonoCode instance".into());
    }
    Ok(file)
}

#[cfg(not(target_os = "linux"))]
fn exclusive(_root: &Path, _source: &NativeSessionFile) -> Result<File, String> {
    Err("Native session ownership cannot be verified on this platform".into())
}

#[cfg(target_os = "linux")]
fn provider_argv(argv: &[String], provider: &str) -> bool {
    argv.iter().take(3).any(|arg| {
        let name = Path::new(arg)
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("");
        match provider {
            "codex" => name == "codex" || name == "codex-cli" || arg.contains("/@openai/codex/"),
            "pi" => name == "pi" || arg.contains("/pi-coding-agent/") || arg.contains("/pi-agent/"),
            _ => false,
        }
    })
}

#[cfg(target_os = "linux")]
fn explicit_session(argv: &[String]) -> Option<&str> {
    for (index, arg) in argv.iter().enumerate() {
        if ["--session", "--resume", "resume"].contains(&arg.as_str()) {
            if let Some(value) = argv.get(index + 1).filter(|v| !v.starts_with('-')) {
                return Some(value);
            }
        }
        if let Some(value) = arg
            .strip_prefix("--session=")
            .or_else(|| arg.strip_prefix("--resume="))
        {
            return Some(value);
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn matches_explicit(value: &str, cwd: &Path, source: &NativeSessionFile) -> bool {
    value == source.provider_session_id
        || (!value.is_empty()
            && !value.contains('/')
            && source.provider_session_id.starts_with(value))
        || cwd
            .join(value)
            .canonicalize()
            .is_ok_and(|path| path == Path::new(&source.path))
}

#[cfg(target_os = "linux")]
fn managed_pid(mut pid: u32, excluded: &HashSet<u32>) -> bool {
    for _ in 0..64 {
        if excluded.contains(&pid) {
            return true;
        }
        if pid <= 1 {
            return false;
        }
        let Some(parent) = crate::harness::proc_ppid(&PathBuf::from(format!("/proc/{pid}"))) else {
            return false;
        };
        if parent == pid {
            return false;
        }
        pid = parent;
    }
    false
}

#[cfg(target_os = "linux")]
fn process_access(source: &NativeSessionFile, excluded: &HashSet<u32>) -> NativeAccess {
    use std::os::unix::fs::MetadataExt;
    let Ok(entries) = fs::read_dir("/proc") else {
        return status(source, "unknown", "unavailable");
    };
    let source_cwd = Path::new(&source.cwd)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&source.cwd));
    let mut uncertain = false;
    let mut ambiguous = false;
    for entry in entries {
        let Ok(entry) = entry else {
            uncertain = true;
            continue;
        };
        let Some(pid) = entry
            .file_name()
            .to_str()
            .and_then(|v| v.parse::<u32>().ok())
        else {
            continue;
        };
        if excluded.contains(&pid) || pid == std::process::id() {
            continue;
        }
        let dir = entry.path();
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.uid() != unsafe { libc::geteuid() } {
            continue;
        }
        let bytes = match fs::read(dir.join("cmdline")) {
            Ok(bytes) => bytes,
            Err(_) => {
                if dir.exists() {
                    uncertain = true;
                }
                continue;
            }
        };
        let argv: Vec<String> = bytes
            .split(|v| *v == 0)
            .filter(|v| !v.is_empty())
            .map(|v| String::from_utf8_lossy(v).into_owned())
            .collect();
        if !provider_argv(&argv, &source.provider)
            || argv
                .iter()
                .any(|v| v == "--no-session" || v == "--version" || v == "--help")
        {
            continue;
        }
        if managed_pid(pid, excluded) {
            continue;
        }
        let cwd = fs::read_link(dir.join("cwd"));
        if let (Some(value), Ok(cwd)) = (explicit_session(&argv), &cwd) {
            if matches_explicit(value, cwd, source) {
                return status(source, "external", "externalProcess");
            }
            // An explicit binding to a different session must not block this one.
            continue;
        }
        let mut has_other_transcript = false;
        if let Ok(fds) = fs::read_dir(dir.join("fd")) {
            for fd in fds.flatten() {
                let Ok(target) = fs::read_link(fd.path()) else {
                    continue;
                };
                if target == Path::new(&source.path) {
                    return status(source, "external", "externalProcess");
                }
                if target.extension().and_then(|v| v.to_str()) == Some("jsonl") {
                    has_other_transcript = true;
                }
            }
        }
        if !has_other_transcript {
            match cwd {
                Ok(cwd) if cwd == source_cwd => ambiguous = true,
                Err(_) => uncertain = true,
                _ => {}
            }
        }
    }
    if uncertain {
        status(source, "unknown", "unavailable")
    } else if ambiguous {
        status(source, "unknown", "ambiguousProcess")
    } else {
        status(source, "idle", "available")
    }
}

#[cfg(not(target_os = "linux"))]
fn process_access(source: &NativeSessionFile, _excluded: &HashSet<u32>) -> NativeAccess {
    status(source, "unknown", "unsupportedPlatform")
}

fn lease_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("native-session-locks"))
}

pub fn probe(
    root: &Path,
    source: &NativeSessionFile,
    leases: &NativeLeases,
    session_id: &str,
    excluded: &HashSet<u32>,
    own_operation_active: bool,
) -> NativeAccess {
    let own_lease = match leases.owners.lock() {
        Ok(owners) => {
            own_operation_active
                && owners
                    .get(session_id)
                    .is_some_and(|lease| lease.path == source.path)
        }
        Err(_) => return status(source, "unknown", "unavailable"),
    };
    if !own_lease {
        if let Err(error) = exclusive(root, source) {
            let reason = if !cfg!(target_os = "linux") {
                "unsupportedPlatform"
            } else if error == "Native session is in use by another MonoCode instance" {
                "anotherMonocode"
            } else {
                "unavailable"
            };
            return status(source, "unknown", reason);
        }
    }
    process_access(source, excluded)
}

#[tauri::command(async)]
pub fn native_session_acquire(
    app: tauri::AppHandle,
    host: tauri::State<'_, crate::harness::HarnessHost>,
    leases: tauri::State<'_, NativeLeases>,
    session_id: String,
    path: String,
    provider_session_id: String,
) -> Result<String, String> {
    let source = crate::native_sessions::source_file(&path, &provider_session_id)?;
    let file = exclusive(&lease_root(&app)?, &source)?;
    let access = process_access(&source, &host.managed_pids());
    if access.state != "idle" {
        return Err("Native session is open in another CLI or its ownership is unknown".into());
    }
    let mut owners = leases
        .owners
        .lock()
        .map_err(|_| "Native session access is locked")?;
    if owners.contains_key(&session_id) {
        return Err("Native session operation is already running".into());
    }
    let token = uuid::Uuid::new_v4().to_string();
    owners.insert(
        session_id,
        Lease {
            _file: file,
            path: source.path,
            token: token.clone(),
        },
    );
    Ok(token)
}

#[tauri::command]
pub fn native_session_release(
    leases: tauri::State<'_, NativeLeases>,
    session_id: String,
    token: String,
) -> Result<(), String> {
    let mut owners = leases
        .owners
        .lock()
        .map_err(|_| "Native session access is locked")?;
    if owners
        .get(&session_id)
        .is_some_and(|lease| lease.token == token)
    {
        owners.remove(&session_id);
    }
    Ok(())
}

pub fn probe_source(
    app: &tauri::AppHandle,
    host: &crate::harness::HarnessHost,
    leases: &NativeLeases,
    source: &NativeSessionFile,
    session_id: &str,
    own_operation_active: bool,
) -> NativeAccess {
    match lease_root(app) {
        Ok(root) => probe(
            &root,
            source,
            leases,
            session_id,
            &host.managed_pids(),
            own_operation_active,
        ),
        Err(_) => status(source, "unknown", "unavailable"),
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use std::process::{Child, Command, Stdio};

    fn fixture() -> (PathBuf, NativeSessionFile) {
        let root = std::env::temp_dir().join(format!("monocode-access-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("pi-coding-agent")).unwrap();
        let path = root.join("native.jsonl");
        fs::write(&path, "native test fixture").unwrap();
        let source = NativeSessionFile {
            provider: "pi".into(),
            provider_session_id: "session-123".into(),
            cwd: root.to_string_lossy().into_owned(),
            path: path.to_string_lossy().into_owned(),
            revision: "1".into(),
            modified_at: 1,
        };
        (root, source)
    }
    fn process(root: &Path, args: &[&str], wrapper: bool) -> Child {
        let script = root.join("pi-coding-agent/owner.js");
        let body = if wrapper {
            "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,[process.argv[1],'--child',...process.argv.slice(2)],{stdio:['ignore','pipe','inherit']}); child.stdout.once('data',()=>console.log('ready')); setInterval(()=>{},1000);"
        } else {
            "console.log('ready'); setInterval(()=>{},1000);"
        };
        // The nested child branch uses the same argv/path but avoids recursively spawning.
        let body = format!("if(process.argv.includes('--child')){{console.log('ready');setInterval(()=>{{}},1000)}}else{{{body}}}");
        fs::write(&script, body).unwrap();
        let mut command = Command::new("node");
        command
            .arg(script)
            .args(args)
            .current_dir(root)
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        use std::os::unix::process::CommandExt;
        command.process_group(0);
        let mut child = command.spawn().unwrap();
        let mut ready = String::new();
        BufReader::new(child.stdout.take().unwrap())
            .read_line(&mut ready)
            .unwrap();
        assert_eq!(ready.trim(), "ready");
        child
    }
    fn stop(child: &mut Child) {
        unsafe {
            libc::kill(-(child.id() as i32), libc::SIGKILL);
        }
        let _ = child.wait();
    }
    #[test]
    fn detects_external_owner_and_release_without_touching_its_process() {
        let (root, source) = fixture();
        let mut child = process(&root, &["--session", &source.path], false);
        assert_eq!(process_access(&source, &HashSet::new()).state, "external");
        assert_eq!(
            process_access(&source, &HashSet::from([child.id()])).state,
            "idle"
        );
        stop(&mut child);
        assert_eq!(process_access(&source, &HashSet::new()).state, "idle");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn ambiguous_tui_is_read_only_but_explicit_other_sessions_are_not() {
        let (root, source) = fixture();
        let mut child = process(&root, &[], false);
        assert_eq!(
            process_access(&source, &HashSet::new()).reason,
            "ambiguousProcess"
        );
        stop(&mut child);
        let mut child = process(&root, &["--session", "another-native-id"], false);
        assert_eq!(process_access(&source, &HashSet::new()).state, "idle");
        stop(&mut child);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn managed_wrapper_descendants_do_not_look_like_external_owners() {
        let (root, source) = fixture();
        let mut child = process(&root, &["--session", &source.path], true);
        assert_eq!(
            process_access(&source, &HashSet::from([child.id()])).state,
            "idle"
        );
        stop(&mut child);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn advisory_lease_serializes_writers_and_releases_on_drop() {
        let (root, source) = fixture();
        let locks = root.join("locks");
        let leases = NativeLeases::default();
        let file = exclusive(&locks, &source).unwrap();
        assert!(exclusive(&locks, &source).is_err());
        leases.owners.lock().unwrap().insert(
            "ours".into(),
            Lease {
                _file: file,
                path: source.path.clone(),
                token: "token".into(),
            },
        );
        assert_eq!(
            probe(&locks, &source, &leases, "ours", &HashSet::new(), false).reason,
            "anotherMonocode"
        );
        assert_eq!(
            probe(&locks, &source, &leases, "ours", &HashSet::new(), true).state,
            "idle"
        );
        assert_eq!(
            probe(&locks, &source, &leases, "another", &HashSet::new(), false).state,
            "unknown"
        );
        leases.owners.lock().unwrap().remove("ours");
        assert!(exclusive(&locks, &source).is_ok());
        fs::remove_dir_all(root).unwrap();
    }
}
