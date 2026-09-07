/* ===== helpers ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function bkkNow() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: DATA.trip.tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, mins: parseInt(g("hour"), 10) * 60 + parseInt(g("minute"), 10) };
}
const toMins = hm => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };

function tripPhase() {
  const { date } = bkkNow();
  if (date < DATA.trip.start) return "before";
  if (date > DATA.trip.end) return "after";
  return "during";
}
function daysUntil() {
  const { date } = bkkNow();
  return Math.round((new Date(DATA.trip.start + "T00:00:00") - new Date(date + "T00:00:00")) / 86400000);
}
function todayDayIndex() {
  const { date } = bkkNow();
  return DATA.days.findIndex(d => d.date === date);
}

const mapUrl = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

const SVG = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const QI = {
  cal: SVG('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  plane: SVG('<path d="M10.5 13.5L3 10.8l18-6.8-6.8 18-3.7-8.5z"/>'),
  doc: SVG('<path d="M6 2.5h8.5L20 8v13.5H6z"/><path d="M14 2.5V8h6M9 13h6M9 17h6"/>'),
  coin: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10.2h5M9.5 13.8h5"/>'),
  sos: SVG('<path d="M12 3.5L22 21H2z"/><path d="M12 10.5v4.5"/><circle cx="12" cy="17.8" r="0.3" fill="currentColor"/>'),
  check: SVG('<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>'),
  chat: SVG('<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.1A8.5 8.5 0 1 1 21 11.5z"/>'),
  bed: SVG('<path d="M3 7v11M3 12h18v6M21 18v-4a3 3 0 0 0-3-3h-7v4"/><circle cx="7" cy="10" r="1.5"/>'),
  pin: SVG('<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  food: SVG('<path d="M6 2v6a2 2 0 0 0 4 0V2"/><path d="M8 10v12"/><path d="M17 2a5 5 0 0 0-2 4v5h3v11"/>'),
  toilet: SVG('<ellipse cx="12" cy="8.5" rx="6" ry="5"/><ellipse cx="12" cy="8.5" rx="2.3" ry="1.7"/><path d="M8.4 13 8 21M15.6 13 16 21M8 21h8"/>'),
  tools: SVG('<path d="M14.6 6.4a3.8 3.8 0 0 1-5 5L4 17v3h3l5.6-5.6a3.8 3.8 0 0 0 5-5l-2.4 2.4-2-2z"/>'),
  todo: SVG('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l2.5 2.5L16 9"/>')
};

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}
function copyText(text, msg) {
  const done = () => toast(msg || "已複製");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "absolute"; ta.style.left = "-9999px";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { toast("複製失敗，請長按手動複製"); }
  document.body.removeChild(ta);
}
window.copyAddr = (i) => copyText(DATA.hotels[i].addrEn, "英文地址已複製，上車給司機看");
window.copyTxt = (t) => copyText(t);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ===== event status (done / now / next) ===== */
function dayStatuses(day) {
  const { date, mins } = bkkNow();
  if (date !== day.date) return day.events.map(() => "");
  let nowIdx = -1;
  day.events.forEach((ev, i) => { if (toMins(ev.time) <= mins) nowIdx = i; });
  return day.events.map((ev, i) => i < nowIdx ? "done" : i === nowIdx ? "now" : i === nowIdx + 1 ? "next" : "");
}

/* ===== HOME ===== */
function hotelForNight(date) {
  if (date >= "2026-09-27") return null; // 最後一天飛回家，當晚無住宿
  if (date <= "2026-09-22") return DATA.hotels[0];
  if (date <= "2026-09-25") return DATA.hotels[1];
  return DATA.hotels[2];
}

// 共用的住宿區塊（行程頁與首頁旅途模式共用）
function hotelBlockHTML(h, opts) {
  opts = opts || {};
  const i = DATA.hotels.indexOf(h);
  return `<div class="hotelblock${opts.flat ? " flat" : ""}">
    <div class="hb-label">${opts.label || "今晚住宿"}</div>
    <div class="hb-name">${esc(h.name)}</div>
    <div class="hb-addr">${esc(h.addrZh)}<br><span class="hb-en">${esc(h.addrEn)}</span></div>
    <div class="btnrow">
      <button class="abtn primary" onclick="copyAddr(${i})">複製英文地址</button>
      <a class="abtn" target="_blank" rel="noopener" href="${mapUrl(h.mapq)}">導航</a>
    </div>
  </div>`;
}

function nextFlight() {
  const { date } = bkkNow();
  return DATA.flights.find(f => f.date >= date) || DATA.flights[DATA.flights.length - 1];
}
function fmtClock(mins) {
  return String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
}
function renderHome() {
  const phase = tripPhase();
  const { mins } = bkkNow();
  let html = `
    <div class="travel-mast"><span>THAILAND / 2026</span><span>${esc(DATA.trip.sub)}</span></div>
    <header class="home-cover">
      <img src="assets/img/hero.jpg" alt="泰國旅行風景" fetchpriority="high">
      <div class="cover-copy"><span class="eyebrow">CHIANG MAI & BANGKOK</span><h1>${esc(DATA.trip.title)}</h1><p>09.20 — 09.27 <span>8 天 7 夜</span></p></div>
    </header>
    <div class="ob-badge" id="offline-note"><span class="dot"></span><span id="offline-text">內容更新於 ${esc(DATA.updated)}</span></div>`;

  if (phase === "before") {
    const n = daysUntil();
    const all = DATA.checklist.flatMap(g => g.items);
    const done = all.filter(it => store.get("chk_" + it.id, false)).length;
    const pct = all.length ? Math.round(done / all.length * 100) : 0;
    const undone = all.filter(it => !store.get("chk_" + it.id, false)).slice(0, 3);
    html += `
      <div class="departure-strip"><div><strong>${n}</strong><span>天後出發</span></div><p>9/20 週日<br><b>07:40 桃園起飛</b></p></div>
      <div class="today-card prep-card">
        <div class="prep-row">
          <div class="prep-label">行前準備</div>
          <div class="prep-num"><b>${done}</b> / ${all.length}</div>
        </div>
        <div class="mini-progress"><div style="width:${pct}%"></div></div>
        ${undone.length ? `<div class="prep-next">${undone.map(it => `<div class="pn-item">${esc(it.text)}</div>`).join("")}</div>` : `<div class="prep-done">全部準備完成，可以出發了</div>`}
        <button class="prep-link" onclick="go('list',0)">查看完整清單 <span aria-hidden="true">→</span></button>
      </div>
      <a class="cta-strip" href="https://tdac.immigration.go.th" target="_blank" rel="noopener">
        <div class="cta-ic">${QI.doc}</div>
        <div class="cta-body"><b>9/17 起填 TDAC 電子入境卡</b><span>官方免費網站，填完截圖存手機</span></div>
        <span class="cta-go">前往 ›</span>
      </a>
      `;
  } else if (phase === "during") {
    const di = todayDayIndex();
    const day = DATA.days[di];
    const st = dayStatuses(day);
    const nowI = st.indexOf("now"), nextI = st.indexOf("next");
    const hotel = hotelForNight(day.date);
    const nextEv = nextI >= 0 ? day.events[nextI] : null;
    const nowEv = nowI >= 0 ? day.events[nowI] : null;
    html += `
      <div class="today-card">
        <div class="tc-top">
          <div>
            <span class="tc-tag tag-orange">今天</span>
            <div class="tc-d">${day.label} <span class="tc-city ${day.cityClass}">${esc(day.city)}</span></div>
          </div>
          <div class="tc-date"><span class="tc-clock">${fmtClock(mins)}</span><br>${day.date.slice(5).replace("-", "/")} ${esc(day.week)}</div>
        </div>
        <div class="tc-div"></div>
        ${nextEv ? `
          <div class="tc-nextlabel">${QI.pin}<span>下一站</span></div>
          <div class="tc-next">${esc(nextEv.time)} ${esc(nextEv.title)}</div>
          <div class="tc-nextdesc">${esc(nextEv.desc)}</div>
          ${nowEv ? `<div class="tc-nowline">現在進行：${esc(nowEv.time)} ${esc(nowEv.title)}</div>` : ""}
          <div class="tc-actions">
            ${nextEv.mapq ? `<a class="btn-green sm" target="_blank" rel="noopener" href="${mapUrl(nextEv.mapq)}">導航</a>` : ""}
          </div>`
        : `
          <div class="tc-next">今天行程跑完了，好好休息</div>
`}
      </div>
      ${hotel ? hotelBlockHTML(hotel, {}) : ""}
      <div class="rain-strip"><b>今日雨備</b>${esc(day.rain)}</div>
      <button class="cta-strip" onclick="go('list',1)">
        <div class="cta-ic">${QI.check}</div>
        <div class="cta-body"><b>出門前檢查</b><span>護照、傘、錢包、防蚊液帶了沒</span></div>
        <span class="cta-go">查看 ›</span>
      </button>
      `;
  } else {
    html += `
      <div class="today-card" style="text-align:center;padding:30px 20px">
        <div class="tc-d" style="justify-content:center">旅程圓滿</div>
        <div style="color:var(--ink-soft);margin-top:8px">8 天的清邁與曼谷回憶，<br>歡迎隨時回來翻看行程與照片。</div>

      </div>
      `;
  }

  $("#page-home").innerHTML = html;
  updateOfflineNote();
}

