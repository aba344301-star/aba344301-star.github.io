/*=================================================
   CampusFind – script.js
   Block numbers/names: LPU site plan legend.
   The map is drawn with SVG (no picture). Block positions (POS) and
   road points (NODES) were measured from the LPU site plan on a
   345 x 641 grid and are APPROXIMATE – adjust them if needed.
   ===================================================== */

/* ---------- 1. DATA ---------- */
const MAP_W = 345, MAP_H = 641;
const CATEGORIES = {
  academic: "Academic Block", hostel: "Hostel", food: "Food & Shopping",
  admin: "Administration", medical: "Medical", hall: "Auditorium", utility: "Utility & Residence"
};
const BLOCKS = [];
// Adds blocks numbered from..to. "#" in the name is replaced by 1, 2, 3...
function add(from, to, name, cat, startIdx = 1) {
  for (let n = from; n <= to; n++) BLOCKS.push({ num: n, name: name.replace("#", startIdx + n - from), cat });
}
add(1,1,"LIM","academic"); add(2,2,"Campus Café","food"); add(3,3,"Auditorium","hall");
add(4,4,"LIT Engineering","academic"); add(5,5,"LIT Pharmacy","academic"); add(6,6,"LIT Architecture","academic");
add(7,7,"LIT Pharmacy","academic"); add(8,8,"Shri Baldev Raj Mittal Hospital","medical");
add(9,12,"Girls Hostel #","hostel"); add(13,13,"LIT Polytechnic","academic"); add(14,14,"Business Block","academic");
add(15,15,"Lovely Mall","food"); add(16,16,"Hotel Management","academic"); add(17,17,"Mall - II","food");
add(18,18,"Education","academic"); add(19,19,"Auditorium","hall"); add(20,20,"LSB","academic");
add(21,22,"Girls Hostel #","hostel",5); add(23,24,"Auditorium","hall"); add(25,29,"Engineering Block","academic");
add(30,30,"Chancellor Office","admin"); add(31,32,"Administrative Block","admin"); add(33,38,"Engineering Block","academic");
add(39,39,"STP","utility"); add(40,40,"Store","utility"); add(41,42,"Staff Residence","utility");
add(43,43,"Boys Hostel #","hostel",1); add(45,47,"Boys Hostel #","hostel",2); add(51,52,"Boys Hostel #","hostel",5);
add(53,55,"Academic Block #","academic");

// Approximate position [x, y] of each block on the map image
const POS = {
  1:[131,602], 2:[147,583], 3:[150,564], 4:[172,535], 5:[153,534], 6:[138,522], 7:[153,513], 8:[149,502],
  9:[195,487], 10:[216,467], 11:[198,455], 12:[183,458], 13:[177,472], 14:[145,417], 15:[173,445],
  16:[197,425], 17:[176,404], 18:[145,455], 19:[217,388], 20:[277,342], 21:[267,297], 22:[254,306],
  23:[214,324], 24:[232,324], 25:[204,305], 26:[189,308], 27:[176,317], 28:[164,325], 29:[152,334],
  30:[140,341], 31:[129,346], 32:[124,329], 33:[117,318], 34:[109,304], 35:[110,298], 36:[129,296],
  37:[146,296], 38:[167,298], 39:[170,269], 40:[165,237], 41:[197,266], 42:[237,201], 43:[215,193],
  45:[189,173], 46:[206,156], 47:[187,128], 51:[87,199], 52:[66,166], 53:[53,136], 54:[33,128], 55:[23,110]
};
BLOCKS.forEach(b => { b.cx = POS[b.num][0]; b.cy = POS[b.num][1]; });

// Road nodes (points on the campus roads) and the roads joining them
const NODES = {
  G:[190,604], A:[200,578], B:[182,550], C:[167,520], D:[160,490], E:[160,455], F:[154,420], H:[151,385],
  I:[146,355], J:[141,340], J2:[124,360], K:[100,310], L:[88,282], Q:[166,312], R:[195,290], S:[235,298],
  T:[252,325], M:[190,378], N:[235,358], O:[275,340], P:[292,332], U:[200,262], V:[205,225], W:[205,190],
  X:[165,160], P1:[145,130], P2:[125,95], P3:[104,55], AF:[75,150], AG:[98,210]
};
const ROADS = "G-A A-B B-C C-D D-E E-F F-H H-I I-J I-J2 J2-K K-L J-Q Q-R R-S S-T T-O H-M M-N N-O O-P R-U U-V V-W W-X X-P1 P1-P2 P2-P3 P1-AF AF-AG"
  .split(" ").map(r => r.split("-"));

