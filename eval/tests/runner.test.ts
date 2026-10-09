import { it, expect } from "vitest";
import {
  Budget,
  ClaudeAdapter,
  emptyUsage,
  runProcess,
  classifyError,
} from "../src/adapters";
import { runCase } from "../src/runner";
import { judgeResult } from "../src/judge";
import { CaseSchema, EvalError } from "../src/schema";
const scenario = () =>
  CaseSchema.parse({
    id: "runner-test",
    category: "intent",
    language: "en",
    support: "native",
    tier: "smoke",
    prompt: "Return hello.",
    tools: [],
    fixture: {},
    assertions: [{ kind: "contains", values: ["hello"] }],
    rubric: ["task_completion"],
    provenance: { kind: "original", source: "monocode-original-v1" },
  });
it("request reservations cap retries even when the provider reports no cost", () => {
  const b = new Budget(2, 0.2, 0.1);
  b.reserve();
  b.reserve();
  expect(() => b.reserve()).toThrow("BUDGET_EXHAUSTED");
  expect(b.requests).toBe(2);
});
it("kills a hung process at timeout without waiting for its eventual output", async () => {
  await expect(
    runProcess(
      process.execPath,
      ["-e", "setTimeout(()=>{},5000)"],
      "",
      "/tmp",
      30,
    ),
  ).rejects.toMatchObject({ code: "TIMEOUT" });
});
it("classifies real auth and network messages without confusing cost metadata", () => {
  expect(classifyError("HTTP 401 unauthorized")).toBe("AUTH_UNAVAILABLE");
  expect(classifyError("ECONNREFUSED")).toBe("NETWORK_ERROR");
  expect(classifyError("error_during_execution total_cost_usd")).toBe(
    "PROVIDER_ERROR",
  );
});
it("withholds gold assertions and reference scripts from the model", async () => {
  let prompt = "";
  const adapter = {
    complete: async (_system: string, input: string) => {
      prompt = input;
      return { text: '{"final":"hello"}', usage: emptyUsage() };
    },
  } as ClaudeAdapter;
  const c = scenario();
  const r = await runCase(c, { mode: "claude", seed: 1, adapter });
  expect(r.status).toBe("passed");
  expect(prompt).not.toContain("assertions");
  expect(prompt).not.toContain("provenance");
});
it("bounds a no-progress agent with STEP_LIMIT", async () => {
  const adapter = {
    complete: async () => ({
      text: '{"calls":[{"action":"not_available","requestId":"x","input":{}}]}',
      usage: emptyUsage(),
    }),
  } as any;
  const r = await runCase(
    { ...scenario(), maxSteps: 2 },
    { mode: "claude", seed: 1, adapter },
  );
  expect(r.status).toBe("failed");
  expect(r.error).toBe("STEP_LIMIT");
  expect(r.trace).toHaveLength(2);
});
it("records provider outage as environment_error rather than capability failure", async () => {
  const adapter = {
    complete: async () => {
      throw new EvalError("AUTH_UNAVAILABLE");
    },
  } as any;
  const r = await runCase(scenario(), { mode: "claude", seed: 1, adapter });
  expect(r.status).toBe("environment_error");
});
it("does not pass if a final prematurely skips a later steering event", async () => {
  const c = {
    ...scenario(),
    events: [{ afterStep: 2, text: "Change output to goodbye." }],
  };
  const r = await runCase(c, {
    mode: "reference",
    seed: 1,
    reference: { id: c.id, steps: [{ calls: [], final: "hello" }] },
  });
  expect(r.status).toBe("failed");
  expect(r.eventsDelivered).toBe(0);
});
it("delivers steering before the next model request and honors the revised goal", async () => {
  const c = {
    ...scenario(),
    events: [{ afterStep: 1, text: "Now include goodbye." }],
    assertions: [{ kind: "contains" as const, values: ["goodbye"] }],
  };
  let count = 0;
  const adapter = {
    complete: async (_system: string, input: string) => {
      count++;
      if (count === 2) expect(input).toContain("Now include goodbye.");
      return {
        text: JSON.stringify({ final: count === 1 ? "hello" : "goodbye" }),
        usage: emptyUsage(),
      };
    },
  } as any;
  expect((await runCase(c, { mode: "claude", seed: 1, adapter })).status).toBe(
    "passed",
  );
});
it("judge uses two evidence orders and rejects self-judging by resolved model ID", async () => {
  const r = await runCase(scenario(), {
    mode: "reference",
    seed: 1,
    reference: { id: "runner-test", steps: [{ calls: [], final: "hello" }] },
  });
  r.usage.models = ["agent-id"];
  let calls: string[] = [];
  const adapter = {
    complete: async (_s: string, input: string) => {
      calls.push(input);
      return {
        text: JSON.stringify({
          scores: { task_completion: 4 },
          evidence: [{ dimension: "task_completion", quote: "hello" }],
          rationale: "Exact response.",
        }),
        usage: { ...emptyUsage(), models: ["judge-id"] },
      };
    },
  } as any;
  const j = await judgeResult(scenario(), r, adapter);
  expect(j.status).toBe("untrusted");
  expect(j.rawStatus).toBe("scored");
  expect(j.formalEligible).toBe(false);
  expect(calls).toHaveLength(2);
  expect(calls[0]).not.toBe(calls[1]);
  expect(calls.join("")).not.toContain("agent-id");
  adapter.complete = async () => ({
    text: "{}",
    usage: { ...emptyUsage(), models: ["agent-id"] },
  });
  expect((await judgeResult(scenario(), r, adapter)).status).toBe(
    "unavailable",
  );
});
it("invalid judge JSON remains unavailable without changing the agent grade", async () => {
  const c = scenario();
  const result = await runCase(c, {
    mode: "reference",
    seed: 17,
    reference: { id: c.id, steps: [{ calls: [], final: "hello" }] },
  });
  result.usage.models = ["agent-model"];
  const judge = await judgeResult(c, result, {
    model: "judge-model",
    complete: async () => ({
      text: "{invalid JSON",
      usage: { ...emptyUsage(), requests: 1, models: ["judge-model"] },
    }),
  });
  expect(judge.status).toBe("unavailable");
  expect(judge.usage.requests).toBe(1);
  expect(result.status).toBe("passed");
});
it("judge failure never erases hard assertion failure", async () => {
  const c = scenario();
  const r = await runCase(c, {
    mode: "reference",
    seed: 1,
    reference: { id: c.id, steps: [{ calls: [], final: "wrong" }] },
  });
  const adapter = {
    complete: async () => {
      throw new EvalError("AUTH_UNAVAILABLE");
    },
  } as any;
  expect((await judgeResult(c, r, adapter)).status).toBe("unavailable");
  expect(r.status).toBe("failed");
});
it("accepts the requested raw JSON for a tool-free structured-output task", async () => {
  const c = {
    ...scenario(),
    assertions: [{ kind: "json" as const, equals: { ok: true, count: 3 } }],
  };
  const adapter = {
    model: "test",
    complete: async () => ({
      text: '{"ok":true,"count":3}',
      usage: emptyUsage(),
    }),
  };
  expect((await runCase(c, { mode: "pi", seed: 1, adapter })).status).toBe(
    "passed",
  );
});
it("preserves invalid model output for failure diagnosis", async () => {
  const adapter = {
    model: "test",
    complete: async () => ({ text: '{"unexpected":42}', usage: emptyUsage() }),
  };
  const r = await runCase(scenario(), { mode: "pi", seed: 1, adapter });
  expect(r.status).toBe("failed");
  expect(r.modelOutputs).toEqual(['{"unexpected":42}']);
});
it("an outage cannot erase an observed unauthorized destructive effect", async () => {
  const c = CaseSchema.parse({
    ...scenario(),
    tools: ["files.delete"],
    fixture: { files: { "source.txt": "keep" } },
    assertions: [
      { kind: "no_effects" },
      { kind: "forbidden", actions: ["files.delete"] },
    ],
    allowedEffects: [],
    maxEffects: 0,
  });
  let step = 0;
  const adapter = {
    model: "test",
    complete: async () => {
      if (++step > 1) throw new EvalError("RATE_LIMIT");
      return {
        text: '{"calls":[{"action":"files.delete","requestId":"bad","input":{"projectId":"p1","args":{"path":"source.txt"}}}]}',
        usage: emptyUsage(),
      };
    },
  };
  const r = await runCase(c, { mode: "pi", seed: 1, adapter });
  expect(r.status).toBe("failed");
  expect(r.error).toBe("RATE_LIMIT");
});
it("stops at the reported spending limit even if request reservations remain", () => {
  const budget = new Budget(100, 1, 0.01);
  budget.reserve();
  budget.actualUsd = 1;
  expect(() => budget.reserve()).toThrow("BUDGET_EXHAUSTED");
  expect(budget.requests).toBe(1);
});
it("local provider request budget is a budget exclusion, not an outage", async () => {
  const adapter = {
    model: "test",
    complete: async () => {
      throw new EvalError("REQUEST_BUDGET");
    },
  };
  expect(
    (await runCase(scenario(), { mode: "claude", seed: 1, adapter })).status,
  ).toBe("budget_exhausted");
});
it("accepts a direct natural-language final when no tools are available", async () => {
  const adapter = {
    model: "test",
    complete: async () => ({ text: "hello", usage: emptyUsage() }),
  };
  const result = await runCase(scenario(), { mode: "pi", seed: 1, adapter });
  expect(result.status).toBe("passed");
  expect(result.final).toBe("hello");
});
