# Product

## Register

product

## Users

Cookie Chain DeFi traders and stakers — COOK / bCOOK holders, LP and limit-order
users, bridge users moving between Cookie and Solana, `.cook` name holders.
They operate in a live-money workflow: checking balances, quoting swaps,
firing stakes/unstakes/limits/bridges, tracking standing orders and activity.
Context: desktop-first terminal with a mobile tab rail; Nightly wallet in hand;
every money move ends in a signature they must approve with confidence.
Secondary audience: bounty judges and hackers running the 60-second demo
(connect → quote → sign → confirm → Cookiescan proof). A future marketing /
landing surface is in scope but secondary — the app UI is the default.

## Product Purpose

Sous is the sous-chef for Cookie Chain: it preps, tastes, and plates on-chain
moves so the user (Head Chef) just reviews and signs. Plain-words input
(`Quote 10 COOK -> bCOOK`) becomes a paper quote ticket with venue and impact,
then a Nightly signature, then a confirmed settlement with a Cookiescan link —
in about a second, for fractions of a cent. The product exists to prove
Cookie Chain's edge (sub-second finality, ~0.000005 COOK fees) makes AI-driven
micro-trading actually usable. Success is a session where speed and discovery
reinforce each other: fire fast with total signing confidence, and explore
pools, tokens, names, and activity without ever guessing with money.

## Brand Personality

Warm, expert, playful-kitchen — confident, never goofy. Three words: warm,
precise, unhurried. Voice is the pass: "Yes, Chef!", Preheating / Tasting /
Plating, order tickets, pantry, market. It behaves like a great sous-chef:
mises everything in place, calls out what matters (venue, impact, expiry),
never rushes the signature, never hides the receipt. Visual personality lives
in DESIGN.md; strategically the brand is a single warm light (copper) in one
dark room, paper where money moves, hairlines everywhere else.

## Anti-references

Explicitly NOT generic Web3 slop: no purple/blue gradients, no glassmorphism
cards, no neon glows, no oversized drop shadows, no anonymous dark-mode
dashboard gray. NOT a Solana-explorer clone or a sterile banking minimal.
NOT a cartoon kitchen either — no emoji-chef kitsch, no clown colors, no
jokey copy at the moment of signing. If it looks like an AI-generated
purple-gradient dApp template, it failed.

## Design Principles

1. **Tickets carry money.** Anything that costs the user goes on a paper
   ticket with venue, impact, and exact terms — reviewable, re-firable,
   refusable. No silent writes, no blind retries.
2. **Sign with confidence.** The moment before Nightly opens must answer:
   what, how much, where, and what it costs. Mints don't lie; symbols do —
   decode, compare, and refuse on mismatch.
3. **Kitchen calm under fire.** One accent means one thing (live / fire /
   focus). Everything else stays quiet so the pass can move fast without
   shouting. Speed is felt in feedback latency, not in animation energy.
4. **Show the receipt.** Every fill ends with a signature, a Cookiescan link,
   and a phase trail (quoting → awaiting signature → sending → confirming →
   confirmed). Trust is the paper trail, not the promise.
5. **Practice what you preach.** The interface itself must feel sub-second
   and near-free: optimistic tickets, honest sparklines (no fake history),
   empty/error/loading states that teach the next step.

## Accessibility & Inclusion

WCAG 2.1 AA baseline. Keep what the codebase already commits to: always-visible
focus ring, `prefers-reduced-motion` kill-switch for ticket-in and live-pulse,
tabular numbers for slots and amounts, `aria-live` on chain pulse, loaders,
and tx phases, labeled tab rail on mobile. No color-only signaling — live,
success, warning, and error always pair color with text or shape. Future
landing surface must meet the same bar from day one.