/* ---------- 2. HELPERS ---------- */
const $ = id => document.getElementById(id);
const state = { all: [], filter: "all", title: "", block: null, start: null, from: "home" };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const findBlock = n => BLOCKS.find(b => b.num === Number(n));
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  $("view-" + name).hidden = false;
  $("navLinks").classList.remove("open");
  window.scrollTo(0, 0);
  document.querySelectorAll("#view-" + name + " .gmap").forEach(m => m._ctl && m._ctl.fit());   // maps need to be visible to fit
}
function nearby(b) {
  return BLOCKS.filter(o => o !== b).sort((p, q) => dist(POS[p.num], POS[b.num]) - dist(POS[q.num], POS[b.num])).slice(0, 2);
}
function area(b) {
  return b.cy < 230 ? "Northern part of campus" : b.cy < 430 ? "Central part of campus" : "Southern part (near the main gate)";
}
function nearestNode(p) {       // the road node closest to a point
  return Object.keys(NODES).sort((a, b) => dist(NODES[a], p) - dist(NODES[b], p))[0];
}

/* ---------- 3. ROUTE FINDING (shortest path along roads) ---------- */
function findPath(from, to) {   // Dijkstra's algorithm on the road graph
  const d = {}, prev = {}, todo = new Set(Object.keys(NODES));
  todo.forEach(n => d[n] = Infinity); d[from] = 0;
  while (todo.size) {
    let u = [...todo].sort((a, b) => d[a] - d[b])[0]; todo.delete(u);
    if (u === to) break;
    ROADS.forEach(([a, b]) => {
      const v = a === u ? b : b === u ? a : null;
      if (v && todo.has(v) && d[u] + dist(NODES[u], NODES[v]) < d[v]) { d[v] = d[u] + dist(NODES[u], NODES[v]); prev[v] = u; }
    });
  }
  const path = [to]; while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

/* ---------- 4. DRAW THE MAP (vector, Google-Maps style) ---------- */
// Decoration: lawns, trees, footpaths and area labels (purely visual)
const LAWNS = [
  { cx: 235, cy: 352, rx: 46, ry: 26, rot: -25 },   // central lawn
  { cx: 282, cy: 500, rx: 30, ry: 68, rot: 0 },
  { cx: 58, cy: 425, rx: 26, ry: 52, rot: 0 },
  { cx: 298, cy: 235, rx: 17, ry: 28, rot: 0 },
  { cx: 240, cy: 440, rx: 22, ry: 16, rot: 0 }
];
const LABELS = [["HOSTEL AREA", 252, 128, -30], ["ENGINEERING BLOCKS", 52, 338, -32], ["CENTRAL LAWN", 235, 366, -25],
  ["SPORTS GROUND", 35, 596, 0], ["ACADEMIC BLOCKS", 52, 90, -45], ["MAIN GATE", 204, 620, 0]];
const rnd = i => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };   // repeatable "random"
const ART = (() => {
  let trees = "", paths = "", n = 1;
  const tree = (x, y) => `<circle class="tree" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.3 + rnd(n++) * 1.5).toFixed(1)}"/>`;
  const nearBlock = (x, y) => BLOCKS.some(b => Math.hypot(b.cx - x, b.cy - y) < 11);
  ROADS.forEach(([a, b]) => {                      // trees along both sides of every road
    const [x1, y1] = NODES[a], [x2, y2] = NODES[b], len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    for (let d = 8; d < len - 4; d += 14) [-1, 1].forEach(side => {
      const off = (9 + rnd(n++) * 3) * side, x = x1 + (x2 - x1) * d / len + nx * off, y = y1 + (y2 - y1) * d / len + ny * off;
      if (!nearBlock(x, y) && rnd(n++) > 0.2) trees += tree(x, y);
    });
  });
  LAWNS.slice(1).forEach(l => { for (let i = 0; i < 9; i++) {   // trees scattered on the lawns
    const x = l.cx + (rnd(n++) * 2 - 1) * l.rx * 0.8, y = l.cy + (rnd(n++) * 2 - 1) * l.ry * 0.8;
    if (((x - l.cx) / l.rx) ** 2 + ((y - l.cy) / l.ry) ** 2 < 0.7) trees += tree(x, y);
  } });
  BLOCKS.forEach(b => { const p = NODES[nearestNode(POS[b.num])]; paths += `M${b.cx} ${b.cy} L${p[0]} ${p[1]} `; });
  return { trees, paths };
})();
const shortName = n => n.replace("Engineering Block", "Engineering").replace("Administrative Block", "Admin Block")
  .replace("Shri Baldev Raj Mittal Hospital", "Hospital").replace("Hotel Management", "Hotel Mgmt");

