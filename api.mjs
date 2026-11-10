import { getStore } from "@netlify/blobs";
import { createGame } from "../../lib/game.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)\/?/, "").replace(/\/$/, "");
  let body = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const headers = { "x-host-pin": req.headers.get("x-host-pin") || "" };
  const game = createGame(getStore("silly-quiz"), { HOST_PIN: process.env.HOST_PIN });
  const { status, body: out } = await game.handle(req.method, route, body, headers);
  return new Response(JSON.stringify(out), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

export const config = { path: "/api/*" };
