import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";

// ═══════════════════════════════════════════════════════
// FIREBASE SETUP
// ═══════════════════════════════════════════════════════

const app = initializeApp({
  apiKey: "AIzaSyCDduy4UbsBnJgUbGriSiXqXF9t0wlvYbk",
  authDomain: "sacfl-companion-website.firebaseapp.com",
  projectId: "sacfl-companion-website",
  storageBucket: "sacfl-companion-website.firebasestorage.app",
  messagingSenderId: "684758798935",
  appId: "1:684758798935:web:4e51e65d56abb7c11a0912",
});
const db = getFirestore(app);

async function fsCol(name) {
  const snap = await getDocs(collection(db, name));
  const r = {};
  snap.forEach(d => { r[d.id] = d.data(); });
  return r;
}

async function fsDoc(col, id) {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? snap.data() : null;
}

// ═══════════════════════════════════════════════════════
// DATA HOOKS
// ═══════════════════════════════════════════════════════

function useFirestore() {
  const [teams, setTeams] = useState(null);
  const [rosters, setRosters] = useState(null);
  const [draftPicks, setDraftPicks] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [nameHistory, setNameHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fsCol("teams"), fsCol("rosters"), fsCol("draftPicks"),
      fsDoc("league", "info"), fsDoc("league", "nameHistory"),
    ]).then(([t, r, dp, li, nh]) => {
      setTeams(t); setRosters(r); setDraftPicks(dp);
      setLeagueInfo(li); setNameHistory(nh); setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return { teams, rosters, draftPicks, leagueInfo, nameHistory, loading, error };
}

function useDraftYear(year) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState({});

  useEffect(() => {
    if (!year) return;
    if (cache[year]) { setData(cache[year]); return; }
    setLoading(true);
    fsDoc("draftHistory", String(year)).then(d => {
      const p = d?.picks || [];
      setCache(c => ({ ...c, [year]: p }));
      setData(p); setLoading(false);
    }).catch(() => { setData([]); setLoading(false); });
  }, [year, cache]);

  return { data, loading };
}

function useKeepers(year) {
  const [data, setData] = useState(null);
  const [cache, setCache] = useState({});

  useEffect(() => {
    if (!year) return;
    if (cache[year] !== undefined) { setData(cache[year]); return; }
    fsDoc("keeperHighlights", String(year)).then(d => {
      const p = d?.players || null;
      setCache(c => ({ ...c, [year]: p }));
      setData(p);
    }).catch(() => { setCache(c => ({ ...c, [year]: null })); setData(null); });
  }, [year, cache]);

  return data;
}

function useTradeYear(year) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState({});

  useEffect(() => {
    if (!year) return;
    if (cache[year]) { setData(cache[year]); return; }
    setLoading(true);
    fsDoc("trades", String(year)).then(d => {
      const t = d?.trades || [];
      setCache(c => ({ ...c, [year]: t }));
      setData(t); setLoading(false);
    }).catch(() => { setData([]); setLoading(false); });
  }, [year, cache]);

  return { data, loading };
}
// ═══════════════════════════════════════════════════════

const SC = {
  R: { bg: "#1a7a3a", label: "Rookie Keeper" },
  GPII: { bg: "#b8860b", label: "Tier II (GPII)" },
  K: { bg: "#2563eb", label: "Round-Locked Keeper" },
  NK: { bg: "#6b7280", label: "Non-Keeper" },
  FAE: { bg: "#9333ea", label: "Free Agent Exception" },
};
const PO = { QB: 1, RB: 2, WR: 3, TE: 4, PK: 5, DEF: 6 };
const SO = { R: 0, GPII: 1, K: 2, NK: 3, FAE: 4 };
const DH_YEARS = [];
for (let y = 2025; y >= 1999; y--) { if (y !== 2001 && y !== 2002) DH_YEARS.push(y); }
const TRADE_YEARS = [];
for (let y = 2025; y >= 2003; y--) TRADE_YEARS.push(y);