function updateOfflineNote() {
  const el = $("#offline-note"); if (!el) return;
  const txt = $("#offline-text");
  if (navigator.onLine) {
    el.classList.remove("off");
    txt.textContent = swReady ? "離線手冊已就緒" : "內容更新於 " + DATA.updated;
  } else {
    el.classList.add("off");
    txt.textContent = "目前離線中 · 顯示已儲存的內容";
  }
}

/* ===== PLAN ===== */
let selDay = 0;
function renderPlan() {
  const pills = DATA.days.map((d, i) => {
    const isToday = d.date === bkkNow().date;
    return `<button class="daypill ${i === selDay ? "sel " + d.cityClass : ""} ${isToday ? "today-ring" : ""}" aria-pressed="${i === selDay}" onclick="selectDay(${i})">${d.label} ${esc(d.week.replace("週", ""))}<small>${d.date.slice(5).replace("-", "/")}</small></button>`;
  }).join("");

  const day = DATA.days[selDay];
  const st = dayStatuses(day);
  const events = day.events.map((ev, i) => {
    const s = st[i];
    const stateTag = s === "now" ? `<span class="ev-state now">現在</span>` : s === "next" ? `<span class="ev-state next">下一站</span>` : s === "done" ? `<span class="ev-state done">完成</span>` : "";
    return `
      <article class="ev status-${s || "todo"}">
        <div class="ev-when"><span class="ev-time">${esc(ev.time)}</span>${stateTag}</div>
        <div class="ev-card">
          <div class="ev-heading"><h3 class="ev-title">${esc(ev.title)}</h3>${ev.mapq ? `<a class="event-nav" target="_blank" rel="noopener" href="${mapUrl(ev.mapq)}" aria-label="導航至${esc(ev.title)}">導航 ↗</a>` : ""}</div>
          ${ev.warn ? `<div class="ev-warn">${esc(ev.warn)}</div>` : ""}
          <details class="event-detail"${s === "now" ? " open" : ""}><summary>行程詳情</summary>
            <div class="ev-desc">${esc(ev.desc)}</div>
            ${ev.cost ? `<div class="ev-cost">費用 ${esc(ev.cost)}</div>` : ""}
            ${ev.mapq ? `<button class="copy-place" data-place="${esc(ev.mapq)}">複製地點</button>` : ""}
          </details>
        </div>
      </article>`;
  }).join("");

  const hotel = hotelForNight(day.date);
  $("#page-plan").innerHTML = `
    <div class="page-head compact-head"><h1>每日行程</h1><span>9/20 — 9/27</span></div>
    <div class="daybar" id="daybar">${pills}</div>
    <div class="day-hero"><img class="dayimg" src="assets/img/${day.img}" alt="${esc(day.city)}旅行風景">
    <div class="dayhead">
      <div class="dh-city ${day.cityClass}">${esc(day.city)} · ${esc(day.week)}</div>
      <h2>${esc(day.title)}</h2>
      <div class="dh-date">${day.date.replace(/-/g, "/")}　${day.date === bkkNow().date ? "— 就是今天" : ""}</div>
    </div>
    </div>
    <div class="day-notes">${day.note ? `<details class="notebox"><summary>出發前提醒</summary><p>${esc(day.note)}</p></details>` : ""}
    <details class="rainbox"><summary>下雨的備案</summary><p>${esc(day.rain)}</p></details></div>
    <div class="section-title itinerary-label">${day.events.length} 站旅程 ${hotel ? `<button class="stay-shortcut" onclick="jumpTo('plan-stay')">今晚住宿 ↗</button>` : `<span>DAY ${selDay + 1}</span>`}</div>
    <div class="timeline">${events}</div>
    ${hotel ? `<div id="plan-stay">${hotelBlockHTML(hotel, { flat: true })}</div>` : ""}
    <div class="swipe-hint">← 左右滑動切換天數 →</div>
    <div class="toolmenu" id="toolmenu">
      <div class="tm-options" id="tm-options" role="menu" aria-label="旅途工具" hidden>
        <button class="tm-opt" role="menuitem" onclick="toolPick('food')">${QI.food}<span>附近美食</span></button>
        <button class="tm-opt" role="menuitem" onclick="toolPick('toilet')">${QI.toilet}<span>附近廁所</span></button>
        <button class="tm-opt" role="menuitem" onclick="toolPick('todo')">${QI.todo}<span>每日待辦</span></button>
      </div>
      <button class="food-fab tm-fab" id="tm-fab" onclick="toggleTools()" aria-haspopup="menu" aria-expanded="false" aria-controls="tm-options">${QI.tools}<span>旅途工具</span></button>
    </div>`;

  const selPill = document.querySelectorAll(".daypill")[selDay];
  if (selPill) selPill.scrollIntoView({ inline: "center", block: "nearest" });
  if (typeof closeTools === "function") closeTools();   // 重繪行程頁時工具選單回到收合態
}
window.selectDay = i => { selDay = i; renderPlan(); window.scrollTo({ top: 0 }); };

/* swipe */
let tx = null, ty = null;
document.addEventListener("touchstart", e => {
  if (!$("#page-plan").classList.contains("active")) return;
  if (e.target.closest("button, a, input, summary, .daybar")) { tx = ty = null; return; }
  tx = e.touches[0].clientX; ty = e.touches[0].clientY;
}, { passive: true });
document.addEventListener("touchend", e => {
  if (tx === null || !$("#page-plan").classList.contains("active")) return;
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  tx = ty = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
    if (dx < 0 && selDay < DATA.days.length - 1) selectDay(selDay + 1);
    else if (dx > 0 && selDay > 0) selectDay(selDay - 1);
  }
}, { passive: true });

