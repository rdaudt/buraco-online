# Buraco Clube

React 19 / TypeScript multiplayer buraco, served by a Cloudflare Worker with D1 persistence.

## Features
- Public rooms with unique invitation URLs, no accounts or passwords.
- Two players or four players in partnerships (seats 1+3, 2+4).
- Automatic start when all named seats join; 108-card shuffle, 11-card hands and two 11-card mortos.
- Server-validated turns, draw/pickup, same-suit runs, wild twos, meld extension and discard.
- Shared table and complete visible discard pile; own hand shown to the selected seat.
- A layered SVG dog avatar, based on the owner's photo, watches the table with subtle eye and head reactions to visible plays and local drags. Each browser can hide it with the Mascote control; the choice is saved locally and the table reclaims the space. The standalone illustration is `public/pet-avatar.svg`; run `node scripts/export-pet-avatar.mjs` after editing `app/pet-avatar.tsx` to refresh it.
- Optional always-visible video tiles and live voice through Cloudflare Realtime SFU, when configured.
- Host closes rounds; persisted score breakdown and unlimited additional rounds.
- Optimistic database revisions prevent simultaneous actions from overwriting one another. Clients refresh every 1.5 seconds.

## House rules
Two decks with two printed jokers each. Every 2 can act as a wildcard worth 20 points. A 2 of the run’s suit in the natural 2 position counts as a natural card; if a former wild 2 moves there and the run is otherwise natural, the canasta becomes clean. A run has at most one wildcard and is dirty whenever it uses a joker or 2 as a wildcard. Aces may be low or high. Runs only, minimum three cards. Canastas of seven or more: clean +200, dirty +100. No 500/1000 bonus. Card values: printed joker=50, 2=20, A=15, 8–K=10, 3–7=5. Cards in hand subtract points, unclaimed morto −100, valid final out +100. Going out requires a claimed morto and at least one canasta of either kind. One of five short barks or three meows plays randomly on each seated player’s device when the turn changes; the same clip is not repeated on consecutive turns. Audio sources, licenses, and edits are listed in `public/turn-sounds/CREDITS.txt`. Host may also close an interrupted round without an out bonus. With an empty stock, take the discard or have the host close the round. Four-player scores are partnership totals.

## Trust model
Anyone with a room URL can select or resume any seat, including the host. This is intentional: there is no authentication or security boundary. Browser local storage only remembers the seat; authoritative games and scores live in D1. Reloads and reconnects retain game state.

## Development
Use the package manager selected by setup. `pnpm dev` runs development, `pnpm build` builds, and `pnpm exec tsc --noEmit` checks types. `node --experimental-strip-types tests/game.test.ts` checks game rules.

D1 schema lives in `db/schema.ts`; generate migrations with `pnpm db:generate`. Bind DB through `.openai/hosting.json`. Apply the generated SQL to local D1 before exercising room endpoints. Production migrations are included with publication.

## Optional live voice and video (Cloudflare Realtime SFU)

The game and D1 remain on the existing Site. Realtime media uses one Cloudflare Realtime SFU app and server-side signaling through `app/api/rooms/[id]/media`. The `media_sessions` table contains only temporary session IDs, seat numbers and presence timestamps; no audio or video is recorded or stored.

To turn it on, create a **Realtime → Serverless SFU** app in your Cloudflare account. Set the following secret runtime environment values in Sites and deploy the saved version again:

- `REALTIME_SFU_APP_ID` — SFU App ID
- `REALTIME_SFU_APP_SECRET` — SFU App Secret; server-side only

For reliable connections on restrictive networks, create a TURN key in **Realtime → TURN**, then set `REALTIME_TURN_KEY_ID` and `REALTIME_TURN_API_TOKEN` as secrets too. The endpoint creates 24-hour short-lived ICE credentials for each visiting browser. Without TURN values, the call uses Cloudflare's STUN server; some networks may fail. Do not put any secret in browser source or `.openai/hosting.json`.

The call is optional and independently joined from the table. Camera and microphone start off; each is explicitly enabled. One publishing connection per media kind and separate receiving connections per remote publication simplify negotiation. Presence expires after 35 seconds without a heartbeat. Round transitions do not disconnect the call. A seat is deliberately not authenticated in this game: anyone with the room URL can select or resume it, so the media endpoint follows the same access model.

Production verification requires the owner-provided SFU values and two distinct devices/browsers. Test camera and audio toggles, audio-only participation, a round transition, reload/rejoin, and an interrupted connection. Without values, the game remains playable and shows that the call awaits configuration.
