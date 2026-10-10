//! Tray icon: the way back to a window that closing hid.
//!
//! Windows and Linux. Closing a window hides it so the harness children keep
//! running, and a hidden window drops off the taskbar, so without this the
//! windows would be unreachable. The menu also lists the Host's unread, pinned
//! and recent conversations, and owns the one quit that stops the Host too.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, WebviewWindow, Wry};

const TRAY_ID: &str = "main";
const OPEN: &str = "tray_open";
const NEW: &str = "tray_new";
const QUIT: &str = "tray_quit";
const SESSION_PREFIX: &str = "tray_session:";
/// Opens a Host conversation in one window; payload is [`OpenSession`].
pub const OPEN_SESSION_EVENT: &str = "monocode:tray-open-session";
const SECTION_LIMIT: usize = 5;
const MORE_LIMIT: usize = 10;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayLabels {
    open: String,
    unread: String,
    pinned: String,
    recent: String,
    more: String,
    new_session: String,
    quit: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            open: "Open MonoCode".into(),
            unread: "Unread".into(),
            pinned: "Pinned".into(),
            recent: "Recent".into(),
            more: "More".into(),
            new_session: "New conversation".into(),
            quit: "Quit MonoCode and Host".into(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TraySession {
    id: String,
    project: String,
    title: String,
    busy: bool,
    unread: bool,
    pinned: bool,
    activity_at: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenSession {
    id: String,
    project: String,
}

#[derive(Default)]
struct TrayState {
    labels: TrayLabels,
    /// Each window reports what it sees; the menu merges them.
    sessions: HashMap<String, Vec<TraySession>>,
}

static STATE: Mutex<Option<TrayState>> = Mutex::new(None);

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app, &TrayLabels::default(), &Sections::default())?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("MonoCode")
        .menu(&menu)
        // Left click reopens; the menu stays on the right button. Linux
        // indicators never report clicks, so there the menu is the only way.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                OPEN => {
                    let _ = crate::window::show_hidden_or_open_new(app);
                }
                NEW => {
                    let _ = crate::window::show_hidden_or_open_new(app);
                    crate::menu::emit_to_focused(app, "new_tab");
                }
                QUIT => crate::window::request_quit_with_host(app),
                _ => {
                    if let Some(id) = id.strip_prefix(SESSION_PREFIX) {
                        open_session(app, id);
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = crate::window::show_hidden_or_open_new(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}

fn open_session(app: &AppHandle, id: &str) {
    let project = STATE.lock().unwrap().as_ref().and_then(|state| {
        state
            .sessions
            .values()
            .flatten()
            .find(|session| session.id == id)
            .map(|session| session.project.clone())
    });
    let Some(project) = project else { return };
    let _ = crate::window::show_hidden_or_open_new(app);
    // One window opens it; a broadcast would open it in every window.
    let Some(window) = crate::menu::focused_window(app) else {
        return;
    };
    let _ = app.emit_to(
        window.label(),
        OPEN_SESSION_EVENT,
        OpenSession {
            id: id.to_string(),
            project,
        },
    );
}

#[derive(Debug, Default, PartialEq)]
struct Sections {
    unread: Vec<TraySession>,
    pinned: Vec<TraySession>,
    recent: Vec<TraySession>,
    more: Vec<TraySession>,
}

/// One row per conversation across windows. It stays unread until any window
/// has seen it, which is what clears the sidebar's dot in that window.
fn merge(sessions: &HashMap<String, Vec<TraySession>>) -> Vec<TraySession> {
    let mut by_id: HashMap<String, TraySession> = HashMap::new();
    for session in sessions.values().flatten() {
        match by_id.get_mut(&session.id) {
            None => {
                by_id.insert(session.id.clone(), session.clone());
            }
            Some(current) => {
                let unread = current.unread && session.unread;
                let busy = current.busy || session.busy;
                if session.activity_at > current.activity_at {
                    *current = session.clone();
                }
                current.unread = unread;
                current.busy = busy;
            }
        }
    }
    let mut merged: Vec<TraySession> = by_id.into_values().collect();
    merged.sort_by(|a, b| {
        b.activity_at
            .partial_cmp(&a.activity_at)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.id.cmp(&b.id))
    });
    merged
}

/// Each conversation appears once: unread first, then pinned, then recent.
fn sections(sessions: Vec<TraySession>) -> Sections {
    let mut out = Sections::default();
    let mut rest = Vec::new();
    for session in sessions {
        if session.unread && out.unread.len() < SECTION_LIMIT {
            out.unread.push(session);
        } else if session.pinned && out.pinned.len() < SECTION_LIMIT {
            out.pinned.push(session);
        } else {
            rest.push(session);
        }
    }
    let mut rest = rest.into_iter();
    out.recent = rest.by_ref().take(SECTION_LIMIT).collect();
    out.more = rest.take(MORE_LIMIT).collect();
    out
}

fn session_item(
    app: &AppHandle,
    session: &TraySession,
) -> tauri::Result<tauri::menu::MenuItem<Wry>> {
    let text = if session.busy {
        format!("● {}", session.title)
    } else {
        session.title.clone()
    };
    MenuItemBuilder::with_id(format!("{SESSION_PREFIX}{}", session.id), text).build(app)
}

fn build_menu(
    app: &AppHandle,
    labels: &TrayLabels,
    sections: &Sections,
) -> tauri::Result<Menu<Wry>> {
    let mut menu = MenuBuilder::new(app);
    for (title, rows, more) in [
        (&labels.unread, &sections.unread, &[][..]),
        (&labels.pinned, &sections.pinned, &[][..]),
        (&labels.recent, &sections.recent, &sections.more[..]),
    ] {
        if rows.is_empty() {
            continue;
        }
        menu = menu.item(&MenuItemBuilder::new(title).enabled(false).build(app)?);
        for session in rows {
            menu = menu.item(&session_item(app, session)?);
        }
        if !more.is_empty() {
            let mut submenu = SubmenuBuilder::new(app, &labels.more);
            for session in more {
                submenu = submenu.item(&session_item(app, session)?);
            }
            menu = menu.item(&submenu.build()?);
        }
        menu = menu.separator();
    }
    menu.item(&MenuItemBuilder::with_id(NEW, &labels.new_session).build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id(OPEN, &labels.open).build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id(QUIT, &labels.quit).build(app)?)
        .build()
}

fn refresh(app: &AppHandle) {
    let (labels, sections) = {
        let guard = STATE.lock().unwrap();
        let Some(state) = guard.as_ref() else { return };
        (state.labels.clone(), sections(merge(&state.sessions)))
    };
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    if let Ok(menu) = build_menu(app, &labels, &sections) {
        let _ = tray.set_menu(Some(menu));
    }
}

/// A window's view of the Host conversations and the menu text in the
/// current UI language.
#[tauri::command]
pub fn tray_update(
    app: AppHandle,
    window: WebviewWindow,
    labels: TrayLabels,
    sessions: Vec<TraySession>,
) {
    {
        let mut guard = STATE.lock().unwrap();
        let state = guard.get_or_insert_with(TrayState::default);
        state.labels = labels;
        state.sessions.insert(window.label().to_string(), sessions);
    }
    refresh(&app);
}

pub fn window_closed(app: &AppHandle, label: &str) {
    let removed = STATE
        .lock()
        .unwrap()
        .as_mut()
        .and_then(|state| state.sessions.remove(label))
        .is_some();
    if removed {
        refresh(app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(id: &str, activity_at: f64) -> TraySession {
        TraySession {
            id: id.into(),
            project: "/repo".into(),
            title: id.into(),
            busy: false,
            unread: false,
            pinned: false,
            activity_at,
        }
    }

    fn ids(rows: &[TraySession]) -> Vec<&str> {
        rows.iter().map(|s| s.id.as_str()).collect()
    }

    #[test]
    fn windows_reporting_the_same_session_list_it_once_newest_first() {
        let mut sessions = HashMap::new();
        let unread = TraySession {
            unread: true,
            ..session("a", 1.0)
        };
        sessions.insert("main".into(), vec![unread, session("b", 3.0)]);
        sessions.insert("w2".into(), vec![session("a", 5.0), session("c", 2.0)]);
        let merged = merge(&sessions);
        assert_eq!(ids(&merged), ["a", "b", "c"]);
        // Seen in one window is seen.
        assert!(!merged[0].unread);
    }

    #[test]
    fn each_conversation_lands_in_one_section() {
        let rows = vec![
            TraySession {
                unread: true,
                pinned: true,
                ..session("u", 9.0)
            },
            TraySession {
                pinned: true,
                ..session("p", 8.0)
            },
        ]
        .into_iter()
        .chain((0..20).map(|i| session(&format!("r{i}"), 7.0 - i as f64 * 0.1)))
        .collect();
        let out = sections(rows);
        assert_eq!(ids(&out.unread), ["u"]);
        assert_eq!(ids(&out.pinned), ["p"]);
        assert_eq!(out.recent.len(), SECTION_LIMIT);
        assert_eq!(out.recent[0].id, "r0");
        assert_eq!(out.more.len(), MORE_LIMIT);
        assert_eq!(out.more[0].id, "r5");
    }
}