/* ===== ORDERS ===== */
function renderOrders() {
  const flights = DATA.flights.map((f, i) => {
    const pnr = store.get(f.pnrKey, "");
    return `
    <div class="card flight-card">
      <div><span class="badge gold">${esc(f.no)} · ${esc(f.airline)}</span>　<span style="font-size:13.5px;color:var(--ink-soft)">${f.date.slice(5).replace("-", "/")}（${esc(f.day)}）</span></div>
      <div class="ticket-route"><div><span>${esc(f.from)}</span><strong>${esc(f.dep)}</strong><small>出發</small></div><div class="ticket-path">${QI.plane}<span></span></div><div><span>${esc(f.to)}</span><strong>${esc(f.arr)}</strong><small>抵達</small></div></div>
      <div class="fc-note">${esc(f.note)}</div>
      <div class="pnr-row">
        <label for="pnr-${i}">訂位代碼</label>
        <input id="pnr-${i}" value="${esc(pnr)}" placeholder="可自行輸入" maxlength="8" onchange="savePnr('${f.pnrKey}',this.value)">
      </div>
      <div class="pnr-note">可自行輸入，只會存在這台手機、不會同步</div>
    </div>`;
  }).join("");

  const hotels = DATA.hotels.map((h, i) => `
    <div class="card hotel-card">
      <div class="hc-top">
        <img class="hc-thumb" src="assets/img/${h.img}" alt="" onerror="this.remove()">
        <div style="flex:1;min-width:0">
          <span class="badge ${h.cityClass}">${esc(h.city)}</span> <span class="badge gold">已確認</span>
          <div class="hc-name">${esc(h.name)}</div>
          <div class="hc-meta">${esc(h.dates)} · ${esc(h.nights)} · ${esc(h.price)}</div>
        </div>
      </div>
      <div class="hc-addr">${esc(h.addrZh)}<br><span style="color:var(--ink-faint);font-size:12.5px">${esc(h.addrEn)}</span></div>
      <div class="hc-tips">${esc(h.tips)}</div>
      <div class="btnrow">
        <button class="abtn primary" onclick="copyAddr(${i})">複製英文地址</button>
        <a class="abtn" target="_blank" rel="noopener" href="${mapUrl(h.mapq)}">導航</a>
        ${h.tel ? `<a class="abtn" href="tel:${h.tel}">電話</a>` : ""}
      </div>
    </div>`).join("");

  const rsv = DATA.reservations.map(r => `
    <div class="card rsv-card">
      <div class="rc-body">
        <div class="rc-title">${esc(r.title)} ${r.urgent ? '<span class="badge red">需預訂</span>' : '<span class="badge gold">選配</span>'}</div>
        <div class="rc-meta">時間：${esc(r.when)}</div>
        <div class="rc-meta">預訂：${esc(r.how)}</div>
      </div>
    </div>`).join("");

  const ochips = [["sec-fl", "機票"], ["sec-ho", "住宿"], ["sec-rs", "體驗預訂"]]
    .map(c => `<button class="chip" onclick="jumpTo('${c[0]}')">${c[1]}</button>`).join("");

  $("#page-orders").innerHTML = `
    <div class="page-head"><span class="eyebrow">TICKETS & STAYS</span><h1>航班與住宿</h1><p>航班、住宿與預訂，都放在一起。</p></div>
    <div class="chipnav">${ochips}</div>
    <div class="section-title" id="sec-fl">航班</div>${flights}
    <div class="section-title" id="sec-ho">住宿 · 已確認</div>${hotels}
    <div class="section-title" id="sec-rs">體驗預訂</div>${rsv}
    <div class="card" style="background:var(--blue-soft)">
      <div style="font-size:14px;color:var(--blue-deep)"><b>原始訂單截圖不放在網站內。</b>請到家族群組置頂訊息查看，出發前請先下載到手機相簿，避免現場網路差。</div>
    </div>`;
}
window.savePnr = (k, v) => { store.set(k, v.trim().toUpperCase()); toast("訂位代碼已儲存在這支手機"); };

/* ===== LIST ===== */
let listMode = 0;
function renderList() {
  let body = "";
  if (listMode === 0) {
    const all = DATA.checklist.flatMap(g => g.items);
    const done = all.filter(it => store.get("chk_" + it.id, false)).length;
    body = `
      <div class="prog-line"><span>出發前完成這些就安心了</span><span><b>${done}</b> / ${all.length}</span></div>
      <div class="mini-progress" style="margin:0 4px 14px"><div style="width:${Math.round(done / all.length * 100)}%"></div></div>
      ${DATA.checklist.map(g => `
        <div class="chk-group"><h3>${esc(g.group)}</h3>
        ${g.items.map(it => chkRow("chk_" + it.id, it.text)).join("")}</div>`).join("")}`;
  } else {
    const { date } = bkkNow();
    const key = "daily_" + date;
    const done = DATA.dailyCheck.filter(it => store.get(key + "_" + it.id, false)).length;
    body = `
      <div class="prog-line"><span>每天出門前 30 秒檢查（${date.slice(5).replace("-", "/")}）</span><span><b>${done}</b> / ${DATA.dailyCheck.length}</span></div>
      <div class="daily-note">每天自動重置，勾選只存在自己手機</div>
      ${DATA.dailyCheck.map(it => chkRow(key + "_" + it.id, it.text)).join("")}
      ${done > 0 ? `<button class="abtn" style="margin-top:6px" onclick="resetDaily()">一鍵全部清掉，重新檢查</button>` : ""}`;
  }
  $("#page-list").innerHTML = `
    <div class="page-head"><span class="eyebrow">READY TO GO</span><h1>出發清單</h1><p>勾選會保存在這台手機，慢慢準備就好。</p></div>
    <div class="seg">
      <button class="${listMode === 0 ? "sel" : ""}" onclick="setListMode(0)">行前準備</button>
      <button class="${listMode === 1 ? "sel" : ""}" onclick="setListMode(1)">每日出門</button>
    </div>${body}`;
}
function chkRow(key, text) {
  const v = store.get(key, false);
  return `<button type="button" class="chk ${v ? "done" : ""}" role="checkbox" data-check-key="${key}" aria-checked="${v}" onclick="toggleChk('${key}')">
    <span class="box" aria-hidden="true">${v ? "✓" : ""}</span><span class="txt">${esc(text)}</span></button>`;
}
window.setListMode = m => { listMode = m; renderList(); };
window.toggleChk = k => {
  const y = window.scrollY;
  store.set(k, !store.get(k, false));
  renderList();
  const item = [...document.querySelectorAll("[data-check-key]")].find(el => el.dataset.checkKey === k);
  if (item) item.focus({ preventScroll: true });
  window.scrollTo(0, y);
  if ($("#page-home").classList.contains("active")) renderHome();
};
window.resetDaily = () => {
  const { date } = bkkNow();
  const key = "daily_" + date;
  DATA.dailyCheck.forEach(it => store.set(key + "_" + it.id, false));
  renderList();
};

/* ===== INFO ===== */
const SPEAKER = SVG('<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.2 6a8.5 8.5 0 0 1 0 12"/>');

