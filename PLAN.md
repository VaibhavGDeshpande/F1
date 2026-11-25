# F1 Analysis & Live Telemetry Site — Plan

Goal: one site for (1) deep historical data analysis, (2) live race-weekend timing + telemetry, (3) every F1 news item, strategy calls and driver/car "paperwork" (components, penalties, upgrades).

---

## 1. Data sources (what we can actually get)

| Need | Source | Cost / notes |
|---|---|---|
| Historical laps, telemetry (speed/throttle/brake/gear/RPM), positions, stints, pits, weather, race control, team radio | **OpenF1 API** (openf1.org) | Historical is free. Live/real-time access is a paid tier (MQTT/WebSocket) — check current pricing. |
| Historical telemetry + analysis helpers (Python) | **FastF1** library | Free. Best for heavy processing (lap comparisons, corner-by-corner). Has a live-timing recorder too. |
| Results, standings, schedules back to 1950 | **Jolpica-F1 API** (Ergast replacement) | Free, rate-limited. |
| Live timing feed (raw) | F1 live timing SignalR feed | Unofficial; car/position streams may require an F1 TV login now. Use OpenF1 live as primary, this as fallback. |
| Penalties, stewards' decisions, PU component usage, car upgrades ("Car Presentation Submissions"), scrutineering, grid penalties | **FIA documents page** (fia.com → F1 → documents) | Free PDFs. We scrape + parse them per event. This is the key source for "components changed / penalties". |
| Live penalties / investigations / flags during a session | OpenF1 `race_control` + live feed | Arrives in real time as text messages. |
| News | RSS feeds: formula1.com, Autosport, Motorsport.com, The Race, RaceFans, team sites | Show headline + short summary + link out. **Don't republish full articles** (copyright). |
| Weather forecast for the weekend | Open-Meteo (free) using circuit coordinates | Free, no key. |

---

## 2. Feature list

### A. Live race weekend (the headline feature)
- **Live timing tower**: position, gap, interval, last/best lap, sectors (purple/green/yellow), tyre compound + age, pit count.
- **Live track map**: car dots moving on the circuit outline (from position data).
- **Live telemetry**: pick 1–2 drivers → speed / throttle / brake / gear / RPM traces, updating each lap.
- **Race control feed**: flags, SC/VSC, investigations, penalties, track limits — as a live ticker with push alerts.
- **Team radio feed**: playable clips with timestamps.
- **Live strategy panel**: current stints, predicted pit windows, undercut/overcut threat between two drivers, "pit now → rejoins in P__ behind __".
- **Weather strip**: air/track temp, rain, wind; forecast for the rest of the session.
- **Session clock & countdown** to every session in the user's local timezone.

### B. Post-session / historical analysis
- **Lap comparison**: overlay any two laps (any driver, any session, any year in data) — speed trace + delta-time chart + track map coloured by who's faster.
- **Corner analysis**: min speed, braking point, throttle pickup per corner.
- **Race pace**: lap-time distribution (box/violin) per driver, fuel-corrected.
- **Tyre degradation**: lap time vs tyre age per compound, deg rate per driver/team.
- **Stint chart**: horizontal bars showing each driver's tyre strategy.
- **Position chart**: position-by-lap lines for the whole race.
- **Gap-to-leader chart** and **pit stop times** leaderboard.
- **Quali analysis**: teammate deltas, ideal lap (best sectors), improvement per run.
- **Season views**: standings over time, teammate head-to-head (quali/race), points per race.

### C. News & paddock info
- **News feed**: aggregated, de-duplicated, filterable by driver / team / topic.
- **Driver & car "logbook"** per event (parsed from FIA docs):
  - Power unit elements used vs allocation (ICE, turbo, MGU-K, energy store, control electronics, exhaust) → **"next element = grid penalty"** warning.
  - Gearbox / driveline changes.
  - Grid penalties, time penalties, penalty points on licence (running total → race-ban risk).
  - Reprimands count.
  - Car upgrades declared per team per event.
  - Parc fermé changes / pit-lane starts.
- **Stewards' decisions** page: summary + link to the PDF.
- **Driver pages**: bio, stats, current season form, penalty points, components used, recent news.
- **Team pages**: drivers, upgrades timeline, PU supplier, reliability record.
- **Calendar**: all sessions, local time, circuit info, last year's winner/strategy, add-to-calendar (.ics).

