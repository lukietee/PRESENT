# API Contract (Socket.IO Events)

No REST API. No database. Everything flows through Socket.IO between the dashboard and the backend server.

## In-Memory State (Server)

```typescript
const state = {
  activeCall: null as null | {
    id: string;
    callerNumber: string;
    transcript: { role: string; content: string; timestamp: Date }[];
    status: 'active' | 'ended';
  },
  activeMeeting: null as null | {
    id: string;
    meetingUrl: string;
    transcript: { role: string; content: string; speaker?: string; timestamp: Date }[];
    status: 'joining' | 'active' | 'ended';
  },
};
```

## Events: Server → Dashboard

| Event | Payload | When |
|-------|---------|------|
| `call:start` | `{ id, callerNumber }` | Twilio webhook received |
| `call:transcript` | `{ role, content }` | New message (caller or AI) |
| `call:end` | `{ id }` | Call ended |
| `meeting:joining` | `{ id, meetingUrl }` | Playwright launching |
| `meeting:active` | `{ id }` | Avatar joined the meeting |
| `meeting:transcript` | `{ role, content, speaker? }` | New message in meeting |
| `meeting:ended` | `{ id }` | Meeting session closed |

## Events: Dashboard → Server

| Event | Payload | When |
|-------|---------|------|
| `meeting:join_now` | `{ url }` | User pastes URL + clicks Join |
| `meeting:leave` | `{}` | User clicks Leave Meeting |
| `call:end` | `{}` | User clicks End Call |

**Total: 10 events.** Agree on these in the first 30 minutes so Person A and Person B can work independently.
