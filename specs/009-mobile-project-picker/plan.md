# Implementation and validation

Reuse protocol-v1 projects.browse and HostDirectory through a typed MobileClient
method. The existing Host browser starts at homedir() without a project boundary.
Extend its directory enumeration to follow symlink metadata while retaining link
paths, ignoring links whose targets are files, missing or inaccessible. No Rust,
provider or persistence changes are needed.

Build a MobileProjectPicker in the existing MobileSheet with Host name, editable
path and Go control, home/parent navigation, current-directory filter, scrollable
folder rows, retry/empty states and a persistent Open project action. Keep loading
and failures local to the picker. Guard request generations on navigation, manual
editing and unmount; guard duplicate open submissions. Connect the existing empty
screen and drawer entry points to the same component and keep the existing shared
project registration/selection flow.

Store parent navigation separately from the loaded directory. Derive it from
the requested Host path using the existing shared path helpers, then prefer the
Host's returned parent on success. Manual editing updates the parent; navigation
can cancel an in-flight read, and stale responses cannot overwrite it. Regress
EACCES recovery, late failures, Windows drive/UNC roots, and real symlink browsing
through both the Host function and the authenticated mobile client.

Verify directory navigation, manual paths, filtering, failed browse/open recovery,
stale responses, cancellation, language switching and MobileApp wiring. Exercise
MobileClient against a disposable real Host and directories outside its registered
project, without providers or personal directories. Run affected tests, check:web,
test:host, desktop build and mobile build. Record tool versions and actual results;
native Android/iOS use remains unverified unless exercised. No APK publication,
push or merge is requested.
