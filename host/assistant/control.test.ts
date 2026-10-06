import { connect } from "node:net";
import { expect, it, vi } from "vitest";
import { HostControl } from "../control";

async function call(
  environment: Record<string, string>,
  namespace = "assistant",
) {
  return new Promise<any>((resolve, reject) => {
    const socket = connect(
      Number(environment.MONOCODE_CONTROL_ENDPOINT.split(":")[1]),
      "127.0.0.1",
    );
    let reply = "";
    socket.on("error", reject);
    socket.setEncoding("utf8");
    socket.on("connect", () =>
      socket.write(
        JSON.stringify({
          namespace,
          token: environment.MONOCODE_CONTROL_TOKEN,
          requestId: "stable",
          action: "projects.list",
          input: {},
        }) + "\n",
      ),
    );
    socket.on("data", (data) => (reply += data));
    socket.on("end", () => resolve(JSON.parse(reply)));
  });
}
it("isolates assistant grants from orchestration and from an older brain generation", async () => {
  const handle = vi.fn(async () => ({ projects: [] }));
  const assistant = new HostControl(handle, {
    namespace: "assistant",
    actions: ["projects.list"],
  });
  const orchestration = new HostControl(async () => ({}));
  await Promise.all([assistant.ready, orchestration.ready]);
  try {
    assistant.enable("brain");
    orchestration.enable("lead");
    const first = assistant.environment("brain");
    expect(await call(first)).toMatchObject({ ok: true });
    expect(await call(first, "control")).toMatchObject({ ok: false });
    expect(
      await call({
        ...first,
        MONOCODE_CONTROL_TOKEN:
          orchestration.environment("lead").MONOCODE_CONTROL_TOKEN,
      }),
    ).toMatchObject({ ok: false });
    assistant.enable("brain");
    expect(await call(first)).toMatchObject({ ok: false });
    expect(await call(assistant.environment("brain"))).toMatchObject({
      ok: true,
    });
    expect(handle).toHaveBeenCalledTimes(2);
  } finally {
    await assistant.close();
    await orchestration.close();
  }
});
it("suppresses a read result when its grant is revoked during an await", async () => {
  let finish!: () => void;
  const started = vi.fn();
  const assistant = new HostControl(
    async () => {
      started();
      await new Promise<void>((resolve) => (finish = resolve));
      return { secretResult: true };
    },
    { namespace: "assistant", actions: ["projects.list"] },
  );
  await assistant.ready;
  try {
    assistant.enable("brain");
    const request = call(assistant.environment("brain"));
    await vi.waitFor(() => expect(started).toHaveBeenCalled());
    assistant.disable("brain");
    finish();
    expect(await request).toMatchObject({ ok: false });
  } finally {
    await assistant.close();
  }
});
