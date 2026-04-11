# Dashboard (Single Page)

The entire dashboard is **one page** at `/`. No routing, no detail pages, no settings.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  PhoneClone                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  JOIN MEETING                                               │
│  [https://meet.google.com/...          ] [Join Now]         │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ACTIVE SESSIONS                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ PHONE │ ● LIVE │ 3:42                                 │  │
│  │                                                       │  │
│  │  Caller: "Hey can you check where we're at on the     │  │
│  │           capstone project?"                          │  │
│  │  You (AI): "Yeah for sure, let me pull that up..."    │  │
│  │                                                       │  │
│  │  [End Call]                                            │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ MEETING │ ● LIVE │ Google Meet                        │  │
│  │                                                       │  │
│  │  Jake: "Lucas, what did you work on yesterday?"       │  │
│  │  You (AI): "I pushed the auth middleware and fixed     │  │
│  │             that CORS bug"                            │  │
│  │                                                       │  │
│  │  [Leave Meeting]                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components

| Component | Purpose |
|-----------|---------|
| `LiveTranscript.tsx` | Auto-scrolling transcript, receives messages via Socket.IO |
| `SessionCard.tsx` | Generic card for both phone calls and meetings (status badge, transcript, action button) |
| `StatusBadge.tsx` | LIVE / ENDED pill indicator |

That's it. Three components + the page.

## Data Flow

All data comes through Socket.IO — no REST API calls, no database queries.

```
Socket.IO events → useSocket hook → React state → render
```

The `useSocket` hook manages:
- `activeCall`: current phone call transcript + status
- `activeMeeting`: current meeting transcript + status