function speakThai(i) {
  const p = DATA.phrases[i];
  if (!("speechSynthesis" in window)) { toast("此裝置不支援語音"); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(p.speak);
    u.lang = "th-TH"; u.rate = 0.85;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("th"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { toast("此裝置不支援泰語語音"); }
}
window.speakThai = speakThai;
if ("speechSynthesis" in window) speechSynthesis.getVoices();

function massageRow(m) {
  return `<div class="mas">
    <div style="flex:1;min-width:0"><div class="mn">${esc(m.name)}</div><div class="md">${esc(m.desc)}</div></div>
    <a class="mapbtn" target="_blank" rel="noopener" href="${mapUrl(m.mapq)}">地圖</a>
  </div>`;
}

function expRender() {
  const arr = store.get("expenses", []);
  const rate = DATA.money.rate;
  const total = arr.reduce((s, e) => s + e.a, 0);
  const rows = arr.map((e, i) => `
    <div class="exp-row">
      <span class="xn">${esc(e.n)}</span>
      <span style="font-weight:600">${e.a.toLocaleString()} ฿</span>
      <button class="exp-del" onclick="delExpense(${i})" aria-label="刪除">✕</button>
    </div>`).join("");
  return `
    ${arr.length ? rows : `<div style="font-size:14px;color:var(--ink-faint);padding:6px 0">還沒有記帳，買了什麼記一筆</div>`}
    ${arr.length ? `<div class="exp-total">合計 ${total.toLocaleString()} 泰銖 ≈ TWD ${Math.round(total * rate).toLocaleString()}</div>` : ""}
    <div class="exp-form">
      <input id="exp-name" placeholder="項目（例：按摩）" maxlength="20">
      <input id="exp-amt" type="number" inputmode="decimal" placeholder="泰銖">
      <button class="abtn primary" style="flex:0 0 auto;padding:9px 18px" onclick="addExpense()">記一筆</button>
    </div>`;
}
window.addExpense = () => {
  const n = $("#exp-name").value.trim();
  const a = parseFloat($("#exp-amt").value);
  if (!n || !(a > 0)) { toast("請輸入項目和金額"); return; }
  const arr = store.get("expenses", []);
  arr.push({ n, a });
  store.set("expenses", arr);
  const y = window.scrollY; renderInfo(); window.scrollTo(0, y);
  toast("已記下（只存在這支手機）");
};
window.delExpense = i => {
  const arr = store.get("expenses", []);
  arr.splice(i, 1);
  store.set("expenses", arr);
  const y = window.scrollY; renderInfo(); window.scrollTo(0, y);
};

function renderInfo() {
  const primary = [
    { tel: "191", lbl: "警察", cls: "t-red" },
    { tel: "1155", lbl: "觀光警察", cls: "t-orange" },
    { tel: "1669", lbl: "救護車", cls: "t-green" }
  ].map(t => `<a class="tel-big ${t.cls}" href="tel:${t.tel}"><span class="num">${t.tel}</span><span class="lbl">${t.lbl}</span></a>`).join("");

  const rest = DATA.emergency.slice(3).map(e => `
    <div class="tel-row">
      <span>${esc(e.name)}${e.note ? `<div style="font-size:12px;color:var(--ink-faint)">${esc(e.note)}</div>` : ""}</span>
      <a href="tel:${e.tel.replace(/[^+\d]/g, "")}">${esc(e.tel)}</a>
    </div>`).join("");

  const phrases = DATA.phrases.map((p, i) => `
    <div class="phrase">
      <div style="flex:1;min-width:0">
        <div class="pz">${esc(p.zh)}${p.note ? ` <span class="pn">${esc(p.note)}</span>` : ""}</div>
        <div class="pth">${esc(p.thai)}</div>
        <div class="pr">${esc(p.roman)}</div>
      </div>
      <button class="speak" onclick="speakThai(${i})" aria-label="播放發音">${SPEAKER}</button>
    </div>`).join("");

  const fxRows = [100, 500, 1000, 2000].map(thb =>
    `<div class="fx"><div class="thb">${thb.toLocaleString()} ฿</div><div class="twd">≈ ${Math.round(thb * DATA.money.rate).toLocaleString()} 元</div></div>`).join("");

  const tipRows = DATA.money.tipping.map(r => `<tr><td>${esc(r.item)}</td><td>${esc(r.amt)}</td></tr>`).join("");
  const paid = DATA.budget.paid.map(r => `<tr><td>${esc(r.item)}</td><td>${esc(r.amt)}</td></tr>`).join("");
  const est = DATA.budget.est.map(r => `<tr><td>${esc(r.item)}</td><td>${esc(r.amt)}</td></tr>`).join("");

  const chips = [
    ["sec-tel", "緊急電話"], ["sec-phrases", "常用泰語"], ["sec-money", "小費匯率"],
    ["sec-massage", "按摩"], ["sec-scam", "防雷"], ["sec-budget", "預算記帳"]
  ].map(c => `<button class="chip" onclick="jumpTo('${c[0]}')">${c[1]}</button>`).join("");

  $("#page-info").innerHTML = `
    <div class="page-head"><span class="eyebrow">THE TRAVEL ESSENTIALS</span><h1>旅行工具</h1><p>常用泰語、小費匯率與緊急聯絡。</p></div>
    <div class="chipnav">${chips}</div>

    <div class="section-title" id="sec-tel">緊急電話（點了直接撥）</div>
    <div class="tel-primary">${primary}</div>
    <div class="card" style="margin-top:10px">${rest}</div>

    <div class="section-title" id="sec-phrases">常用泰語 <span class="st-hint">點喇叭聽發音，泰文可直接秀給對方看</span></div>
    <div class="card">${phrases}</div>

    <div class="section-title" id="sec-money">小費與匯率</div>
    <div class="card">
      <table class="btable">${tipRows}</table>
      <div style="font-size:13px;color:var(--ink-faint);margin-top:6px">${esc(DATA.money.tipNote)}</div>
      <div class="fxgrid" style="margin-top:14px">${fxRows}</div>
      <div class="conv">
        <input id="conv-thb" type="number" inputmode="decimal" placeholder="輸入泰銖金額" oninput="convThb(this.value)">
        <span class="conv-out" id="conv-out">≈ TWD —</span>
      </div>
      <div style="font-size:13px;color:var(--ink-faint);margin-top:8px">${esc(DATA.money.fxNote)}</div>
    </div>

    <div class="section-title" id="sec-massage">按摩口袋名單</div>
    <div class="card">
      <div class="mas-city" style="color:var(--green)">清邁</div>
      ${DATA.massage.cm.map(massageRow).join("")}
      <div class="mas-city" style="color:var(--orange);margin-top:14px">曼谷</div>
      ${DATA.massage.bkk.map(massageRow).join("")}
    </div>

    <div class="section-title" id="sec-scam">防雷提醒</div>
    <div class="card">${DATA.scams.map(s => `<div class="scam">${esc(s)}</div>`).join("")}</div>

    <div class="section-title">實用小知識</div>
    <div class="card">${DATA.tips.map(t => `<div class="tip"><div class="tt">${esc(t.title)}</div><div class="tx">${esc(t.text)}</div></div>`).join("")}</div>

    <div class="section-title" id="sec-budget">預算與記帳</div>
    <div class="card">
      <div class="sub-label">已付（台灣出發前）</div>
      <table class="btable">${paid}<tr class="total"><td>合計</td><td>${esc(DATA.budget.paidTotal)}</td></tr></table>
      <div class="sub-label" style="margin-top:16px">當地花費預估（4 人）</div>
      <table class="btable">${est}</table>
      <div class="bnote">${esc(DATA.budget.estNote)}</div>
    </div>
    <div class="card">
      <div class="sub-label">旅途記帳<span style="font-weight:400;letter-spacing:0">（只存在自己手機，記個大概）</span></div>
      <div id="exp-area">${expRender()}</div>
    </div>

    <div style="text-align:center;margin:22px 0 6px">
      <button class="abtn" style="display:inline-flex;width:auto;padding:9px 20px" onclick="if(confirm('登出後這台裝置下次要重新輸入密碼，確定？'))forgetDevice()">登出 · 忘記此裝置</button>
    </div>
    <div style="text-align:center;color:var(--ink-faint);font-size:12.5px;margin:8px 0 10px">
      清邁與曼谷 · 2026 家族旅行手冊 · 內容更新於 ${esc(DATA.updated)}
    </div>`;
}
window.jumpTo = id => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
window.convThb = v => {
  const n = parseFloat(v);
  $("#conv-out").textContent = n > 0 ? "≈ TWD " + Math.round(n * DATA.money.rate).toLocaleString() : "≈ TWD —";
};

/* ===== 旅途工具：共用面板控制器 =====
   一次只開一個面板；開啟時背景 inert + 鎖捲動，返回鍵先關面板留在原分頁。 */
let activePanel = null;   // "food" | "toilet" | "todo"
let panelOpener = null;

function openPanel(kind, render) {
  if (activePanel === kind) { render(); return; }
  if (activePanel) closePanelDom();
  panelOpener = document.activeElement;
  activePanel = kind;
  const s = document.getElementById(kind + "sheet");
  if (s) s.hidden = false;
  document.getElementById("app").inert = true;
  document.getElementById("tabbar").inert = true;
  document.body.style.overflow = "hidden";
  history.pushState({ panel: kind }, "");   // 讓手機返回鍵先關面板
  render();
}
function closePanelDom() {
  if (!activePanel) return;
  const s = document.getElementById(activePanel + "sheet");
  if (s) s.hidden = true;
  activePanel = null;
  document.body.style.overflow = "";
  document.getElementById("app").inert = false;
  document.getElementById("tabbar").inert = false;
  if (panelOpener && panelOpener.isConnected) panelOpener.focus({ preventScroll: true });
}
// 由使用者操作（關閉鈕／背景／Esc）觸發：走 history.back → popstate → closePanelDom（單一收斂路徑）
window.closePanel = function () {
  if (!activePanel) return;
  if (history.state && history.state.panel) history.back();
  else closePanelDom();
};

/* ===== 旅途工具選單（收合鈕 + 展開選項） ===== */
let toolsOpen = false;
function openTools() {
  const fab = document.getElementById("tm-fab"), opts = document.getElementById("tm-options");
  if (!fab || !opts) return;
  toolsOpen = true;
  opts.hidden = false;
  fab.setAttribute("aria-expanded", "true");
  let scrim = document.getElementById("tm-scrim");
  if (!scrim) {
    scrim = document.createElement("div");
    scrim.id = "tm-scrim";
    scrim.addEventListener("click", closeTools);
    document.body.appendChild(scrim);
  }
  scrim.hidden = false;
}
function closeTools() {
  toolsOpen = false;
  const fab = document.getElementById("tm-fab"), opts = document.getElementById("tm-options"), scrim = document.getElementById("tm-scrim");
  if (opts) opts.hidden = true;
  if (fab) fab.setAttribute("aria-expanded", "false");
  if (scrim) scrim.hidden = true;
}
window.closeTools = closeTools;
window.toggleTools = function () { toolsOpen ? closeTools() : openTools(); };
window.toolPick = function (kind) {
  closeTools();                       // 先收合選單，再開面板
  if (kind === "food") openFood();
  else if (kind === "toilet") openToilet();
  else if (kind === "todo") openTodo();
};

/* ===== 距離工具（美食與廁所共用） ===== */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function fmtDist(m) {
  if (m < 1000) return Math.round(m) + "m · 步行約 " + Math.max(1, Math.ceil(m / 75)) + " 分";
  const km = m / 1000;
  return (km < 10 ? km.toFixed(1) : Math.round(km)) + "km · 車程約 " + Math.max(2, Math.ceil(km / 20 * 60)) + " 分";
}
const inThailand = (lat, lng) => lat > 5.5 && lat < 20.6 && lng > 97.2 && lng < 105.8;

// 依目前選取日的城市決定預設參考中心（曼谷日→Wyndham(3)，其餘→清邁飯店(0)）
function defaultCenterIdx() {
  const { date } = bkkNow();
  const day = $("#page-plan").classList.contains("active") ? DATA.days[selDay] : DATA.days.find(d => d.date === date);
  return (day && day.cityClass === "bkk") ? 3 : 0;
}

/* ===== 附近美食 ===== */
let foodState = { center: null, centerIdx: null, city: "all", note: "" };
let foodList = [];
let foodDay = null;

function ensureFoodSheet() {
  let sheet = document.getElementById("foodsheet");
  if (sheet) return sheet;
  sheet = document.createElement("div");
  sheet.id = "foodsheet";
  sheet.hidden = true;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e => {
    const cp = e.target.closest("[data-copyaddr]");
    if (cp) { copyText(foodList[+cp.dataset.copyaddr].addr, "地址已複製，貼到 Grab／Bolt 就能叫車"); return; }
    if (e.target === sheet) closePanel();
  });
  return sheet;
}
window.openFood = function () {
  ensureFoodSheet();
  const selectedDate = DATA.days[selDay].date;
  if (foodState.centerIdx === null || foodDay !== selectedDate) {
    setFoodCenterIdx(defaultCenterIdx(), true);
    foodDay = selectedDate;
  }
  openPanel("food", renderFood);
};
function tryLocateFood() {
  if (!("geolocation" in navigator)) { foodState.note = "此裝置不支援定位，已切換為參考地點"; renderFood(); return; }
  foodState.note = "定位中…（拒絕或逾時會自動用參考地點）";
  renderFood();
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    if (inThailand(lat, lng)) {
      foodState.center = { label: "目前位置", lat, lng };
      foodState.centerIdx = -2;
      foodState.city = lat > 16 ? "cm" : "bkk";
      foodState.note = "";
    } else {
      foodState.note = "目前未定位於泰國，已為你切換為參考地點";
    }
    renderFood();
  }, () => {
    foodState.note = "未取得定位權限，已為你切換為參考地點";
    renderFood();
  }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 });
}
window.relocateFood = () => { tryLocateFood(); };
window.setFoodCenterIdx = (i, silent) => {
  foodState.centerIdx = i;
  foodState.center = DATA.foodCenters[i];
  foodState.city = DATA.foodCenters[i].city;
  foodState.note = "";
  if (!silent) renderFood();
};
window.setFoodCity = c => { foodState.city = c; renderFood(); };

