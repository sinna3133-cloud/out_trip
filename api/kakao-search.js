// Vercel Serverless Function — Kakao 장소 검색 프록시
// 경로: /api/kakao-search?q=검색어
// 카카오 REST 키는 Vercel 환경변수 KAKAO_REST_KEY 에 저장됨 (코드/깃허브에 노출 안 됨)

export default async function handler(req, res) {
  // CORS 허용 (같은 도메인에서 부르지만 안전하게 명시)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const q = (req.query.q || "").toString().trim();
  if (!q) { res.status(400).json({ error: "missing q" }); return; }

  const key = process.env.KAKAO_REST_KEY;
  if (!key) { res.status(500).json({ error: "server not configured" }); return; }

  try {
    const url = "https://dapi.kakao.com/v2/local/search/keyword.json?size=8&query=" + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Authorization: "KakaoAK " + key } });
    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).json({ error: "kakao " + r.status, detail: text.slice(0, 300) });
      return;
    }
    const data = await r.json();
    // 필요한 필드만 추려서 반환
    const results = (data.documents || []).map(d => ({
      name: d.place_name,
      address: d.road_address_name || d.address_name || "",
      lat: parseFloat(d.y),
      lon: parseFloat(d.x)
    }));
    // 살짝 캐시 (같은 검색어 반복 시 빠르게)
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: "proxy failed", detail: String(e).slice(0, 300) });
  }
}