// opts: dest (block), start (block or null), route (points), clickable, mini
function drawMap(el, o = {}) {
  el.classList.add("gmap"); if (o.mini) el.classList.add("mini");
  const roadPath = ROADS.map(([a, b]) => `M${NODES[a]} L${NODES[b]}`).join(" ")
    + " M190 604 V626 M322 -50 V622 Q322 628 310 628 H100";       // gate road + outer road

  let s = `<svg class="map" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Campus map">
    <rect class="ground" x="-600" y="-600" width="1600" height="2000"/>
    ${LAWNS.map(l => `<ellipse class="park" cx="${l.cx}" cy="${l.cy}" rx="${l.rx}" ry="${l.ry}" transform="rotate(${l.rot} ${l.cx} ${l.cy})"/>`).join("")}
    <ellipse class="park-in" cx="235" cy="352" rx="34" ry="17" transform="rotate(-25 235 352)"/>
    <rect class="park" x="4" y="520" width="62" height="64" rx="26"/><ellipse class="track" cx="35" cy="552" rx="17" ry="23"/>
    <g transform="translate(262 188) rotate(-25)"><rect class="court" x="-16" y="-10" width="32" height="20" rx="2"/><path class="court-l" d="M0 -10 V10 M-16 0 H16"/></g>
    <path class="foot" d="${ART.paths}"/>
    <path class="road-case" d="${roadPath}"/><path class="road" d="${roadPath}"/><path class="road-mid" d="${roadPath}"/>
    <g>${ART.trees}</g>
    ${LABELS.map(([t, x, y, r]) => `<text class="zlabel" x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})">${t}</text>`).join("")}`;

  // buildings: grey boxes tilted to follow the campus roads
  BLOCKS.forEach(b => {
    const ang = b.cy > 430 ? -12 : -30, hl = o.hl && o.hl.includes(b.num), dest = o.dest && o.dest.num === b.num, st = o.start && o.start.num === b.num;
    s += `<g class="bd c-${b.cat} ${o.clickable ? "click" : ""} ${dest ? "dest" : ""} ${st ? "from" : ""} ${hl ? "hl" : ""}" data-num="${b.num}"
      transform="translate(${b.cx} ${b.cy}) rotate(${ang})"><title>Block ${b.num} – ${b.name}</title>
      <rect class="sh" x="-6.5" y="-4.5" width="16" height="12" rx="2"/><rect x="-8" y="-6" width="16" height="12" rx="2"/>
      <text y="2" transform="rotate(${-ang})">${b.num}</text><text class="nm" y="13" transform="rotate(${-ang})">${shortName(b.name)}</text></g>`;
  });

  // route: white outline, blue line, then white direction arrows
  if (o.route) {
    const pts = o.route.map(p => p.join(",")).join(" ");
    s += `<polyline class="route-case" points="${pts}"/><polyline class="route-line" points="${pts}"/>`;
    for (let i = 1; i < o.route.length; i++) {
      const [x1, y1] = o.route[i - 1], [x2, y2] = o.route[i], len = Math.hypot(x2 - x1, y2 - y1);
      const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      for (let d = 9; d < len - 5; d += 14) {
        s += `<polygon class="arrow" points="-3,-3 3.2,0 -3,3" transform="translate(${x1 + (x2 - x1) * d / len} ${y1 + (y2 - y1) * d / len}) rotate(${ang})"/>`;
      }
    }
  }
  // start dot (blue, with glow) and destination pin (red)
  if (o.startPt) s += `<circle class="glow" cx="${o.startPt[0]}" cy="${o.startPt[1]}" r="10"/>
    <circle class="start-pt" cx="${o.startPt[0]}" cy="${o.startPt[1]}" r="5"/>
    <text class="plabel" x="${o.startPt[0] + 9}" y="${o.startPt[1] + 3}" text-anchor="start">${o.startName}</text>`;
  if (o.dest) s += `<g transform="translate(${o.dest.cx} ${o.dest.cy})"><path class="pin" d="M0 0 C-3 -5 -7 -8 -7 -14 a7 7 0 0 1 14 0 c0 6 -4 9 -7 14z"/>
    <circle cx="0" cy="-14" r="2.8" fill="#fff"/><text class="plabel big" y="-26">Block ${o.dest.num} · ${o.dest.name}</text></g>`;
  el.innerHTML = s + `</svg><div class="compass"><span>N</span><i></i></div><div class="zoom-ctl"><button data-z="in" aria-label="Zoom in">+</button>
    <button data-z="out" aria-label="Zoom out">−</button><button data-z="fit" aria-label="Recenter">⌖</button></div>`;

  // area the map should show: the route, or the destination, or the whole campus
  let box = [0, 0, MAP_W, MAP_H], pad = 10;
  if (o.route) { const xs = o.route.map(p => p[0]), ys = o.route.map(p => p[1]);
    box = [Math.min(...xs), Math.min(...ys) - 30, Math.max(...xs), Math.max(...ys)]; pad = 30; }
  else if (o.hl && o.hl.length) { const p = o.hl.map(n => POS[n]), xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    box = [Math.min(...xs) - 25, Math.min(...ys) - 25, Math.max(...xs) + 25, Math.max(...ys) + 25]; }
  else if (o.dest) { const xs = [o.dest.cx - 45, o.dest.cx + 45], ys = [o.dest.cy - 45, o.dest.cy + 45];
    if (o.startPt) { xs.push(o.startPt[0]); ys.push(o.startPt[1]); }
    box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; pad = 25; }
  addPanZoom(el, box, pad);
}