function renderFood() {
  const sheet = document.getElementById("foodsheet");
  if (!sheet || sheet.hidden) return;
  const focused = sheet.contains(document.activeElement) ? document.activeElement.getAttribute("onclick") : null;
  const st = foodState, c = st.center;
  foodList = DATA.food
    .filter(f => st.city === "all" || f.city === st.city)
    .map(f => Object.assign({}, f, { dist: haversineM(c.lat, c.lng, f.lat, f.lng) }))
    .sort((a, b) => a.dist - b.dist);

  const chips = [
    `<button class="chip ${st.centerIdx === -2 ? "on" : ""}" onclick="relocateFood()">${st.centerIdx === -2 ? "目前位置" : "用我的位置"}</button>`,
    ...DATA.foodCenters.map((cc, i) => `<button class="chip ${st.centerIdx === i ? "on" : ""}" onclick="setFoodCenterIdx(${i})">${esc(cc.label)}</button>`)
  ].join("");

  const cards = foodList.map((f, i) => `
    <div class="fcard">
      <div class="fc-top"><span class="fc-name">${esc(f.name)}</span><span class="fc-dist">${fmtDist(f.dist)}</span></div>
      <div class="fc-type"><span class="badge ${f.city}">${f.city === "cm" ? "清邁" : "曼谷"}</span> <span class="badge gold">${esc(f.type)}</span></div>
      <div class="fc-dishes"><b>必點</b>${esc(f.dishes)}</div>
      <div class="fc-addr">${esc(f.addr)}</div>
      <div class="btnrow">
        <a class="abtn primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}">Google Maps 導航</a>
        <button class="abtn" data-copyaddr="${i}">複製地址</button>
      </div>
    </div>`).join("");

  sheet.innerHTML = `
    <div class="fs-panel" role="dialog" aria-modal="true" aria-label="附近美食">
      <div class="fs-head">
        <div><span class="eyebrow">GOOD FOOD, GOOD MOOD</span><div class="fs-title">附近，有什麼好吃的？</div></div>
        <button class="fs-close" onclick="closePanel()" aria-label="關閉">✕</button>
      </div>
      ${st.note ? `<div class="fs-note">${esc(st.note)}</div>` : ""}
      <div class="fs-center">距離基準：<b>${esc(c.label)}</b></div>
      <div class="fs-chips">${chips}</div>
      <div class="seg fs-seg">
        <button class="${st.city === "all" ? "sel" : ""}" onclick="setFoodCity('all')">全部 ${DATA.food.length}</button>
        <button class="${st.city === "cm" ? "sel" : ""}" onclick="setFoodCity('cm')">清邁</button>
        <button class="${st.city === "bkk" ? "sel" : ""}" onclick="setFoodCity('bkk')">曼谷</button>
      </div>
      <div class="fs-list">${cards || '<div class="card">這個城市還沒有美食資料，試試其他城市。</div>'}</div>
    </div>`;
  const nextFocus = focused && [...sheet.querySelectorAll("button[onclick]")].find(el => el.getAttribute("onclick") === focused);
  (nextFocus || sheet.querySelector(".fs-close")).focus({ preventScroll: true });
}

/* ===== 附近廁所（互動完全比照美食） ===== */
let toiletState = { center: null, centerIdx: null, city: "all", cat: "all", note: "" };
let toiletList = [];
let toiletDay = null;

