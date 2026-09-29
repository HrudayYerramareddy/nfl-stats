# Gridiron Lab

A free NFL statistics explorer inspired by natural-language sports search, with one extra idea: users can invent and name their own statistics.

## Features

- Current 2026 regular-season player summaries from nflverse
- Plain-English queries such as:
  - `Top 10 QBs with at least 80 attempts by yards per attempt`
  - `Top 10 receivers by yards per target`
  - `RBs with over 40 carries by yards per carry`
- Position, player/team, threshold, sort, and order filters
- Passing, rushing, receiving, fantasy, and EPA fields
- Custom formula builder
- Saved custom stats using browser localStorage
- Custom metrics usable for sorting/filtering and comparisons
- Head-to-head player comparison
- Responsive UI
- 15-minute server-side data cache

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Node 18+ is required because the server uses the built-in `fetch` API.

## Custom formulas

Examples:

```text
passing_yards / attempts
(passing_yards + passing_tds * 20 - interceptions * 45) / attempts
(receiving_yards + receiving_tds * 20) / targets
```

Formula input is restricted to known numeric stat fields, numbers, parentheses, and arithmetic operators.

## Data

Player summaries are loaded from the nflverse `stats_player` release for the 2026 regular season.

## Natural-language search

The current version uses a free deterministic parser. It understands positions, common stat names, thresholds, top-N requests, and ascending/descending intent. The query parser is isolated behind `POST /api/parse-query`, so a future LLM-powered parser can replace or augment it without changing the explorer or formula engine.

## Project structure

```text
nfl-stats/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server.js
└── package.json
```
