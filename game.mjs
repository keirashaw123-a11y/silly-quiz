// Silly Quiz — game logic, independent of Netlify so it can be tested locally.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const GAME_KEY = "game";
const AUTH_KEY = "auth";

const LIMITS = { teamName: 40, member: 40, members: 12, reason: 140, announcement: 280, roundName: 40, rounds: 30, teams: 100 };

const id = () => randomBytes(6).toString("hex");
const now = () => new Date().toISOString();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function freshGame() {
  return {
    title: "Silly Quiz",
    registrationOpen: true,
    rounds: [{ id: id(), name: "Round 1" }],
    teams: [],
    scores: {},
    adjustments: [],
    announcements: [],
    updatedAt: now(),
  };
}

function cleanText(value, max, label, { required = true } = {}) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && !text) throw new HttpError(400, `${label} can't be empty.`);
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return text;
}

function cleanMembers(members) {
  if (!Array.isArray(members)) throw new HttpError(400, "Add at least one team member.");
  const list = members.map((m) => cleanText(m, LIMITS.member, "Member name", { required: false })).filter(Boolean);
  if (!list.length) throw new HttpError(400, "Add at least one team member.");
  if (list.length > LIMITS.members) throw new HttpError(400, `Teams can have up to ${LIMITS.members} members.`);
  return list;
}

function cleanNumber(value, label) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 100000) throw new HttpError(400, `${label} must be a number.`);
  return Math.round(n * 100) / 100;
}

