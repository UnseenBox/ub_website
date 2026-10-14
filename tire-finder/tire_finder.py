"""Tire finder: scans Algerian listings for 185/65 R14 tires near Tlemcen.

Run:  python tire_finder.py
Out:  reports/report-YYYY-MM-DD.html  (self-contained, images embedded)
      reports/latest.json             (machine-readable results)
      reports/latest.md               (short text summary)
State: data/seen.json (first-seen dates, so new listings get flagged)

Standard library only.
"""
import base64
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "data"
REPORTS = ROOT / "reports"

# ---------------------------------------------------------------- config
WIDTH, ASPECT, RIM = 185, 65, 14
VEHICLE = "Hyundai Matrix CRDI 2009"

# Ouedkniss region id == wilaya code. km = rough road distance from Tlemcen city.
REGIONS = [
    ("13", "Tlemcen", 0),
    ("46", "Aïn Témouchent", 70),
    ("22", "Sidi Bel Abbès", 90),
    ("31", "Oran", 140),
    ("29", "Mascara", 180),
    ("20", "Saïda", 180),
    ("45", "Naâma", 250),
    ("27", "Mostaganem", 220),
]
REGION_KM = {rid: km for rid, _, km in REGIONS}
NEARBY_KM = 150  # "nearby" tier cut-off

TIRE_CATEGORY = "pieces_detachees-pieces_automobiles-pneus_jantes"
REGION_KEYWORDS = ["pneu", "pneus", "عجلات"]
NATIONAL_QUERIES = ["185/65 R14", "185 65 R14", "185/65/14", "pneu 185 65 14", "pneus R14"]

API = "https://api.ouedkniss.com/graphql"
SITE = "https://www.ouedkniss.com"
PAGE_SIZE = 48
MAX_PAGES = 8
DELAY = 0.6  # seconds between requests, be polite
MAX_IMAGES_EMBEDDED = 80

