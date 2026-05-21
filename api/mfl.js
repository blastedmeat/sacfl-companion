export default async function handler(req, res) {
  const { type, action } = req.query;
  const MFL_LEAGUE = "20812";
  const MFL_BASE = "https://www49.myfantasyleague.com/2025/export";
  const MFL_API = "https://api.myfantasyleague.com/2026";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Handle roster push to MFL
  if (action === "pushRosters") {
    try {
      const { username, password, rosters } = req.body || {};
      if (!username || !password || !rosters) {
        return res.status(400).json({ error: "Missing username, password, or rosters" });
      }

      // 1. Login to get cookie
      const loginResp = await fetch(
        `${MFL_API}/login?USERNAME=${encodeURIComponent(username)}&PASSWORD=${encodeURIComponent(password)}&XML=1`
      );
      const loginText = await loginResp.text();

      // Extract cookie from response
      const cookieMatch = loginText.match(/MFL_USER_ID="([^"]+)"/);
      if (!cookieMatch) {
        return res.status(401).json({ error: "Login failed. Check your MFL username and password." });
      }
      const mflCookie = cookieMatch[1];

      // 2. Push rosters via import API
      // MFL import format: franchiseId,playerId (one per line)
      const results = [];
      for (const [franchiseId, playerIds] of Object.entries(rosters)) {
        const rosterStr = playerIds.join(",");
        const importUrl = `${MFL_API}/import?TYPE=rosters&L=${MFL_LEAGUE}&FRANCHISE_ID=${franchiseId}&PLAYER_IDS=${rosterStr}&JSON=1`;

        const importResp = await fetch(importUrl, {
          headers: { Cookie: `MFL_USER_ID=${mflCookie}` },
        });
        const importData = await importResp.text();
        results.push({ franchise: franchiseId, response: importData });
      }

      return res.status(200).json({ success: true, results });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Handle normal export requests
  const validTypes = ["freeAgents", "players", "rosters", "liveScoring", "playerScores", "topAdds"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }

  try {
    let url = `${MFL_BASE}?TYPE=${type}&L=${MFL_LEAGUE}&JSON=1`;
    if (type === "players") {
      url += "&DETAILS=1";
    }
    if (type === "playerScores") {
      url += "&SEASON=2025&RULES=1";
    }
    // For rosters and freeAgents on 2026 site
    if (type === "rosters") {
      url = `https://www49.myfantasyleague.com/2026/export?TYPE=rosters&L=${MFL_LEAGUE}&JSON=1`;
    }

    const response = await fetch(url);
    const data = await response.json();

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