### D. Strategy
- **Strategy calls tracker**: log each pit stop with context (SC timing, undercut, tyre choice) and mark whether it gained/lost positions.
- **Pre-race strategy preview**: likely 1-stop vs 2-stop based on practice long runs + tyre allocation left per driver.
- **Pit-loss table** per circuit (green flag vs SC/VSC).
- **"What if" simulator** (later): change one driver's pit lap and replay the race gap model.

---

## 3. More features to add later (phase 5+)

- **Push notifications** (web push / Telegram / Discord bot): session start, SC, penalty for my favourite driver, new grid penalty.
- **AI race summary**: auto-generated session recap from timing + race control + news (LLM).
- **Ask-the-data chat**: "Who was fastest in sector 2 on mediums?" → query + chart.
- **Race replay**: scrub a past race on the track map with timing tower synced.
- **Predictions game**: users predict podium/pole, leaderboard among friends.
- **Accounts**: favourite drivers/teams, custom dashboard layout.
- **Rumours / silly season tracker** (contracts, seat moves) with source links.
- **Embeddable charts** + "share as image" for social posts.
- **Fantasy F1 helper**: price vs points, form.
- **Multi-language**, dark mode, mobile layout for watching on a second screen.
- **F2/F3 / F1 Academy** later using the same pipelines where data exists.

---

## 4. Architecture (keep it simple)

```
                 ┌──────────────── Live ingest worker (always-on, Python/Node) ───────────┐
OpenF1 live ───► │ normalise → Redis pub/sub (latest state)  → WebSocket/SSE to browsers   │
F1 SignalR  ───► │           → Postgres (store every message for replay)                   │
                 └─────────────────────────────────────────────────────────────────────────┘
Scheduled jobs (every 10–30 min, faster on race weekends):
  - RSS news pull → dedupe → Postgres
  - FIA documents scrape → PDF parse → penalties / components / upgrades tables
  - Jolpica results + standings sync
  - FastF1 post-session processing → precomputed analysis JSON (cached)

Frontend: Next.js (App Router) + charts (Plotly or ECharts for telemetry; they handle 10k+ points)
DB: Postgres (Supabase) · Cache/live state: Redis (Upstash)
Hosting: Vercel for the site + scheduled jobs; the always-on live worker on Vercel Daemons (beta) or Railway/Fly.
```

Why a separate worker: live feeds are long-lived connections; serverless functions shouldn't own them.

---

## 5. Build phases

| Phase | Scope | Done when |
|---|---|---|
| **1 — MVP (historical + news)** | Calendar, results/standings, news feed, lap comparison, stint chart, position chart, driver/team pages | Can open any 2023–2026 race and compare two drivers' laps |
| **2 — Paddock logbook** | FIA doc scraper + parser: penalties, PU components, penalty points, upgrades; alerts on new docs | Each event page shows components used + all penalties |
| **3 — Live weekend** | Live worker, timing tower, track map, race control ticker, radio, weather | Survives a full race session live without manual restarts |
| **4 — Strategy** | Deg models, pit-window + undercut calculator, strategy tracker, pre-race preview | Pit-window predictions shown live and graded after the race |
| **5 — Extras** | Notifications, AI recaps, chat-with-data, replay, predictions game, accounts | — |

Timing note: today is 2026-11-25, so only the last round(s) of 2026 remain live. Build phase 3 by **recording a live session and replaying it locally** (also our test harness); go live for real at 2027 pre-season testing.

---

## 6. Risks / things to decide

- **Legal**: unofficial fan site. No F1/FIA/team logos, add a "not affiliated" disclaimer, link out to news instead of copying it, respect source ToS.
- **Live data dependency**: unofficial feeds can change or lock down without notice — keep two sources and a "data delayed" state in the UI.
- **FIA PDF formats** change between events — parser needs tests with saved sample PDFs.
- **2026 regulations** changed the car (new PU split, no MGU-H, active aero, overtake mode instead of DRS) — telemetry fields like DRS may be missing or mean something different; handle per season.
- **Cost**: OpenF1 live tier + Redis + always-on worker are the only paid parts; everything else fits free tiers at small scale.

## 7. Open decisions
1. Python (FastF1) for all processing, or Python only for analysis + TypeScript for the rest? → Recommended: Python worker + jobs, TypeScript frontend.
2. Accounts in phase 1 or later? → Recommended: later.
3. Pay for OpenF1 live tier, or try the raw F1 feed first? → Recommended: pay for OpenF1 live when phase 3 starts.
