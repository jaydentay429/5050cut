/**
 * 按国家 / 全球排行。国家来自 Cloudflare CF-IPCountry，不信任客户端上报。
 * 头衔只能是已知成就名，不能自由填字。
 */

const NAME_RE = /^[\p{L}\p{N} _.\-·]{2,12}$/u;
const MAX_SCORE = 1_000_000;
const LIMIT = 30;
const TITLES = {
  first_cut: "第一刀",
  combo_5: "手感来了",
  combo_10: "停不下来",
  combo_25: "热刀不歇",
  combo_50: "一气呵成",
  combo_100: "百连成神",
  score_500: "小试牛刀",
  score_2000: "千刀入账",
  score_5000: "摊位常客",
  score_12000: "一刀传城",
  score_25000: "史册留名",
  perfect: "正中红心",
  collect_10: "见多识广",
  collect_30: "收藏家",
  collect_100: "百刀入册",
  first_rare: "小隐藏",
  first_secret: "大隐藏",
  stall_seen: "逛完一摊",
  stall_bronze: "铜杯",
  stall_bronze_all: "十摊铜杯",
  stall_gold: "金杯",
  grand: "刀神",
  worlds_3: "连逛三摊",
  worlds_10: "环城一圈",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function countryOf(request) {
  const cf = request.cf?.country;
  if (cf && /^[A-Z]{2}$/.test(cf) && cf !== "T1" && cf !== "XX") return cf;
  const header = request.headers.get("cf-ipcountry");
  if (header && /^[A-Z]{2}$/i.test(header)) return header.toUpperCase();
  return "UN";
}

function cleanName(raw) {
  const name = String(raw || "").trim().replace(/\s+/g, " ");
  if (!NAME_RE.test(name)) return null;
  if (/https?:|www\.|@/i.test(name)) return null;
  return name;
}

function cleanTitle(raw) {
  if (raw == null || raw === "") return "";
  const id = String(raw);
  return Object.prototype.hasOwnProperty.call(TITLES, id) ? TITLES[id] : null;
}

function cleanId(raw) {
  const id = String(raw || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return id.length >= 8 && id.length <= 40 ? id : null;
}

function rowOut(row, i, pid) {
  return {
    rank: i + 1,
    name: row.name,
    title: row.title || "",
    score: row.score,
    country: row.country,
    me: pid ? row.pid === pid : false,
  };
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) return json({ error: "board-offline" }, 503);
  const url = new URL(context.request.url);
  const scope = url.searchParams.get("scope") === "home" ? "home" : "global";
  const pid = cleanId(url.searchParams.get("id") || "");
  const country = countryOf(context.request);

  const listSql =
    scope === "home"
      ? "SELECT pid, name, title, score, country FROM scores WHERE country = ? ORDER BY score DESC, updated ASC LIMIT ?"
      : "SELECT pid, name, title, score, country FROM scores ORDER BY score DESC, updated ASC LIMIT ?";
  const rows =
    scope === "home"
      ? await db.prepare(listSql).bind(country, LIMIT).all()
      : await db.prepare(listSql).bind(LIMIT).all();

  const list = (rows.results || []).map((row, i) => rowOut(row, i, pid));

  let mine = null;
  if (pid) {
    const self = await db.prepare("SELECT name, title, score, country FROM scores WHERE pid = ?").bind(pid).first();
    if (self) {
      const rankRow =
        scope === "home" && self.country === country
          ? await db
              .prepare(
                "SELECT COUNT(*) AS n FROM scores WHERE country = ? AND (score > ? OR (score = ? AND updated < (SELECT updated FROM scores WHERE pid = ?)))",
              )
              .bind(country, self.score, self.score, pid)
              .first()
          : await db
              .prepare(
                "SELECT COUNT(*) AS n FROM scores WHERE score > ? OR (score = ? AND updated < (SELECT updated FROM scores WHERE pid = ?))",
              )
              .bind(self.score, self.score, pid)
              .first();
      mine = {
        rank: Number(rankRow?.n || 0) + 1,
        name: self.name,
        title: self.title || "",
        score: self.score,
        country: self.country,
      };
    }
  }

  return json({ country, scope, rows: list, me: mine });
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) return json({ error: "board-offline" }, 503);
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  const pid = cleanId(body.id);
  const name = cleanName(body.name);
  const title = cleanTitle(body.titleId);
  const score = Math.floor(Number(body.score));
  if (!pid || !name || title === null || !Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return json({ error: "bad-payload" }, 400);
  }
  const country = countryOf(context.request);
  const now = Date.now();
  const prev = await db.prepare("SELECT name, title, score FROM scores WHERE pid = ?").bind(pid).first();
  if (!prev) {
    if (score < 1) return json({ ok: true, updated: false, country });
  } else {
    const better = score > prev.score;
    const renamed = name !== prev.name;
    const retitled = title !== (prev.title || "");
    if (!better && !renamed && !retitled) return json({ ok: true, updated: false, country });
    if (!better && (renamed || retitled)) {
      await db.prepare("UPDATE scores SET name = ?, title = ? WHERE pid = ?").bind(name, title, pid).run();
      return json({ ok: true, updated: false, renamed: renamed || retitled, country });
    }
  }
  await db
    .prepare(
      "INSERT INTO scores (pid, name, title, score, country, updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(pid) DO UPDATE SET name = excluded.name, title = excluded.title, score = excluded.score, country = excluded.country, updated = excluded.updated",
    )
    .bind(pid, name, title, score, country, now)
    .run();
  return json({ ok: true, updated: true, country });
}