// Zoom and pan: change the SVG viewBox (mouse wheel, drag, pinch, + / - buttons)
function addPanZoom(el, box, pad) {
  const svg = el.querySelector("svg"), vb = { x: 0, y: 0, w: MAP_W, h: MAP_H }, ptrs = new Map();
  let last = 0;
  const apply = () => { svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); svg.classList.toggle("zoomed", vb.w < 150); };   // names appear when zoomed in
  const aspect = () => { const r = el.getBoundingClientRect(); return r.width && r.height ? r.width / r.height : 0.8; };
  const zoom = (f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => {
    const w = Math.min(900, Math.max(40, vb.w * f)), k = w / vb.w;
    vb.x = cx - (cx - vb.x) * k; vb.y = cy - (cy - vb.y) * k; vb.w = w; vb.h *= k; apply();
  };
  const fit = () => {
    const bw = box[2] - box[0] + 2 * pad, bh = box[3] - box[1] + 2 * pad, a = aspect();
    vb.w = Math.max(bw, bh * a); vb.h = vb.w / a;
    vb.x = (box[0] + box[2]) / 2 - vb.w / 2; vb.y = (box[1] + box[3]) / 2 - vb.h / 2; apply();
  };
  const toMap = (e) => { const r = svg.getBoundingClientRect(); return [vb.x + (e.clientX - r.left) * vb.w / r.width, vb.y + (e.clientY - r.top) * vb.h / r.height]; };
  svg.addEventListener("wheel", e => { e.preventDefault(); const [x, y] = toMap(e); zoom(e.deltaY < 0 ? 0.85 : 1.18, x, y); }, { passive: false });
  svg.addEventListener("pointerdown", e => { ptrs.set(e.pointerId, e); el._moved = false; });
  svg.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    const r = svg.getBoundingClientRect(), p = ptrs.get(e.pointerId);
    if (ptrs.size === 1) {
      const dx = e.clientX - p.clientX, dy = e.clientY - p.clientY;
      if (el._moved || Math.hypot(dx, dy) > 3) { el._moved = true; vb.x -= dx * vb.w / r.width; vb.y -= dy * vb.h / r.height; apply(); ptrs.set(e.pointerId, e); }
    } else if (ptrs.size === 2) {       // pinch to zoom on phones / tablets
      const o = [...ptrs.values()], other = o.find(q => q.pointerId !== e.pointerId);
      const before = Math.hypot(p.clientX - other.clientX, p.clientY - other.clientY);
      const after = Math.hypot(e.clientX - other.clientX, e.clientY - other.clientY);
      el._moved = true; ptrs.set(e.pointerId, e); if (before && Date.now() - last > 16) { last = Date.now(); zoom(before / after); }
    }
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => svg.addEventListener(ev, e => ptrs.delete(e.pointerId)));
  el.querySelector(".zoom-ctl").addEventListener("click", e => {
    const z = e.target.dataset.z; if (z === "in") zoom(0.7); else if (z === "out") zoom(1.4); else if (z === "fit") fit();
  });
  el._ctl = { fit }; fit();
}

