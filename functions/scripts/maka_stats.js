/**
 * MAKA Wallet & Winner Payout Stats — one-off reporting script (prod RTDB, read-only).
 *
 * Pulls: Users/{uid}/WinningHistory, WithdrawalHistory, wallets, userName/firstName/lastName
 * Computes:
 *   1. MAKA wallet start date (earliest maka withdrawal in DB)
 *   2. Monthly winner stats (Aug / Sep / Oct 2026): winners, winners w/ EVM (MAKA) wallets,
 *      new-vs-returning winners, new MAKA wallets (proxy = user's first maka withdrawal)
 *   3. Payout stats (Sep / Oct): winners paid in MAKA, total MAKA paid
 *   4. New vs returning winners over monthly payout sets (Aug baseline)
 *
 * Run (from functions/ folder, Node 20+):
 *   node scripts\maka_stats.js "C:\path\to\serviceAccountKey.json"
 *   or set GOOGLE_APPLICATION_CREDENTIALS and run: node scripts\maka_stats.js
 *
 * Output: scripts\output\*.json / *.csv  (contains PII — do NOT commit)
 * NOTE: Month boundaries are UTC. October is month-to-date.
 */

const path = require("path");
const fs = require("fs");

const DB_URL = "https://zpln-3be94.firebaseio.com";
const OUT_DIR = path.join(__dirname, "output");
const CONCURRENCY = 16;

const MONTHS = [
  { key: "2026-08", label: "August 2026",        start: Date.UTC(2026, 7, 1),  end: Date.UTC(2026, 8, 1) },
  { key: "2026-09", label: "September 2026",     start: Date.UTC(2026, 8, 1),  end: Date.UTC(2026, 9, 1) },
  { key: "2026-10", label: "October 2026 (MTD)", start: Date.UTC(2026, 9, 1),  end: Date.UTC(2026, 10, 1) },
];

function monthKeyForTs(ts) {
  for (const m of MONTHS) if (ts >= m.start && ts < m.end) return m.key;
  return null;
}

