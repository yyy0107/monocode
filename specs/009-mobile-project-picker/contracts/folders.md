# Folder browsing contract

MobileClient.browseDirectories(path?) invokes projects.browse with no path for
the Host's home directory, or a user-selected absolute Host path. HostDirectory
contains path, nullable parent (null at a filesystem root), and entries of name
and absolute path. Paths are interpreted by the Host OS, never the phone OS.
Reuse the current protocol and desktop limits; the picker adds no project-root
restriction. Standard input validation and operating-system errors still apply.

Directory navigation never invokes projects.open. Only explicit Open project
submits the current path to the existing registration flow. Manual edits
invalidate outstanding directory responses. Browse errors preserve the requested
path for retry or manual opening; open errors preserve the picker. Once a newer
request starts or the picker closes, earlier responses have no UI effect.

Parent navigation is retained or derived even when projects.browse rejects;
loading a directory is not a prerequisite for leaving it. POSIX, Windows drive
and UNC share roots do not navigate above their root. A directory symlink entry
uses the link's name and absolute path, while stat follows its target to classify
it. Entering a link keeps that path and its lexical parent. Unresolvable links
are omitted individually without failing the containing directory listing.