const mono = "'JetBrains Mono', monospace";
const display = "'Anybody', sans-serif";

// ═══════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════

function Badge({ status }) {
  const s = SC[status] || { bg: "#374151" };
  return <span style={{ background: s.bg, color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fontFamily: mono, display: "inline-block" }}>{status}</span>;
}

function Spin({ msg }) {
  return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
      <div style={{ fontSize: 24, marginBottom: 8, animation: "spin 1s linear infinite", display: "inline-block" }}>🏈</div>
      <div style={{ fontSize: 14 }}>{msg || "Loading..."}</div>
    </div>
  );
}

function DivBadge({ division }) {
  const isN = division.startsWith("Norris");
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: isN ? "#dbeafe" : "#fce7f3", color: isN ? "#1d4ed8" : "#be185d", letterSpacing: 0.5, textTransform: "uppercase" }}>{division}</span>;
}

function PickChips({ picks }) {
  if (!picks || picks.length === 0) return <span style={{ fontSize: 12, color: "#94a3b8" }}>No picks</span>;
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{picks.map((p, i) => (
    <span key={i} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: mono, background: p.startsWith("R") ? "#dcfce7" : "#dbeafe", color: p.startsWith("R") ? "#166534" : "#1d4ed8" }}>{p}</span>
  ))}</div>;
}

// ═══════════════════════════════════════════════════════
// TEAMS TAB
// ═══════════════════════════════════════════════════════

function TeamCard({ id, team, roster, onSelect }) {
  const pl = roster?.players || [];
  const cc = team.championships ? team.championships.split(",").length : 0;
  return (
    <div onClick={() => onSelect(id)} style={{
      background: "#fff", borderRadius: 10, padding: "18px 20px", cursor: "pointer",
      border: "1px solid #e2e5e9", transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.12)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e5e9"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", fontFamily: display }}>{team.nick}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{team.owner}</div>
        </div>
        <DivBadge division={team.division} />
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>{team.full}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>{pl.length} players</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>|</span>
        <span style={{ fontSize: 11, color: SC.R.bg, fontWeight: 600 }}>{pl.filter(p => p.status === "R").length}R</span>
        <span style={{ fontSize: 11, color: SC.GPII.bg, fontWeight: 600 }}>{pl.filter(p => p.status === "GPII").length}GP</span>
        <span style={{ fontSize: 11, color: SC.K.bg, fontWeight: 600 }}>{pl.filter(p => p.status === "K").length}K</span>
        {cc > 0 && <>
          <span style={{ fontSize: 11, color: "#64748b" }}>|</span>
          <span style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>{"🏆".repeat(Math.min(cc, 6))}{cc > 6 ? `+${cc-6}` : ""}</span>
        </>}
      </div>
    </div>
  );
}

