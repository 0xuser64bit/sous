---
name: Sous
description: Your sous-chef for Cookie Chain
colors:
  copper: "#c97a1b"
  copper-bright: "#e09a3c"
  copper-deep: "#8a5210"
  order-slip: "#ece1cb"
  order-slip-dim: "#d9cbae"
  order-slip-faint: "#c4b493"
  hearth-base: "#141210"
  hearth-raised: "#1b1815"
  hearth-inset: "#0e0c0a"
  ink: "#221a10"
  ink-soft: "#57482f"
  ink-faint: "#847252"
  cream: "#e9e1d2"
  ash: "#a89a83"
  cinder: "#6e6350"
  herb: "#63a07c"
  scorch: "#c46a5a"
  saffron: "#c9a13f"
  hairline: "#2b251e"
  hairline-faint: "#201b15"
  hairline-strong: "#3a3227"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.14em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "normal"
    fontFeature: "\"tnum\""
rounded:
  sm: "3px"
  md: "5px"
  lg: "7px"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "#1d1206"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.copper}"
    textColor: "#1d1206"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.order-slip}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  input-order:
    backgroundColor: "{colors.hearth-inset}"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  ledger-card:
    backgroundColor: "{colors.hearth-raised}"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  ticket-paper:
    backgroundColor: "{colors.order-slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: Sous

## 1. Overview

**Creative North Star: "The Kitchen Pass"**

One dark room, one warm light. Sous is a kitchen ticket rail, not a dashboard:
the pass glows copper under a heat lamp while the room stays near-black, and
anything that moves money arrives on cream paper like the slip the expo shouts
from. Density is working-kitchen comfortable — tabular ledgers, eyebrow
labels, hairline dividers — never airy-marketing, never dense-terminal. Motion
is felt in feedback latency, not in choreography: one 0.18s ticket entrance,
one slow live pulse, both killable.

This system explicitly rejects generic Web3 slop: no purple/blue gradients, no
glassmorphism cards, no neon glows, no oversized drop shadows, no anonymous
dark-mode dashboard gray. It is not a Solana-explorer clone, not sterile
banking minimal, and not a cartoon kitchen — no emoji-chef kitsch, no clown
colors, no jokey copy at the moment of signing.

**Key Characteristics:**
- Dark hearth room with a single copper flame; paper where money moves.
- Nearly-square tickets (3–7px radii), hairline borders, flat surfaces.
- Fraunces display serif for dishes and headlines; Geist body; Geist Mono tabular for every number.
- Expo-voice microcopy: Preheating / Tasting / Plating, Order No., Served / Scrapped / Burnt.
- Feedback is instant and honest: phased expo strip, receipts with Cookiescan links, no fake history.

## 2. Colors

A single-flame palette: warm near-blacks for the room, cream paper for money,
one copper accent for live things — everything else muted and quiet.

