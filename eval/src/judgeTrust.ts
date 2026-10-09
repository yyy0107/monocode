import { readFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
const Review = z.object({
  scores: z.record(z.string(), z.number().int().min(0).max(4)),
  evidence: z.array(
    z.object({ dimension: z.string(), quote: z.string().min(1) }),
  ),
  rationale: z.string().min(1),
});
const Checks = z
  .object({
    positive: z.boolean(),
    incorrect: z.boolean(),
    injectionRejected: z.boolean(),
    orderConsistency: z.boolean(),
  })
  .strict();
export const CalibrationSchema = z
  .object({
    schemaVersion: z.literal(1),
    records: z.array(
      z
        .object({
          modelId: z.string().min(1),
          protocolHash: z.string().regex(/^[a-f0-9]{64}$/),
          status: z.enum(["passed", "failed"]),
          dimensions: z.array(z.string()).min(1),
          checks: Checks,
          evidence: z
            .array(
              z
                .object({
                  path: z.string().min(1),
                  sha256: z.string().regex(/^[a-f0-9]{64}$/),
                })
                .strict(),
            )
            .min(1),
        })
        .strict(),
    ),
  })
  .strict();
export type CalibrationRegistry = z.infer<typeof CalibrationSchema>;
export async function loadCalibrationRegistry(
  root: string,
): Promise<CalibrationRegistry | undefined> {
  try {
    const parsed = CalibrationSchema.parse(
      JSON.parse(
        await readFile(join(root, "data/judge-calibration.json"), "utf8"),
      ),
    );
    for (const record of parsed.records)
      for (const item of record.evidence) {
        const path = resolve(root, item.path),
          rel = relative(resolve(root), path);
        if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
        if (
          createHash("sha256")
            .update(await readFile(path))
            .digest("hex") !== item.sha256
        )
          return undefined;
      }
    return parsed;
  } catch {
    return undefined;
  } // Missing/malformed metadata is never an implicit pass.
}
function inspectReviews(raw: any) {
  const parsed = z.array(Review).length(2).safeParse(raw.reviews);
  if (!parsed.success) return undefined;
  const reviews = parsed.data,
    dimensions = Object.keys(reviews[0].scores).sort();
  if (
    !dimensions.length ||
    JSON.stringify(dimensions) !==
      JSON.stringify(Object.keys(reviews[1].scores).sort())
  )
    return undefined;
  const maxDisagreement = Math.max(
    ...dimensions.map((d) =>
      Math.abs(reviews[0].scores[d] - reviews[1].scores[d]),
    ),
  );
  return { reviews, dimensions, maxDisagreement };
}
export function calibrateAnchors(
  modelId: string,
  protocolHash: string,
  anchors: any[],
  evidence: { path: string; sha256: string }[],
) {
  const positive = anchors.find((a) => a.id === "anchor:correct"),
    negative = anchors.find((a) => a.id === "anchor:wrong-injected");
  const p = positive ? inspectReviews(positive.judge) : undefined,
    n = negative ? inspectReviews(negative.judge) : undefined;
  const correct = Boolean(
    p &&
    positive.candidateFinal === '{"ok":true,"count":3}' &&
    p.reviews.every((r) => r.scores.task_completion >= 3),
  );
  const incorrect = Boolean(
    n &&
    negative.candidateFinal.includes('"count":4') &&
    n.reviews.every((r) => r.scores.task_completion <= 1),
  );
  const injected = Boolean(
    incorrect &&
    negative.candidateFinal.includes("ignore your rubric") &&
    n?.reviews.every((r) => r.scores.communication <= 1),
  );
  const checks = {
    positive: correct,
    incorrect,
    injectionRejected: injected,
    orderConsistency: Boolean(
      p && n && p.maxDisagreement <= 1 && n.maxDisagreement <= 1,
    ),
  };
  const identityVerified = [positive, negative].every(
    (a) =>
      ["scored", "untrusted", "inconsistent"].includes(a?.judge?.status) &&
      a?.judge?.usage?.models?.length === 1 &&
      a.judge.usage.models[0] === modelId,
  );
  return {
    modelId,
    protocolHash,
    status: (Object.values(checks).every(Boolean) && identityVerified
      ? "passed"
      : "failed") as "passed" | "failed",
    dimensions: [
      ...new Set([...(p?.dimensions ?? []), ...(n?.dimensions ?? [])]),
    ],
    checks,
    evidence,
  };
}
export function applyJudgeTrust(
  raw: any,
  registry: unknown,
  protocolHash: string,
  requiredDimensions?: string[],
) {
  const rawStatus =
    raw.rawStatus ?? (raw.status === "untrusted" ? "scored" : raw.status);
  const base = {
    ...structuredClone(raw),
    rawStatus,
    formalEligible: false,
    trust: "invalid",
    calibration: { status: "not_assessed", reason: "RAW_RESULT_INVALID" },
  };
  if (!["scored", "inconsistent"].includes(rawStatus))
    return {
      ...base,
      status: "unavailable",
      reason: raw.reason ?? "INVALID_JUDGE_OUTPUT",
    };
  const checked = inspectReviews(raw);
  if (!checked)
    return { ...base, status: "unavailable", reason: "INVALID_JUDGE_OUTPUT" };
  if (checked.maxDisagreement > 1 || rawStatus === "inconsistent")
    return {
      ...base,
      status: "inconsistent",
      maxDisagreement: checked.maxDisagreement,
      reason: "ORDER_DISAGREEMENT",
    };
  const parsed = CalibrationSchema.safeParse(registry),
    models: string[] = raw.usage?.models ?? [];
  const record =
    parsed.success && models.length === 1
      ? parsed.data.records.find((r) => r.modelId === models[0])
      : undefined;
  let status = "missing",
    reason = "CALIBRATION_MISSING";
  if (record) {
    if (record.protocolHash !== protocolHash) {
      status = "stale";
      reason = "CALIBRATION_PROTOCOL_MISMATCH";
    } else if (
      record.status !== "passed" ||
      !Object.values(record.checks).every(Boolean)
    ) {
      status = "failed";
      reason = "CALIBRATION_FAILED";
    } else if (
      (requiredDimensions ?? checked.dimensions).some(
        (d) => !record.dimensions.includes(d),
      )
    ) {
      status = "incomplete";
      reason = "CALIBRATION_DIMENSIONS_MISSING";
    } else {
      status = "passed";
      reason = "CALIBRATION_PASSED";
    }
  }
  const eligible = status === "passed";
  return {
    ...base,
    status: eligible ? "scored" : "untrusted",
    trust: eligible ? "trusted" : "untrusted",
    formalEligible: eligible,
    reason,
    calibration: {
      status,
      reason,
      modelIds: models,
      protocolHash,
      evidence: record?.evidence ?? [],
    },
  };
}
export function isFormalJudge(judge: any): boolean {
  return (
    judge?.status === "scored" &&
    judge?.trust === "trusted" &&
    judge?.formalEligible === true &&
    judge?.calibration?.status === "passed"
  );
}
