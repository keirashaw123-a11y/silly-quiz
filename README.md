# Silly Quiz 🎉

A live quiz-night scoreboard.

- **Teams** (`/`): sign up with a team name and players, then watch the live leaderboard, round-by-round scores, bonus/penalty points with reasons, and host announcements.
- **Host** (`/host`): enter round scores, add or deduct points with a reason, post announcements, manage rounds and teams, open/close registration, reset between quizzes.

Everything updates live (every ~3 seconds) on every phone. Data is stored in **Netlify Blobs**. You don't need a database or any setup.

## Deploy to Netlify

**Option A – GitHub (recommended)**
1. Push this folder to a new GitHub repo.
2. In Netlify: *Add new site → Import an existing project →* pick the repo.
3. Leave the build settings as they are (they're read from `netlify.toml`) and click **Deploy**.

**Option B – Netlify CLI**
```bash
npm install
npx netlify-cli deploy --prod
```

> Drag-and-drop deploys won't work, because the app has a serverless function that needs installing.

## First run
1. Open `https://your-site.netlify.app/host`. The first visit asks you to **create a host PIN**.
2. Share `https://your-site.netlify.app/` with the teams (there's a copy button in the host panel).

**Optional:** set an environment variable `HOST_PIN` in Netlify (*Site configuration → Environment variables*). It overrides the PIN created on first run.

Forgot the PIN? Set `HOST_PIN` in Netlify and redeploy.

## Structure
```
public/            Front end (index.html = teams, host.html = host)
netlify/functions/ api.mjs, the /api/* serverless endpoint
lib/game.mjs       Game rules, validation and conflict-safe saving
netlify.toml       Netlify config
```