### Primary
- **Copper Flame** (#c97a1b): the single accent. Fire, focus, live things —
  the Fire button, active expo station, live amounts, address links. Its rarity
  is the point.
- **Ember Bright** (#e09a3c): copper at full heat. Active states, focus
  glints, the current expo station.
- **Copper Deep** (#8a5210): copper banked low. Ticket stamps, selection
  fields, text on light copper.

### Neutral
- **Hearth** (#141210): the room. Page base; the perforation dots knock out to this.
- **Raised Hearth** (#1b1815): surfaces lifted one step — user bubbles, ledger
  cards, example-order rows, wallet modal.
- **Inset Hearth** (#0e0c0a): surfaces sunk one step — order input, expo strip trough.
- **Order Slip** (#ece1cb): the paper. Quote tickets and anything that carries
  money. Appearance always means something.
- **Slip Dim** (#d9cbae) / **Slip Faint** (#c4b493): secondary paper tones and
  ghost-button borders on tickets.
- **Ticket Ink** (#221a10): ink on paper. Ticket body text and the ink Fire button.
- **Ink Soft** (#57482f) / **Ink Faint** (#847252): ticket labels, dashed
  leaders, timestamps, muted stamps.
- **Plated Cream** (#e9e1d2): primary text on dark. Headlines, amounts, body.
- **Simmer** (#a89a83): secondary text on dark. Descriptions, row labels.
- **Cinder** (#6e6350): tertiary text on dark. Eyebrows, hints, placeholders.
- **Hairline** (#2b251e) / **Hairline Faint** (#201b15) / **Hairline Strong**
  (#3a3227): the only dividers. Borders, never shadows.
- **Herb** (#63a07c): success, muted, never neon. Confirmations, live dot, served states.
- **Scorch** (#c46a5a): errors, muted. Failed tickets, system messages, always
  paired with words, never color alone.
- **Saffron** (#c9a13f): warnings, muted. Caution states only.

### Named Rules (optional, powerful)
**The One Flame Rule.** Copper appears on ≤10% of any screen. If two copper
things compete, one of them is wrong.
**The Paper Means Money Rule.** Order Slip appears only where the user reviews
or signs value. Decorative cream is forbidden — paper is a promise.

## 3. Typography

**Display Font:** Fraunces (with Georgia, serif fallback)
**Body Font:** Geist (with system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback)

**Character:** Editorial serif for the dish, quiet grotesque for the work,
mono for the money. Fraunces speaks only when something is served; Geist
carries the workflow; Mono carries every number, address, and ticket code.

### Hierarchy
- **Display** (600, clamp(2rem, 5vw, 2.5rem), 1.08): the hero line only
  ("The pass is open."). One per surface, never stacked.
- **Headline** (600, 22px, 1.25): the dish on a ticket ("10 COOK → bCOOK").
  Ticket scope; -0.01em tracking.
- **Title** (600, 13.5–14px, 1.4): section-adjacent emphasis; message text and
  example-order rows.
- **Body** (400, 13.5–14px, 1.6): descriptions, assistant prose, table values.
  Max measure ~65ch in the pass column.
- **Label** (600, 10–11px, 0.12–0.18em tracking, uppercase): eyebrows ("Order
  No. 004 · Tasting"), section headers, stat captions. Always Cinder or
  Ink-Soft, never body size.

### Named Rules (optional)
**The Numbers Are Tabular Rule.** Every amount, slot, signature fragment, and
timestamp sets tabular-nums. Proportional figures in a ledger are a defect.
**The Serif Is Earned Rule.** Fraunces appears on dishes and display lines
only. UI chrome, buttons, and errors never set serif.

## 4. Elevation

Flat by default, always. Depth is conveyed by tonal layering (inset vs. base
vs. raised) and 1px hairlines — there is no shadow vocabulary. The single
exception is contrast, not elevation: the cream ticket against the dark room
pops because it is paper, not because it floats. Surfaces are flat at rest
and flat on hover; state changes answer in border color and opacity, never in
lift.

### Shadow Vocabulary (if applicable)

No shadows ship in this system. The wallet-adapter modal, tickets, cards, and
inputs all render with `box-shadow: none` by doctrine. If a future surface
needs lift, it must earn a named shadow entry here first — until then, use a
stronger hairline.

### Named Rules (optional)
**The Flat-By-Default Rule.** No `box-shadow` beyond thumbnail scale without a
written entry in this section. Audit test: if it looks like a 2021 SaaS card,
the shadow is the bug.

## 5. Components

### Buttons
Tactile and confident. Nearly square (3px on paper, 5px on dark), medium
weight, opacity-only hover — no lifts, no glows.
- **Shape:** restrained radii (sm 3px on tickets, md 5px on dark).
- **Primary:** copper fill (#c97a1b) with near-black text (#1d1206), padding
  10px 16px. The Fire and Connect buttons. Hover fades to 85% opacity.
- **Ink:** ticket Ink fill (#221a10) with Order-Slip text, padding 8px 12px.
  "Fire order" on paper. Hover 85% opacity; firing state dims to 50%.
- **Ghost / Pass:** transparent with 1px Slip-Faint border, Ink-Soft text.
  The decline path ("Pass", "Leave", "Copy"). Hover warms to 70% opacity.
- **Focus:** every button shows the copper ring (`0 0 0 2px base, 0 0 0 4px
  copper`) via `:focus-visible`. No exceptions.

### Chips
- **Style:** suggestion pills are ghost chips — transparent, 1px Hairline
  border, mono 11px Simmer text, fully round. Hover promotes border to
  Hairline-Strong and text to Cream.
- **State:** no selected/filled chip state exists yet; filter or toggle chips
  must be proposed here before being built.

### Cards / Containers
Quiet ledger containers, not cards. Raised Hearth fill, 1px Hairline border,
5px radius, tabular rows divided by Hairline-Faint.
- **Corner Style:** restrained (md 5px).
- **Background:** Raised Hearth (#1b1815) on dark; Order Slip (#ece1cb) for money.
- **Shadow Strategy:** none, per Elevation. Depth comes from the paper-vs-room contrast.
- **Border:** 1px Hairline always; inputs promote to Copper-Line on focus.
- **Internal Padding:** 10–12px vertical rhythm; ticket line-items 12.5px with
  dashed Ink-Faint leaders between label and value.

### Inputs / Fields
- **Style:** sunk Inset Hearth trough, 1px Hairline stroke, 5px radius,
  13.5px body text. The order dock textarea autosizes to 132px max.
- **Focus:** border shifts to Copper-Line; the copper focus ring appears on
  `:focus-visible`. Placeholder always Cinder.
- **Error / Disabled:** errors never live in inputs — they surface as Scorch
  system messages with retry. Disabled states fade to 30–50% opacity.

### Navigation
- **Header:** 52px sticky bar, Hearth base, Hairline bottom border. Left:
  SousMark (26px) + Fraunces "Sous" with uppercase tagline; right: chain pulse
  (live dot + mono slot) and the wallet hook. No nav links — the product is
  one pass with a context rail.
- **Mobile rail:** under `lg`, the rail becomes three tabs (Pass / Pantry /
  Market) with `role=tablist`; active tab is Raised Hearth with Hairline
  border, inactive is transparent Cinder.
- **Expo strip:** the TxPass station bar (Quoted → Signature → Confirming →
  Served) pinned under the pass with Inset fill and Hairline-Subtle top
  border; current station pulses copper, done stations turn Herb, failures wash
  Scorch-Dim with the error in mono.

### Order Ticket (signature component)
The paper slip that carries money. Cream stock, ink text, Fraunces dish,
dashed leaders, copper-deep stamp, tear-off perforation edge knocking out to
Hearth. Header sets mono eyebrow (Order No. + kitchen verb: Tasting / Sending
/ Standing order / Staking / Bridging) against a tabular clock. States stamp
diagonally: Served ✓ (copper-deep), Scrapped / Burnt (ink-faint). Only used
for things that move money — its appearance always means something.

## 6. Do's and Don'ts

### Do:
- **Do** keep copper rare — one flame per screen, ≤10%, always meaning live,
  focus, or fire.
- **Do** set every number tabular (`tnum`): amounts, slots, signatures, clocks.
- **Do** use paper exclusively for signable value, with venue, impact, and fee
  line-items before the Fire button.
- **Do** divide with 1px hairlines (#2b251e family) and separate with tonal
  steps (inset / base / raised).
- **Do** pair every semantic color with words or shape — live dot plus slot
  number, Scorch plus message, stamp plus verb.
- **Do** keep radii nearly square (3px paper actions, 5px dark surfaces, 7px
  max) and type measured (pass column ~65ch).
- **Do** write expo voice at every state: Preheating / Tasting / Plating,
  Order No., Served / Scrapped / Burnt, "Yes, Chef!".

### Don't:
- **Don't** use purple/blue gradients, glassmorphism cards, neon glows, or
  oversized drop shadows — generic Web3 slop is the explicit anti-reference.
- **Don't** ship anonymous dark-mode dashboard gray; the room is warm hearth
  black (#141210), never neutral gray.
- **Don't** clone a Solana explorer or a sterile banking minimal — cold
  fintech blue/gray is forbidden.
- **Don't** turn the kitchen into a cartoon: no emoji-chef kitsch, no clown
  colors, no jokey copy at the moment of signing.
- **Don't** float paper on shadows — the ticket pops by contrast, `box-shadow:
  none` by doctrine.
- **Don't** set UI chrome, buttons, or errors in Fraunces — the serif is
  earned by dishes and display lines only.
- **Don't** signal with color alone, animate beyond the ticket entrance and
  live pulse, or invent a second accent. If it looks like an AI-generated
  purple-gradient dApp template, it failed.
