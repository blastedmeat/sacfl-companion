export default async function handler(req, res) {
  const { type } = req.query;
  const MFL_LEAGUE = "67549";
  const MFL_BASE = "https://www43.myfantasyleague.com/2026/export";

  const validTypes = ["freeAgents", "players", "rosters", "liveScoring"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }

  try {
    let url = `${MFL_BASE}?TYPE=${type}&L=${MFL_LEAGUE}&JSON=1`;
    if (type === "players") {
      url += "&DETAILS=1";
    }

    const response = await fetch(url);
    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
