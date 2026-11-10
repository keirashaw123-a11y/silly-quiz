// Silly Quiz — shared browser helpers
const SQ = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, { method = "GET", body, pin } = {}) {
    const headers = { "content-type": "application/json" };
    if (pin) headers["x-host-pin"] = pin;
    let res;
    try {
      res = await fetch(`/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    } catch {
      throw Object.assign(new Error("Can't reach the quiz server — check your connection."), { status: 0 });
    }
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
    return data;
  }

  const fmt = (n) => {
    const v = Math.round(n * 100) / 100;
    return Number.isInteger(v) ? String(v) : v.toFixed(v * 10 === Math.round(v * 10) ? 1 : 2);
  };
  const signed = (n) => (n > 0 ? `+${fmt(n)}` : fmt(n));

  function timeAgo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
    return new Date(iso).toLocaleDateString();
  }
  const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  /** Totals + rank (ties share a rank). */
  function standings(state) {
    const rows = state.teams.map((t) => {
      const rs = state.scores[t.id] || {};
      const roundTotal = state.rounds.reduce((sum, r) => sum + (Number(rs[r.id]) || 0), 0);
      const adjustments = state.adjustments.filter((a) => a.teamId === t.id);
      const adjTotal = adjustments.reduce((sum, a) => sum + a.points, 0);
      return { ...t, roundScores: rs, adjustments, roundTotal, adjTotal, total: roundTotal + adjTotal };
    });
    rows.sort((a, b) => b.total - a.total || a.joinedAt.localeCompare(b.joinedAt));
    rows.forEach((r, i) => {
      r.rank = i > 0 && r.total === rows[i - 1].total ? rows[i - 1].rank : i + 1;
    });
    return rows;
  }

  const medal = (rank) => ({ 1: "🏆", 2: "🥈", 3: "🥉" }[rank] || rank);

  // ---------- announcements ----------
  let lastAnnouncementId = null;
  function renderAnnouncements(el, state) {
    const [latest, ...older] = state.announcements;
    if (!latest) { el.innerHTML = ""; lastAnnouncementId = null; return; }
    if (latest.id === lastAnnouncementId && el.dataset.count === String(state.announcements.length)) {
      const t = el.querySelector(".announce .time");
      if (t) t.textContent = `${clock(latest.at)} · ${timeAgo(latest.at)}`;
      return;
    }
    const isNew = lastAnnouncementId !== null && latest.id !== lastAnnouncementId;
    lastAnnouncementId = latest.id;
    el.dataset.count = state.announcements.length;
    el.innerHTML = `
      <div class="announce" role="status" aria-live="polite">
        <div class="label">Announcement from the host</div>
        <div class="text">${esc(latest.text)}</div>
        <div class="time">${clock(latest.at)} · ${timeAgo(latest.at)}</div>
      </div>
      ${older.length ? `<details class="older"><summary>Earlier announcements (${older.length})</summary><ul>
        ${older.map((a) => `<li>${esc(a.text)}<small>${clock(a.at)}</small></li>`).join("")}
      </ul></details>` : ""}`;
    if (isNew && navigator.vibrate) navigator.vibrate([80, 60, 80]);
  }

  // ---------- leaderboard ----------
  const openTeams = new Set();
  const lastTotals = new Map();

  function renderBoard(listEl, state, { myTeamId } = {}) {
    const rows = standings(state);
    if (!rows.length) {
      listEl.innerHTML = `<li class="card empty"><span class="big-emoji">🦆</span><b>No teams yet!</b><div class="hint">Teams will waddle in here as they sign up.</div></li>`;
      lastTotals.clear();
      return;
    }

    // FLIP: remember old positions
    const before = new Map();
    listEl.querySelectorAll(".team").forEach((li) => before.set(li.dataset.id, li.getBoundingClientRect().top));

    listEl.innerHTML = rows.map((r) => {
      const mine = r.id === myTeamId;
      const adjFlag = r.adjTotal ? `<span class="adj-flag ${r.adjTotal > 0 ? "pos" : ""}">${signed(r.adjTotal)} pts</span>` : "";
      return `
      <li class="team ${mine ? "mine" : ""} ${openTeams.has(r.id) ? "open" : ""}" data-id="${r.id}" data-rank="${r.rank}">
        <div class="team-main" tabindex="0" role="button" aria-expanded="${openTeams.has(r.id)}">
          <div class="rank">${medal(r.rank)}</div>
          <div class="team-info">
            <div class="team-name">${esc(r.name)} ${mine ? '<span class="you-tag">You</span>' : ""}</div>
            <div class="team-members">${r.members.map(esc).join(" · ")}${adjFlag}</div>
          </div>
          <div class="total"><div class="total-num" data-total="${r.total}">${fmt(r.total)}</div><div class="total-lbl">points</div></div>
          <div class="chev">▾</div>
        </div>
        <div class="team-detail">
          <div class="chips">
            ${state.rounds.length ? state.rounds.map((rd) => {
              const v = r.roundScores[rd.id];
              return `<span class="chip">${esc(rd.name)} <b>${v === undefined ? "–" : fmt(v)}</b></span>`;
            }).join("") : '<span class="hint">No rounds yet.</span>'}
          </div>
          ${r.adjustments.length ? `<ul class="adj-list">${r.adjustments.map((a) => `
            <li class="adj">
              <span class="adj-pts ${a.points < 0 ? "neg" : "pos"}">${signed(a.points)}</span>
              <span class="adj-why">${esc(a.reason)}<small>${clock(a.at)}</small></span>
            </li>`).join("")}</ul>` : ""}
        </div>
      </li>`;
    }).join("");

    // FLIP animate + score bumps
    listEl.querySelectorAll(".team").forEach((li) => {
      const id = li.dataset.id;
      const prevTop = before.get(id);
      if (prevTop !== undefined) {
        const dy = prevTop - li.getBoundingClientRect().top;
        if (dy) {
          li.style.transition = "none";
          li.style.transform = `translateY(${dy}px)`;
          requestAnimationFrame(() => requestAnimationFrame(() => { li.style.transition = ""; li.style.transform = ""; }));
        }
      }
      const num = li.querySelector(".total-num");
      const total = Number(num.dataset.total);
      if (lastTotals.has(id) && lastTotals.get(id) !== total) num.classList.add("bump");
      lastTotals.set(id, total);

      const main = li.querySelector(".team-main");
      const toggle = () => {
        li.classList.toggle("open");
        li.classList.contains("open") ? openTeams.add(id) : openTeams.delete(id);
        main.setAttribute("aria-expanded", li.classList.contains("open"));
      };
      main.addEventListener("click", toggle);
      main.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
  }

  // ---------- live polling ----------
  function poll(onState, { interval = 3000, statusEl } = {}) {
    let timer, failures = 0, lastStamp = null;
    const setStatus = (live) => {
      if (!statusEl) return;
      statusEl.innerHTML = live ? '<span class="live-dot"></span> Live' : '<span class="live-dot off"></span> Reconnecting…';
    };
    async function tick() {
      clearTimeout(timer);
      try {
        const state = await api("state");
        failures = 0;
        setStatus(true);
        if (state.updatedAt !== lastStamp) { lastStamp = state.updatedAt; onState(state); }
        else onState(state, { unchanged: true });
      } catch {
        failures++;
        setStatus(false);
      }
      const wait = document.hidden ? 10000 : Math.min(interval * (1 + failures), 15000);
      timer = setTimeout(tick, wait);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
    tick();
    return { refresh: tick, force: () => { lastStamp = null; tick(); } };
  }

  // ---------- bits ----------
  let toastTimer;
  function toast(msg) {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function confetti(count = 90) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ff4fa3", "#ffd23f", "#3ddc97", "#4cc9f0", "#b69cff", "#ff8c42"];
    for (let i = 0; i < count; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = colors[i % colors.length];
      c.style.borderRadius = Math.random() > 0.5 ? "50%" : "3px";
      c.style.setProperty("--dx", `${(Math.random() - 0.5) * 300}px`);
      c.style.setProperty("--rot", `${Math.random() * 1080}deg`);
      c.style.animationDuration = `${2.2 + Math.random() * 2}s`;
      c.style.animationDelay = `${Math.random() * 0.5}s`;
      document.body.append(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  return { $, esc, api, fmt, signed, timeAgo, clock, standings, renderAnnouncements, renderBoard, poll, toast, confetti };
})();