/* ---------- 5. SEARCH, LIVE SUGGESTIONS & RESULTS ---------- */
const CAT_ICON = { academic: "🎓", hostel: "🏠", food: "🍴", admin: "🏛️", medical: "🏥", hall: "🎭", utility: "⚙️" };

// Does block b match what the user typed? ("34", "block 34", "hostel", "engineering"...)
function matches(b, query) {
  const q = query.trim().toLowerCase().replace(/^block\s*/, "");
  if (!q) return false;
  return /^\d+$/.test(q) ? String(b.num).startsWith(String(Number(q)))
    : b.name.toLowerCase().includes(q) || CATEGORIES[b.cat].toLowerCase().includes(q);
}
function searchBlocks(query) {
  const q = query.trim().toLowerCase().replace(/^block\s*/, "");
  return BLOCKS.filter(b => matches(b, query)).sort((a, b) => (String(b.num) === q) - (String(a.num) === q) || a.num - b.num);
}
const asItem = b => ({ key: String(b.num), icon: CAT_ICON[b.cat], title: `Block ${b.num} · ${b.name}`, sub: CATEGORIES[b.cat] });
const GATE = { key: "gate", icon: "🚪", title: "Main Gate", sub: "Campus entrance" };
const POPULAR = [34, 9, 43, 31, 3, 2].map(n => asItem(findBlock(n)));

// Suggestions for the search box and for the location pickers
function findBlocks(q, limit = 7) { return q.trim() ? searchBlocks(q).slice(0, limit).map(asItem) : POPULAR; }
function findStarts(q, limit = 7) {
  const g = !q.trim() || "main gate entrance".includes(q.trim().toLowerCase()) ? [GATE] : [];
  return [...g, ...(q.trim() ? searchBlocks(q).map(asItem) : BLOCKS.map(asItem))].slice(0, limit);
}

// Dropdown suggestions under an input (mouse, touch and keyboard)
function setupSuggest(input, box, find, onPick) {
  let shown = [], active = -1;
  const render = () => {
    shown = find(input.value);
    box.innerHTML = shown.map((it, i) => `<button type="button" class="sg ${i === active ? "on" : ""}" data-i="${i}">
      <span class="sg-ic">${it.icon}</span><span><b>${it.title}</b><small>${it.sub}</small></span></button>`).join("");
    box.hidden = !shown.length;
  };
  const pick = it => { input.value = it.title; box.hidden = true; onPick(it); };
  input.addEventListener("input", () => { active = -1; render(); });
  input.addEventListener("focus", render);
  input.addEventListener("keydown", e => {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % shown.length; render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + shown.length) % shown.length; render(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === "Escape") box.hidden = true;
  });
  box.addEventListener("mousedown", e => { const b = e.target.closest(".sg"); if (b) { e.preventDefault(); pick(shown[b.dataset.i]); } });
  document.addEventListener("click", e => { if (!input.parentElement.contains(e.target)) box.hidden = true; });
}

