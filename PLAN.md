# OpenClaw Agent Integration Plan for nilo.chat

## Overview

Connect an OpenClaw agent to nilo.chat so it can read and send messages in
real-time across all four channels (`welcome`, `general`, `growth`, `feedback`).

---

## Architecture at a Glance

```
┌──────────────────────────┐         Socket.IO          ┌──────────────────────────────┐
│     OpenClaw Agent       │◄──────────────────────────► │   nilo.chat Backend          │
│  (local Node.js runtime) │    wss://nilochat-         │   (Express + Socket.IO)      │
│                          │    production.up.railway.app│   PostgreSQL                 │
│  ┌────────────────────┐  │                             └──────────────────────────────┘
│  │ nilo.chat Skill    │  │
│  │  (SKILL.md + code) │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## Phase 1 — Socket.IO Bot Client (Backend)

**Goal**: A lightweight Node.js service that connects to nilo.chat as a bot
user and exposes a clean async API for sending/receiving messages.

### Tasks

1. **Create `src/server/bot-client.js`** — a reusable Socket.IO client module
   - Connect to `VUE_APP_SOCKET_URL` (production or local)
   - Emit `user_connected` with a bot username (e.g. `OpenClaw`)
   - Listen for `chat_message` events on all channels
   - Expose helpers: `sendMessage(channel, text)`, `joinChannel(channel)`,
     `onMessage(callback)`
   - Handle reconnection, error logging, and graceful shutdown

2. **Add CORS origin for the bot** (if self-hosting the bot separately)
   - Update `src/server/index.js` allowed origins list to include the bot's
     origin, or connect from `localhost` which is already allowed during dev

3. **Write tests** — `tests/bot-client.test.js`
   - Verify connect/disconnect lifecycle
   - Verify message send/receive round-trip
   - Verify channel switching

### Key Socket.IO Events (already exist, no server changes needed)

| Direction       | Event             | Payload                                    |
|-----------------|-------------------|--------------------------------------------|
| Bot → Server    | `user_connected`  | `{ username, channel }`                    |
| Bot → Server    | `chat_message`    | `{ message }` (server adds username/ts)    |
| Bot → Server    | `join_channel`    | `{ channel }`                              |
| Server → Bot    | `chat_message`    | `{ username, message, channel, timestamp }`|
| Server → Bot    | `message_history` | `[...messages]`                            |

---

## Phase 2 — OpenClaw Skill

**Goal**: Package the bot client as an OpenClaw Skill so the agent can
discover and invoke it through natural language.

### Tasks

1. **Create skill directory**:
   `~/.openclaw/workspace/skills/nilo-chat/`

2. **Write `SKILL.md`** — declares the skill to OpenClaw:
   ```markdown
   ---
   name: nilo-chat
   description: Send and receive messages on nilo.chat in real time
   tools:
     - nilo_send_message
     - nilo_read_messages
     - nilo_list_channels
   ---

   # nilo-chat

   Connect to nilo.chat and interact with channels.

   ## Tools

   ### nilo_send_message
   Send a message to a nilo.chat channel.
   - **channel** (string, required): one of welcome, general, growth, feedback
   - **message** (string, required): the message text (max 2000 chars)

   ### nilo_read_messages
   Retrieve recent messages from a channel.
   - **channel** (string, required)
   - **limit** (number, optional, default 20)

   ### nilo_list_channels
   List available channels with descriptions.
   ```

3. **Implement tool handlers** — JS/TS files in the skill directory that
   import the bot client from Phase 1 and fulfill each tool call.

4. **Register the skill** via ClawHub or local workspace install.

---

## Phase 3 — Real-Time Event Bridge (bidirectional)

**Goal**: Let the OpenClaw agent react to incoming nilo.chat messages
automatically (not just on-demand tool calls).

### Option A — Webhook Relay (simpler)

1. Add a thin HTTP endpoint to the nilo.chat server:
   `POST /api/webhooks/outgoing` — fires on every new `chat_message`
2. OpenClaw's webhook listener receives the payload and wakes the agent
3. The agent decides whether to respond and calls `nilo_send_message`

### Option B — Persistent Socket Listener in the Skill (recommended)

1. The skill keeps a long-lived Socket.IO connection open
2. On each incoming `chat_message`, push it into OpenClaw's gateway as an
   inbound event (similar to how WhatsApp/Telegram channels work)
3. The agent sees new messages in its inbox and can respond conversationally

### Filtering / Anti-Loop

- Ignore messages where `username === bot_username` to prevent self-replies
- Optionally only respond when @mentioned or in specific channels
- Rate-limit outbound messages (e.g. max 1 reply per 5 seconds)

---

## Phase 4 — Auth & Identity (optional enhancement)

**Goal**: Give the bot a verified identity instead of anonymous access.

1. Create a Clerk service account for the bot
2. Pass Clerk session token when connecting via Socket.IO
3. Server-side: validate the token and tag messages as `bot: true`
4. UI-side: render bot messages with a distinct badge/avatar

---

## Phase 5 — Multi-Agent Routing (optional enhancement)

**Goal**: Run multiple specialized OpenClaw agents, each owning a channel.

1. Use OpenClaw's multi-agent routing to assign one agent per nilo.chat channel
2. Use `sessions_send` for agents to coordinate across channels
3. Tag each agent's username distinctly (e.g. `Claw-Growth`, `Claw-Feedback`)

---

## Implementation Priority

| Phase | Effort | Impact | Recommendation        |
|-------|--------|--------|-----------------------|
| 1     | Low    | High   | **Start here**        |
| 2     | Medium | High   | Do immediately after  |
| 3B    | Medium | High   | Core real-time value  |
| 4     | Low    | Medium | Nice-to-have          |
| 5     | Medium | Low    | Only if multi-agent   |

---

## Files to Create / Modify

| File                                          | Action  | Purpose                              |
|-----------------------------------------------|---------|--------------------------------------|
| `src/server/bot-client.js`                    | Create  | Socket.IO bot client library         |
| `tests/bot-client.test.js`                    | Create  | Bot client tests                     |
| `src/server/index.js`                         | Modify  | Add webhook endpoint (Phase 3A only) |
| `~/.openclaw/workspace/skills/nilo-chat/`     | Create  | OpenClaw skill directory             |
| `SKILL.md` + tool handler files               | Create  | Skill definition and tool logic      |
| `package.json`                                | Modify  | Add `socket.io-client` to server deps|

---

## Risks & Mitigations

| Risk                          | Mitigation                                      |
|-------------------------------|--------------------------------------------------|
| Bot reply loops               | Self-message filtering + rate limiting           |
| Socket disconnects            | Auto-reconnect with exponential backoff          |
| Message flooding              | Server-side rate limiting per username           |
| Security (prompt injection)   | Treat all inbound chat as untrusted input        |
| CORS issues                   | Add bot origin to server's allowed origins list  |
