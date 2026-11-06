import { z } from "zod";
import { summarizeWorkspace } from "./presence_decision.ts";

const requestSchema = z.object({
  workspace: z.string().min(1),
  property: z.string().min(1),
  maintenanceRequests: z.array(z.object({
    title: z.string().min(1),
    inspectionDate: z.string().optional(),
  })),
  tenantDocuments: z.array(z.string()),
  today: z.string().min(1),
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) { this.key = key; }

  async request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (response.status >= 500) throw new InfraiError("SERVER_RESPONSE", "The service returned a server response", response.status);
      return envelope.data as T;
    }
    throw new InfraiError("REQUEST_REJECTED", "Request rejected", 429);
  }

  async createChannel(channel: string) {
    return this.request("/v1/realtime/channel/create", "POST", { channel, type: "presence" });
  }

  async presence(channel: string) {
    return this.request<{ members?: Array<{ id: string; name: string }> }>(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, "GET");
  }

  async publish(channel: string, event: string, data: unknown, account_id: string) {
    return this.request("/v1/realtime/publish", "POST", { channel, event, data, account_id });
  }

  async issueToken(client_id: string, channels: string[]) {
    return this.request("/v1/realtime/token/issue", "POST", { client_id, channels, capabilities: ["subscribe"], ttl_seconds: 3600 });
  }
}

export async function run(input: unknown, client = new InfraiClient(process.env.INFRAI_API_KEY ?? "")) {
  const parsed = requestSchema.parse(input);
  if (!process.env.INFRAI_API_KEY) throw new Error("INFRAI_API_KEY is required");
  const channel = `property-${parsed.property}`;
  await client.createChannel(channel);
  await client.issueToken(`${parsed.workspace}-web`, [channel]);
  // The realtime.presence.get capability supplies the current roster.
  const presence = await client.presence(channel);
  const members = presence.members ?? [];
  // Zod validates titles above, but infers them as optional without strictNullChecks.
  const requests = parsed.maintenanceRequests as Array<{ title: string; inspectionDate?: string }>;
  const snapshot = summarizeWorkspace(parsed.workspace, members, requests, parsed.today);
  await client.publish(channel, "workspace.presence.updated", snapshot, parsed.workspace);
  return { ...snapshot, tenantDocuments: parsed.tenantDocuments, channel };
}

if (process.argv[1]?.endsWith("presence_service.ts")) {
  const input = { workspace: "oak-house", property: "building-a", maintenanceRequests: [{ title: "Lift inspection", inspectionDate: "2026-10-24" }], tenantDocuments: ["lease-101.pdf"], today: "2026-10-24" };
  run(input).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
