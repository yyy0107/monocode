// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileNotes, type MobileNotesHandle } from "./MobileNotes";
import { setUiLanguage } from "../shared/i18n/language";
import type { Note, NoteUpsert } from "../features/notes/notesText";
import type { MobileClient } from "./client";

vi.mock("../features/sessions/ui/AgentMarkdown", () => ({
  AgentMarkdown: ({ text }: { text: string }) =>
    createElement("p", { "data-preview": true }, text),
}));
let root: Root, node: HTMLDivElement, stored: Note;
let upsert: ReturnType<typeof vi.fn>,
  remove: ReturnType<typeof vi.fn>,
  close: ReturnType<typeof vi.fn>,
  add: ReturnType<typeof vi.fn>;
let client: MobileClient;
const handle = createRef<MobileNotesHandle>();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  setUiLanguage("en");
  stored = {
    id: crypto.randomUUID(),
    slug: "untitled",
    title: "Untitled",
    body: "",
    tags: [],
    slugPending: true,
    createdAt: 1,
    updatedAt: 1,
  };
  upsert = vi.fn(async (note: NoteUpsert) => {
    stored = {
      ...stored,
      ...note,
      title: note.title.trim() || "Untitled",
      ...(note.finalizeSlug && note.title !== "Untitled"
        ? { slug: "real-title", slugPending: false }
        : {}),
    };
    return { ...stored };
  });
  remove = vi.fn(async () => {});
  close = vi.fn();
  add = vi.fn(async () => {});
  client = {
    connection: { environmentId: "host", endpoint: "http://host" },
    listNotes: async () => [{ ...stored }],
    getNote: async () => ({ ...stored }),
    upsertNote: upsert,
    deleteNote: remove,
  } as unknown as MobileClient;
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      createElement(MobileNotes, {
        ref: handle,
        client,
        hostKey: "host",
        projects: [{ id: "project", cwd: "/work/project", name: "Project" }],
        onClose: close,
        onAddToChat: add,
      }),
    ),
  );
}
function active() {
  return node.querySelector<HTMLElement>('[data-page-active="true"]')!;
}
function button(label: string) {
  return [...active().querySelectorAll<HTMLButtonElement>("button")].find(
    (button) =>
      button.getAttribute("aria-label") === label ||
      button.textContent === label,
  )!;
}
function type(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    field.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
async function open() {
  await render();
  await act(async () =>
    active().querySelector<HTMLButtonElement>(".mobile-note-card")!.click(),
  );
}

it("filters body, slug, tags and project name and exposes load failures for retry", async () => {
  stored = {
    ...stored,
    title: "Plan",
    body: "Draft body",
    slug: "plan-slug",
    tags: ["ideas"],
    sourceCwd: "/work/project",
  };
  await render();
  const filter = active().querySelector<HTMLInputElement>(
    '[aria-label="Filter notes"]',
  )!;
  for (const query of ["draft body", "plan-slug", "#ideas", "project"]) {
    act(() => type(filter, query));
    expect(active().querySelectorAll(".mobile-note-card")).toHaveLength(1);
  }
  act(() => type(filter, "missing"));
  expect(active().textContent).toContain("No matching notes");
  client.listNotes = async () => {
    throw new Error("Offline");
  };
  await act(async () => button("Refresh notes").click());
  expect(active().querySelector('[role="alert"]')?.textContent).toContain(
    "Offline",
  );
});
it("opens new blank notes in Source, debounces typing and finalizes only on blur", async () => {
  await render();
  await act(async () => button("New note").click());
  expect(upsert.mock.calls[0][0]).toMatchObject({ title: "", body: "" });
  expect(active().querySelector("textarea")).not.toBeNull();
  const title = active().querySelector<HTMLInputElement>(
    '[aria-label="Note title"]',
  )!;
  act(() => {
    title.focus();
    type(title, "Real title");
  });
  await act(async () => vi.advanceTimersByTime(399));
  expect(upsert).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(1));
  expect(upsert.mock.calls.at(-1)![0].finalizeSlug).toBeUndefined();
  await act(async () => title.blur());
  expect(upsert.mock.calls.at(-1)![0]).toMatchObject({
    title: "Real title",
    finalizeSlug: true,
  });
});
it("queues saves and preserves edits typed while an older save is pending", async () => {
  await open();
  const original = upsert.getMockImplementation()!;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  upsert.mockImplementationOnce(async (value) => {
    await gate;
    return original(value);
  });
  const body = active().querySelector<HTMLTextAreaElement>("textarea")!;
  act(() => type(body, "first"));
  await act(async () => vi.advanceTimersByTime(400));
  act(() => type(body, "newer"));
  await act(async () => vi.advanceTimersByTime(400));
  expect(upsert).toHaveBeenCalledTimes(1);
  await act(async () => release());
  expect(stored.body).toBe("newer");
  expect(body.value).toBe("newer");
  expect(upsert.mock.calls.map(([note]) => note.body)).toEqual([
    "first",
    "newer",
  ]);
});
it("flushes immediately on Back, then returns from list to close", async () => {
  await open();
  act(() =>
    type(
      active().querySelector<HTMLTextAreaElement>("textarea")!,
      "Pending text",
    ),
  );
  await act(async () => handle.current!.back());
  expect(stored.body).toBe("Pending text");
  expect(active().querySelector("textarea")).toBeNull();
  expect(close).not.toHaveBeenCalled();
  await act(async () => handle.current!.back());
  expect(close).toHaveBeenCalledOnce();
});
it("keeps the editor and edits after failed saves, and retries the pending finalization", async () => {
  await open();
  const title = active().querySelector<HTMLInputElement>(
    '[aria-label="Note title"]',
  )!;
  const original = upsert.getMockImplementation()!;
  upsert.mockRejectedValue(new Error("Disk full"));
  act(() => {
    title.focus();
    type(title, "Real title");
  });
  await act(async () => title.blur());
  expect(active().querySelector('[role="alert"]')?.textContent).toContain(
    "Disk full",
  );
  await act(async () => handle.current!.back());
  expect(active().querySelector("textarea")).not.toBeNull();
  upsert.mockImplementation(original);
  await act(async () => button("Retry").click());
  expect(stored.slugPending).toBe(false);
  expect(title.value).toBe("Real title");
  expect(active().querySelector('[role="alert"]')).toBeNull();
});
it("flushes before Add to chat and preserves failed navigation for another attempt", async () => {
  await open();
  act(() =>
    type(
      active().querySelector<HTMLTextAreaElement>("textarea")!,
      "Use this draft",
    ),
  );
  add.mockRejectedValueOnce(new Error("No project"));
  await act(async () => button("Add to chat").click());
  expect(add.mock.calls[0][0].body).toBe("Use this draft");
  expect(active().querySelector('[role="alert"]')?.textContent).toContain(
    "No project",
  );
  await act(async () => button("Add to chat").click());
  expect(add).toHaveBeenCalledTimes(2);
});
it("confirms deletion and never recreates a deleted note with a pending save", async () => {
  await open();
  act(() =>
    type(active().querySelector<HTMLTextAreaElement>("textarea")!, "Pending"),
  );
  await act(async () => button("Delete note").click());
  expect(remove).not.toHaveBeenCalled();
  const confirm = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((button) => button.textContent === "Delete")!;
  await act(async () => confirm.click());
  await act(async () => vi.advanceTimersByTime(1000));
  expect(remove).toHaveBeenCalledOnce();
  expect(upsert).not.toHaveBeenCalled();
  expect(active().querySelectorAll(".mobile-note-card")).toHaveLength(0);
});
it("does not send queued edits to another Host after a connection switch", async () => {
  await open();
  act(() =>
    type(
      active().querySelector<HTMLTextAreaElement>("textarea")!,
      "Private note",
    ),
  );
  client.connection = {
    environmentId: "other",
    endpoint: "http://other",
    token: "token",
    name: "Other",
  };
  await act(async () => vi.advanceTimersByTime(400));
  expect(upsert).not.toHaveBeenCalled();
  expect(active().querySelector('[role="alert"]')?.textContent).toContain(
    "Host connection changed",
  );
});

