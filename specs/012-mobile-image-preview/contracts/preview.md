# Preview contract

`MobileClient.readBinaryFile(absolutePath)` continues calling authenticated
`workspace.run` with command `read_binary_file` and `{path}`. Host returns base64
for a regular file up to 10 MiB; mobile decodes it into a Uint8Array. Existing
read-only access outside projects is unchanged, as are write/editor boundaries.

`MobileFileSheet` keeps its public props and bottom-sheet placement. Image bytes
render via a typed blob URL with the filename as alt text. The decoder owns
supported image rendering; decode failure becomes a localized alert. Switching
files or closing releases owned URLs and prevents late reads overwriting state.
No protocol, persisted session or attachment contract changes.