function search(query) {
  if (!query.trim()) { showResults([], "Type a block number or name"); return; }
  showResults(searchBlocks(query), 'Results for "' + query.trim() + '"');
}
function showResults(list, title) {
  state.all = list; state.title = title; state.filter = "all";
  renderResults(); showView("results");
}
function renderResults() {
  const list = state.all.filter(b => state.filter === "all" || b.cat === state.filter);
  const cats = [...new Set(state.all.map(b => b.cat))];
  $("resultsTitle").textContent = state.title;
  $("resultsCount").textContent = state.all.length ? `${list.length} location${list.length > 1 ? "s" : ""} found` : "";
  $("filterChips").innerHTML = cats.length > 1 ? ["all", ...cats].map(c =>
    `<button class="chip ${state.filter === c ? "on" : ""}" data-filter="${c}">${c === "all" ? "All" : CATEGORIES[c]}</button>`).join("") : "";
  $("resultsGrid").classList.toggle("one", !list.length);
  $("resultsMap").hidden = !list.length;
  $("resultsList").innerHTML = list.length ? list.map(b => `<div class="rcard">
      <span class="r-ic cat-${b.cat}">${CAT_ICON[b.cat]}</span>
      <div class="r-body"><h3>Block ${b.num}</h3><p>${b.name}</p><span class="tag">${CATEGORIES[b.cat]}</span></div>
      <button class="btn primary sm" data-details="${b.num}">View Details</button></div>`).join("")
    : `<div class="card empty"><h3>😕 No block found</h3><p>Check the number (1 to 55) or try a name.</p>
       <div class="chips" style="justify-content:center"><button class="chip" data-q="34">34</button>
       <button class="chip" data-q="hostel">Hostel</button><button class="chip" data-q="engineering">Engineering</button></div></div>`;
  if (list.length) drawMap($("resultsMap"), { hl: list.map(b => b.num), clickable: true });
}

// Block photo: put a file named block-34.jpg (block number) in images/blocks/. If the file is missing, nothing is shown.
function photoTag(b) {
  return `<img class="photo" src="images/blocks/block-${b.num}.jpg" alt="Photo of Block ${b.num}" onerror="this.parentNode.classList.add('nophoto');this.remove()">`;
}

/* ---------- 6. BLOCK DETAILS & STARTING POINT ---------- */
function showDetails(num, from) {
  const b = state.block = findBlock(num);
  if (from) state.from = from;
  $("detailInfo").innerHTML = `${photoTag(b)}<span class="tag">${CAT_ICON[b.cat]} ${CATEGORIES[b.cat]}</span><h2>Block ${b.num}</h2><h3>${b.name}</h3>
    <p>📍 <b>Area:</b> ${area(b)}</p>
    <p>🏢 <b>Nearby:</b> ${nearby(b).map(n => "Block " + n.num).join(", ")}</p>
    <button class="btn primary wide" id="getDirBtn">Get Directions</button>`;
  drawMap($("detailMap"), { dest: b });
  $("getDirBtn").onclick = openStart;
  showView("details");
}
function openStart() {
  const b = state.block;
  $("startDest").innerHTML = `<span class="dot red"></span><div><small>Destination</small><b>Block ${b.num} · ${b.name}</b></div>`;
  $("startFilter").value = "";
  renderStartList(); drawStartMap();
  showView("start");
}
function renderStartList() {
  const list = findStarts($("startFilter").value, 60);
  $("startList").innerHTML = list.length ? list.map(it => `<button type="button" class="sopt ${it.key === state.start ? "on" : ""}" data-start="${it.key}">
      <span class="sg-ic">${it.icon}</span><span><b>${it.title}</b><small>${it.sub}</small></span>
      ${it.key === state.start ? '<span class="chk">✓</span>' : ""}</button>`).join("") : '<p class="note">No matching location.</p>';
  $("showRouteBtn").disabled = !state.start;
}
function drawStartMap() {   // preview: destination pin + your chosen starting point
  const sb = state.start && state.start !== "gate" ? findBlock(state.start) : null;
  drawMap($("startMap"), { dest: state.block, start: sb, startPt: state.start ? (sb ? POS[sb.num] : NODES.G) : null, startName: sb ? "Block " + sb.num : "Main Gate" });
}

