import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  HostProviderAccount,
  HostProviderAccounts,
  HostAccountIdentity,
} from "../src/features/connections/model/protocol";

export const ACCOUNT_PROVIDERS = ["codex", "claude"] as const;
const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,80}$/;
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function read(path: string): Record<string, unknown> {
  return record(JSON.parse(readFileSync(path, "utf8")));
}
function desktopDirectory(owner: string): string | undefined {
  try {
    const dir = read(owner).desktopDirectory;
    if (typeof dir !== "string" || !dir.trim()) throw new Error("Invalid desktop account configuration");
    return dir;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("Invalid desktop account configuration");
  }
}
function preferredAccount(
  directory: string,
  provider: string,
): string | undefined {
  let value: unknown;
  try {
    value = JSON.parse(
      readFileSync(
        join(directory, "provider-accounts", "defaults.json"),
        "utf8",
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("Invalid shared account defaults");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.entries(value).some(
      ([key, id]) =>
        !ACCOUNT_PROVIDERS.includes(key as never) ||
        typeof id !== "string" ||
        !ACCOUNT_ID.test(id),
    )
  )
    throw new Error("Invalid shared account defaults");
  const id = (value as Record<string, string>)[provider];
  return id === "default" ? undefined : id;
}
function accountsIn(
  directory: string,
  provider: string,
): HostProviderAccount[] {
  let published: Record<string, unknown> = {};
  try {
    published = read(join(directory, "provider-accounts", "accounts.json"));
  } catch {
    /* No labels published yet. */
  }
  const seen = new Set<string>();
  const accounts: HostProviderAccount[] = [];
  for (const entry of Array.isArray(published[provider])
    ? published[provider]
    : []) {
    const { id, label } = record(entry);
    if (typeof id !== "string" || !ACCOUNT_ID.test(id) || seen.has(id))
      continue;
    const text = typeof label === "string" ? label.trim().slice(0, 80) : "";
    if (!text) continue;
    seen.add(id);
    accounts.push({ id, label: text });
  }
  if (!seen.has("default"))
    accounts.unshift({ id: "default", label: "Default account" });
  return accounts;
}
/** Resolve exactly once at creation. Retained sessions must not call this. */
export function resolveDefaultAccount(
  owner: string,
  provider: string,
  requested?: string,
): string | undefined {
  if (!ACCOUNT_PROVIDERS.includes(provider as never)) return undefined;
  if (requested === "default") return undefined;
  const directory = desktopDirectory(owner);
  const id =
    requested
      ? requested
      : directory
        ? preferredAccount(directory, provider)
        : undefined;
  if (!id) return undefined;
  if (
    !directory ||
    !accountsIn(directory, provider).some((account) => account.id === id)
  )
    throw new Error("This provider account is no longer available");
  return id;
}
function identity(
  directory: string,
  provider: string,
  id: string,
): HostAccountIdentity | undefined {
  const named = id !== "default";
  if (
    !named &&
    (provider === "codex"
      ? ["OPENAI_API_KEY", "CODEX_API_KEY", "CODEX_ACCESS_TOKEN"]
      : ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"]
    ).some((key) => process.env[key])
  )
    return undefined;
  try {
    let value: Record<string, unknown>;
    if (provider === "codex") {
      const home = named
        ? join(directory, "provider-accounts", provider, id)
        : process.env.CODEX_HOME || join(homedir(), ".codex");
      const token = record(read(join(home, "auth.json")).tokens).id_token;
      if (typeof token !== "string") return undefined;
      value = record(
        JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
        ),
      );
      const auth = record(value["https://api.openai.com/auth"]);
      return publicIdentity({
        email:
          value.email ?? record(value["https://api.openai.com/profile"]).email,
        name: value.name,
        plan: auth.chatgpt_plan_type,
        organization: Array.isArray(auth.organizations)
          ? record(
              auth.organizations.find((org) => record(org).is_default === true),
            ).title
          : undefined,
      });
    }
    const config = named
      ? join(directory, "provider-accounts", provider, id, ".claude.json")
      : process.env.CLAUDE_CONFIG_DIR
        ? join(process.env.CLAUDE_CONFIG_DIR, ".claude.json")
        : join(homedir(), ".claude.json");
    value = record(read(config).oauthAccount);
    return publicIdentity({
      email: value.emailAddress,
      name: value.displayName ?? value.fullName,
      plan:
        typeof value.organizationType === "string"
          ? value.organizationType.replace(/^claude_/, "")
          : undefined,
      organization: value.organizationName,
    });
  } catch {
    return undefined;
  }
}
function publicIdentity(
  value: Record<string, unknown>,
): HostAccountIdentity | undefined {
  const entries = Object.entries(value).flatMap(([key, value]) =>
    typeof value === "string" && value.trim() ? [[key, value.trim()]] : [],
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}
/** Public account metadata only; credentials and profile paths never leave Host. */
export function desktopProviderAccounts(owner: string): HostProviderAccounts {
  const directory = desktopDirectory(owner);
  if (!directory) return {};
  return Object.fromEntries(
    ACCOUNT_PROVIDERS.map((provider) => {
      const accounts = accountsIn(directory, provider).map(
        (account) =>
          ({
            ...account,
            identity: identity(directory, provider, account.id),
          }) as HostProviderAccount,
      );
      const original = accounts.find((account) => account.id === "default")!;
      try {
        const id = resolveDefaultAccount(owner, provider) ?? "default";
        const selected = accounts.find((account) => account.id === id)!;
        Object.assign(original, {
          defaultAccountId: id,
          defaultAccountLabel: selected.label,
          defaultIdentity: selected.identity,
        });
      } catch (error) {
        original.defaultError =
          error instanceof Error ? error.message : String(error);
      }
      return [provider, accounts];
    }),
  );
}
