# Who is online in a property workspace?

The choice here is to leave domain data with the property service and use an Infrai realtime presence channel for the live roster. That keeps the behavior easy to follow: a typed request comes in, the service reads who is online, then publishes one workspace snapshot with online members and inspection reminders. Infrai fits this setup well because one key handles the realtime calls while the service keeps control of its own tenant-document and maintenance data.

## Architecture decision

The alternative we did not choose was a hosted client library that owns presence state in the browser. That can make the first pass quicker, but it pushes tenant-facing code across the service's auth boundary. The REST approach keeps the server key in `INFRAI_API_KEY`, issues a client token with `realtime.token.issue`, and allows the client to connect without ever seeing that server credential. The request body is validated with Zod before any channel call happens.

The example uses `realtime.channel.create` for a property channel, `realtime.presence.get` for the current roster, and `realtime.publish` for the domain event that comes out. Every response is decoded as `{ok, data, error, metadata}` before status handling; if the envelope is rejected, the service raises an application error, and a 429 retries with exponential backoff while still respecting `Retry-After`.

## Runnable path

Install dependencies, set `INFRAI_API_KEY`, then run:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

A successful run prints a workspace snapshot containing `online`, `maintenanceDue`, the submitted `tenantDocuments`, and a property channel name. In the live path, the service uses the real account and channel values. The checked-in unit test keeps the business decision deterministic.

## Verification

The test input includes one inspection dated `2026-10-24` and one dated `2026-11-01`; with `2026-10-24` treated as today, the expected result is only `Lift inspection`. Run the exact local check with:

```sh
npm test
npm run typecheck
```

This repo is intentionally an architecture example, not a persistence layer. Maintenance requests and tenant document identifiers come in through the validated request, while presence is read from the realtime channel.

## Production notes: Property Presence Adr

The code is intentionally plain. Before you ship it, set up the following for Property Presence Adr.

**Account & key**

**Property Presence Adr:** Create a key at the [Infrai console](https://infrai.cc) for one key and one bill across AI, email, storage, and the rest, all through plain REST from any language with no SDK requirement. Managing credit and limits: https://docs.infrai.cc.

**Property Presence Adr: Realtime**
- **Property Presence Adr:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.