function isoDay(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, header, rows) {
  const lines = [header.join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  fs.writeFileSync(path.join(OUT_DIR, file), lines.join("\n"), "utf8");
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
      if (idx % 250 === 0) console.log(`  ...processed ${idx}/${items.length} users`);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const keyPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error('Usage: node scripts\\maka_stats.js "C:\\path\\to\\serviceAccountKey.json"');
    process.exit(1);
  }

  const admin = require("firebase-admin");
  const serviceAccount = require(path.resolve(keyPath));
  const credential = admin.credential.cert(serviceAccount);
  const { access_token: accessToken } = await credential.getAccessToken();

  const rtdbGet = async (p) => {
    const res = await fetch(`${DB_URL}${p}.json?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) throw new Error(`RTDB GET ${p} failed: HTTP ${res.status}`);
    return res.json();
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1) Shallow key list (no user payloads downloaded)
  console.log("Fetching user key list (shallow)...");
  const keysObj = await rtdbGet("/Users?shallow=true");
  const uids = Object.keys(keysObj || {});
  console.log(`Found ${uids.length} users.`);

  // 2) Per-user targeted subtree fetch (avoids full /Users download)
  console.log("Fetching WinningHistory / WithdrawalHistory / wallets per user...");
  const users = await mapLimit(uids, CONCURRENCY, async (uid) => {
    const [winning, withdrawals, wallets, userName, firstName, lastName] = await Promise.all([
      rtdbGet(`/Users/${uid}/WinningHistory`),
      rtdbGet(`/Users/${uid}/WithdrawalHistory`),
      rtdbGet(`/Users/${uid}/wallets`),
      rtdbGet(`/Users/${uid}/userName`),
      rtdbGet(`/Users/${uid}/firstName`),
      rtdbGet(`/Users/${uid}/lastName`),
    ]);

    const looksEvm = (a) => typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a.trim());
    const evmFromList = Object.keys((wallets && wallets.evm && wallets.evm.list) || {});
    const legacyPrimary = wallets && wallets.primary ? String(wallets.primary) : null;
    const evmPrimary =
      (wallets && wallets.evm && wallets.evm.primary) ||
      evmFromList[0] ||
      (legacyPrimary && looksEvm(legacyPrimary) ? legacyPrimary : null) ||
      null;

    const wins = Object.values(winning || {})
      .filter((w) => w && typeof w === "object" && w.timestamp)
      .map((w) => ({
        ts: Number(w.timestamp),
        eventId: w.eventId || "",
        eventName: w.eventName || "",
        eventType: w.eventType ?? "",
        rank: w.rank ?? "",
        makaCredited: Number((w.prizeCredited && (w.prizeCredited.maka ?? w.prizeCredited.Maka_Token)) || 0),
        cashCredited: Number((w.prizeCredited && (w.prizeCredited.cash ?? w.prizeCredited.Cash)) || 0),
      }))
      .sort((a, b) => a.ts - b.ts);

    // MAKA is the only EVM token, so walletNetwork==="evm" also implies maka
    const makaPayouts = Object.values(withdrawals || {})
      .filter((x) => x && typeof x === "object" && x.timestamp)
      .filter((x) => String(x.token || "").toLowerCase() === "maka" || String(x.walletNetwork || "").toLowerCase() === "evm")
      .map((x) => ({ ts: Number(x.timestamp), amount: Number(x.amount) || 0, walletId: x.walletId || "" }))
      .sort((a, b) => a.ts - b.ts);

    return {
      uid,
      userName: userName || "",
      firstName: firstName || "",
      lastName: lastName || "",
      evmWallet: evmPrimary,
      wins,
      makaPayouts,
      firstWinTs: wins.length ? wins[0].ts : null,
      firstMakaPayoutTs: makaPayouts.length ? makaPayouts[0].ts : null,
    };
  });

  // ---- 1. MAKA wallet start date -------------------------------------------------
  let makaStart = null;
  let makaStartUser = null;
  for (const u of users) {
    if (u.firstMakaPayoutTs && (makaStart === null || u.firstMakaPayoutTs < makaStart)) {
      makaStart = u.firstMakaPayoutTs;
      makaStartUser = u;
    }
  }

  // ---- Monthly stats --------------------------------------------------------------
  const winnerSets = {};   // month -> Set(uid)
  const paidSets = {};     // month -> Set(uid) with maka payout
  const monthStats = {};

  for (const m of MONTHS) {
    const winners = users.filter((u) => u.wins.some((w) => w.ts >= m.start && w.ts < m.end));
    const winnerSet = new Set(winners.map((u) => u.uid));
    winnerSets[m.key] = winnerSet;

    const winnersWithEvm = winners.filter((u) => u.evmWallet);
    const newEver = winners.filter((u) => u.firstWinTs >= m.start && u.firstWinTs < m.end);

    // payouts (MAKA) in month
    const paidInMonth = users.filter((u) => u.makaPayouts.some((p) => p.ts >= m.start && p.ts < m.end));
    paidSets[m.key] = new Set(paidInMonth.map((u) => u.uid));
    const winnersPaid = winners.filter((u) => paidSets[m.key].has(u.uid));

    const sumMakaAll = paidInMonth.reduce(
      (s, u) => s + u.makaPayouts.filter((p) => p.ts >= m.start && p.ts < m.end).reduce((a, p) => a + p.amount, 0), 0);
    const sumMakaWinners = winnersPaid.reduce(
      (s, u) => s + u.makaPayouts.filter((p) => p.ts >= m.start && p.ts < m.end).reduce((a, p) => a + p.amount, 0), 0);

    // New MAKA wallets proxy: first-ever maka payout occurs in this month
    const newMakaWallets = users.filter((u) => u.firstMakaPayoutTs && u.firstMakaPayoutTs >= m.start && u.firstMakaPayoutTs < m.end);

    // Win entries + MAKA credited to winners this month
    let winEntries = 0, makaCreditedToWinners = 0;
    for (const u of winners) {
      for (const w of u.wins) {
        if (w.ts >= m.start && w.ts < m.end) {
          winEntries++;
          makaCreditedToWinners += w.makaCredited;
        }
      }
    }

    monthStats[m.key] = {
      month: m.label,
      uniqueWinners: winnerSet.size,
      winEntries,
      winnersWithMakaWallet: winnersWithEvm.length,
      newMakaWalletsCollected_proxyFirstMakaPayout: newMakaWallets.length,
      winnersPaidMaka: winnersPaid.length,
      totalUsersPaidMaka: paidInMonth.length,
      makaPaidToWinners: Number(sumMakaWinners.toFixed(4)),
      makaPaidTotal_allUsers: Number(sumMakaAll.toFixed(4)),
      makaCreditedToWinners_viaWins: Number(makaCreditedToWinners.toFixed(4)),
      newWinners_firstWinEverThisMonth: newEver.length,
    };

    // CSV: winners detail
    writeCsv(`winners_${m.key}.csv`,
      ["uid", "userName", "firstName", "lastName", "winEntries", "makaCredited", "hasEvmWallet", "evmWallet", "paidMakaThisMonth", "makaPaidAmount", "firstWinEver"],
      winners.map((u) => {
        const mw = u.wins.filter((w) => w.ts >= m.start && w.ts < m.end);
        const mp = u.makaPayouts.filter((p) => p.ts >= m.start && p.ts < m.end);
        return [
          u.uid, u.userName, u.firstName, u.lastName,
          mw.length, Number(mw.reduce((s, w) => s + w.makaCredited, 0).toFixed(4)),
          u.evmWallet ? 1 : 0, u.evmWallet || "",
          mp.length > 0 ? 1 : 0, Number(mp.reduce((s, p) => s + p.amount, 0).toFixed(4)),
          u.firstWinTs ? isoDay(u.firstWinTs) : "",
        ];
      }));

    // CSV: maka payouts detail
    const payoutRows = [];
    for (const u of paidInMonth) {
      for (const p of u.makaPayouts.filter((x) => x.ts >= m.start && x.ts < m.end)) {
        payoutRows.push([u.uid, u.userName, u.firstName, u.lastName, isoDay(p.ts), p.amount, p.walletId, winnerSet.has(u.uid) ? 1 : 0]);
      }
    }
    payoutRows.sort((a, b) => (a[4] < b[4] ? -1 : 1));
    writeCsv(`maka_payouts_${m.key}.csv`,
      ["uid", "userName", "firstName", "lastName", "date", "amount", "walletId", "isWinnerThisMonth"], payoutRows);
  }

  // New vs previous month (winners and paid)
  const prev = { "2026-09": "2026-08", "2026-10": "2026-09" };
  const newVsPrev = {};
  for (const [mk, pk] of Object.entries(prev)) {
    const wNew = [...winnerSets[mk]].filter((id) => !winnerSets[pk].has(id));
    const pNew = [...paidSets[mk]].filter((id) => !paidSets[pk].has(id));
    const pNewVsAllPrior = [...paidSets[mk]].filter((id) =>
      !MONTHS.filter((m) => m.key < mk).some((m) => paidSets[m.key].has(id)));
    newVsPrev[mk] = {
      month: MONTHS.find((m) => m.key === mk).label,
      newWinners_vsPrevMonth: wNew.length,
      returningWinners_vsPrevMonth: winnerSets[mk].size - wNew.length,
      newPaid_vsPrevMonth: pNew.length,
      newPaid_vsAllPriorMonths: pNewVsAllPrior.length,
    };
  }

  // ---- Report ---------------------------------------------------------------------
  const summary = {
    generatedAt: new Date().toISOString(),
    timezoneBasis: "UTC",
    makaWalletStart: makaStart
      ? { date: new Date(makaStart).toISOString(), uid: makaStartUser.uid, userName: makaStartUser.userName }
      : null,
    totals: {
      users: users.length,
      usersWithWins: users.filter((u) => u.wins.length > 0).length,
      usersWithEvmWallet: users.filter((u) => u.evmWallet).length,
      usersWithMakaPayouts: users.filter((u) => u.makaPayouts.length > 0).length,
    },
    months: monthStats,
    newVsPrev,
  };

  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  console.log("\n================ MAKA WALLET START ================");
  console.log(makaStart
    ? `Earliest MAKA payout: ${new Date(makaStart).toISOString()} by ${makaStartUser.userName} (${makaStartUser.uid})`
    : "No MAKA payouts found in DB.");

  console.log("\n================ MONTHLY STATS (UTC) ================");
  for (const m of MONTHS) {
    const s = monthStats[m.key];
    console.log(`\n--- ${m.label} ---`);
    console.log(`  Unique winners:                 ${s.uniqueWinners}  (${s.winEntries} win entries)`);
    console.log(`  Winners w/ MAKA (EVM) wallet:   ${s.winnersWithMakaWallet}`);
    console.log(`  New MAKA wallets (proxy*):      ${s.newMakaWalletsCollected_proxyFirstMakaPayout}`);
    console.log(`  Winners paid in MAKA:           ${s.winnersPaidMaka}`);
    console.log(`  All users paid in MAKA:         ${s.totalUsersPaidMaka}`);
    console.log(`  MAKA paid to winners:           ${s.makaPaidToWinners}`);
    console.log(`  MAKA paid total (all users):    ${s.makaPaidTotal_allUsers}`);
    console.log(`  MAKA credited via wins:         ${s.makaCreditedToWinners_viaWins}`);
    console.log(`  New winners (first-ever win):   ${s.newWinners_firstWinEverThisMonth}`);
    if (newVsPrev[m.key]) {
      const n = newVsPrev[m.key];
      console.log(`  New winners vs prev month:      ${n.newWinners_vsPrevMonth}  (returning: ${n.returningWinners_vsPrevMonth})`);
      console.log(`  New paid vs prev month:         ${n.newPaid_vsPrevMonth}  (vs all prior: ${n.newPaid_vsAllPriorMonths})`);
    }
  }

  console.log("\n* proxy = user's first-ever MAKA payout falls in that month");
  console.log("  (wallets node has no timestamps, so exact 'wallets collected per month' is not in the DB)");
  console.log(`\nOutput written to: ${OUT_DIR}`);
  console.log("  summary.json, winners_<month>.csv, maka_payouts_<month>.csv");
  console.log("  NOTE: CSVs contain PII (names, wallet addresses) — do not commit.");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