// 把 Sheet 的細分類別歸併成少數幾組，讓 chip 篩選好用；未知類別歸「其他」。
const TOILET_GROUPS = [
  ["寺廟古蹟", /寺|佛|古蹟/],
  ["夜市市集", /夜市|市集|市場/],
  ["商場百貨", /百貨|商場|賣場|超市|量販|購物/],
  ["飯店大廳", /飯店|酒店|公寓|大廳/],
  ["交通站", /捷運|地鐵|碼頭|機場|車站/],
  ["餐廳咖啡", /餐廳|咖啡|速食|加油|超商/],
  ["公園景點", /公園|文創|景觀|藝術/]
];
function toiletGroup(cat) {
  cat = cat || "";
  for (const [name, re] of TOILET_GROUPS) if (re.test(cat)) return name;
  return "其他";
}

function ensureToiletSheet() {
  let sheet = document.getElementById("toiletsheet");
  if (sheet) return sheet;
  sheet = document.createElement("div");
  sheet.id = "toiletsheet";
  sheet.hidden = true;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e => {
    const cp = e.target.closest("[data-copyaddr]");
    if (cp) { const t = toiletList[+cp.dataset.copyaddr]; if (t && t.addr) copyText(t.addr, "地址已複製，貼到 Grab／Bolt 就能叫車"); return; }
    if (e.target === sheet) closePanel();
  });
  return sheet;
}
window.openToilet = function () {
  ensureToiletSheet();
  const selectedDate = DATA.days[selDay].date;
  if (toiletState.centerIdx === null || toiletDay !== selectedDate) {
    setToiletCenterIdx(defaultCenterIdx(), true);
    toiletDay = selectedDate;
  }
  openPanel("toilet", renderToilet);
};
function tryLocateToilet() {
  if (!("geolocation" in navigator)) { toiletState.note = "此裝置不支援定位，已切換為參考地點"; renderToilet(); return; }
  toiletState.note = "定位中…（拒絕或逾時會自動用參考地點）";
  renderToilet();
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    if (inThailand(lat, lng)) {
      toiletState.center = { label: "目前位置", lat, lng };
      toiletState.centerIdx = -2;
      toiletState.city = lat > 16 ? "cm" : "bkk";
      toiletState.cat = "all";
      toiletState.note = "";
    } else {
      toiletState.note = "目前未定位於泰國，已為你切換為參考地點";
    }
    renderToilet();
  }, () => {
    toiletState.note = "未取得定位權限，已為你切換為參考地點";
    renderToilet();
  }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 });
}
window.relocateToilet = () => { tryLocateToilet(); };
window.setToiletCenterIdx = (i, silent) => {
  toiletState.centerIdx = i;
  toiletState.center = DATA.foodCenters[i];
  toiletState.city = DATA.foodCenters[i].city;
  toiletState.cat = "all";
  toiletState.note = "";
  if (!silent) renderToilet();
};
window.setToiletCity = c => { toiletState.city = c; toiletState.cat = "all"; renderToilet(); };
window.setToiletCat = g => { toiletState.cat = g; renderToilet(); };

function renderToilet() {
  const sheet = document.getElementById("toiletsheet");
  if (!sheet || sheet.hidden) return;
  const focused = sheet.contains(document.activeElement) ? document.activeElement.getAttribute("onclick") : null;
  const st = toiletState, c = st.center;
  const toilets = (DATA.toilets || []);

  const cityList = toilets.filter(t => st.city === "all" || t.city === st.city);
  // 類別 chip：只列出目前城市範圍內存在的組別，依固定優先序排列
  const present = cityList.map(t => toiletGroup(t.cat));
  const groups = [...TOILET_GROUPS.map(g => g[0]), "其他"].filter(g => present.includes(g));
  if (!groups.includes(st.cat)) st.cat = "all";  // 城市切換後若原組別不存在則退回全部

  toiletList = cityList
    .filter(t => st.cat === "all" || toiletGroup(t.cat) === st.cat)
    .map(t => Object.assign({}, t, { dist: haversineM(c.lat, c.lng, t.lat, t.lng) }))
    .sort((a, b) => a.dist - b.dist);

  const chips = [
    `<button class="chip ${st.centerIdx === -2 ? "on" : ""}" onclick="relocateToilet()">${st.centerIdx === -2 ? "目前位置" : "用我的位置"}</button>`,
    ...DATA.foodCenters.map((cc, i) => `<button class="chip ${st.centerIdx === i ? "on" : ""}" onclick="setToiletCenterIdx(${i})">${esc(cc.label)}</button>`)
  ].join("");

  const catChips = groups.length ? [
    `<button class="chip ${st.cat === "all" ? "on" : ""}" onclick="setToiletCat('all')">全部類別</button>`,
    ...groups.map(g => `<button class="chip ${st.cat === g ? "on" : ""}" onclick="setToiletCat('${g}')">${esc(g)}</button>`)
  ].join("") : "";

  const cards = toiletList.map((t, i) => {
    const meta = [t.fee, t.hours].filter(Boolean).join(" · ");
    const where = [t.area, t.addr].filter(Boolean).join(" · ");
    return `
    <div class="fcard">
      <div class="fc-top"><span class="fc-name">${esc(t.name)}</span><span class="fc-dist">${fmtDist(t.dist)}</span></div>
      <div class="fc-type"><span class="badge ${t.city}">${t.city === "cm" ? "清邁" : "曼谷"}</span> <span class="badge gold">${esc(t.cat || "公廁")}</span></div>
      ${meta ? `<div class="fc-meta">${esc(meta)}</div>` : ""}
      ${t.note ? `<div class="fc-dishes"><b>位置</b>${esc(t.note)}</div>` : ""}
      ${where ? `<div class="fc-addr">${esc(where)}</div>` : ""}
      <div class="btnrow">
        <a class="abtn primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}">Google Maps 導航</a>
        ${t.addr ? `<button class="abtn" data-copyaddr="${i}">複製地址</button>` : ""}
      </div>
    </div>`;
  }).join("");

  sheet.innerHTML = `
    <div class="fs-panel" role="dialog" aria-modal="true" aria-label="附近廁所">
      <div class="fs-head">
        <div><span class="eyebrow">WHEN YOU GOTTA GO</span><div class="fs-title">附近，哪裡有廁所？</div></div>
        <button class="fs-close" onclick="closePanel()" aria-label="關閉">✕</button>
      </div>
      ${st.note ? `<div class="fs-note">${esc(st.note)}</div>` : ""}
      <div class="fs-center">距離基準：<b>${esc(c.label)}</b></div>
      <div class="fs-chips">${chips}</div>
      <div class="seg fs-seg">
        <button class="${st.city === "all" ? "sel" : ""}" onclick="setToiletCity('all')">全部 ${toilets.length}</button>
        <button class="${st.city === "cm" ? "sel" : ""}" onclick="setToiletCity('cm')">清邁</button>
        <button class="${st.city === "bkk" ? "sel" : ""}" onclick="setToiletCity('bkk')">曼谷</button>
      </div>
      ${catChips ? `<div class="fs-chips fs-catchips">${catChips}</div>` : ""}
      <div class="fs-list">${cards || '<div class="card">這個範圍還沒整理廁所資料。</div>'}</div>
    </div>`;
  const nextFocus = focused && [...sheet.querySelectorAll("button[onclick]")].find(el => el.getAttribute("onclick") === focused);
  (nextFocus || sheet.querySelector(".fs-close")).focus({ preventScroll: true });
}

/* ===== 每日待辦（Sheet 定義事項 + 各裝置 localStorage 勾選） ===== */
let todoData = null;   // 來自 Sheet「待辦」分頁；未載入為 null
function todoKey(dayLabel, it) { return "todo_" + dayLabel + "_" + (it.code || it.text); }

function ensureTodoSheet() {
  let sheet = document.getElementById("todosheet");
  if (sheet) return sheet;
  sheet = document.createElement("div");
  sheet.id = "todosheet";
  sheet.hidden = true;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e => {
    const chk = e.target.closest("[data-todokey]");
    if (chk) { const k = chk.getAttribute("data-todokey"); store.set(k, !store.get(k, false)); renderTodo(); return; }
    if (e.target === sheet) closePanel();
  });
  return sheet;
}
window.openTodo = function () {
  ensureTodoSheet();
  openPanel("todo", renderTodo);
};

