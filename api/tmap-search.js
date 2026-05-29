// Vercel Serverless Function — TMAP 장소(POI) 검색 프록시
// 경로: /api/tmap-search?q=검색어
// TMAP 앱키는 Vercel 환경변수 TMAP_APP_KEY 에 저장됨 (코드/깃허브에 노출 안 됨)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const q = (req.query.q || "").toString().trim();
  if (!q) { res.status(400).json({ error: "missing q" }); return; }

  const key = process.env.TMAP_APP_KEY;
  if (!key) { res.status(500).json({ error: "server not configured (no TMAP_APP_KEY)" }); return; }

  try {
    const url = "https://apis.openapi.sk.com/tmap/pois?version=1&count=8&resCoordType=WGS84GEO&searchType=all&searchKeyword=" + encodeURIComponent(q);
    const r = await fetch(url, { headers: { appKey: key, Accept: "application/json" } });
    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).json({ error: "tmap " + r.status, detail: text.slice(0, 300) });
      return;
    }
    const data = await r.json();
    const pois = (data.searchPoiInfo && data.searchPoiInfo.pois && data.searchPoiInfo.pois.poi) || [];
    const results = pois.map(p => {
      const addr = [p.upperAddrName, p.middleAddrName, p.lowerAddrName].filter(Boolean).join(" ")
        + (p.firstNo && p.firstNo !== "0" ? " " + p.firstNo + (p.secondNo && p.secondNo !== "0" ? "-" + p.secondNo : "") : "");
      return {
        name: p.name,
        address: (p.roadName ? (p.upperAddrName + " " + p.middleAddrName + " " + p.roadName + " " + (p.firstBuildNo||"")).trim() : addr.trim()),
        lat: parseFloat(p.noorLat),
        lon: parseFloat(p.noorLon)
      };
    }).filter(x => !isNaN(x.lat) && !isNaN(x.lon));
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: "proxy failed", detail: String(e).slice(0, 300) });
  }
}
