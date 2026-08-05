# AI Avatar UI

The frontend module for the AI Avatar interface — a set of framework-free Web
Components (built with Vite) that render a talking 3D avatar, handle chat
input and voice, and stay in sync with a backend for AI replies,
text-to-speech, and persisted chat history.

## 🚀 Live Demo

**[Check out the live demo →](https://ai-avatar-ui-ghost.vercel.app/)**

## Load It From Vercel

The latest build is hosted at
[`ai-avatar-ui-ghost.vercel.app`](https://ai-avatar-ui-ghost.vercel.app/) —
no npm install or build step needed. Drop this into any page:

Html
```html
 <div class="ai-avatar-shell">
    <div class="avatar-stage">
      <avatar-model
        backend="backend-url"
        app-id="your-app-id"
        avatar-scale="1"
        avatar-vertical-offset="-1.25"
      ></avatar-model>
      <avatar-captions></avatar-captions>
    </div>
    <avatar-status></avatar-status>
    <avatar-settings></avatar-settings>

    <!-- Optional: point avatar-inputs at your own chat UI instead of its
         built-in textarea/buttons. Each attribute is independent — supply
         one, two, or all three; omit any of them to keep the built-in
         default for that piece. See Custom Input Elements below. -->
    <!--
    <div class="my-existing-chat-bar">
      <textarea id="my-chat-input"></textarea>
      <button id="my-mic-btn">🎤</button>
      <button id="my-send-btn">Send</button>
    </div>
    <avatar-inputs
      text-input="#my-chat-input"
      send-button="#my-send-btn"
      mic-button="#my-mic-btn"
    ></avatar-inputs> -->
   <avatar-inputs></avatar-inputs>
   
  </div>

  <script type="module" src="https://ai-avatar-ui-ghost.vercel.app/ai-avatar-ui.js"></script>
```
React/Next.js
```jsx
'use client'
import { useEffect } from 'react';

export default function AvatarWidget() {
  useEffect(() => {
    // Dynamically load the Web Component script when the component mounts
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ai-avatar-ui-ghost.vercel.app/ai-avatar-ui.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      // Clean up the script when the component unmounts
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="ai-avatar-shell">
      <div className="avatar-stage">
        <avatar-model
          backend="backend-url"
          app-id="your-app-id"
          avatar-scale="1"
          avatar-vertical-offset="-1.25"
        />
        <avatar-captions />
      </div>
      <avatar-status />
      <avatar-settings />
      {/* Optional: point avatar-inputs at your own chat UI instead of its
          built-in textarea/buttons. Each attribute is independent — supply
          one, two, or all three; omit any of them to keep the built-in
          default for that piece. See Custom Input Elements below. */}
      {/*<div className="my-existing-chat-bar">
        <textarea id="my-chat-input" />
        <button id="my-mic-btn">🎤</button>
        <button id="my-send-btn">Send</button>
      </div>
      <avatar-inputs
        text-input="#my-chat-input"
        send-button="#my-send-btn"
        mic-button="#my-mic-btn"
      />*/}
      <avatar-inputs />
    </div>
  );
}
```


Set `backend` to wherever your own backend (implementing the
[API Contract](#api-contract) below) is running — see
[Persistence & Identity](#persistence--identity) and the
[Backend](#backend) section for details. `app-id` is optional but
recommended for any third-party integration — see
[Persistence & Identity](#persistence--identity). Visit the URL directly
in a browser for a live demo and usage notes.

## Screenshots

<p align="center">
  <img src="public/Screenshot1.png" width="48%" />
  <img src="public/Screenshot2.png" width="48%" />
</p>
<p align="center">
  <img src="public/Screenshot3.png" width="48%" />
  <img src="public/Screenshot4.png" width="48%" />
</p>
<p align="center">
  <img src="public/Screenshot5.png" width="48%" />
  <img src="public/Screenshot6.png" width="48%" />
</p>

---

## Features

- **Dual-Language Support** — Interface text and reply language can switch between **English** and **Japanese** (日本語).
- **3D Lip-Sync** — Powered by `three.js`, driving real-time facial morphs and animations from server-generated visemes.
- **Multiple Avatars** — Switch between characters at runtime; each keeps its own persona, voice, and chat history.
- **Persistent Chat History & Settings** — Reply language, interface language, and your last-selected avatar are remembered across visits, with no account or login required (see [Persistence & Identity](#persistence--identity)).
- **Multi-Tenant Ready** — Third-party apps embedding this widget can pass their own `app-id` (and optionally `user-id`) so each integrator's users stay fully isolated from every other integrator's, with no login system required on either side (see [Persistence & Identity](#persistence--identity)).
- **Offline Fallback** — If the backend drops, the avatar keeps moving safely with a neutral expression and an "offline" animation instead of freezing or crashing.
- **Load-Failure Recovery** — A failed avatar load (e.g. an unstable connection while fetching the GLB) shows a clear retry prompt over the 3D area instead of silently leaving it blank, and disables chat input until the retry succeeds — see [Load Error Handling](#load-error-handling).
- **Auto-Timezone Awareness** — Detects the browser's timezone automatically so the AI is grounded in the real current date and time.
- **Voice Input** — Live interim captions via the browser's SpeechRecognition API, with the final transcript refined server-side via Whisper.
- **Editable Personas** — Each avatar's persona and display name can be edited directly from the settings panel, with a one-click reset back to its built-in default. Edits are per-avatar and per-instance, persisted to the backend (not `localStorage`) as part of that identity's settings — so they carry over across devices/browsers the same way reply language and last-selected avatar already do, and to a settings-only page with no `<avatar-model>` at all (see [Settings-Only Pages](#settings-only-pages--cross-page-configuration)). Editing either language automatically translates and fills in the other via the backend's `/translate` endpoint.
- **Bring-Your-Own Input UI** — `<avatar-inputs>` can adopt an existing text field, send button, and/or mic button already on your page instead of rendering its own — see [Custom Input Elements](#custom-input-elements).
- **Multiple Avatars Per Page** — Run several fully independent avatar groups on the same page at once (e.g. a "tutor" and a "receptionist" side by side), each with its own conversation, status, captions, and settings — see [Multiple Avatar Instances](#multiple-avatar-instances).

---
## Project Structure

```text
index.html
src/
  main.js                        # Bootstrap: injects styles, registers custom elements, mounts <avatar-model>
  index.css
  components/
    AvatarModel.js                # <avatar-model> — 3D scene, camera, lighting, animation/lip-sync wiring, load-error/retry UI
    AvatarController.js           # Orchestrator: talks to the backend, owns app state, emits avatar:* events
    AvatarStatus.js                # <avatar-status> — status pill (thinking / listening / ready / offline)
    AvatarCaptions.js              # <avatar-captions> — on-screen subtitles
    AvatarInputs.js                # <avatar-inputs> — text box, send button, mic/voice input
    AvatarSettings.js              # <avatar-settings> — avatar/language pickers, chat history panel
    AvatarPickerCore.js            # Shared avatar-grid/persona-edit logic used by AvatarSettings
    Events.js                      # Thin pub/sub layer over window CustomEvents
    i18n.js                        # UI copy (EN/JA) + language helpers
    constants.js                   # App-wide constants (backend URL, supported languages, etc.)
avatar/
  CharacterBrain.js              # Backend API client (fetch wrappers + app-id/user-id identity handling)
  AvatarSources.js               # Avatar roster: names, personas, model files, default voices
  AvatarManager.js                # Loads/positions the GLB avatar body, disposes the previous one on swap, times out stalled loads
  AvatarScale.js                  # Normalizes avatar height/build and grounds it in the scene
  AnimationManager.js            # Loads and plays Mixamo body clips (idle, talk, think, gestures)
  ExpressionEngine.js            # Facial morph targets for emotions (happy, sad, angry, etc.), plus blinking
  ExpressionManagerFallback.js   # Legacy viseme/morph fallback used only by LipSync.stop()
  LipSync.js                      # Audio-driven mouth movement from TTS output (Web Audio analyser)
  EmotionSystem.js                # Maps backend behavior JSON to face, body clips, and lip sync together
  CameraFraming.js                # Responsive camera framing/zoom that keeps the avatar centered on resize

```
---

## Web Components

- `<avatar-model>` — Renders the 3D canvas, animations, gestures, and mouth movements. Shows a retry prompt if loading fails — see [Load Error Handling](#load-error-handling).
- `<avatar-status>` — Shows if the avatar is offline, thinking, or talking.
- `<avatar-captions>` — Displays the text subtitles on the screen.
- `<avatar-settings>` — Configuration UI for languages, voice choices, character selection, and chat history. Can run standalone, with no `<avatar-model>` on the page — see [Settings-Only Pages](#settings-only-pages--cross-page-configuration).
- `<avatar-inputs>` — The text box, send button, and microphone controls. Optionally binds to your own existing elements instead of its own defaults — see [Custom Input Elements](#custom-input-elements) below.


---

## Core Events

Components don't reference each other directly — they communicate through
`window` CustomEvents (`avatar:*`), dispatched via a small helper in
`events.js`. This keeps every element independently swappable.

| Event | Fired by | Purpose |
|---|---|---|
| `avatar:ask` | inputs | User submitted a text message |
| `avatar:select-avatar` | settings, setup | User picked a different avatar |
| `avatar:set-ui-language` | settings, setup | Switches interface labels (`en` / `ja`) |
| `avatar:set-response-language` | settings, setup | Switches the avatar's reply language (`en` / `ja` / `both`) |
| `avatar:set-voice` | settings | Overrides the TTS voice for the current avatar |
| `avatar:open-chat-history` / `avatar:clear-chat-history` | settings | Opens the history panel / clears the *current avatar's* history |
| `avatar:reset` | — | Resets the active conversation |
| `avatar:update-status` | controller | Updates the status pill text and color |
| `avatar:show-caption` / `avatar:hide-caption` | controller | Shows or hides subtitles |
| `avatar:thinking` / `avatar:listening` / `avatar:speaking` | controller | Drives the avatar's pose/animation while processing, recording, or talking |
| `avatar:available-avatars` / `avatar:available-voices` | controller | Populates the avatar and voice pickers |
| `avatar:update-profile` | controller | Updates the settings panel's name/persona card |
| `avatar:chat-history` | controller | Delivers a fresh snapshot of chat history to render |
| `avatar:avatar-loading` | controller | Toggles the loading overlay while a new avatar model loads |
| `avatar:load-error` | controller | Fires `{ active: true }` when an avatar fails to load (disables chat input until resolved) and `{ active: false }` on a successful (re)load |
| `avatar:app:loading` / `avatar:app:ready` | controller | Marks overall app startup boundaries |

---


## Load Error Handling

Avatar GLB files can be large, and on an unstable connection the load can
either fail outright or hang indefinitely. `<avatar-model>` handles both:

- **Stalled loads time out** after 20 seconds (see `AvatarManager.loadAvatar()`) instead of leaving the UI stuck on a spinner forever.
- **A failed load** shows a small retry prompt centered over the (blank) 3D area, explaining that this is most likely due to an unstable connection, with a **Retry** button that re-attempts the same avatar.
- **Chat input, mic, and send are disabled** for the duration of a load error (`avatar:load-error` event), and automatically re-enabled the moment a retry succeeds.
- Retrying goes through the exact same code path as a normal avatar selection — no separate/divergent retry logic to keep in sync.

---

## Custom Input Elements

By default `<avatar-inputs>` renders its own textarea, send button, and mic
button. If your page already has its own chat input UI, you can point
`<avatar-inputs>` at those elements instead via three optional attributes —
supply any combination of the three; whichever you omit still falls back to
the built-in default for that piece:

```html
<textarea id="my-chat-input"></textarea>
<button id="my-send-btn">Send</button>
<button id="my-mic-btn">🎤</button>

<avatar-inputs
  text-input="#my-chat-input"
  send-button="#my-send-btn"
  mic-button="#my-mic-btn"
></avatar-inputs>
```

Each attribute is a CSS selector, resolved once when `<avatar-inputs>`
connects. All existing behavior — sending on Enter, mic recording, Whisper
transcription via `/stt`, and disabling itself while the avatar is
thinking/speaking/loading/erroring — is wired onto whichever elements are
in use, built-in or your own. If a selector doesn't match anything at
connect time, `<avatar-inputs>` logs a warning to the console and falls
back to its built-in element for that piece rather than failing silently.

Note: when you supply your own `send-button`, `<avatar-inputs>` will not
overwrite its label/title text when the UI language is switched — that's
left to you, since the button is yours.

If you're running [multiple avatar instances](#multiple-avatar-instances)
on one page, make sure each group's `text-input` / `send-button` /
`mic-button` selectors point at elements unique to that group — the
selectors themselves aren't instance-aware, so a selector that matches
more than one element (or the wrong group's element) will bind to
whichever element `document.querySelector` finds first.

## Multiple Avatar Instances


To run more than one avatar on the same page — each with its own
conversation, status pill, captions, and settings — give every element in
a group the same `instance` attribute, and use a different value per
group:

```html
<avatar-model instance="tutor" app-id="your-app-id"></avatar-model>
<avatar-status instance="tutor"></avatar-status>
<avatar-captions instance="tutor"></avatar-captions>
<avatar-settings instance="tutor"></avatar-settings>
<avatar-inputs instance="tutor"></avatar-inputs>

<avatar-model instance="receptionist" app-id="your-app-id"></avatar-model>
<avatar-status instance="receptionist"></avatar-status>
<avatar-captions instance="receptionist"></avatar-captions>
<avatar-settings instance="receptionist"></avatar-settings>
<avatar-inputs instance="receptionist"></avatar-inputs>
```

Each `instance` group is fully isolated:
- Separate conversation, status, and captions.
- Independently selecting an avatar, sending a message, or recording
  audio in one group has no effect on any other group.
- If two groups happen to load the *same* avatar character, persona edits
  made in one group's settings panel do not affect the other — persona
  overrides are scoped per instance, not just per avatar (voice edits are
  still in-memory only and don't persist at all — see
  [Persistence & Identity](#persistence--identity)).
- `app-id`/`user-id` can also differ per instance if you genuinely want
  two groups on the same page to represent two different tenants/users —
  see [Persistence & Identity](#persistence--identity).

The one exception is interface (UI) language: switching English/Japanese
in one group's settings panel updates that group's own elements
immediately, but the underlying preference is shared page-wide — on the
next page load, all groups start in whichever language was last set by
any of them.

Elements can also be placed anywhere in the DOM — order doesn't matter,
only the matching `instance` value does. Omitting `instance` entirely (as
in every other example in this README) is equivalent to giving every
element `instance="default"`.

## Settings-Only Pages & Cross-Page Configuration

`<avatar-settings>` doesn't require an `<avatar-model>` on the same page.
Mounted on its own — e.g. a dedicated "customize your avatar" screen — it
detects that no matching `<avatar-model>` exists for its `instance` and
persists changes directly, with no other wiring needed:

```html
<avatar-settings
  instance="slot-1"
  app-id="acme-corp"
  user-id="user-001"
  backend="http://localhost:8000"
></avatar-settings>
```

For a settings-only page and a separate display page to represent the
*same* avatar slot, both must use the **same `instance`, `app-id`, and
`user-id`** — this is the same identity contract described in
[Persistence & Identity](#persistence--identity), just split across two
page loads instead of one:

```html
<!-- Page A: settings only, no 3D avatar -->
<avatar-settings instance="slot-1" app-id="acme-corp" user-id="user-001" backend="..."></avatar-settings>

<!-- Page B: display, no settings panel -->
<avatar-model instance="slot-1" app-id="acme-corp" user-id="user-001" backend="..."></avatar-model>
<avatar-status instance="slot-1"></avatar-status>
<avatar-inputs instance="slot-1"></avatar-inputs>
```

Avatar selection, persona/name, reply language, and interface language all
carry over this way. Voice and scale are not exposed on the settings panel
today and remain session-only regardless of page.

A different `instance` value on the two pages will **not** link them, even
with matching `app-id`/`user-id` — `instance` is part of the scoping key for
persona overrides specifically, so it must match exactly for edits made on
the settings-only page to show up on the display page.

## Backend

This UI is **backend-agnostic** — every request goes through plain
`fetch()` calls in `avatar/CharacterBrain.js`, so any server in any
language or framework works as long as it implements the routes and JSON
shapes described in [API Contract](#api-contract) below. There's no
FastAPI-specific code anywhere in the frontend.

The reference implementation this UI was built and tested against is
FastAPI + SQLite/Postgres, but that's an implementation detail on the
other side of the fetch calls — swap in Express, Django, Go, or anything
else, and the frontend won't know the difference, as long as the contract
holds.

The backend must be running for anything beyond the offline fallback to
work — without it, the avatar still renders and moves, but replies fall
back to a canned local message and voice input/TTS are unavailable.

By default, requests are sent to the same origin the frontend is served
from (`BACKEND = ''` in `components/constants.js`). To point at a backend
running elsewhere in development, set the `backend` attribute on the model
element, e.g.:

```html
<avatar-model backend="http://localhost:8000"></avatar-model>
```

> **Note:** the `backend` attribute currently redirects everything routed
> through `CharacterBrain.js` (`/ask`, `/history`, `/settings`, `/reset`,
> `/voices`). Voice input (`/stt`) and the TTS audio URL prefix still read
> `BACKEND` directly from `constants.js` rather than the attribute, so if
> you point `backend` at a different origin, edit `BACKEND` in
> `constants.js` too until those paths are unified.

## API Contract

Any backend you plug in needs to implement these endpoints. Every request
carries an `X-User-Id` header, and — for multi-tenant integrations — an
`X-App-Id` header. See [Persistence & Identity](#persistence--identity)
for what these are for.

| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/ask` | POST | `{ text, persona, avatar_persona, character_name, voice_en, voice_ja, speak_language, timezone }` | `{ reply, translated_reply, expression, animation, primary, audio_url_en, audio_url_ja, visemes_en, visemes_ja }` |
| `/translate` | POST | `application/x-www-form-urlencoded`: `text`, `target` | `{ text, romanization }` |
| `/history` | GET | query: `character_name` (optional) | `{ history: [{ role, text/content, text_en?, text_ja?, time, character_name? }, ...] }` |
| `/settings` | GET | — | `{ ui_language, response_language, last_avatar, persona_overrides }` |
| `/settings` | POST | partial patch of the same shape | full saved settings row |
| `/reset` | POST | query: `character_name` (optional) | — (response is ignored) |
| `/voice` | POST | `{ text, voice, culture }` | TTS payload (used by a separate live-interpreter flow) |
| `/stt` | POST | `multipart/form-data`: `audio` (blob), `language` | `{ text }` |

Notes for implementers:
- `/ask`'s response shape is the one field set the frontend actually reads
  values out of — `reply`, `expression`, and `animation` drive the 3D
  avatar's face, animation, and pose; `audio_url_en`/`audio_url_ja` and
  `visemes_en`/`visemes_ja` drive lip-sync. Keep those field names as-is
  unless you're also updating `AvatarController.applyBehavior()` and
  `EmotionSystem.apply()` to match.
- Audio URLs returned from `/ask` are fetched directly (prefixed with the
  configured backend origin) — your backend needs to actually serve those
  files at those paths, or return absolute URLs to wherever they're hosted.
- `X-User-Id` and `X-App-Id` are the only identity signals sent — no auth
  token, no session. The reference backend combines them into one scoped
  key (`"<app-id>::<user-id>"`) for chat history and settings lookups, but
  any backend can key off them however it likes — just make sure both are
  factored into isolation, not `X-User-Id` alone, or two different
  integrators' users with the same `user-id` will collide.
- `persona_overrides` is an object keyed by `"<instance>::<avatarId>"` strings (e.g. `"slot-1::female_ug": { "name": "...", "persona": "...", "personaJa": "..." }`), constructed and read entirely client-side — the backend just needs to store and return whatever object it's given. The frontend always sends its **complete current object** on every persona edit, so this field must be stored as a full replace, not merged server-side, or edits to one avatar will silently wipe out previously saved edits to others.

## Persistence & Identity

There are no user accounts, on either end. Two independent identity
signals are sent with every request:

- **`X-App-Id`** — identifies *which application* is embedding this
  widget (a third-party integrator, or your own deployment). Set via the
  `app-id` attribute on `<avatar-model>`. If omitted, it falls back to
  the embedding page's hostname (`window.location.hostname`) — so even
  integrators who don't explicitly configure anything still get natural
  isolation from every other site the widget happens to be embedded on.
- **`X-User-Id`** — identifies *which end-user* of that application this
  is. Set via the `user-id` attribute — a host application with its own
  user accounts should pass its own user identifier here, which gives
  that user's chat history and settings full cross-device support (no
  `localStorage` dependency at all). If omitted, it falls back to a
  random ID (`crypto.randomUUID()`) generated once and cached in
  `localStorage`, scoped per `instance` — the original "no accounts
  needed" behavior, for integrators (including this project's own demo)
  that have no user system of their own.

```html
<!-- Solo / demo use — no attributes needed, works exactly as before -->
<avatar-model backend="..."></avatar-model>

<!-- Third-party app with no user system of its own — still gets
     isolation from every other integrator -->
<avatar-model backend="..." app-id="acme-corp"></avatar-model>

<!-- Third-party app with its own users — full cross-device history -->
<avatar-model
  backend="..."
  app-id="acme-corp"
  user-id="acme-user-48213"
></avatar-model>
```

What's persisted per identity (`app-id` + `user-id` pair):
- Full chat history, per avatar
- Interface language, reply language, and last-selected avatar
- Any edited personas/names (per avatar, per instance) — backend-stored, not `localStorage` — see Editable Personas above and [Settings-Only Pages](#settings-only-pages--cross-page-configuration)

Clearing browser storage (or switching browsers/devices) only affects
identities that were relying on the `localStorage`-generated fallback —
an integrator passing their own `user-id` is unaffected, since nothing
about their identity lives in this browser at all.

---

## Quickstart

### 1. Installation
```bash
npm install
```

### 2. Development
Run the local dev server (make sure the backend is running too — see above):
```bash
npm run dev
```

### 3. Build Production Files
```bash
npm run build
```