function renderTodo() {
  const sheet = document.getElementById("todosheet");
  if (!sheet || sheet.hidden) return;
  const focusedKey = sheet.contains(document.activeElement) ? document.activeElement.getAttribute("data-todokey") : null;
  const wasClose = sheet.contains(document.activeElement) && document.activeElement.classList.contains("fs-close");
  const day = DATA.days[selDay];
  const md = day.date.slice(5).replace("-", "/");
  const items = (todoData || []).filter(t => t.day === day.label);
  const done = items.filter(it => store.get(todoKey(day.label, it), false)).length;

  const rows = items.map(it => {
    const key = todoKey(day.label, it);
    const v = store.get(key, false);
    return `<button type="button" class="chk todo-chk ${v ? "done" : ""}" role="checkbox" aria-checked="${v}" data-todokey="${esc(key)}">
      <span class="box" aria-hidden="true">${v ? "✓" : ""}</span>
      <span class="txt">${esc(it.text)}${it.note ? `<small class="todo-note">${esc(it.note)}</small>` : ""}</span></button>`;
  }).join("");

  sheet.innerHTML = `
    <div class="fs-panel" role="dialog" aria-modal="true" aria-label="每日待辦">
      <div class="fs-head">
        <div><span class="eyebrow">TODAY'S TO-DO</span><div class="fs-title">${esc(md)} 待辦</div></div>
        <button class="fs-close" onclick="closePanel()" aria-label="關閉">✕</button>
      </div>
      ${items.length ? `<div class="fs-center prog-line td-prog"><span>已完成</span><span><b>${done}</b> / ${items.length}</span></div>` : ""}
      <div class="fs-list td-list">${items.length ? rows : '<div class="card">這一天沒有待辦事項。</div>'}</div>
    </div>`;
  let nextFocus = null;
  if (focusedKey) nextFocus = [...sheet.querySelectorAll("[data-todokey]")].find(el => el.getAttribute("data-todokey") === focusedKey);
  if (!nextFocus && !wasClose) nextFocus = sheet.querySelector("[data-todokey]");
  (nextFocus || sheet.querySelector(".fs-close")).focus({ preventScroll: true });
}

/* ===== 面板共同：焦點陷阱 + Esc；選單 Esc ===== */
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && toolsOpen && !activePanel) { e.preventDefault(); closeTools(); return; }
  const sheet = activePanel ? document.getElementById(activePanel + "sheet") : null;
  if (!sheet || sheet.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); closePanel(); return; }
  if (e.key !== "Tab") return;
  const items = [...sheet.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(el => !el.disabled);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

document.addEventListener("click", e => {
  const button = e.target.closest("[data-place]");
  if (button) copyTxt(button.dataset.place);
});

/* ===== router ===== */
const PAGES = { home: renderHome, plan: renderPlan, orders: renderOrders, list: renderList, info: renderInfo };
const pageScroll = {};
const pageDetails = {};
function go(tab, arg, fromHistory = false) {
  if (!PAGES[tab]) tab = "home";
  if (toolsOpen) closeTools();   // 切換分頁時收合旅途工具選單
  const oldPage = document.querySelector(".page.active");
  if (oldPage) {
    const oldTab = oldPage.id.slice(5);
    pageScroll[oldTab] = window.scrollY;
    pageDetails[oldTab] = [...oldPage.querySelectorAll("details")].map(el => el.open);
  }
  if (oldPage && oldPage.id === "page-" + tab && arg === undefined && !fromHistory) return;
  if (tab === "plan" && typeof arg === "number") selDay = arg;
  if (tab === "list" && typeof arg === "number") listMode = arg;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll("#tabbar .tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tab);
    if (t.dataset.tab === tab) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
  });
  $("#page-" + tab).classList.add("active");
  PAGES[tab]();
  if (arg === undefined && pageDetails[tab]) {
    document.querySelectorAll("#page-" + tab + " details").forEach((el, i) => { el.open = !!pageDetails[tab][i]; });
  }
  if (typeof arg === "string" && document.getElementById(arg)) {
    document.getElementById(arg).scrollIntoView({ block: "start" });
  } else {
    window.scrollTo({ top: arg === undefined ? (pageScroll[tab] || 0) : 0 });
  }
  if (!fromHistory && location.hash !== "#" + tab) history.pushState(null, "", "#" + tab);
}
window.go = go;
window.addEventListener("popstate", () => {
  if (activePanel) { closePanelDom(); return; }   // 返回鍵先關面板、留在原分頁
  closeTools();
  go(location.hash.slice(1), undefined, true);
});
document.querySelectorAll("#tabbar .tab").forEach(t => t.addEventListener("click", () => go(t.dataset.tab)));

/* ===== Google Sheet 同步 ===== */
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") {}
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// 解析單一天分頁。一般列＝行程點；「時間」欄填 提醒/雨備/標題 的列＝當日欄位（不算行程點）
// 回傳 { events, note, rain, title }
const DAY_FIELD = { "提醒": "note", "提醒事項": "note", "雨備": "rain", "雨天備案": "rain", "標題": "title", "當日標題": "title" };
function parseDayTab(text) {
  const rows = parseCSV(text);
  if (!rows.length) return null;
  const head = rows[0].map(h => h.trim());
  if (head[0] !== "時間") return null; // 防呆：分頁不存在時 gviz 會退回第一頁，擋掉
  const ci = { time: head.indexOf("時間"), title: head.indexOf("標題"), desc: head.indexOf("說明"), mapq: head.indexOf("地圖關鍵字"), cost: head.indexOf("費用"), warn: head.indexOf("注意") };
  const padTime = t => /^\d:\d\d/.test(t) ? "0" + t : t;
  const out = { events: [] };
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; if (!row) continue;
    const time = (row[ci.time] || "").trim();
    const title = (row[ci.title] || "").trim();
    const desc = (row[ci.desc] || "").trim();
    if (DAY_FIELD[time]) { // 特殊列：當日欄位
      const val = [title, desc].filter(Boolean).join("");
      if (val) out[DAY_FIELD[time]] = val;
      continue;
    }
    if (!title) continue;
    const ev = { time: padTime(time), title, desc };
    const mq = ci.mapq >= 0 ? (row[ci.mapq] || "").trim() : ""; if (mq) ev.mapq = mq;
    const cost = ci.cost >= 0 ? (row[ci.cost] || "").trim() : ""; if (cost) ev.cost = cost;
    const warn = ci.warn >= 0 ? (row[ci.warn] || "").trim() : ""; if (warn) ev.warn = warn;
    out.events.push(ev);
  }
  return out;
}

// 解析美食試算表（自動尋找表頭列，容忍前置空白列）
function parseFoodSheet(text) {
  const rows = parseCSV(text);
  let hi = -1;
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const cells = rows[r].map(c => c.trim());
    if (cells.includes("店名") && cells.includes("緯度")) { hi = r; break; }
  }
  if (hi < 0) return null; // 防呆：讀到的不是美食表就放棄
  const head = rows[hi].map(h => h.trim());
  const ci = { city: head.indexOf("城市代碼"), name: head.indexOf("店名"), type: head.indexOf("分類"), dishes: head.indexOf("必點推薦"), lat: head.indexOf("緯度"), lng: head.indexOf("經度"), addr: head.indexOf("地址") };
  const out = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r]; if (!row) continue;
    const name = (row[ci.name] || "").trim();
    const lat = parseFloat(row[ci.lat]), lng = parseFloat(row[ci.lng]);
    if (!name || !isFinite(lat) || !isFinite(lng)) continue; // 跳過缺店名或座標錯的列
    out.push({
      city: (row[ci.city] || "").trim().toLowerCase() === "bkk" ? "bkk" : "cm",
      name, lat, lng,
      type: ci.type >= 0 ? (row[ci.type] || "").trim() : "",
      dishes: ci.dishes >= 0 ? (row[ci.dishes] || "").trim() : "",
      addr: ci.addr >= 0 ? (row[ci.addr] || "").trim() : ""
    });
  }
  return out.length ? out : null;
}

