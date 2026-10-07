# Session title API

MonoCode's title fallback calls a separately configured model API. It does not
launch a provider CLI or create a provider conversation. Native provider titles
still take priority, and manual names cannot be overwritten.

In **Settings → Chat → Session titles**, expand **Model API configuration**, select the machine that owns the
conversation, enable API title generation, and enter:

- The **full OpenAI-compatible Chat Completions endpoint**, for example
  `https://api.openai.com/v1/chat/completions`. A base URL alone is insufficient.
- The model ID supported by that endpoint.
- An API key, unless the endpoint accepts unauthenticated local requests.

Save, then use **Test connection** to send a short sample request. The button
shows progress and the result appears below it. Collapsing the settings preserves
unsaved edits; opening the setting from search expands it automatically.
Local endpoints can use HTTP on `localhost`, `127.0.0.1`, or `[::1]`; other
endpoints require HTTPS. Anthropic Messages and Responses endpoints are not
Chat Completions endpoints and cannot be used with this configuration.

Each Host stores its settings in `title-model.json` inside its data directory
(normally `~/.monocode-host`, or the directory selected with `--data-dir`).
The desktop's shared Host and clients connected to that Host use the same
configuration. A remote Host has its own configuration. The file contains the
API key; it is written atomically with owner-only permissions on Unix. Settings
responses expose only `hasApiKey`, never the key. Leaving the key input empty
preserves it; use the removal checkbox to clear it. Changing endpoints requires
re-entering or explicitly clearing the saved key.

The request contains the configured model and a single user message with the
title prompt, `stream: false`, and `store: false`. No tools or conversation IDs
are supplied. The prompt uses at most 8,000 characters from the triggering
message and requests a title of at most 50 characters. See the
[Chat Completions API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
for the request format. An API service's own logging policy is independent of
the provider CLI's conversation history.

An unconfigured or disabled API leaves the existing title intact. Errors and
timeouts also preserve it; they never fall back to a CLI. Requests time out
after 20 seconds, reject redirects, and bound response size. Existing title
ownership and single-attempt rules still apply, so enabling the API does not
retroactively retitle old conversations.
