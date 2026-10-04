# Implementation plan

Extend the existing MCP provider type, labels, filter and scope choices with Pi.
Use the locked atomic JSON writer to retain all native configuration fields.
Share one Pi path resolver between discovery and addition; read only the selected
project's file. Include Pi in the existing CLI binary resolver and login branch.
Reuse the shared settings cache and message picker without new protocol fields.

Follow-up: add a bounded `pi_mcp_list` desktop command that returns selected
metadata from Pi's JSON, including nonzero-exit reports. Keep raw transport and
credential fields out of the response. Normalize native state under the Pi
provider, then update optional connection health fields in the shared cache.
Deduplicate background checks and ignore superseded results. Use native source
and scope to resolve project overrides; show native trust/config errors. Gate
Pi's login action and picker availability on native health. Preserve other
providers' current behavior and localize application-owned health labels.

Add Rust regressions for default/custom paths, disabled entries, credential-safe
discovery, parent isolation, and preservation of native fields on addition. Add
UI regressions for discovery/filter/login and project/user addition, plus picker
availability. Run affected tests, check:web, test:host, build and check:rust.
Record the actual Pi version and any untested native sign-in/model scenarios.
