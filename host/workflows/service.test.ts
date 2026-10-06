import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostEngine } from "../engine";
import { HostStore } from "../store";
import type { HostProvider } from "../providers";
import type { SendTurnInput } from "../../src/integrations/harness/core/types";
import { extractResultBlock } from "./driver";
import { runControlCli } from "../control";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

type Reply = (input: SendTurnInput) => string;

function fakeProvider(reply: Reply, sent: SendTurnInput[]): HostProvider {
  return {
    send: vi.fn(async (input: SendTurnInput) => {
      sent.push(input);
      input.onEvent({ type: "message.delta", text: reply(input) });
      input.onEvent({ type: "message.completed" });
      input.onEvent({ type: "turn.metrics", inputTokens: 100, outputTokens: 20 });
    }),
    cancel: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    bind: vi.fn(),
    approve: vi.fn(),
    answer: vi.fn(),
  };
}

function setup(runtimeMode: "supervised" | "full-access" = "full-access", reply?: Reply) {
  const directory = mkdtempSync(join(tmpdir(), "monocode-workflow-test-"));
  const store = new HostStore(join(directory, "host.db"));
  const project = store.addProject(directory, "Test");
  const sent: SendTurnInput[] = [];
  const answer: Reply = reply ?? ((input) => input.text.includes("workflow-result")
    ? "Planned.\n```workflow-result\n{\"steps\":[\"write tests\"]}\n```"
    : `Done: ${input.text.split("\n")[0]}`);
  const claude = fakeProvider(answer, sent);
  const codex = fakeProvider(answer, sent);
  const engine = new HostEngine(store, { claude, codex }, undefined, {
    native: { environment: { home: join(directory, "home"), env: {} } },
  });
  const created = engine.command({ type: "create", commandId: "create", projectId: project.id, harness: "claude", model: "claude:sonnet-5", runtimeMode });
  cleanups.push(async () => {
    await engine.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { engine, store, sent, claude, codex, parentId: created.sessionId };
}

const SCRIPT = `
interface Plan { steps: string[] }
phase("Plan");
const planner = agent("planner", { system: "You plan.", provider: "claude", model: "opus", thinking: "high" });
const plan = await planner.ask<Plan>("Plan the change");
phase("Build");
const builder = agent("builder", { provider: "codex", speed: "fast" });
const out = await builder.ask("Implement " + plan.steps[0]);
return { plan, out };
`;

describe("Host dynamic workflows", () => {
  it("runs each agent on its own provider runtime and projects the run into the parent", async () => {
    const { engine, store, parentId, claude, codex } = setup();
    const submitted = await engine.workflows.submit(parentId, { script: SCRIPT, name: "Plan and build" }, "user");
    expect(submitted).toMatchObject({ ok: true, status: "running" });
    const runId = (submitted as { runId: string }).runId;
    const settled = await engine.workflows.wait(runId, 20);
    expect(settled).toMatchObject({ status: "completed", settled: true, result: { plan: { steps: ["write tests"] }, out: "Done: Implement write tests" } });
    expect(claude.send).toHaveBeenCalledTimes(1);
    expect(codex.send).toHaveBeenCalledTimes(1);
    expect((settled as { spentTokens: number }).spentTokens).toBe(240);

    const workers = store.sessions().filter((value) => value.session.workflowRunId === runId);
    const planner = workers.find((value) => value.session.title === "planner")!.session;
    const builder = workers.find((value) => value.session.title === "builder")!.session;
    expect(planner).toMatchObject({ harness: "claude", model: "claude:opus", workflowParentId: parentId });
    expect(planner.modelSettings.effort).toBe("high");
    expect(builder).toMatchObject({ harness: "codex", workflowParentId: parentId });
    expect(builder.modelSettings.serviceTier).toBe("fast");

    const parent = store.session(parentId).session;
    expect(parent.blocks.at(-1)?.workflowRun).toMatchObject({ runId, name: "Plan and build", launchedBy: "user" });
    const run = parent.workflowRuns?.runs.find((entry) => entry.runId === runId);
    expect(run?.status).toBe("completed");
    expect(run?.actors.map((actor) => actor.runtime?.harness).sort()).toEqual(["claude", "codex"]);
    expect(run?.phases?.map((phase) => phase.name)).toEqual(["Plan", "Build"]);
    expect(store.summaries().some((summary) => summary.workflowParentId === parentId)).toBe(true);
  }, 30_000);

  it("repairs a typed result that does not match its schema", async () => {
    let attempt = 0;
    const { engine, sent, parentId } = setup("full-access", (input) => {
      if (!input.text.includes("workflow-result") && !input.text.includes("did not conform")) return "plain";
      attempt++;
      return attempt === 1 ? "```workflow-result\n{\"steps\":\"oops\"}\n```" : "```workflow-result\n{\"steps\":[\"fixed\"]}\n```";
    });
    const script = `interface Plan { steps: string[] }\nphase("Plan");\nconst p = await agent("planner").ask<Plan>("Plan");\nreturn p;`;
    const submitted = await engine.workflows.submit(parentId, { script, name: "Repair" }, "user");
    const runId = (submitted as { runId: string }).runId;
    const settled = await engine.workflows.wait(runId, 20);
    expect(settled).toMatchObject({ status: "completed", result: { steps: ["fixed"] } });
    expect(sent.some((input) => input.text.includes("did not conform"))).toBe(true);
  }, 30_000);

  it("holds an agent-launched run in a supervised conversation until the user approves", async () => {
    const { engine, store, parentId, claude } = setup("supervised");
    const script = `phase("Ask");\nconst a = await agent("asker").ask("Say hi");\nreturn a;`;
    const submitted = await engine.workflows.submit(parentId, { script, name: "Approval" }, "agent");
    expect(submitted).toMatchObject({ ok: true, status: "awaiting_approval" });
    const runId = (submitted as { runId: string }).runId;
    expect(store.session(parentId).session.blocks.at(-1)?.workflowRun?.approval).toBe("pending");
    expect(claude.send).not.toHaveBeenCalled();
    engine.workflows.approve(runId);
    expect(await engine.workflows.wait(runId, 20)).toMatchObject({ status: "completed" });
    expect(store.session(parentId).session.blocks.at(-1)?.workflowRun?.approval).toBe("approved");
  }, 30_000);

  it("reports compile diagnostics against the draft file without running anything", async () => {
    const { engine, parentId, claude } = setup();
    const result = await engine.workflows.submit(parentId, { script: "const x: number = 'no';\nreturn x;", name: "Broken" }, "agent");
    expect(result).toMatchObject({ ok: false, reason: "diagnostics" });
    expect((result as { diagnostics: string[] }).diagnostics[0]).toMatch(/\.monocode\/workflow-drafts\/.+\.dwf\.ts:L1:C/);
    expect(claude.send).not.toHaveBeenCalled();
  }, 30_000);

  it("amends a completed run, replaying unchanged asks from the cache", async () => {
    const { engine, parentId, claude, codex } = setup();
    const first = await engine.workflows.submit(parentId, { script: SCRIPT, name: "Plan and build" }, "user");
    const runId = (first as { runId: string }).runId;
    await engine.workflows.wait(runId, 20);
    const revised = SCRIPT.replace('"Implement " + plan.steps[0]', '"Implement carefully " + plan.steps[0]');
    const amended = await engine.workflows.amend(parentId, runId, { script: revised }, "agent");
    expect(amended).toMatchObject({ ok: true });
    const next = (amended as { runId: string }).runId;
    expect(await engine.workflows.wait(next, 20)).toMatchObject({ status: "completed", resumedFrom: runId, result: { out: "Done: Implement carefully write tests" } });
    // The planner's ask replayed from cache; only the builder ran again.
    expect(claude.send).toHaveBeenCalledTimes(1);
    expect(codex.send).toHaveBeenCalledTimes(2);
  }, 30_000);
});

describe("workflow control CLI", () => {
  it("lets a conversation's agent create and wait for a run through its scoped credentials", async () => {
    const { engine, parentId } = setup();
    await engine.workflows.ready;
    const environment = engine.workflows.environment(parentId);
    expect(environment.MONOCODE_WORKFLOW_TOKEN).toBeTruthy();
    expect(engine.workflows.prompt(parentId, "/workflow review the repo")).toContain("SKILL.md");
    const saved = { ...process.env };
    const output: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => { output.push(String(chunk)); return true; });
    try {
      Object.assign(process.env, environment);
      const script = `phase("Ask");\nreturn await agent("asker").ask("Say hi");`;
      expect(await runControlCli(["create", "--json", JSON.stringify({ name: "CLI", script })], "workflow")).toBe(0);
      const created = JSON.parse(output.at(-1)!);
      expect(created).toMatchObject({ ok: true, result: { ok: true, status: "running" } });
      expect(await runControlCli(["wait", "--json", JSON.stringify({ runId: created.result.runId, timeoutSeconds: 20 })], "workflow")).toBe(0);
      expect(JSON.parse(output.at(-1)!)).toMatchObject({ ok: true, result: { status: "completed", settled: true } });
    } finally {
      write.mockRestore();
      process.env = saved;
    }
  }, 30_000);
});

describe("extractResultBlock", () => {
  it("prefers the tagged block, then json, then a bare JSON reply", () => {
    expect(extractResultBlock("x\n```json\n{\"a\":1}\n```\n```workflow-result\n{\"a\":2}\n```")).toEqual({ found: true, value: { a: 2 } });
    expect(extractResultBlock("```json\n[1,2]\n```")).toEqual({ found: true, value: [1, 2] });
    expect(extractResultBlock("{\"a\":3}")).toEqual({ found: true, value: { a: 3 } });
    expect(extractResultBlock("no result")).toEqual({ found: false });
  });
});