# ---------------------------------------------------------------- http
TRACK_ID = str(uuid.uuid4())
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def _headers(referer=SITE + "/"):
    return {
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Accept": "*/*",
        "Origin": SITE,
        "Referer": SITE + "/",
        "locale": "fr",
        "x-app-version": '"3.8.9"',
        "x-track-id": TRACK_ID,
        "x-track-timestamp": str(int(time.time())),
        "x-referer": referer,
    }


def gql(query, variables, referer=SITE + "/", retries=3):
    body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API, data=body, headers=_headers(referer))
            with urllib.request.urlopen(req, timeout=40) as r:
                out = json.loads(r.read().decode("utf-8"))
            if out.get("errors"):
                raise RuntimeError(str(out["errors"])[:300])
            time.sleep(DELAY)
            return out["data"]
        except Exception as e:  # network hiccup / rate limit: back off and retry
            last = e
            time.sleep(2 + attempt * 4)
    raise RuntimeError(f"Ouedkniss API failed: {last}")


SEARCH_Q = """
query S($q: String, $filter: SearchFilterInput) {
  search(q: $q, filter: $filter) {
    announcements {
      data {
        id title slug description price priceUnit createdAt refreshedAt
        hasDelivery street_name
        cities { id name region { id name } }
        defaultMedia(size: MEDIUM) { mediaUrl }
        medias(size: LARGE) { mediaUrl }
        store { id name slug }
        user { id username displayName }
        category { slug name }
      }
      paginatorInfo { total lastPage }
    }
  }
}"""

PHONE_Q = """
query UnhidePhone($id: ID!) {
  phones: announcementPhoneGet(id: $id) { phone phoneExt hasViber hasWhatsapp hasTelegram }
}"""


def search_all(q=None, region=None, category=None, max_pages=MAX_PAGES):
    items, page = [], 1
    while page <= max_pages:
        flt = {"page": page, "count": PAGE_SIZE}
        if region:
            flt["regionIds"] = [region]
        if category:
            flt["categorySlug"] = category
        d = gql(SEARCH_Q, {"q": q, "filter": flt})["search"]["announcements"]
        items += d["data"]
        if page >= (d["paginatorInfo"]["lastPage"] or 1):
            break
        page += 1
    return items


# ---------------------------------------------------------------- matching
ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
SIZE_RE = re.compile(r"(?<!\d)([1-3]\d5)\s*[/x×.\-\\ ]\s*(\d{2})\s*[/x×.\-\\ ]?\s*Z?R?\s*[/\-]?\s*(1[2-9]|2[0-4])(?!\d)", re.I)
SIZE_REV_RE = re.compile(r"R\s*(1[2-9]|2[0-4])\s*[/\-\\ ]\s*([1-3]\d5)\s*[/\-\\ ]\s*(\d{2})(?!\d)", re.I)
RIM_RE = re.compile(r"(?:\bR\s*%d\b|\b%d\s*(?:pouces?|\"|''|p\b))" % (RIM, RIM), re.I)
ALL_SIZES_RE = re.compile(r"tou(?:te)?s?\s+(?:les\s+)?dimensions?|toutes?\s+(?:les\s+)?(?:tailles|mesures)|"
                          r"جميع\s+(?:المقاسات|الأحجام|القياسات)|كل\s+(?:المقاسات|القياسات)", re.I)
TIRE_RE = re.compile(r"pneu|pneux|tyre|tire\b|عجل|إطار|اطار|بنو", re.I)
TARGET = (WIDTH, ASPECT, RIM)


def sizes_in(text):
    text = text.translate(ARABIC_DIGITS)
    found = {(int(a), int(b), int(c)) for a, b, c in SIZE_RE.findall(text)}
    found |= {(int(w), int(a), int(r)) for r, w, a in SIZE_REV_RE.findall(text)}
    return found


def classify(a):
    """Returns ('exact'|'possible'|None, reason)."""
    text = f"{a.get('title') or ''}\n{a.get('description') or ''}"
    in_tire_cat = (a.get("category") or {}).get("slug", "").startswith(TIRE_CATEGORY)
    if not in_tire_cat and not TIRE_RE.search(text):
        return None, ""
    sizes = sizes_in(text)
    if TARGET in sizes:
        if len(sizes) > 1:
            return "exact", f"185/65 R14 is in the seller's size list ({len(sizes)} sizes listed)"
        return "exact", "185/65 R14 written in the listing"
    if ALL_SIZES_RE.search(text):
        return "possible", "Seller says all sizes available — call to confirm 185/65 R14"
    if len(sizes) >= 4 and any(s[2] == RIM for s in sizes):
        return "possible", "Multi-size dealer with R14 stock — call to confirm 185/65 R14"
    if not sizes and TIRE_RE.search(text) and RIM_RE.search(text.translate(ARABIC_DIGITS)):
        return "possible", "R14 tires, exact width not stated — ask the seller"
    return None, ""


def nearest_region(a):
    best = None
    for c in a.get("cities") or []:
        rid = (c.get("region") or {}).get("id")
        km = REGION_KM.get(rid, 9999)
        if best is None or km < best[0]:
            best = (km, c)
    return best or (9999, {})


# ---------------------------------------------------------------- helpers
def fmt_price(a):
    p, unit = a.get("price"), a.get("priceUnit")
    if not p:
        return "Price not listed"
    if unit == "MILLION":
        return f"{p:g} million centimes (= {p * 10000:,.0f} DA)"
    if p < 500:  # sellers type placeholders like 1 or 123
        return f"{p:g} DA (placeholder — ask the seller)"
    return f"{p:,.0f} DA"


def fmt_phone(p):
    d = re.sub(r"\D", "", p)
    return " ".join([d[:4], d[4:6], d[6:8], d[8:]]) if len(d) == 10 else p


def embed_image(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": SITE + "/"})
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            ctype = r.headers.get("Content-Type", "image/jpeg")
        if len(raw) > 400_000:
            return url  # too big to embed, hotlink instead
        return f"data:{ctype};base64," + base64.b64encode(raw).decode()
    except Exception:
        return url


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


# ---------------------------------------------------------------- collect
def collect(log):
    pool, errors = {}, []

    def add(items, source):
        for a in items:
            pool.setdefault(a["id"], a).setdefault("_sources", set()).add(source)

    for rid, name, _ in REGIONS:
        try:
            items = search_all(region=rid, category=TIRE_CATEGORY)
            add(items, f"category:{name}")
            log(f"  {name}: {len(items)} tire/rim listings")
        except Exception as e:
            errors.append(f"category {name}: {e}")
        for kw in REGION_KEYWORDS:
            try:
                add(search_all(q=kw, region=rid, max_pages=3), f"kw:{kw}:{name}")
            except Exception as e:
                errors.append(f"keyword {kw} {name}: {e}")
    for q in NATIONAL_QUERIES:
        try:
            items = search_all(q=q, max_pages=2)
            add(items, f"national:{q}")
            log(f"  national '{q}': {len(items)}")
        except Exception as e:
            errors.append(f"national {q}: {e}")
    return pool, errors


def build_results(pool, seen, today, log):
    results = []
    for a in pool.values():
        kind, reason = classify(a)
        if not kind:
            continue
        km, city = nearest_region(a)
        if kind == "possible" and km > NEARBY_KM:
            continue  # vague leads are only worth it close to home
        url = f"{SITE}/{a['slug']}-d{a['id']}"
        places = [f"{c['name']} ({c['region']['name']})" for c in a.get("cities") or []]
        first_seen = seen.get(a["id"], today)
        seen[a["id"]] = first_seen
        results.append({
            "id": a["id"], "match": kind, "reason": reason, "title": (a.get("title") or "").strip(),
            "description": (a.get("description") or "").strip(), "price": fmt_price(a),
            "url": url, "km": km, "city": city.get("name", "?"),
            "wilaya": (city.get("region") or {}).get("name", "?"), "all_places": places,
            "street": (a.get("street_name") or "").strip(),
            "seller": (a.get("store") or {}).get("name") or (a.get("user") or {}).get("displayName")
                      or (a.get("user") or {}).get("username") or "?",
            "is_store": bool(a.get("store")),
            "store_url": f"{SITE}/store/{a['store']['slug']}" if a.get("store") else "",
            "delivery": bool(a.get("hasDelivery")),
            "refreshed": (a.get("refreshedAt") or a.get("createdAt") or "")[:10],
            "image": (a.get("defaultMedia") or {}).get("mediaUrl") or "",
            "images": [m["mediaUrl"] for m in (a.get("medias") or []) if m.get("mediaUrl")][:6],
            "first_seen": first_seen, "is_new": first_seen == today, "phones": [],
        })
    order = {"exact": 0, "possible": 1}
    results.sort(key=lambda r: (order[r["match"]], r["km"], -int(r["refreshed"].replace("-", "") or 0)))

    log(f"Fetching phone numbers for {len(results)} listings...")
    for r in results:
        try:
            phones = gql(PHONE_Q, {"id": r["id"]}, referer=r["url"])["phones"] or []
            r["phones"] = [{"number": fmt_phone(p["phone"]), "intl": p.get("phoneExt") or "",
                            "whatsapp": bool(p.get("hasWhatsapp")), "viber": bool(p.get("hasViber"))}
                           for p in phones]
        except Exception:
            pass
        # numbers typed into the description are often the shop's real line
        extra = re.findall(r"(?<!\d)(0[5-7](?:[ .\-]?\d{2}){4})(?!\d)", r["description"].translate(ARABIC_DIGITS))
        known = {re.sub(r"\D", "", p["number"]) for p in r["phones"]}
        for e in extra:
            if re.sub(r"\D", "", e) not in known:
                known.add(re.sub(r"\D", "", e))
                r["phones"].append({"number": fmt_phone(e), "intl": "", "whatsapp": False, "viber": False,
                                    "from_description": True})
    return results


# ---------------------------------------------------------------- report
CSS = """
:root{--bg:#f6f5f1;--card:#fff;--ink:#1c1b19;--mut:#6b6860;--line:#e2dfd6;--ok:#17603a;--okbg:#e2f3e8;
--warn:#8a5a00;--warnbg:#fbefcf;--new:#b3261e;--acc:#1f4fa3}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--card:#21201d;--ink:#eeece6;--mut:#a39f95;--line:#35332e;
--ok:#7fd6a3;--okbg:#17392a;--warn:#f0c768;--warnbg:#3d3115;--new:#ff8a80;--acc:#8fb4ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 60px}h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:32px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.sub{color:var(--mut);margin:0 0 16px}.stats{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:120px}
.stat b{display:block;font-size:22px}.stat span{color:var(--mut);font-size:13px}
.card{display:grid;grid-template-columns:220px 1fr;gap:16px;background:var(--card);border:1px solid var(--line);
border-radius:12px;padding:14px;margin-bottom:14px}
@media (max-width:640px){.card{grid-template-columns:1fr}}
.card img{width:100%;height:170px;object-fit:cover;border-radius:8px;background:var(--line)}
.noimg{height:170px;border-radius:8px;background:var(--line);display:grid;place-items:center;color:var(--mut)}
.thumbs{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}.thumbs a{font-size:12px}
h3{margin:0 0 4px;font-size:17px}.tag{display:inline-block;font-size:12px;font-weight:600;border-radius:99px;
padding:2px 9px;margin-right:6px}.exact{background:var(--okbg);color:var(--ok)}.possible{background:var(--warnbg);color:var(--warn)}
.new{color:var(--new);border:1px solid var(--new)}.row{margin:4px 0}.k{color:var(--mut)}
a{color:var(--acc)}.phone{font-weight:700;font-size:16px;text-decoration:none;margin-right:12px;white-space:nowrap}
.desc{color:var(--mut);font-size:13px;white-space:pre-wrap;max-height:110px;overflow:auto;margin-top:8px;
border-top:1px dashed var(--line);padding-top:8px;unicode-bidi:plaintext}
.note{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;color:var(--mut);font-size:14px}
.empty{color:var(--mut);font-style:italic}
"""


def maps_link(r):
    q = ", ".join(x for x in [r["street"], r["city"], r["wilaya"], "Algérie"] if x and x != "?")
    return "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(q)


def card_html(r, img_src):
    e = html.escape
    phones = "".join(
        f'<a class="phone" href="tel:{e(re.sub(chr(32), "", p["number"]))}">&#128222; {e(p["number"])}</a>'
        + (f'<a href="https://wa.me/{e(p["intl"].lstrip("+"))}">WhatsApp</a> ' if p.get("whatsapp") and p.get("intl") else "")
        for p in r["phones"]) or '<span class="k">No phone published — message the seller on Ouedkniss</span>'
    img = f'<a href="{e(r["url"])}"><img src="{img_src}" alt="{e(r["title"])}" loading="lazy"></a>' if img_src \
        else '<div class="noimg">no photo</div>'
    more = "".join(f'<a href="{e(u)}">photo {i + 2}</a>' for i, u in enumerate(r["images"][1:]))
    loc = e(f'{r["city"]}, {r["wilaya"]}') + (f' — {e(r["street"])}' if r["street"] else "")
    others = [p for p in r["all_places"] if not p.startswith(r["city"])]
    return f"""<article class="card">
<div>{img}<div class="thumbs">{more}</div></div>
<div>
<div><span class="tag {r['match']}">{'EXACT SIZE' if r['match'] == 'exact' else 'CALL TO CONFIRM'}</span>
{'<span class="tag new">NEW TODAY</span>' if r['is_new'] else ''}</div>
<h3><a href="{e(r['url'])}">{e(r['title']) or 'Untitled listing'}</a></h3>
<div class="row"><b>{e(r['price'])}</b>{' · delivery offered' if r['delivery'] else ''}</div>
<div class="row"><span class="k">Location:</span> {loc} · ~{r['km'] if r['km'] < 9999 else '?'} km from Tlemcen ·
<a href="{maps_link(r)}">open in Maps</a>{'<br><span class="k">Also listed for: ' + e(', '.join(others)) + '</span>' if others else ''}</div>
<div class="row"><span class="k">Seller:</span> {e(r['seller'])}{' (shop)' if r['is_store'] else ''}
{f' · <a href="{e(r["store_url"])}">shop page</a>' if r['store_url'] else ''}</div>
<div class="row">{phones}</div>
<div class="row k">{e(r['reason'])} · updated {e(r['refreshed'])} · first seen {e(r['first_seen'])}</div>
<div class="desc">{e(r['description'][:900])}</div>
</div></article>"""


def render_html(results, today, scanned, errors):
    budget = [MAX_IMAGES_EMBEDDED]

    def cards(rows):
        out = []
        for r in rows:
            src = ""
            if r["image"]:
                src = embed_image(r["image"]) if budget[0] > 0 else r["image"]
                budget[0] -= 1
            out.append(card_html(r, html.escape(src)))
        return "\n".join(out) or '<p class="empty">Nothing in this group today.</p>'

    exact_near = [r for r in results if r["match"] == "exact" and r["km"] <= NEARBY_KM]
    exact_far = [r for r in results if r["match"] == "exact" and r["km"] > NEARBY_KM]
    possible = [r for r in results if r["match"] == "possible"]
    new = sum(r["is_new"] for r in results)
    err = f'<p class="note">Some searches failed this run: {html.escape("; ".join(errors)[:600])}</p>' if errors else ""
    size = f"{WIDTH}/{ASPECT} R{RIM}"
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tires {size} — {today}</title>
<style>{CSS}</style></head><body><main>
<h1>Tires {size} near Tlemcen</h1>
<p class="sub">{VEHICLE} · report for {today} · source: Ouedkniss (all tire &amp; rim listings in
{', '.join(n for _, n, _ in REGIONS)} + national size searches)</p>
<div class="stats">
<div class="stat"><b>{len(exact_near)}</b><span>exact size, within {NEARBY_KM} km</span></div>
<div class="stat"><b>{len(exact_far)}</b><span>exact size, farther away</span></div>
<div class="stat"><b>{len(possible)}</b><span>nearby, call to confirm</span></div>
<div class="stat"><b>{new}</b><span>new since last run</span></div>
<div class="stat"><b>{scanned}</b><span>listings scanned</span></div>
</div>{err}
<h2>Exact size — Tlemcen and nearby</h2>{cards(exact_near)}
<h2>Nearby sellers worth a call (size not confirmed in the ad)</h2>{cards(possible)}
<h2>Exact size — elsewhere in Algeria</h2>{cards(exact_far)}
<p class="note">Location is the commune the seller chose on Ouedkniss (plus street when they gave one); the Maps
link opens that place, not a verified shop address. Confirm stock, price per tire and manufacture date (DOT code)
by phone before travelling.</p>
</main></body></html>"""


def render_md(results, today, scanned):
    lines = [f"# Tires {WIDTH}/{ASPECT} R{RIM} near Tlemcen — {today}", "",
             f"{len(results)} relevant listings out of {scanned} scanned. "
             f"{sum(r['is_new'] for r in results)} new since last run.", ""]
    for r in results:
        phones = ", ".join(p["number"] for p in r["phones"]) or "no phone published"
        lines += [f"- **[{r['match'].upper()}]{' NEW' if r['is_new'] else ''}** [{r['title'] or 'listing'}]({r['url']}) — "
                  f"{r['price']} — {r['city']}, {r['wilaya']} ({'~%d km' % r['km'] if r['km'] < 9999 else 'far from Tlemcen'}) — {r['seller']} — {phones}"]
    return "\n".join(lines) + "\n"


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    log = lambda m: print(m, flush=True)
    DATA.mkdir(exist_ok=True)
    REPORTS.mkdir(exist_ok=True)
    today = dt.date.today().isoformat()
    seen = load_json(DATA / "seen.json", {})

    log(f"Scanning Ouedkniss for {WIDTH}/{ASPECT} R{RIM}...")
    pool, errors = collect(log)
    if not pool:
        log("ERROR: no listings retrieved at all. " + "; ".join(errors))
        return 1
    results = build_results(pool, seen, today, log)

    report = REPORTS / f"report-{today}.html"
    report.write_text(render_html(results, today, len(pool), errors), encoding="utf-8")
    (REPORTS / "latest.html").write_text(report.read_text(encoding="utf-8"), encoding="utf-8")
    (REPORTS / "latest.md").write_text(render_md(results, today, len(pool)), encoding="utf-8")
    (REPORTS / "latest.json").write_text(json.dumps(
        {"date": today, "scanned": len(pool), "errors": errors, "results": results},
        ensure_ascii=False, indent=1), encoding="utf-8")
    (DATA / "seen.json").write_text(json.dumps(seen), encoding="utf-8")

    exact = [r for r in results if r["match"] == "exact"]
    log(f"Done: scanned {len(pool)}, exact {len(exact)}, possible {len(results) - len(exact)}, "
        f"new {sum(r['is_new'] for r in results)}, errors {len(errors)}")
    log(f"Report: {report}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
