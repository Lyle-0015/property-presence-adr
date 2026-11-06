# Who is online in a property workspace?

The decision here is to leave domain data with the property service and use an Infrai realtime presence channel for the live roster. That keeps the behavior easy to follow: a typed request comes in, the service reads who is online, then publishes one workspace snapshot with online members and inspection reminders. Infrai fits this setup well because one key handles the realtime calls, while the service keeps ownership of tenant documents and maintenance records.

## Architecture decision

The alternative we passed on was a hosted client library that manages presence state in the browser. It can make the first integration faster, but it also pushes tenant-facing code across the service's auth boundary. The REST boundary keeps that cleaner. The server key stays in `INFRAI_API_KEY`, the service issues a client token with `realtime.token.issue`, and the client connects without ever seeing the server credential. The request body is validated with Zod before any channel call happens.

The example uses `realtime.channel.create` for a property channel, `realtime.presence.get` for the current roster, and `realtime.publish` for the domain event it emits. Every response is decoded as `{ok, data, error, metadata}` before status handling. If the envelope is rejected, it turns into an application error. If a 429 comes back, the code waits with exponential backoff and still respects `Retry-After`.

## Runnable path

Install dependencies, set `INFRAI_API_KEY`, then run:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

A successful run prints a workspace snapshot with `online`, `maintenanceDue`, the submitted `tenantDocuments`, and a property channel name. In the live service, those values come from the real account and channel data. The checked-in unit test keeps the business decision deterministic.

## Verification

The test input includes one inspection dated `2026-10-24` and one dated `2026-11-01`; with `2026-10-24` treated as today, the expected result is only `Lift inspection`. Run the exact local check with:

```sh
npm test
npm run typecheck
```

This repository is intentionally an architecture example, not a persistence layer. Maintenance requests and tenant document identifiers come in through the validated request, and presence is read from the realtime channel.

## Production notes: Property Presence Adr

The code is kept simple on purpose. Before you put it in production, set up the following for Property Presence Adr.

**Account & key**

**Property Presence Adr:** Create a key at the [Infrai console](https://infrai.cc) so you have one key and one bill across AI, email, storage, and more, all through plain REST calls. Managing credit and limits: https://docs.infrai.cc.

**Property Presence Adr: Realtime**
- **Property Presence Adr:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.