// Consider It Sorted: a panel on instagram.com. It only reads saved posts; nothing on the account changes.
(() => {
  const R = globalThis.SS_RULES;
  const KEY = "saved-sorted-v1";
  const SORTED = [...R.albums].sort((x, y) => x.name.localeCompare(y.name));
  const PAGE = 60;
  const state = { items: [], moved: {}, cursor: null, finished: false, running: false, stop: false, note: "", album: "all", q: "", shown: PAGE };
  const store = globalThis.chrome?.storage?.local;

  const load = () => new Promise(res => store ? store.get(KEY, v => res(v[KEY] || {})) : res({}));
  const save = () => store?.set({ [KEY]: { items: state.items, moved: state.moved, cursor: state.cursor, finished: state.finished } });

  // First two sentences of a caption, without hashtags, mentions or invisible marks.
  const blurb = text => {
    const t = (text || "").replace(/[#@][^\s#@]+/g, " ").replace(/[\u2066-\u2069\u200e\u200f\u202a-\u202e]/g, "").replace(/(\s\.)+\s/g, " ").split(/\s+/).join(" ").replace(/^[\s.\-|]+|[\s.\-|]+$/g, "");
    const out = (t.match(/.+?(?:[.!?…]+(?=\s|$)|$)/g) || []).slice(0, 2).map(x => x.trim()).join(" ");
    return out.length > 150 ? out.slice(0, 150).replace(/\s\S*$/, "") + "…" : out;
  };
  const albumsOf = p => state.moved[p.code] || ssPropose(p);
  const thumbOf = m => {
    const src = m.image_versions2 ? m : (m.carousel_media && m.carousel_media[0]) || m;
    const c = [...(src.image_versions2?.candidates || [])].sort((a, b) => a.width - b.width);
    return (c.find(x => x.width >= 320) || c[c.length - 1])?.url || null;
  };
  const slim = m => ({
    pk: m.pk, code: m.code, user: m.user?.username, name: m.user?.full_name, product: m.product_type,
    caption: (m.caption?.text || "").slice(0, 500), location: m.location ? { name: m.location.name, city: m.location.city } : null, thumb: thumbOf(m),
  });

  async function read() {
    state.running = true; state.stop = false; state.note = ""; paint();
    const seen = new Set(state.items.map(p => p.pk));
    let top = state.cursor ? -1 : 0; // a fresh read puts newly saved posts first
    while (!state.stop) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 20000);
      let j;
      try {
        const url = "/api/v1/feed/saved/posts/" + (state.cursor ? "?max_id=" + encodeURIComponent(state.cursor) : "");
        const r = await fetch(url, { headers: { "X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest" }, credentials: "include", signal: ctl.signal });
        if (!r.ok) throw new Error("Instagram answered " + r.status);
        j = await r.json();
        if (j.status !== "ok") throw new Error(j.message || "Instagram refused the request");
      } catch (e) {
        state.note = `Stopped: ${e.message}. Your ${state.items.length} posts are kept. Try Continue later.`;
        break;
      } finally { clearTimeout(timer); }
      for (const it of j.items || []) {
        const m = it.media;
        if (m && !seen.has(m.pk)) { seen.add(m.pk); top < 0 ? state.items.push(slim(m)) : state.items.splice(top++, 0, slim(m)); }
      }
      if (!j.more_available || !j.next_max_id) { state.finished = true; break; }
      state.cursor = j.next_max_id;
      save(); paint();
      await new Promise(res => setTimeout(res, 6000 + Math.random() * 3000)); // stay slow on purpose
    }
    state.running = false; save(); paint();
  }

  // ---------- interface ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;z-index:2147483000;left:0;top:0;width:0;height:0";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { --bg:#fbf0e2; --surface:#fffaf3; --fg:#3f0f1f; --muted:#7c4a52; --line:#eed8c2; --accent:#ef4f16; --on:#fffaf3; --tint:#f9d9e6 }
    [hidden] { display:none !important }
    * { box-sizing:border-box; font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif }
    #open { position:fixed; left:16px; bottom:16px; padding:10px 16px; border:0; border-radius:999px; background:var(--accent); color:var(--on); font-size:14px; font-weight:600; cursor:pointer }
    #panel { position:fixed; inset:0; display:flex; flex-direction:column; background:var(--bg); color:var(--fg); font-size:14px }
    #top { position:relative; overflow:hidden; background:#dfe9c6 url(data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27240%27%20height%3D%27170%27%20viewBox%3D%270%200%20240%20170%27%3E%3Cg%20fill%3D%27none%27%20stroke%3D%27%23c3d29a%27%20stroke-width%3D%273.4%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cg%20transform%3D%27translate%284%202%29%20rotate%28-14%2050%2060%29%20scale%280.56%29%27%3E%3Cpath%20d%3D%27M50%2030C43%2030%2039%2037%2039%2045C39%2055%2023%2063%2023%2085C23%20104%2036%20113%2050%20113C64%20113%2077%20104%2077%2085C77%2063%2061%2055%2061%2045C61%2037%2057%2030%2050%2030Z%27%2F%3E%3Cpath%20d%3D%27M50%2030C50%2022%2053%2016%2058%2011%27%2F%3E%3Cpath%20d%3D%27M54%2021C61%2013%2072%2015%2077%2021C69%2027%2060%2027%2054%2021Z%27%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%27translate%2882%20-4%29%20rotate%2810%2050%2060%29%20scale%280.6%29%27%3E%3Cpath%20d%3D%27M50%2030C43%2030%2039%2037%2039%2045C39%2055%2023%2063%2023%2085C23%20104%2036%20113%2050%20113C64%20113%2077%20104%2077%2085C77%2063%2061%2055%2061%2045C61%2037%2057%2030%2050%2030Z%27%2F%3E%3Cpath%20d%3D%27M50%2030C50%2022%2053%2016%2058%2011%27%2F%3E%3Cpath%20d%3D%27M54%2021C61%2013%2072%2015%2077%2021C69%2027%2060%2027%2054%2021Z%27%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%27translate%28166%204%29%20rotate%2818%2050%2060%29%20scale%280.52%29%27%3E%3Cpath%20d%3D%27M50%2030C43%2030%2039%2037%2039%2045C39%2055%2023%2063%2023%2085C23%20104%2036%20113%2050%20113C64%20113%2077%20104%2077%2085C77%2063%2061%2055%2061%2045C61%2037%2057%2030%2050%2030Z%27%2F%3E%3Cpath%20d%3D%27M50%2030C50%2022%2053%2016%2058%2011%27%2F%3E%3Cpath%20d%3D%27M54%2021C61%2013%2072%2015%2077%2021C69%2027%2060%2027%2054%2021Z%27%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%27translate%2840%2084%29%20rotate%2812%2050%2060%29%20scale%280.58%29%27%3E%3Cpath%20d%3D%27M50%2030C43%2030%2039%2037%2039%2045C39%2055%2023%2063%2023%2085C23%20104%2036%20113%2050%20113C64%20113%2077%20104%2077%2085C77%2063%2061%2055%2061%2045C61%2037%2057%2030%2050%2030Z%27%2F%3E%3Cpath%20d%3D%27M50%2030C50%2022%2053%2016%2058%2011%27%2F%3E%3Cpath%20d%3D%27M54%2021C61%2013%2072%2015%2077%2021C69%2027%2060%2027%2054%2021Z%27%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%27translate%28122%2080%29%20rotate%28-10%2050%2060%29%20scale%280.56%29%27%3E%3Cpath%20d%3D%27M50%2030C43%2030%2039%2037%2039%2045C39%2055%2023%2063%2023%2085C23%20104%2036%20113%2050%20113C64%20113%2077%20104%2077%2085C77%2063%2061%2055%2061%2045C61%2037%2057%2030%2050%2030Z%27%2F%3E%3Cpath%20d%3D%27M50%2030C50%2022%2053%2016%2058%2011%27%2F%3E%3Cpath%20d%3D%27M54%2021C61%2013%2072%2015%2077%2021C69%2027%2060%2027%2054%2021Z%27%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%27translate%28188%2092%29%20rotate%28-18%2050%2060%29%20scale%280.46%29%27%3E%3Cpath%20d%3D%27M50%2030C43%2030%2039%2037%2039%2045C39%2055%2023%2063%2023%2085C23%20104%2036%20113%2050%20113C64%20113%2077%20104%2077%2085C77%2063%2061%2055%2061%2045C61%2037%2057%2030%2050%2030Z%27%2F%3E%3Cpath%20d%3D%27M50%2030C50%2022%2053%2016%2058%2011%27%2F%3E%3Cpath%20d%3D%27M54%2021C61%2013%2072%2015%2077%2021C69%2027%2060%2027%2054%2021Z%27%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E) 0 0/240px 170px; color:#3f0f1f; display:flex; flex-wrap:wrap; gap:10px; align-items:center; padding:14px 18px; border-bottom:1px solid var(--line) }
    h1 { margin:0 8px 0 0; font-size:20px; font-weight:800 }
    #tag { font-family:Georgia,serif; font-style:italic; font-size:13px }
    #status { color:#3f0f1f; flex:1 1 200px; min-width:0 }
    button { font-size:14px; cursor:pointer }
    .btn { padding:8px 16px; border-radius:999px; border:2px solid #3f0f1f; background:none; color:#3f0f1f; font-weight:600 }
    .btn.main { background:#c2185b; border-color:#c2185b; color:#fffaf3 }
    #more { border-color:var(--accent); color:var(--accent) }
    #tip { position:absolute; left:18px; z-index:5; max-width:340px; padding:12px 16px; border:2px solid #f79cc4; border-radius:18px 18px 18px 4px; background:#fffaf3; color:#3f0f1f; font-size:14px; line-height:1.4; box-shadow:0 8px 24px rgba(63,15,31,.18); animation:pop .18s ease-out; pointer-events:none }
    @keyframes pop { from { opacity:0; transform:translateY(-6px) scale(.96) } }
    @media (prefers-reduced-motion: reduce) { #tip { animation:none } }
    #body { flex:1; min-height:0; display:grid; grid-template-columns:230px minmax(0,1fr) }
    nav { overflow-y:auto; padding:14px 10px; border-right:1px solid var(--line) }
    nav h2 { margin:12px 8px 4px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted) }
    .album { display:flex; gap:8px; width:fit-content; max-width:100%; padding:7px 14px; white-space:nowrap; border:0; border-radius:999px; background:none; color:inherit; text-align:left }
    .album:hover { background:var(--tint) }
    .album.on { background:#e0327f; color:var(--on) }
    main { overflow-y:auto; padding:14px 18px }
    #q { width:100%; padding:10px 12px; margin-bottom:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--fg); font-size:14px }
    #grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px }
    .post { min-width:0 }
    .post a { color:inherit; text-decoration:none }
    .frame { position:relative; aspect-ratio:4/5; background:var(--tint); border-radius:14px; overflow:hidden }
    .frame img { width:100%; height:100%; object-fit:cover; display:block }
    .kind { position:absolute; left:6px; top:6px; padding:1px 8px; border-radius:999px; font-size:11px; font-weight:600; color:#3f0f1f }
    .album.on { outline:3px solid #3f0f1f; outline-offset:-3px }
    .album { font-weight:700 }
    .who { margin-top:4px; font-weight:600; font-size:12px; overflow-wrap:anywhere }
    .cap { color:var(--muted); font-size:12px; line-height:1.3; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden }
    select { width:100%; margin-top:6px; padding:5px 6px; border:0; border-radius:999px; font-weight:600; background:var(--surface); color:var(--fg); font-size:12px }
    #more { display:block; margin:16px auto }
    .empty { padding:40px 16px; text-align:center; color:var(--muted) }
    @media (max-width:760px) { #body { grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr) } nav { display:flex; overflow-x:auto; border-right:0; border-bottom:1px solid var(--line) } nav h2 { display:none } .album { width:auto; flex:none; gap:8px } }
  </style>
  <button id="open" type="button">Sort my saves</button>
  <div id="panel" hidden>
    <div id="top">
      <div><h1>Consider It <span style="color:#c2185b">Sorted</span></h1><div id="tag">Save what you love. Find it when it matters.</div></div>
      <span id="status" aria-live="polite"></span>
      <button id="go" class="btn main" type="button"></button>
      <button id="export" class="btn" type="button">Export</button>
      <button id="close" class="btn" type="button">Close</button>
    </div>
    <div id="tip" hidden>🍐 A smart organizer that makes sense of your Instagram saves and recommends where each piece of content belongs.</div>
    <div id="body">
      <nav id="nav" aria-label="Collections"></nav>
      <main>
        <input id="q" type="search" placeholder="Search captions, creators, places" aria-label="Search saved posts">
        <div id="grid"></div>
        <button id="more" class="btn" type="button" hidden>Show more</button>
      </main>
    </div>
  </div>`;
  const $ = id => root.getElementById(id);

  function paintNav() {
    const nav = $("nav"); nav.textContent = "";
    const counts = {};
    for (const p of state.items) for (const a of albumsOf(p)) counts[a] = (counts[a] || 0) + 1;
    const add = (id, name, n, color) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "album" + (state.album === id ? " on" : "");
      if (color) { b.style.background = color; b.style.color = "#3f0f1f"; b.style.marginBottom = "4px"; }
      const s = document.createElement("span"); s.textContent = name;
      const i = document.createElement("span"); i.textContent = n;
      b.append(s, i);
      b.onclick = () => { state.album = id; state.shown = PAGE; paint(); };
      nav.append(b);
    };
    add("all", "All saves", state.items.length);
    SORTED.filter(a => counts[a.id]).forEach(a => add(a.id, a.icon + " " + a.name, counts[a.id], a.color));
  }

  function paintGrid() {
    const q = state.q.trim().toLowerCase();
    const list = state.items.filter(p => (state.album === "all" || albumsOf(p).includes(state.album)) &&
      (!q || `${p.caption} ${p.user} ${p.location?.name || ""}`.toLowerCase().includes(q)));
    const grid = $("grid"); grid.textContent = "";
    if (!list.length) {
      const e = document.createElement("p"); e.className = "empty";
      e.textContent = state.items.length ? "Nothing matches that. Try another word or collection." : "Press Start to read your saved posts. Nothing on your account changes.";
      grid.append(e);
    }
    for (const p of list.slice(0, state.shown)) {
      const box = document.createElement("div"); box.className = "post";
      const a = document.createElement("a"); a.target = "_blank"; a.rel = "noopener";
      a.href = `https://www.instagram.com/${p.product === "clips" ? "reel" : "p"}/${p.code}/`;
      const f = document.createElement("div"); f.className = "frame";
      if (p.thumb) { const img = document.createElement("img"); img.src = p.thumb; img.alt = ""; img.loading = "lazy"; f.append(img); }
      const w = document.createElement("div"); w.className = "who"; w.textContent = "@" + p.user;
      const c = document.createElement("div"); c.className = "cap"; c.dir = "auto"; c.textContent = p.summary || blurb(p.caption) || `A ${p.product === "clips" ? "reel" : "post"} saved in ${R.albums.find(al => al.id === albumsOf(p)[0])?.name}.`;
      a.append(f, w, c);
      const sel = document.createElement("select"); sel.setAttribute("aria-label", "Collection for this post");
      const cur = albumsOf(p)[0];
      const color = R.albums.find(al => al.id === cur)?.color;
      sel.style.background = color; sel.style.color = "#3f0f1f";
      for (const al of SORTED) { const o = document.createElement("option"); o.value = al.id; o.textContent = al.icon + " " + al.name; o.selected = al.id === cur; sel.append(o); }
      sel.onchange = () => { state.moved[p.code] = [sel.value]; save(); paint(); };
      const badge = document.createElement("span"); badge.className = "kind"; badge.textContent = p.product === "clips" ? "Reel" : "Post"; badge.style.background = color; f.append(badge);
      box.append(a, sel); grid.append(box);
    }
    $("more").hidden = list.length <= state.shown;
  }

  function paint() {
    $("status").textContent = state.note || (state.running ? `Reading slowly… ${state.items.length} posts so far` :
      state.finished ? `All ${state.items.length} saved posts read` : state.items.length ? `${state.items.length} posts read so far` : "Reads your saves. Changes nothing.");
    $("go").textContent = state.running ? "Pause" : state.items.length && !state.finished ? "Continue" : state.finished ? "Read again" : "Start";
    paintNav(); paintGrid();
  }

  $("open").onclick = () => { $("panel").hidden = false; $("open").hidden = true; paint(); };
  $("close").onclick = () => { $("panel").hidden = true; $("open").hidden = false; };
  $("go").onclick = () => {
    if (state.running) { state.stop = true; return; }
    if (state.finished) { state.finished = false; state.cursor = null; }
    read();
  };
  $("top").onmousemove = e => {
    $("tip").style.top = $("top").getBoundingClientRect().bottom + 8 + "px";
    $("tip").hidden = !!e.target.closest("button");
  };
  $("top").onmouseleave = () => { $("tip").hidden = true; };
  $("q").oninput = e => { state.q = e.target.value; state.shown = PAGE; paintGrid(); };
  $("more").onclick = () => { state.shown += PAGE; paintGrid(); };
  $("export").onclick = () => {
    const rows = state.items.map(p => ({ ...p, albums: albumsOf(p) }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rows)], { type: "application/json" }));
    a.download = "saved-sorted.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  load().then(d => { Object.assign(state, { items: d.items || [], moved: d.moved || {}, cursor: d.cursor || null, finished: !!d.finished }); document.documentElement.append(host); });
})();