/* ---------- 7. ROUTE ---------- */
function showRoute() {
  const b = state.block, v = state.start;
  const sb = v === "gate" ? null : findBlock(v);
  const sName = sb ? `Block ${sb.num}` : "Main Gate";
  const sPt = sb ? POS[sb.num] : NODES.G;
  if (sb && sb.num === b.num) { alert("You are already at this block! Pick a different starting point."); return; }

  // route = start point -> road nodes -> destination
  const ids = findPath(nearestNode(sPt), nearestNode(POS[b.num]));
  const pts = [sPt, ...ids.map(i => NODES[i]), POS[b.num]];

  // Steps: start, every left/right turn (named by the closest block), arrival
  const near = p => "Block " + BLOCKS.filter(o => o.num !== b.num).sort((x, y) => dist(POS[x.num], p) - dist(POS[y.num], p))[0].num;
  const steps = [{ ic: "●", t: `Start at <b>${sName}</b>${sb ? " (" + sb.name + ")" : ""} and head to the road.` }];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]], c = [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]];
    const m = (Math.hypot(...a) * Math.hypot(...c)) || 1, cross = a[0] * c[1] - a[1] * c[0], cos = (a[0] * c[0] + a[1] * c[1]) / m;
    if (Math.abs(cross) / m > 0.5 && cos < 0.9) steps.push({ ic: cross > 0 ? "↱" : "↰", t: `Near <b>${near(pts[i])}</b>, turn <b>${cross > 0 ? "right" : "left"}</b>.` });
  }
  steps.push({ ic: "⚑", t: `Arrive at <b>Block ${b.num}</b> (${b.name}).` });

  $("routeTitle").textContent = `${sName} → Block ${b.num}`;
  $("routeSteps").innerHTML = steps.map(x => `<li><span class="ic">${x.ic}</span><span>${x.t}</span></li>`).join("");
  document.querySelectorAll(".route-photo").forEach(p => p.remove());      // show the destination photo under the steps
  $("routeSteps").insertAdjacentHTML("afterend", `<div class="route-photo"><b>Look for this building:</b>${photoTag(b)}</div>`);
  drawMap($("routeMap"), { dest: b, start: sb, route: pts, startPt: sPt, startName: sName });
  showView("route");
}

/* ---------- 8. SET UP BUTTONS & EVENTS ---------- */
$("chips").innerHTML = '<span class="note">Quick find:</span>' + ["academic", "hostel", "food", "admin", "hall"]
  .map(c => `<button class="chip" data-cat="${c}">${CAT_ICON[c]} ${CATEGORIES[c]}</button>`).join("");
drawMap($("previewMap"), { mini: true });
drawMap($("fullMap"), { clickable: true });

// Search box: picking a suggestion opens the block, pressing Search lists all matches
setupSuggest($("searchInput"), $("suggestSearch"), findBlocks, it => { $("clearSearch").hidden = false; showDetails(it.key, "home"); });
setupSuggest($("homeStartInput"), $("suggestHome"), findStarts, it => state.start = it.key);
$("homeStartInput").addEventListener("input", e => { if (!e.target.value.trim()) state.start = null; });
$("searchInput").addEventListener("input", e => $("clearSearch").hidden = !e.target.value);
$("clearSearch").onclick = () => { $("searchInput").value = ""; $("clearSearch").hidden = true; $("searchInput").focus(); };
$("searchForm").addEventListener("submit", e => { e.preventDefault(); $("suggestSearch").hidden = true; search($("searchInput").value); });
$("startFilter").addEventListener("input", renderStartList);

// One click listener handles all other buttons (event delegation)
document.addEventListener("click", e => {
  const t = e.target, view = t.closest("[data-view]"), sc = t.closest("[data-scroll]"), det = t.closest("[data-details]"),
        chip = t.closest("[data-cat]"), flt = t.closest("[data-filter]"), q = t.closest("[data-q]"),
        so = t.closest("[data-start]"), hit = t.closest(".bd.click");
  if (view) { e.preventDefault(); showView(view.dataset.view); }
  else if (sc) { e.preventDefault(); showView("home"); $(sc.dataset.scroll).scrollIntoView({ behavior: "smooth" }); }
  else if (det) showDetails(det.dataset.details, "results");
  else if (chip) showResults(BLOCKS.filter(b => b.cat === chip.dataset.cat), CATEGORIES[chip.dataset.cat] + " blocks");
  else if (flt) { state.filter = flt.dataset.filter; renderResults(); }
  else if (q) { $("searchInput").value = q.dataset.q; search(q.dataset.q); }
  else if (so) { state.start = so.dataset.start; renderStartList(); drawStartMap(); }
  else if (hit && !hit.closest(".gmap")._moved) showDetails(hit.dataset.num, hit.closest("#fullMap") ? "map" : "results");
});
$("backToResults").onclick = () => showView(state.from === "results" && state.all.length ? "results" : state.from === "map" ? "map" : "home");
$("backToDetails").onclick = () => showView("details");
$("backToStart").onclick = () => showView("start");
$("showRouteBtn").onclick = showRoute;
$("menuBtn").onclick = () => $("navLinks").classList.toggle("open");
