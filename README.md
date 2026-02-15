> **This project is still in development. Undrift is not yet available for download or install.**

# Undrift

A Chrome extension that helps you quit distracting websites — not by willpower alone, but by changing the moment you reach for them.

## What is Undrift?

Undrift is a site blocker that actually works. Most blockers just throw up a wall and hope for the best. Undrift treats the urge itself. When you try to visit a blocked site during a focus session, you don't just see a "blocked" page — you get intervention tools designed to break the impulse loop: breathing exercises, reflection prompts, motivational messaging, and real-time stats on how you're doing.

You pick your distracting sites (Twitter, YouTube, Reddit, TikTok, etc.), set a focus session duration, and Undrift handles the rest. It tracks your time, counts how many times you resisted the pull, maintains your streaks, and gives you a full analytics dashboard so you can see your progress over days and weeks.

### Core features

- **Site blocking** during timed focus sessions
- **Behavioral interventions** on the blocked page (breathing exercises, journaling/reflection, motivational prompts)
- **Time tracking** per site, per day
- **Streaks and session history**
- **Interruption tracking** — how many times you tried to visit a blocked site and whether you stayed focused
- **XP and achievements** — level up by staying consistent
- **Analytics dashboard** with charts and historical data

## Philosophy

Undrift draws heavy inspiration from [QUITTR](https://quittrapp.com/) and its approach to habit-breaking. The core idea: blocking alone is not enough. If you just block a site, you white-knuckle through the urge and eventually disable the blocker. That's not recovery, that's a countdown to relapse.

QUITTR treats the problem at the behavioral level — panic buttons for moments of weakness, grounding techniques, reflective exercises that help you understand *why* you're reaching for the thing in the first place. It shifts the frame from "just don't do it" to "understand the urge and let it pass."

Undrift applies the same thinking to internet distractions. When you hit a blocked page, you're not punished — you're supported. The breathing exercise calms the impulse. The reflection prompt makes you think about what triggered you. The stats remind you how far you've come. The goal is to make the moment of temptation a moment of growth instead of frustration.

## Tech stack

- **Extension:** React 18, TypeScript, Vite, CRXJS (Chrome MV3)
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts

## Running locally

Prerequisites: Node.js (v18+) and npm.

```bash
# Clone the repo
git clone https://github.com/Melkeydev/undrift.git
cd undrift/client

# Install dependencies
npm install

# Build the extension
npm run build
```

Then load it into Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `client/dist` folder

For development with hot reload:

```bash
npm run dev
```

Then load the `client/dist` folder the same way. Vite + CRXJS will handle hot module replacement.

## License

This project is licensed under the [MIT License](LICENSE).