function hashPin(pin, salt) {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Strip secrets (team tokens) before sending to browsers. */
function publicView(game) {
  return {
    ...game,
    teams: game.teams.map(({ token, ...team }) => team),
  };
}

export function createGame(store, env = {}) {
  async function read() {
    const entry = await store.getWithMetadata(GAME_KEY, { type: "json", consistency: "strong" });
    return entry ? { game: entry.data, etag: entry.etag } : { game: freshGame(), etag: null };
  }

  /** Optimistic-concurrency update: retries if someone else wrote in between. */
  async function mutate(fn) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { game, etag } = await read();
      const result = fn(game);
      game.updatedAt = now();
      const res = await store.setJSON(GAME_KEY, game, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      if (res?.modified !== false) return { game, result };
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
    }
    throw new HttpError(409, "Lots happening at once — please try again.");
  }

  // ---------- host auth ----------
  async function authState() {
    if (env.HOST_PIN) return { configured: true, source: "env" };
    const auth = await store.get(AUTH_KEY, { type: "json", consistency: "strong" });
    return { configured: Boolean(auth), source: "blob", auth };
  }

  async function checkPin(pin) {
    if (!pin) throw new HttpError(401, "Enter the host PIN.");
    if (env.HOST_PIN) {
      if (!safeEqual(pin, env.HOST_PIN)) throw new HttpError(401, "That PIN isn't right.");
      return;
    }
    const auth = await store.get(AUTH_KEY, { type: "json", consistency: "strong" });
    if (!auth) throw new HttpError(428, "No host PIN has been set yet.");
    if (!safeEqual(hashPin(pin, auth.salt), auth.hash)) throw new HttpError(401, "That PIN isn't right.");
  }

  async function setupPin(pin) {
    if (env.HOST_PIN) throw new HttpError(409, "The host PIN is set in Netlify settings.");
    pin = String(pin ?? "").trim();
    if (pin.length < 4 || pin.length > 32) throw new HttpError(400, "Choose a PIN of 4–32 characters.");
    const salt = id();
    const res = await store.setJSON(AUTH_KEY, { salt, hash: hashPin(pin, salt), createdAt: now() }, { onlyIfNew: true });
    if (res?.modified === false) throw new HttpError(409, "A host PIN already exists. Log in instead.");
  }

  // ---------- host actions ----------
  const hostActions = {
    verify: () => ({}),

    setTitle: (g, { title }) => {
      g.title = cleanText(title, 40, "Quiz name");
    },

    toggleRegistration: (g, { open }) => {
      g.registrationOpen = Boolean(open);
    },

    addRound: (g, { name }) => {
      if (g.rounds.length >= LIMITS.rounds) throw new HttpError(400, `Up to ${LIMITS.rounds} rounds.`);
      const round = { id: id(), name: cleanText(name || `Round ${g.rounds.length + 1}`, LIMITS.roundName, "Round name") };
      g.rounds.push(round);
      return round;
    },

    renameRound: (g, { roundId, name }) => {
      const round = g.rounds.find((r) => r.id === roundId);
      if (!round) throw new HttpError(404, "Round not found.");
      round.name = cleanText(name, LIMITS.roundName, "Round name");
    },

    deleteRound: (g, { roundId }) => {
      g.rounds = g.rounds.filter((r) => r.id !== roundId);
      for (const t of Object.keys(g.scores)) delete g.scores[t][roundId];
    },

    setScore: (g, { teamId, roundId, score }) => {
      if (!g.teams.some((t) => t.id === teamId)) throw new HttpError(404, "Team not found.");
      if (!g.rounds.some((r) => r.id === roundId)) throw new HttpError(404, "Round not found.");
      const value = cleanNumber(score, "Score");
      g.scores[teamId] ??= {};
      if (value === null) delete g.scores[teamId][roundId];
      else g.scores[teamId][roundId] = value;
    },

    adjust: (g, { teamId, points, reason }) => {
      if (!g.teams.some((t) => t.id === teamId)) throw new HttpError(404, "Team not found.");
      const value = cleanNumber(points, "Points");
      if (!value) throw new HttpError(400, "Enter a number of points (not zero).");
      const adj = { id: id(), teamId, points: value, reason: cleanText(reason, LIMITS.reason, "Reason"), at: now() };
      g.adjustments.unshift(adj);
      return adj;
    },

    deleteAdjustment: (g, { adjustmentId }) => {
      g.adjustments = g.adjustments.filter((a) => a.id !== adjustmentId);
    },

    announce: (g, { text }) => {
      const a = { id: id(), text: cleanText(text, LIMITS.announcement, "Announcement"), at: now() };
      g.announcements.unshift(a);
      g.announcements = g.announcements.slice(0, 50);
      return a;
    },

    deleteAnnouncement: (g, { announcementId }) => {
      g.announcements = g.announcements.filter((a) => a.id !== announcementId);
    },

    removeTeam: (g, { teamId }) => {
      g.teams = g.teams.filter((t) => t.id !== teamId);
      delete g.scores[teamId];
      g.adjustments = g.adjustments.filter((a) => a.teamId !== teamId);
    },

    resetScores: (g) => {
      g.scores = {};
      g.adjustments = [];
      g.announcements = [];
    },

    newGame: (g) => {
      Object.assign(g, freshGame(), { title: g.title });
    },
  };

  // ---------- request routing ----------
  async function handle(method, route, body = {}, headers = {}) {
    try {
      if (method === "GET" && route === "state") {
        const { game } = await read();
        return ok(publicView(game));
      }

      if (method === "GET" && route === "host/status") {
        const { configured, source } = await authState();
        return ok({ configured, source });
      }

      if (method !== "POST") throw new HttpError(405, "Method not allowed.");

      if (route === "join") {
        const name = cleanText(body.name, LIMITS.teamName, "Team name");
        const members = cleanMembers(body.members);
        const token = randomBytes(16).toString("hex");
        const { result } = await mutate((g) => {
          if (!g.registrationOpen) throw new HttpError(403, "Registration is closed — ask the host.");
          if (g.teams.length >= LIMITS.teams) throw new HttpError(400, "This quiz is full.");
          if (g.teams.some((t) => t.name.toLowerCase() === name.toLowerCase()))
            throw new HttpError(409, "That team name is taken — get sillier!");
          const team = { id: id(), name, members, token, joinedAt: now() };
          g.teams.push(team);
          return team;
        });
        return ok({ teamId: result.id, token });
      }

      if (route === "team/update") {
        const members = cleanMembers(body.members);
        await mutate((g) => {
          const team = g.teams.find((t) => t.id === body.teamId);
          if (!team || !body.token || !safeEqual(team.token, body.token)) throw new HttpError(403, "You can only edit your own team.");
          team.members = members;
        });
        return ok({ saved: true });
      }

      if (route === "host/setup") {
        await setupPin(body.pin);
        return ok({ configured: true });
      }

      if (route === "host") {
        await checkPin(headers["x-host-pin"]);
        const action = hostActions[body.action];
        if (!action) throw new HttpError(400, "Unknown action.");
        if (body.action === "verify") return ok({ verified: true });
        const { game, result } = await mutate((g) => action(g, body));
        return ok({ result: result ?? null, state: publicView(game) });
      }

      throw new HttpError(404, "Not found.");
    } catch (err) {
      if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
      console.error(err);
      return { status: 500, body: { error: "Something went wrong. Try again." } };
    }
  }

  return { handle };
}

const ok = (body) => ({ status: 200, body });