it("persists project changes and uses Back to dismiss the picker before leaving the editor", async () => {
  await open();
  await act(async () => button("Project").click());
  expect(document.querySelector('[role="radiogroup"]')).not.toBeNull();
  await act(async () => handle.current!.back());
  expect(active().querySelector("textarea")).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(220));
  await act(async () => button("Project").click());
  const choice = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
  ].find((button) => button.textContent === "Project")!;
  await act(async () => choice.click());
  expect(stored.sourceCwd).toBe("/work/project");
  expect(upsert.mock.calls.at(-1)![0]).toMatchObject({
    sourceCwd: "/work/project",
    body: "",
    title: "Untitled",
  });
});

it("uploads images and inserts their returned Markdown paths at the source selection", async () => {
  await open();
  const body = active().querySelector<HTMLTextAreaElement>("textarea")!;
  act(() => {
    type(body, "BeforeAfter");
    body.setSelectionRange(6, 6);
  });
  const upload = vi.fn(async () => ({
    name: "flow.png",
    markdownPath: `/note-assets/${stored.id}/1-flow.png`,
  }));
  client.saveNoteImage = upload;
  vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(
    function () {
      Object.defineProperty(this, "result", {
        value: "data:image/png;base64,YQ==",
        configurable: true,
      });
      this.onload?.(new ProgressEvent("load"));
    },
  );
  await act(async () => button("Insert images").click());
  const file = active().querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(file, "files", {
    value: [new File(["a"], "flow.png", { type: "image/png" })],
    configurable: true,
  });
  await act(async () =>
    file.dispatchEvent(new Event("change", { bubbles: true })),
  );
  expect(upload).toHaveBeenCalledWith(stored.id, "flow.png", "YQ==");
  expect(body.value).toBe(
    `Before\n\n![flow.png](/note-assets/${stored.id}/1-flow.png)\n\nAfter`,
  );
  await act(async () => vi.advanceTimersByTime(400));
  expect(stored.body).toBe(body.value);
});
