(() => {
  const D = window.SEERAH;
  const { PROJ, events, regions, places, categories, labels, START, END } = D;
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (name, attrs = {}, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = (v) => Math.round(v * 10) / 10;

  // ---------- projection (matches tools/build-land.mjs) ----------
  const KX = Math.cos((PROJ.lat * Math.PI) / 180);
  const project = ([lon, lat]) => [(lon - PROJ.lon0) * KX * PROJ.scale, (PROJ.lat1 - lat) * PROJ.scale];
  const MAPW = (PROJ.lon1 - PROJ.lon0) * KX * PROJ.scale;
  const MAPH = (PROJ.lat1 - PROJ.lat0) * PROJ.scale;
  const placeXY = (e) => project(places[e.place].ll);

  // ---------- static map layers ----------
  const svg = $("map");
  const wrap = $("map-wrap");
  const sea = $("sea");
  sea.setAttribute("x", -3000); sea.setAttribute("y", -3000);
  sea.setAttribute("width", MAPW + 6000); sea.setAttribute("height", MAPH + 6000);
  for (const id of ["land", "land-clip-path", "coast"]) $(id).setAttribute("d", D.landPath);

  const tintEls = regions.map((r) => {
    const pts = r.poly.map((p) => project(p).map(round).join(",")).join(" ");
    return svgEl("polygon", { points: pts }, $("tint"));
  });

  const labelLayer = $("labels");
  const eventPlaces = new Set(Object.values(places).map((p) => p.ll.join()));
  for (const l of labels) {
    const [x, y] = project(l.ll);
    const g = svgEl("g", { class: "lbl-g" }, labelLayer);
    g.style.setProperty("--x", round(x) + "px");
    g.style.setProperty("--y", round(y) + "px");
    if (l.cls === "city") {
      svgEl("circle", { r: 2.6, class: "dot" }, g);
      const t = svgEl("text", { class: l.cls, x: eventPlaces.has(l.ll.join()) ? 19 : 6, y: 4 }, g);
      t.textContent = l.t;
    } else {
      const t = svgEl("text", { class: l.cls }, g);
      if (l.rot) t.setAttribute("transform", `rotate(${l.rot})`);
      t.textContent = l.t;
    }
  }

  // routes
  const routeEls = new Map();
  const smooth = (pts) => {
    let d = `M${round(pts[0][0])} ${round(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
    }
    return d;
  };
  for (const e of events) {
    if (!e.route) continue;
    const p = svgEl("path", { d: smooth(e.route.pts.map(project)), pathLength: 1, "stroke-dasharray": "1 1" }, $("routes"));
    p.style.stroke = categories[e.cat].color;
    routeEls.set(e.id, p);
  }

  // markers
  const markers = events.map((e) => {
    const cat = categories[e.cat];
    const [x, y] = placeXY(e);
    const g = svgEl("g", { class: "m hidden", tabindex: 0, role: "button", "aria-label": `${e.short}, ${places[e.place].name}` }, $("markers"));
    g.style.setProperty("--x", round(x) + "px");
    g.style.setProperty("--y", round(y) + "px");
    g.style.setProperty("--c", cat.color);
    const mi = svgEl("g", { class: "mi" }, g);
    svgEl("circle", { class: "ring", r: 16 }, mi);
    const full = svgEl("g", { class: "full" }, mi);
    svgEl("circle", { class: "bg", r: 14 }, full);
    svgEl("use", { href: "#" + cat.icon, x: -8, y: -8, width: 16, height: 16 }, full);
    svgEl("circle", { class: "small", r: 5 }, mi);
    const tag = svgEl("g", { class: "tag" }, mi);
    const rect = svgEl("rect", { rx: 6, height: 22 }, tag);
    const text = svgEl("text", { y: -31 }, tag);
    text.textContent = e.short;
    g.addEventListener("click", () => goToEvent(e));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter") goToEvent(e); });
    return { g, mi, rect, text, tag, e };
  });
  // size the name tags once the text can be measured
  for (const m of markers) {
    const w = m.text.getBBox().width + 16;
    m.rect.setAttribute("x", -w / 2); m.rect.setAttribute("y", -42); m.rect.setAttribute("width", w);
  }

  // legend
  $("legend-items").innerHTML =
    Object.values(categories).map((c) => `<span style="--c:${c.color}"><i></i>${c.label}</span>`).join("") +
    `<span><i class="tintsw"></i>İslamın çatdığı yerlər</span>`;

  // ---------- camera ----------
  let size = { w: 1, h: 1 };
  const cam = { cx: MAPW / 2, cy: MAPH / 2, w: MAPW };
  const tgt = { ...cam };
  let auto = true, camRunning = false;
  const fullWidth = () => Math.max(MAPW, (MAPH * size.w) / size.h);
  const MIN_W = 150;

  function clampCam(c) {
    c.w = clamp(c.w, MIN_W, fullWidth());
    const h = (c.w * size.h) / size.w;
    c.cx = c.w < MAPW ? clamp(c.cx, c.w / 2, MAPW - c.w / 2) : MAPW / 2;
    c.cy = h < MAPH ? clamp(c.cy, h / 2, MAPH - h / 2) : MAPH / 2;
  }
  function applyCam() {
    const h = (cam.w * size.h) / size.w;
    svg.setAttribute("viewBox", `${round(cam.cx - cam.w / 2)} ${round(cam.cy - h / 2)} ${round(cam.w)} ${round(h)}`);
    svg.style.setProperty("--k", cam.w / size.w);
  }
  function stepCam() {
    clampCam(tgt);
    const f = 0.14;
    let moving = false;
    for (const k of ["cx", "cy", "w"]) {
      const d = tgt[k] - cam[k];
      if (Math.abs(d) > (k === "w" ? 0.3 : 0.15)) { cam[k] += d * f; moving = true; } else cam[k] = tgt[k];
    }
    clampCam(cam);
    applyCam();
    if (moving) requestAnimationFrame(stepCam); else camRunning = false;
  }
  function kickCam() { if (!camRunning) { camRunning = true; requestAnimationFrame(stepCam); } }

  function autoTarget() {
    const ev = events[activeIndex];
    const near = [events[activeIndex - 1], ev, events[activeIndex + 1]].filter(Boolean);
    const pts = near.map(placeXY);
    if (ev.route) pts.push(...ev.route.pts.map(project));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const aspect = size.w / size.h;
    tgt.w = Math.max((maxX - minX) * 1.7, (maxY - minY) * 1.7 * aspect, 260);
    tgt.cx = (minX + maxX) / 2;
    tgt.cy = (minY + maxY) / 2;
  }
  function setAuto(on) {
    auto = on;
    $("zoom-auto").classList.toggle("on", on);
    if (on) { autoTarget(); kickCam(); }
  }
  function manual(fn) {
    setAuto(false);
    fn();
    clampCam(tgt);
    Object.assign(cam, tgt);
    clampCam(cam);
    applyCam();
  }
  function zoomAt(factor, clientX, clientY) {
    manual(() => {
      const r = svg.getBoundingClientRect();
      const fx = (clientX - r.left) / size.w - 0.5, fy = (clientY - r.top) / size.h - 0.5;
      const h = (cam.w * size.h) / size.w;
      const nw = clamp(cam.w / factor, MIN_W, fullWidth());
      const nh = (nw * size.h) / size.w;
      tgt.cx = cam.cx + fx * (cam.w - nw);
      tgt.cy = cam.cy + fy * (h - nh);
      tgt.w = nw;
    });
  }
  const zoomCenter = (f) => { const r = svg.getBoundingClientRect(); zoomAt(f, r.left + size.w / 2, r.top + size.h / 2); };
  $("zoom-in").onclick = () => zoomCenter(1.5);
  $("zoom-out").onclick = () => zoomCenter(1 / 1.5);
  $("zoom-auto").onclick = () => setAuto(true);

  svg.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  const ptrs = new Map();
  let pinch = 0;
  svg.addEventListener("pointerdown", (e) => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, down: e.target });
    if (ptrs.size === 2) pinch = 0;
  });
  svg.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (ptrs.size === 1) {
      if (!svg.classList.contains("dragging")) {
        if (Math.hypot(dx, dy) < 4) return;
        svg.classList.add("dragging");
      }
      manual(() => {
        const s = cam.w / size.w;
        tgt.cx = cam.cx - dx * s; tgt.cy = cam.cy - dy * s; tgt.w = cam.w;
      });
      p.x = e.clientX; p.y = e.clientY;
    } else if (ptrs.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d;
    }
  });
  const endPtr = (e) => { ptrs.delete(e.pointerId); pinch = 0; if (!ptrs.size) svg.classList.remove("dragging"); };
  svg.addEventListener("pointerup", endPtr);
  svg.addEventListener("pointercancel", endPtr);

  new ResizeObserver(() => {
    const r = wrap.getBoundingClientRect();
    size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    if (auto) autoTarget();
    clampCam(tgt); clampCam(cam);
    applyCam(); kickCam();
    layoutTimeline();
  }).observe(wrap);

  // ---------- timeline ----------
  const scroller = $("scroller"), pad = $("pad"), track = $("track");
  const bands = [
    { from: START, to: 610.6, label: "Erkən həyat", color: "#d9c58a" },
    { from: 610.6, to: 622.7, label: "Məkkə dövrü", color: "#8fc5b8" },
    { from: 622.7, to: END, label: "Mədinə dövrü", color: "#8ed1a0" },
  ];
  let ppy = 90;
  const AXIS_Y = 142, ROW_TOP = [26, 50, 74, 98];
  const mkEl = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e; };
  const evButtons = [];

  function buildTimeline() {
    track.innerHTML = "";
    evButtons.length = 0;
    track.style.width = (END - START) * ppy + "px";
    const X = (y) => (y - START) * ppy;
    for (const b of bands) {
      const e = mkEl("div", "tl-band", track);
      e.style.left = X(b.from) + "px"; e.style.width = (b.to - b.from) * ppy + "px"; e.style.background = b.color;
      e.textContent = b.label;
    }
    mkEl("div", "tl-axis", track);
    for (let y = Math.ceil(START); y <= Math.floor(END); y++) {
      const t = mkEl("div", "tl-tick" + (y % 5 === 0 ? " major" : ""), track);
      t.style.left = X(y) + "px";
      mkEl("span", "", t).textContent = y;
    }
    const h = mkEl("div", "tl-hijra", track);
    h.style.left = X(622.54) + "px";
    mkEl("span", "", h).textContent = "h. 1 · Hicri təqvimin başlanğıcı";

    const rowEnd = ROW_TOP.map(() => -1e9);
    for (const e of events) {
      const x = X(e.year);
      let row = rowEnd.findIndex((end) => end <= x);
      const crowded = row < 0;
      if (crowded) row = rowEnd.indexOf(Math.min(...rowEnd));
      else rowEnd[row] = x + 24 + e.short.length * 6.2;
      const b = mkEl("button", "tl-ev" + (crowded ? " nolabel" : ""), track);
      b.style.left = x + "px"; b.style.top = ROW_TOP[row] + "px";
      b.style.setProperty("--c", categories[e.cat].color);
      b.title = `${e.title} (${e.date})`;
      const stem = mkEl("span", "stem", b); stem.style.height = AXIS_Y - ROW_TOP[row] - 18 + "px";
      const pin = mkEl("span", "pin", b);
      pin.innerHTML = `<svg viewBox="0 0 24 24"><use href="#${categories[e.cat].icon}"/></svg>`;
      mkEl("span", "name", b).textContent = e.short;
      b.addEventListener("click", () => { if (!dragged) goToEvent(e); });
      evButtons.push(b);
    }
  }
  function layoutTimeline() {
    const half = scroller.clientWidth / 2;
    const want = scroller.clientWidth < 600 ? 70 : 90;
    if (want !== ppy || !track.children.length) { ppy = want; buildTimeline(); }
    pad.style.paddingLeft = pad.style.paddingRight = half + "px";
    scroller.scrollLeft = (year - START) * ppy;
  }

  // ---------- state ----------
  let year = START, activeIndex = -1;
  const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
  const HIJRA_Y = 622.54;
  const fmtYear = (y) => {
    const m = MONTHS[Math.min(11, Math.floor((y % 1) * 12))];
    return (y < 622 ? "təxm. " : "") + `${m} ${Math.floor(y)}`;
  };
  const fmtHijri = (y) => {
    const d = ((y - HIJRA_Y) * 365.25) / 354.37;
    return d >= 0 ? `h. ${Math.floor(d) + 1}` : `hicrətdən ${Math.max(1, Math.floor(-d))} il əvvəl`;
  };
  const ageAt = (y) => Math.floor(((y - START) / (END - START)) * 63);

  function indexAt(y) {
    let i = 0;
    while (i + 1 < events.length && events[i + 1].year <= y + 1e-6) i++;
    return i;
  }

  function renderCard(e) {
    const cat = categories[e.cat], card = $("card");
    card.style.setProperty("--chip", cat.color);
    $("card-chip").innerHTML = `<i><svg viewBox="0 0 24 24"><use href="#${cat.icon}"/></svg></i>${cat.label}`;
    $("card-title").textContent = e.title;
    $("card-date").textContent = e.date;
    $("card-meta").textContent = `${places[e.place].name} · ${ageAt(e.year)} yaş`;
    $("card-text").textContent = e.text;
    card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
    card.scrollTop = 0;
  }

  function update() {
    const idx = indexAt(year);
    $("ro-year").textContent = fmtYear(year);
    $("ro-hijri").textContent = fmtHijri(year);
    $("ro-age").textContent = `${ageAt(year)} yaş`;

    // tint
    regions.forEach((r, i) => {
      const t = clamp((year - r.from) / r.fade, 0, 1);
      tintEls[i].setAttribute("fill-opacity", (0.55 * t * (2 - t)).toFixed(3));
    });

    // routes
    for (const e of events) {
      const p = routeEls.get(e.id);
      if (!p) continue;
      const prog = clamp((year - e.route.from) / (e.route.to - e.route.from), 0, 1);
      p.style.strokeDashoffset = 1 - prog;
      const since = year - e.route.to;
      p.style.opacity = year < e.route.from || since > 2.5 ? 0 : since > 1.2 ? 0.22 : 0.9;
    }

    // markers
    const ring = new Map();
    for (let i = markers.length - 1; i >= 0; i--) {
      const m = markers[i], g = m.g;
      const state = i > idx + 1 ? "hidden" : i === idx + 1 ? "ghost" : i === idx ? "active" : year - m.e.year < 1.5 ? "full" : year - m.e.year < 6 ? "dot" : "hidden";
      g.setAttribute("class", "m" + (state === "full" ? "" : " " + state));
      let ox = 0, oy = 0;
      if (state === "ghost" && markers[idx].e.place === m.e.place) { ox = 28; oy = -20; }
      if (state === "dot") {
        const n = ring.get(m.e.place) || 0;
        ring.set(m.e.place, n + 1);
        const a = n * 2.4, r = 20 + 7 * Math.sqrt(n);
        ox = Math.cos(a) * r; oy = Math.sin(a) * r;
      }
      m.mi.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px)`;
    }

    evButtons.forEach((b, i) => {
      b.classList.toggle("past", i < idx);
      b.classList.toggle("active", i === idx);
    });

    if (idx !== activeIndex) {
      activeIndex = idx;
      markers[idx].g.parentNode.appendChild(markers[idx].g); // keep the active marker on top
      renderCard(events[idx]);
      if (auto) { autoTarget(); kickCam(); }
      try { history.replaceState(null, "", "#" + events[idx].id); } catch (_) { /* ignore */ }
    }
  }

  let pending = false;
  function onScroll() {
    year = clamp(START + scroller.scrollLeft / ppy, START, END);
    if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; update(); }); }
  }
  scroller.addEventListener("scroll", onScroll, { passive: true });

  function goToEvent(e) {
    stopPlay();
    scroller.scrollTo({ left: (e.year + 0.004 - START) * ppy, behavior: "smooth" });
  }
  const step = (dir) => {
    stopPlay();
    const cur = events[activeIndex];
    let i = activeIndex + dir;
    if (dir < 0 && year - cur.year > 0.02) i = activeIndex;
    i = clamp(i, 0, events.length - 1);
    goToEvent(events[i]);
  };
  $("prev").onclick = () => step(-1);
  $("next").onclick = () => step(1);

  // drag / wheel on the timeline
  let dragged = false;
  (() => {
    let sx = 0, sl = 0, down = false, moved = false, id = null;
    scroller.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) { stopPlay(); return; }
      stopPlay();
      down = true; moved = false; sx = e.clientX; sl = scroller.scrollLeft; id = e.pointerId;
    });
    scroller.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 4) { moved = true; dragged = true; scroller.setPointerCapture(id); scroller.classList.add("dragging"); }
      if (moved) scroller.scrollLeft = sl - dx;
    });
    const end = () => {
      if (!down) return;
      down = false; scroller.classList.remove("dragging");
      if (moved) setTimeout(() => { dragged = false; }, 0);
    };
    scroller.addEventListener("pointerup", end);
    scroller.addEventListener("pointercancel", end);
    scroller.addEventListener("wheel", (e) => {
      stopPlay();
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); scroller.scrollLeft += e.deltaY; }
    }, { passive: false });
  })();

  // ---------- autoplay (dwells on each event) ----------
  let playing = false, raf = 0, pos = 0, last = 0, holdUntil = 0, mult = 1, lastIdx = -1;
  const BASE = 0.4; // years per second
  function tick(now) {
    if (!playing) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (now >= holdUntil) {
      pos += BASE * mult * dt * ppy;
      scroller.scrollLeft = pos;
      year = clamp(START + pos / ppy, START, END);
      const i = indexAt(year);
      if (i !== lastIdx) { lastIdx = i; holdUntil = now + 3200 / mult; }
      if (pos >= (END - START) * ppy) { stopPlay(); return; }
    }
    raf = requestAnimationFrame(tick);
  }
  function startPlay() {
    if (year >= END - 0.01) { scroller.scrollLeft = 0; year = START; }
    pos = scroller.scrollLeft; lastIdx = indexAt(year); holdUntil = 0; last = performance.now();
    playing = true;
    $("play").innerHTML = "&#10074;&#10074;"; $("play").setAttribute("aria-label", "Dayandır");
    raf = requestAnimationFrame(tick);
  }
  function stopPlay() {
    if (!playing) return;
    playing = false; cancelAnimationFrame(raf);
    $("play").innerHTML = "&#9654;"; $("play").setAttribute("aria-label", "Oynat");
  }
  $("play").onclick = () => (playing ? stopPlay() : startPlay());
  $("speed").onclick = () => { mult = mult === 1 ? 2 : mult === 2 ? 4 : 1; $("speed").innerHTML = mult + "&times;"; };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === " " && !/^(BUTTON|SVG|G)$/i.test(e.target.tagName) && !e.target.closest?.(".m")) { e.preventDefault(); $("play").click(); }
  });

  // ---------- init ----------
  $("legend").open = window.innerWidth > 800;
  const hashed = events.find((e) => "#" + e.id === location.hash);
  if (hashed) year = hashed.year + 0.004;
  const r0 = wrap.getBoundingClientRect();
  size = { w: Math.max(1, r0.width), h: Math.max(1, r0.height) };
  layoutTimeline();
  year = clamp(START + scroller.scrollLeft / ppy, START, END);
  update();
  autoTarget(); Object.assign(cam, tgt); clampCam(cam); applyCam();
})();