// 解析「廁所」分頁（表頭：名稱/緯度/經度 必填，其餘選填；缺城市代碼以緯度推斷）
function parseToiletSheet(text) {
  const rows = parseCSV(text);
  let hi = -1;
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const cells = rows[r].map(c => c.trim());
    if (cells.includes("名稱") && cells.includes("緯度")) { hi = r; break; }
  }
  if (hi < 0) return null; // 防呆：讀到的不是廁所表就放棄
  const head = rows[hi].map(h => h.trim());
  const find = names => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const ci = {
    city: find(["城市代碼"]), name: find(["名稱"]), cat: find(["類別"]), area: find(["區域"]),
    fee: find(["費用"]), hours: find(["營業/開放時間", "營業時間", "開放時間"]),
    note: find(["特點與位置備註", "備註", "特點"]), lat: find(["緯度"]), lng: find(["經度"]), addr: find(["地址"])
  };
  const get = (row, i) => i >= 0 ? (row[i] || "").trim() : "";
  const out = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r]; if (!row) continue;
    const name = get(row, ci.name);
    const lat = parseFloat(row[ci.lat]), lng = parseFloat(row[ci.lng]);
    if (!name || !isFinite(lat) || !isFinite(lng)) continue; // 跳過缺名稱或座標錯的列
    let city = get(row, ci.city).toLowerCase();
    if (city !== "cm" && city !== "bkk") city = lat > 16 ? "cm" : "bkk"; // 缺欄或缺值以緯度推斷
    out.push({ city, name, cat: get(row, ci.cat), area: get(row, ci.area), fee: get(row, ci.fee), hours: get(row, ci.hours), note: get(row, ci.note), lat, lng, addr: get(row, ci.addr) });
  }
  return out.length ? out : null;
}

// 解析「待辦」分頁（表頭：Day/事項 必填；備註/代碼 選填）
function parseTodoSheet(text) {
  const rows = parseCSV(text);
  let hi = -1;
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const cells = rows[r].map(c => c.trim());
    if (cells.includes("Day") && cells.includes("事項")) { hi = r; break; }
  }
  if (hi < 0) return null;
  const head = rows[hi].map(h => h.trim());
  const ci = { day: head.indexOf("Day"), text: head.indexOf("事項"), note: head.indexOf("備註"), code: head.indexOf("代碼") };
  const valid = new Set(DATA.days.map(d => d.label));
  const out = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r]; if (!row) continue;
    const day = (row[ci.day] || "").trim();
    const text2 = (row[ci.text] || "").trim();
    if (!day || !text2 || !valid.has(day)) continue; // 跳過缺 Day/事項 或 Day 不在 D1–D8 的列
    out.push({ day, text: text2, note: ci.note >= 0 ? (row[ci.note] || "").trim() : "", code: ci.code >= 0 ? (row[ci.code] || "").trim() : "" });
  }
  return out.length ? out : null;
}

async function refreshFromSheet() {
  if (typeof SHEET_ID === "undefined" || !SHEET_ID) return;
  const tabUrl = name => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  try {
    const jobs = DATA.days.map(async d => {
      try {
        const res = await fetch(tabUrl(d.label), { cache: "no-store" });
        if (!res.ok) return null;
        return parseDayTab(await res.text());
      } catch (e) { return null; }
    });
    // 美食清單（優先讀取主試算表的「美食」分頁，若無則嘗試獨立美食表）
    jobs.push((async () => {
      // 1. 優先嘗試主行程表的「美食」分頁
      try {
        const res = await fetch(tabUrl("美食"), { cache: "no-store" });
        if (res.ok) {
          const food = parseFoodSheet(await res.text());
          if (food && food.length) return { food };
        }
      } catch (e) {}
      // 2. 次要嘗試獨立美食表（若有設定且已共用）
      if (DATA.foodSheetId) {
        try {
          const res = await fetch(`https://docs.google.com/spreadsheets/d/${DATA.foodSheetId}/gviz/tq?tqx=out:csv`, { cache: "no-store" });
          if (res.ok) {
            const food = parseFoodSheet(await res.text());
            if (food && food.length) return { food };
          }
        } catch (e) {}
      }
      return null;
    })());
    // 廁所清單：讀多張候選分頁（「廁所」或按城市分表），合併去重後按城市覆蓋內建。
    // 注意：gviz 對不存在的分頁會退回第一頁，所以合併時必須去重。
    jobs.push((async () => {
      const tabs = ["廁所", "清邁廁所", "曼谷廁所"];
      const lists = await Promise.all(tabs.map(async name => {
        try {
          const res = await fetch(tabUrl(name), { cache: "no-store" });
          if (res.ok) return parseToiletSheet(await res.text());
        } catch (e) {}
        return null;
      }));
      const seen = new Set(); const toilets = [];
      lists.forEach(list => (list || []).forEach(t => {
        const key = t.name + "|" + t.lat + "|" + t.lng;
        if (!seen.has(key)) { seen.add(key); toilets.push(t); }
      }));
      return toilets.length ? { toilets } : null;
    })());
    // 每日待辦（主試算表的「待辦」分頁；不進加密包，靠 SW 快取離線）
    jobs.push((async () => {
      try {
        const res = await fetch(tabUrl("待辦"), { cache: "no-store" });
        if (res.ok) { const todos = parseTodoSheet(await res.text()); if (todos && todos.length) return { todos }; }
      } catch (e) {}
      return null;
    })());

    const results = await Promise.all(jobs);
    const todoRes = results.pop();
    const toiletRes = results.pop();
    const foodRes = results.pop();
    let changed = false;
    results.forEach((res, i) => {
      if (!res) return;
      if (res.events && res.events.length) { DATA.days[i].events = res.events; changed = true; }
      if (res.note) { DATA.days[i].note = res.note; changed = true; }
      if (res.rain) { DATA.days[i].rain = res.rain; changed = true; }
      if (res.title) { DATA.days[i].title = res.title; changed = true; }
    });
    if (foodRes && foodRes.food) { DATA.food = foodRes.food; changed = true; }
    if (toiletRes && toiletRes.toilets && toiletRes.toilets.length) {
      // 按城市覆蓋：Sheet 只提供某一城的資料時，另一城保留內建，不會被整包蓋掉
      const sheetCities = new Set(toiletRes.toilets.map(t => t.city));
      DATA.toilets = (DATA.toilets || []).filter(t => !sheetCities.has(t.city)).concat(toiletRes.toilets);
      changed = true;
    }
    if (todoRes && todoRes.todos) { todoData = todoRes.todos; changed = true; }
    if (changed) {
      const active = document.querySelector(".page.active");
      if (active) {
        const tab = active.id.replace("page-", "");
        if (PAGES[tab]) {
          // 資料更新時就地重繪：保留閱讀位置與已展開的詳情，不打斷目前操作
          const y = window.scrollY;
          const open = [...active.querySelectorAll("details")].map(el => el.open);
          PAGES[tab]();
          active.querySelectorAll("details").forEach((el, i) => { if (open[i] !== undefined) el.open = open[i]; });
          window.scrollTo({ top: y });
        }
      }
      // 面板開著就地重繪，不關閉、不跳動
      if (activePanel === "food") renderFood();
      else if (activePanel === "toilet") renderToilet();
      else if (activePanel === "todo") renderTodo();
    }
  } catch (e) { /* 離線或未公開：靜默使用內建資料 */ }
}

/* ===== init ===== */
let swReady = false;
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(() => { swReady = true; updateOfflineNote(); }).catch(() => {});
}
window.addEventListener("online", updateOfflineNote);
window.addEventListener("offline", updateOfflineNote);

const initTab = (location.hash || "#home").slice(1);
const ti = todayDayIndex();
if (ti >= 0) selDay = ti;
history.replaceState(null, "", "#" + (PAGES[initTab] ? initTab : "home"));
go(PAGES[initTab] ? initTab : "home", undefined, true);

refreshFromSheet();

setInterval(() => {
  const active = document.querySelector(".page.active");
  if (!active) return;
  if (active.id === "page-home" && tripPhase() === "during") renderHome();
}, 60000);
