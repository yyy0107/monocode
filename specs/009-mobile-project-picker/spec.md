# Mobile project folder picker

The phone's Open project action lets the user browse existing folders on the
connected personal Host instead of requiring a typed computer path. Use the same
folder browser as desktop remote projects. Start at the Host user's home folder,
enter subfolders, return to a parent or home, filter the current folder's names,
and open the selected folder as a shared project. Keep a manual path entry and
explicit navigation to that path for Windows drives and known locations.

Browsing is read-only and can reach folders outside registered projects. Add no
path allowlist or per-folder authorization. Keep existing Host device connection
behavior and let normal filesystem errors be displayed. Do not create, edit or
delete computer directories.

Both the empty-project screen and drawer use the same picker. Browsing must not
register a project before Open project is tapped. Opening refreshes the shared
project list and selects the project. Errors are recoverable, cancelled or stale
requests cannot replace newer input, and controls remain usable on a small screen.
Application text supports English and Simplified Chinese; Host paths and folder
names retain their original content. Opening the picker does not summon the
keyboard until the user chooses to type.

An unreadable or disappearing folder must not trap the user: parent navigation
stays available independently of loading and directory-read success, including
manual absolute paths. Filesystem roots have no parent. Directory symlinks appear
alongside normal folders and can be entered using the link's own path; file links,
broken links and loops must not prevent other folders from being listed.