function RosterTable({ players }) {
  const sorted = [...players].sort((a, b) => {
    const d = (PO[a.pos] || 99) - (PO[b.pos] || 99);
    return d !== 0 ? d : (SO[a.status] ?? 5) - (SO[b.status] ?? 5);
  });
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ borderBottom: "2px solid #e2e5e9" }}>
          {["Player","Pos","Status","Acquired","Year"].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{sorted.map((p, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
            <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0f172a" }}>{p.name}</td>
            <td style={{ padding: "7px 10px", color: "#475569", fontFamily: mono, fontSize: 12 }}>{p.pos}</td>
            <td style={{ padding: "7px 10px" }}><Badge status={p.status} /></td>
            <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 12 }}>{p.acquired}</td>
            <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 12 }}>{p.year}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TeamDetail({ id, team, roster, picks, onBack }) {
  const players = roster?.players || [];
  const byStat = {};
  players.forEach(p => { byStat[p.status] = (byStat[p.status] || 0) + 1; });
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16, fontFamily: "inherit" }}>← All Teams</button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ flex: "1 1 300px" }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0, fontFamily: display }}>{team.full}</h2>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Owner: {team.owner} | {team.phone}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <DivBadge division={team.division + " Division"} />
            {team.championships && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>🏆 {team.championships}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(byStat).sort((a,b) => (SO[a[0]]??5) - (SO[b[0]]??5)).map(([s, c]) => (
            <div key={s} style={{ textAlign: "center", padding: "8px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e5e9" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: SC[s]?.bg || "#333" }}>{c}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>{SC[s]?.label || s}</div>
            </div>
          ))}
        </div>
      </div>
      {picks && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e2e5e9" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>2026 Draft Picks</h4>
            <PickChips picks={picks.picks2026} />
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e2e5e9" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>2027 Draft Capital</h4>
            <PickChips picks={picks.picks2027} />
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e5e9", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e5e9", background: "#f8fafc" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Roster ({players.length} players)</h3>
        </div>
        <RosterTable players={players} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ALL ROSTERS TAB
// ═══════════════════════════════════════════════════════

function AllRosters({ teams, rosters, onSelectTeam }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const all = useMemo(() => {
    const r = [];
    if (!teams || !rosters) return r;
    Object.entries(teams).forEach(([k, t]) => {
      (rosters[k]?.players || []).forEach(p => r.push({ ...p, teamKey: k, teamNick: t.nick }));
    });
    return r;
  }, [teams, rosters]);
  const filtered = all.filter(p => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.teamNick.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => { const d = (PO[a.pos]||99) - (PO[b.pos]||99); return d !== 0 ? d : a.name.localeCompare(b.name); });
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players or teams..." style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, flex: "1 1 200px", minWidth: 180, outline: "none", fontFamily: "inherit" }} />
        {["all","R","GPII","K","NK"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", border: filter === f ? "2px solid #2563eb" : "1px solid #d1d5db", background: filter === f ? "#eff6ff" : "#fff", color: filter === f ? "#2563eb" : "#64748b", fontFamily: "inherit" }}>{f === "all" ? "All" : f}</button>
        ))}
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{filtered.length} players</span>
      </div>
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e2e5e9" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: "2px solid #e2e5e9" }}>
            {["Player","Pos","Status","Team","Acquired","Year"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{filtered.map((p, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "6px 10px", fontWeight: 600, color: "#0f172a" }}>{p.name}</td>
              <td style={{ padding: "6px 10px", color: "#475569", fontFamily: mono, fontSize: 12 }}>{p.pos}</td>
              <td style={{ padding: "6px 10px" }}><Badge status={p.status} /></td>
              <td style={{ padding: "6px 10px" }}><span onClick={() => onSelectTeam(p.teamKey)} style={{ color: "#2563eb", cursor: "pointer", fontWeight: 500, fontSize: 12 }}>{p.teamNick}</span></td>
              <td style={{ padding: "6px 10px", color: "#64748b", fontSize: 12 }}>{p.acquired}</td>
              <td style={{ padding: "6px 10px", color: "#64748b", fontSize: 12 }}>{p.year}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DRAFT PICKS TAB
// ═══════════════════════════════════════════════════════

function DraftPickTracker({ teams, draftPicks }) {
  const [season, setSeason] = useState("2026");
  if (!teams || !draftPicks) return <Spin msg="Loading draft picks..." />;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["2026","2027"].map(s => (
          <button key={s} onClick={() => setSeason(s)} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", border: season === s ? "2px solid #2563eb" : "1px solid #d1d5db", background: season === s ? "#eff6ff" : "#fff", color: season === s ? "#2563eb" : "#64748b", fontFamily: "inherit" }}>{s}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {Object.entries(teams).map(([k, t]) => {
          const tp = draftPicks[k] || {};
          const picks = season === "2026" ? (tp.picks2026 || []) : (tp.picks2027 || []);
          const rp = picks.filter(p => p.startsWith("R"));
          const pp = picks.filter(p => p.startsWith("P"));
          return (
            <div key={k} style={{ background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e2e5e9" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8, fontFamily: display }}>{t.nick}</div>
              {rp.length > 0 && <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Rookie </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>{rp.map((p, i) => <span key={i} style={{ padding: "2px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600, fontFamily: mono, background: "#dcfce7", color: "#166534" }}>{p}</span>)}</div>
              </div>}
              {pp.length > 0 && <div>
                <span style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Player </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>{pp.map((p, i) => <span key={i} style={{ padding: "2px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600, fontFamily: mono, background: "#dbeafe", color: "#1d4ed8" }}>{p}</span>)}</div>
              </div>}
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{picks.length} total picks</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DRAFT HISTORY TAB
// ═══════════════════════════════════════════════════════

function DraftHistoryView() {
  const [year, setYear] = useState(2025);
  const [draftType, setDraftType] = useState("all");
  const [search, setSearch] = useState("");
  const { data: raw, loading } = useDraftYear(year);
  const keeperList = useKeepers(year);
  const keeperSet = useMemo(() => keeperList ? new Set(keeperList) : null, [keeperList]);

  const picks = useMemo(() => {
    if (!raw) return [];
    let p = raw;
    if (draftType === "rookie") p = p.filter(x => x.pick.startsWith("R"));
    else if (draftType === "player") p = p.filter(x => x.pick.startsWith("P"));
    if (search) {
      const s = search.toLowerCase();
      p = p.filter(x => x.player.toLowerCase().includes(s) || x.team.toLowerCase().includes(s));
    }
    return p;
  }, [raw, draftType, search]);
  const rp = useMemo(() => picks.filter(p => p.pick.startsWith("R")), [picks]);
  const pp = useMemo(() => picks.filter(p => p.pick.startsWith("P")), [picks]);

  const grp = (arr) => {
    const g = {};
    arr.forEach(p => { const r = p.pick.substring(0,3); (g[r] = g[r] || []).push(p); });
    return Object.entries(g).sort((a,b) => a[0].localeCompare(b[0]));
  };

  const PickCard = ({ p, type }) => {
    const isPlayer = type === "player";
    const rdNum = parseInt(p.pick.substring(1,3));
    const isKR = isPlayer && rdNum >= 6;
    const isKept = isPlayer && keeperSet && keeperSet.has(p.player);
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
        background: isKept ? "#fefce8" : "#fff", borderRadius: 6, fontSize: 13,
        border: isKept ? "1px solid #fde68a" : isPlayer ? (isKR ? "1px solid #dbeafe" : "1px solid #e2e5e9") : "1px solid #dcfce7",
      }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: isKept ? "#a16207" : isPlayer ? (isKR ? "#1d4ed8" : "#6b7280") : "#166534", fontWeight: 700, minWidth: 52 }}>{p.pick}</span>
        <span style={{ fontSize: 11, color: "#64748b", minWidth: 28, fontFamily: mono }}>{p.pos}</span>
        <span style={{ fontWeight: 600, color: "#0f172a", flex: 1 }}>{p.player}</span>
        {isKept && <span style={{ fontSize: 9, fontWeight: 800, color: "#a16207", background: "#fef3c7", padding: "1px 5px", borderRadius: 3, letterSpacing: 0.5 }}>KEPT</span>}
        <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>{p.team}</span>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select value={year} onChange={e => { setYear(Number(e.target.value)); }} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 700, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
          {DH_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {["all","rookie","player"].map(f => (
          <button key={f} onClick={() => setDraftType(f)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", border: draftType === f ? "2px solid #2563eb" : "1px solid #d1d5db", background: draftType === f ? "#eff6ff" : "#fff", color: draftType === f ? "#2563eb" : "#64748b", textTransform: "capitalize", fontFamily: "inherit" }}>{f === "all" ? "All" : f + " Draft"}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player or team..." style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, flex: "1 1 180px", minWidth: 160, outline: "none", fontFamily: "inherit" }} />
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{picks.length} picks</span>
      </div>

      {keeperSet && draftType !== "rookie" && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "#64748b", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "#fefce8", border: "1px solid #fde68a" }} /><span>Keeper</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "#fff", border: "1px solid #dbeafe" }} /><span>Fresh pick (keeper-eligible)</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "#fff", border: "1px solid #e2e5e9" }} /><span>Fresh pick (non-keeper)</span></div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{pp.filter(p => keeperSet.has(p.player)).length} keepers / {pp.length} player picks</span>
        </div>
      )}
      {!keeperSet && draftType !== "rookie" && pp.length > 0 && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12, fontStyle: "italic" }}>Keeper highlighting available for 2020-2025</div>
      )}

      {loading && <Spin msg={`Loading ${year} draft...`} />}

      {!loading && draftType !== "player" && rp.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#166534", marginBottom: 12, fontFamily: display }}>{year} Rookie Draft</h3>
          {grp(rp).map(([rd, rdp]) => (
            <div key={rd} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Round {parseInt(rd.substring(1))}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
                {rdp.map((p, i) => <PickCard key={i} p={p} type="rookie" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && draftType !== "rookie" && pp.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8", marginBottom: 12, fontFamily: display }}>{year} Player Draft</h3>
          {grp(pp).map(([rd, rdp]) => (
            <div key={rd} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Round {parseInt(rd.substring(1))}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
                {rdp.map((p, i) => <PickCard key={i} p={p} type="player" />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// NAME HISTORY TAB
// ═══════════════════════════════════════════════════════

function NameHistoryView({ nameHistory, leagueInfo }) {
  const [sel, setSel] = useState(null);
  if (!nameHistory || !leagueInfo) return <Spin msg="Loading name history..." />;
  const hd = leagueInfo.nameHistoryHeaders || [];
  const entries = nameHistory.entries || [];
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e5e9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
          <thead><tr style={{ borderBottom: "2px solid #e2e5e9" }}>
            <th style={{ padding: "8px 10px", textAlign: "left", color: "#64748b", fontSize: 11, fontWeight: 700, position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>Year</th>
            {hd.map((h, i) => (
              <th key={i} onClick={() => setSel(sel === i ? null : i)} style={{ padding: "8px 6px", textAlign: "left", color: sel === i ? "#2563eb" : "#64748b", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", background: sel === i ? "#eff6ff" : "transparent" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{entries.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "6px 10px", fontWeight: 700, color: "#0f172a", fontSize: 12, fontFamily: mono, position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{row.year}</td>
              {(row.names || []).map((name, ci) => {
                const def = name === hd[ci];
                return <td key={ci} style={{ padding: "6px 6px", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: def ? "#94a3b8" : "#0f172a", fontWeight: def ? 400 : 600, background: sel === ci ? "#f0f9ff" : "transparent" }} title={name}>{name}</td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LEAGUE INFO TAB
// ═══════════════════════════════════════════════════════

function LeagueInfoView({ teams, leagueInfo }) {
  if (!teams || !leagueInfo) return <Spin msg="Loading league info..." />;
  const norris = Object.entries(teams).filter(([,t]) => t.division === "Norris");
  const patrick = Object.entries(teams).filter(([,t]) => t.division === "Patrick");
  return (
    <div>
      <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, margin: "0 0 16px" }}>
        The SACFL is a 12-team dynasty/keeper fantasy football league running since 1999.
        Hosted on MyFantasyLeague (League ID: {leagueInfo.mflLeagueId}). The league uses a five-tier keeper system with both a Rookie Draft (2 rounds)
        and a Player Draft (16 rounds, snake format).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {[{ label: "Norris Division", teams: norris, color: "#2563eb" }, { label: "Patrick Division", teams: patrick, color: "#be185d" }].map(div => (
          <div key={div.label}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: div.color, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>{div.label}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {div.teams.map(([k, t]) => (
                <div key={k} style={{ background: "#fff", borderRadius: 8, padding: "12px 16px", border: "1px solid #e2e5e9" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{t.full}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{t.owner} | {t.phone}</div>
                  {t.championships && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>🏆 {t.championships}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>2026 Draft Selection Order</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(leagueInfo.selectionOrder2026 || []).map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#fff", borderRadius: 6, border: "1px solid #e2e5e9", fontSize: 13 }}>
              <span style={{ fontWeight: 800, color: "#2563eb", fontFamily: mono, fontSize: 12 }}>{i + 1}</span>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Keeper Tier System</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {Object.entries(SC).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e2e5e9" }}>
              <Badge status={k} />
              <span style={{ fontSize: 12, color: "#475569" }}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TRADE LOG TAB
// ═══════════════════════════════════════════════════════

function TradeLogView() {
  const [year, setYear] = useState(2025);
  const [search, setSearch] = useState("");
  const [allTradesCache, setAllTradesCache] = useState(null);
  const [allLoading, setAllLoading] = useState(false);
  const { data: singleYearData, loading: singleLoading } = useTradeYear(year);

  const isAllYears = year === 0;

  // Load all years when "All Years" is selected
  useEffect(() => {
    if (!isAllYears || allTradesCache) return;
    setAllLoading(true);
    Promise.all(TRADE_YEARS.map(y =>
      fsDoc("trades", String(y)).then(d => ({ year: y, trades: d?.trades || [] }))
    )).then(results => {
      const all = [];
      results.sort((a, b) => b.year - a.year);
      results.forEach(r => {
        r.trades.forEach(t => all.push({ ...t, year: r.year }));
      });
      setAllTradesCache(all);
      setAllLoading(false);
    }).catch(() => setAllLoading(false));
  }, [isAllYears, allTradesCache]);

  // Auto-switch to All Years when searching, back to single year when cleared
  const handleSearch = (val) => {
    setSearch(val);
    if (val.length >= 2 && year !== 0) {
      setYear(0);
    }
  };

  const handleYearChange = (val) => {
    setYear(val);
    if (val !== 0) setSearch("");
  };

  const trades = isAllYears ? allTradesCache : singleYearData;
  const loading = isAllYears ? allLoading : singleLoading;

  const filtered = useMemo(() => {
    if (!trades) return [];
    if (!search) return trades;
    const s = search.toLowerCase();
    return trades.filter(t => t.sides.some(side =>
      side.team.toLowerCase().includes(s) || side.desc.toLowerCase().includes(s)
    ));
  }, [trades, search]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select value={year} onChange={e => handleYearChange(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 700, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
          <option value={0}>All Years</option>
          {TRADE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search team or player..." style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, flex: "1 1 200px", minWidth: 180, outline: "none", fontFamily: "inherit" }} />
        {!loading && <span style={{ fontSize: 12, color: "#94a3b8" }}>{filtered.length} trades{isAllYears && search ? " across all years" : ""}</span>}
      </div>

      {loading && <Spin msg={isAllYears ? "Loading all trade history..." : `Loading ${year} trades...`} />}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14 }}>
          {search ? `No trades found for "${search}"` : `No trades found for ${year}`}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((trade, ti) => (
            <div key={ti} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e5e9", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e5e9" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{trade.sides.map(s => s.team).join(" ↔ ")}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isAllYears && <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "2px 8px", borderRadius: 4, fontFamily: mono }}>{trade.year}</span>}
                  {trade.date && <span style={{ fontSize: 12, color: "#64748b", fontFamily: mono }}>{trade.date}</span>}
                </div>
              </div>
              <div style={{ padding: "12px 16px" }}>
                {trade.sides.map((side, si) => (
                  <div key={si} style={{ marginBottom: si < trade.sides.length - 1 ? 10 : 0, paddingBottom: si < trade.sides.length - 1 ? 10 : 0, borderBottom: si < trade.sides.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: 0.5 }}>{side.team}</span>
                    <div style={{ fontSize: 13, color: "#334155", marginTop: 4, lineHeight: 1.5 }}>{side.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FREE AGENTS TAB (pulls from MFL API)
// ═══════════════════════════════════════════════════════

const MFL_BASE = "https://www43.myfantasyleague.com/2026/export";
const MFL_LEAGUE = "67549";

function useFreeAgents() {
  const [players, setPlayers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    // First get the player list to map IDs to names
    Promise.all([
      fetch(`${MFL_BASE}?TYPE=freeAgents&L=${MFL_LEAGUE}&JSON=1`).then(r => r.json()),
      fetch(`${MFL_BASE}?TYPE=players&L=${MFL_LEAGUE}&DETAILS=1&JSON=1`).then(r => r.json()),
    ]).then(([faData, playerData]) => {
      // Build player lookup from the players endpoint
      const lookup = {};
      const allPlayers = playerData?.players?.player || [];
      if (Array.isArray(allPlayers)) {
        allPlayers.forEach(p => { lookup[p.id] = p; });
      }

      // Parse free agents
      const faList = faData?.freeAgents?.leagueUnit?.player || [];
      const parsed = (Array.isArray(faList) ? faList : [faList]).filter(Boolean).map(fa => {
        const info = lookup[fa.id] || {};
        return {
          id: fa.id,
          name: info.name ? info.name.replace(/,\s*/, ", ") : `Player ${fa.id}`,
          pos: info.position || "??",
          nflTeam: info.team || "",
          age: info.age || "",
          drafted: info.draft_year || "",
        };
      }).filter(p => ["QB","RB","WR","TE","PK","Def","DE","DT","LB","CB","S"].includes(p.pos));

      setPlayers(parsed);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  return { players, loading, error };
}

function FreeAgentsView() {
  const { players, loading, error } = useFreeAgents();
  const [posFilter, setPosFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Map MFL positions to fantasy-relevant groups
  const POS_GROUPS = { QB: "QB", RB: "RB", WR: "WR", TE: "TE", PK: "PK", Def: "DEF" };
  const POSITIONS = ["all", "QB", "RB", "WR", "TE", "PK", "DEF"];

  const filtered = useMemo(() => {
    if (!players) return [];
    let f = players;
    if (posFilter !== "all") {
      if (posFilter === "DEF") {
        f = f.filter(p => p.pos === "Def");
      } else {
        f = f.filter(p => p.pos === posFilter);
      }
    }
    if (search) {
      const s = search.toLowerCase();
      f = f.filter(p => p.name.toLowerCase().includes(s) || p.nflTeam.toLowerCase().includes(s));
    }
    return f.sort((a, b) => {
      const po = (PO[a.pos] || PO[POS_GROUPS[a.pos]] || 99) - (PO[b.pos] || PO[POS_GROUPS[b.pos]] || 99);
      return po !== 0 ? po : a.name.localeCompare(b.name);
    });
  }, [players, posFilter, search]);

  if (error) return <div style={{ color: "#dc2626", padding: 20 }}>Error loading free agents from MFL: {error}</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player or NFL team..." style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, flex: "1 1 200px", minWidth: 180, outline: "none", fontFamily: "inherit" }} />
        {POSITIONS.map(p => (
          <button key={p} onClick={() => setPosFilter(p)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", border: posFilter === p ? "2px solid #2563eb" : "1px solid #d1d5db", background: posFilter === p ? "#eff6ff" : "#fff", color: posFilter === p ? "#2563eb" : "#64748b", fontFamily: "inherit" }}>{p === "all" ? "All" : p}</button>
        ))}
        {!loading && players && <span style={{ fontSize: 12, color: "#94a3b8" }}>{filtered.length} players</span>}
      </div>

      {loading && <Spin msg="Loading free agents from MFL..." />}

      {!loading && players && (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e2e5e9" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: "2px solid #e2e5e9" }}>
              {["Player","Pos","NFL Team","Age"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.map((p, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0f172a" }}>{p.name}</td>
                <td style={{ padding: "7px 10px", fontFamily: mono, fontSize: 12 }}>
                  <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600, background: {QB:"#dbeafe",RB:"#dcfce7",WR:"#fef3c7",TE:"#fce7f3",PK:"#e2e5e9",Def:"#e2e5e9"}[p.pos] || "#e2e5e9", color: {QB:"#1d4ed8",RB:"#166534",WR:"#92400e",TE:"#be185d",PK:"#374151",Def:"#374151"}[p.pos] || "#374151" }}>{p.pos === "Def" ? "DEF" : p.pos}</span>
                </td>
                <td style={{ padding: "7px 10px", color: "#475569", fontSize: 12 }}>{p.nflTeam}</td>
                <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 12 }}>{p.age}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════

const TABS = [
  { id: "teams", label: "Teams" },
  { id: "rosters", label: "All Rosters" },
  { id: "freeAgents", label: "Free Agents" },
  { id: "picks", label: "Draft Picks" },
  { id: "draftHistory", label: "Draft History" },
  { id: "trades", label: "Trade Log" },
  { id: "history", label: "Name History" },
  { id: "info", label: "League Info" },
];

function App() {
  const [tab, setTab] = useState("teams");
  const [sel, setSel] = useState(null);
  const d = useFirestore();

  const go = (k) => { setSel(k); setTab("teams"); };

  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: "#f4f6f8", minHeight: "100vh" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Anybody:wght@700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)", padding: "24px 24px 0", color: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>🏈</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: display, letterSpacing: -0.5 }}>SACFL</h1>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Est. 1999 | 12-Team Dynasty League</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 16, overflowX: "auto" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "teams") setSel(null); }} style={{
                padding: "8px 18px", borderRadius: "6px 6px 0 0", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "inherit",
                background: tab === t.id ? "#f4f6f8" : "rgba(255,255,255,0.08)",
                color: tab === t.id ? "#0f172a" : "rgba(255,255,255,0.7)", transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 48px" }}>
        {d.loading && <Spin msg="Loading SACFL data..." />}
        {d.error && <div style={{ color: "#dc2626", padding: 20 }}>Error loading data: {d.error}</div>}
        {!d.loading && !d.error && <>
          {tab === "teams" && !sel && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 16, fontFamily: display }}>All Teams</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {d.teams && Object.entries(d.teams).map(([k, t]) => <TeamCard key={k} id={k} team={t} roster={d.rosters?.[k]} onSelect={go} />)}
              </div>
            </div>
          )}
          {tab === "teams" && sel && d.teams?.[sel] && <TeamDetail id={sel} team={d.teams[sel]} roster={d.rosters?.[sel]} picks={d.draftPicks?.[sel]} onBack={() => setSel(null)} />}
          {tab === "rosters" && <AllRosters teams={d.teams} rosters={d.rosters} onSelectTeam={go} />}
          {tab === "freeAgents" && <FreeAgentsView />}
          {tab === "picks" && <DraftPickTracker teams={d.teams} draftPicks={d.draftPicks} />}
          {tab === "draftHistory" && <DraftHistoryView />}
          {tab === "trades" && <TradeLogView />}
          {tab === "history" && <NameHistoryView nameHistory={d.nameHistory} leagueInfo={d.leagueInfo} />}
          {tab === "info" && <LeagueInfoView teams={d.teams} leagueInfo={d.leagueInfo} />}
        </>}
      </div>
      <div style={{ textAlign: "center", padding: "16px 24px", fontSize: 11, color: "#94a3b8", borderTop: "1px solid #e2e5e9" }}>
        SACFL Companion Site | Built by Tim Radice | Live scoring at{" "}
        <a href="https://www43.myfantasyleague.com/2026/home/67549" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>MyFantasyLeague</a>
      </div>
    </div>
  );
}

export default App;
