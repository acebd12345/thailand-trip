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
  pin: SVG('<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/>')
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
function flightCardMini(f) {
  return `
    <button class="infocard" onclick="go('orders','sec-fl')">
      <div class="ic-head">${QI.plane}<span>航班資訊</span></div>
      <div class="ic-line">${f.date.slice(5).replace("-", "/")}（${esc(f.day)}）${esc(f.from.replace(/ .*/, ""))} → ${esc(f.to.replace(/ .*/, ""))}</div>
      <div class="ic-strong">${esc(f.dep)} – ${esc(f.arr)}</div>
      <div class="ic-sub">${esc(f.no)} · ${esc(f.airline)}</div>
      <div class="ic-more">查看詳情 ›</div>
    </button>`;
}
function hotelCardMini(h, withActions) {
  return `
    <div class="infocard">
      <div class="ic-head">${QI.bed}<span>住宿資訊</span></div>
      <div class="ic-strong" style="font-size:15px">${esc(h.name)}</div>
      <div class="ic-sub">${esc(h.dates)} · ${esc(h.nights)}</div>
      ${withActions ? `<div class="mini-actions">
        <button class="abtn" onclick="copyText('${esc(h.addrEn)}','英文地址已複製，上車給司機看')">複製地址</button>
        <a class="abtn" target="_blank" rel="noopener" href="${mapUrl(h.mapq)}">導航</a>
      </div>` : `<div class="ic-more" onclick="go('orders','sec-ho')">查看詳情 ›</div>`}
    </div>`;
}

function renderHome() {
  const phase = tripPhase();
  const { mins } = bkkNow();
  let html = `
    <div class="home-head">
      <h1 class="hh-title">${esc(DATA.trip.title)} <span class="hh-date">2026.9.20–27</span></h1>
      <div class="hh-sub">8 天 7 夜 · ${esc(DATA.trip.sub)}</div>
    </div>
    <div class="ob-badge" id="offline-note"><span class="dot"></span><span id="offline-text">內容更新於 ${esc(DATA.updated)}</span></div>`;

  if (phase === "before") {
    const n = daysUntil();
    const all = DATA.checklist.flatMap(g => g.items);
    const done = all.filter(it => store.get("chk_" + it.id, false)).length;
    const pct = all.length ? Math.round(done / all.length * 100) : 0;
    const undone = all.filter(it => !store.get("chk_" + it.id, false)).slice(0, 3);
    html += `
      <div class="today-card">
        <div class="tc-top">
          <div>
            <span class="tc-tag tag-orange">出發倒數</span>
            <div class="tc-d">${n}<span> 天</span></div>
          </div>
          <div class="tc-date">9/20 出發<br>週日 07:40</div>
        </div>
        <div class="tc-div"></div>
        <div class="prep-row">
          <div class="prep-label">行前準備</div>
          <div class="prep-num"><b>${done}</b> / ${all.length}</div>
        </div>
        <div class="mini-progress"><div style="width:${pct}%"></div></div>
        ${undone.length ? `<div class="prep-next">${undone.map(it => `<div class="pn-item">${esc(it.text)}</div>`).join("")}</div>` : `<div class="prep-done">全部準備完成，可以出發了</div>`}
        <button class="btn-green" onclick="go('list',0)">查看完整清單</button>
      </div>
      <div class="twocards">
        ${flightCardMini(DATA.flights[0])}
        ${hotelCardMini(DATA.hotels[0], false)}
      </div>
      <a class="cta-strip" href="https://tdac.immigration.go.th" target="_blank" rel="noopener">
        <div class="cta-ic">${QI.doc}</div>
        <div class="cta-body"><b>9/17 起填 TDAC 電子入境卡</b><span>官方免費網站，填完截圖存手機</span></div>
        <span class="cta-go">前往 ›</span>
      </a>
      ${homeTools(false)}`;
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
            <button class="abtn primary" onclick="go('plan',${di})">今天完整行程</button>
            ${nextEv.mapq ? `<a class="btn-green sm" target="_blank" rel="noopener" href="${mapUrl(nextEv.mapq)}">導航</a>` : ""}
          </div>`
        : `
          <div class="tc-next">今天行程跑完了，好好休息</div>
          <div class="tc-actions"><button class="abtn primary" onclick="go('plan',${di})">看今天完整行程</button></div>`}
      </div>
      ${hotel ? hotelBlockHTML(hotel, {}) : ""}
      <div class="rain-strip"><b>今日雨備</b>${esc(day.rain)}</div>
      ${flightCardMini(nextFlight())}
      <button class="cta-strip" onclick="go('list',1)">
        <div class="cta-ic">${QI.check}</div>
        <div class="cta-body"><b>出門前檢查</b><span>護照、傘、錢包、防蚊液帶了沒</span></div>
        <span class="cta-go">查看 ›</span>
      </button>
      ${homeTools(true)}`;
  } else {
    html += `
      <div class="today-card" style="text-align:center;padding:30px 20px">
        <div class="tc-d" style="justify-content:center">旅程圓滿</div>
        <div style="color:var(--ink-soft);margin-top:8px">8 天的清邁與曼谷回憶，<br>歡迎隨時回來翻看行程與照片。</div>
        <button class="btn-green" style="margin-top:16px" onclick="go('plan',0)">回顧行程</button>
      </div>
      ${homeTools(false)}`;
  }

  $("#page-home").innerHTML = html;
  updateOfflineNote();
}

function homeTools(during) {
  const tools = during
    ? [["sos", "緊急電話", "info", "sec-tel", "alert"], ["chat", "常用泰語", "info", "sec-phrases", ""],
       ["coin", "小費匯率", "info", "sec-money", ""], ["doc", "防雷提醒", "info", "sec-scam", ""]]
    : [["cal", "每日行程", "plan", "", ""], ["plane", "機票飯店", "orders", "", ""],
       ["coin", "小費匯率", "info", "sec-money", ""], ["chat", "常用泰語", "info", "sec-phrases", ""]];
  return `<div class="tool-row">${tools.map(t =>
    `<button class="tool ${t[4]}" onclick="go('${t[2]}'${t[3] ? `,'${t[3]}'` : ""})">${QI[t[0]]}<span>${t[1]}</span></button>`
  ).join("")}</div>`;
}

function updateOfflineNote() {
  const el = $("#offline-note"); if (!el) return;
  const txt = $("#offline-text");
  if (navigator.onLine) {
    el.classList.remove("off");
    txt.textContent = swReady ? "離線可用 · 所有內容已下載" : "內容更新於 " + DATA.updated;
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
    return `<button class="daypill ${i === selDay ? "sel " + d.cityClass : ""} ${isToday ? "today-ring" : ""}" onclick="selectDay(${i})">${d.label} ${esc(d.week.replace("週", ""))}<small>${d.date.slice(5).replace("-", "/")}</small></button>`;
  }).join("");

  const day = DATA.days[selDay];
  const st = dayStatuses(day);
  const events = day.events.map((ev, i) => {
    const s = st[i];
    const stateTag = s === "now" ? `<span class="ev-state now">現在</span>` : s === "next" ? `<span class="ev-state next">下一站</span>` : s === "done" ? `<span class="ev-state done">完成</span>` : "";
    const btns = [];
    if (ev.mapq) {
      btns.push(`<a class="abtn" target="_blank" rel="noopener" href="${mapUrl(ev.mapq)}">導航</a>`);
      btns.push(`<button class="abtn" onclick="copyTxt('${esc(ev.mapq)}')">複製地點</button>`);
    }
    return `
      <div class="ev status-${s || "todo"}">
        <span class="ev-time">${esc(ev.time)}</span>${stateTag}
        <div class="ev-card">
          <div class="ev-title">${esc(ev.title)}</div>
          <div class="ev-desc">${esc(ev.desc)}</div>
          ${ev.cost ? `<div class="ev-cost">費用 ${esc(ev.cost)}</div>` : ""}
          ${ev.warn ? `<div class="ev-warn">注意：${esc(ev.warn)}</div>` : ""}
          ${btns.length ? `<div class="btnrow">${btns.join("")}</div>` : ""}
        </div>
      </div>`;
  }).join("");

  const hotel = hotelForNight(day.date);
  $("#page-plan").innerHTML = `
    <div class="daybar" id="daybar">${pills}</div>
    <div class="dayhead">
      <div class="dh-city ${day.cityClass}">${esc(day.city)} · ${esc(day.week)}</div>
      <h2>${esc(day.title)}</h2>
      <div class="dh-date">${day.date.replace(/-/g, "/")}　${day.date === bkkNow().date ? "— 就是今天" : ""}</div>
    </div>
    <img class="dayimg" src="assets/img/${day.img}" alt="" onerror="this.remove()">
    ${hotel ? hotelBlockHTML(hotel, { flat: true }) : ""}
    <div class="rainbox"><b>如果下雨就去這裡</b>${esc(day.rain)}</div>
    <div class="timeline">${events}</div>
    <div class="swipe-hint">← 左右滑動切換天數 →</div>`;

  const selPill = document.querySelectorAll(".daypill")[selDay];
  if (selPill) selPill.scrollIntoView({ inline: "center", block: "nearest" });
}
window.selectDay = i => { selDay = i; renderPlan(); window.scrollTo({ top: 0 }); };

/* swipe */
let tx = null, ty = null;
document.addEventListener("touchstart", e => {
  if (!$("#page-plan").classList.contains("active")) return;
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
      <div class="fc-route" style="margin-top:8px">${esc(f.from)} <span class="arrow">→</span> ${esc(f.to)}</div>
      <div class="fc-times"><b>${esc(f.dep)}</b> 出發　—　<b>${esc(f.arr)}</b> 抵達</div>
      <div class="fc-note">${esc(f.note)}</div>
      <div class="pnr-row">
        <label>訂位代碼</label>
        <input value="${esc(pnr)}" placeholder="可自行輸入" maxlength="8" onchange="savePnr('${f.pnrKey}',this.value)">
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
    <div class="page-head"><h1>出發與入住資訊</h1><p>航班、住宿與預訂提醒</p></div>
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
        <div class="chk-group"><h3>◆ ${esc(g.group)}</h3>
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
    <div class="page-head"><h1>清單</h1><p>勾選狀態各自手機獨立保存</p></div>
    <div class="seg">
      <button class="${listMode === 0 ? "sel" : ""}" onclick="setListMode(0)">行前準備</button>
      <button class="${listMode === 1 ? "sel" : ""}" onclick="setListMode(1)">每日出門</button>
    </div>${body}`;
}
function chkRow(key, text) {
  const v = store.get(key, false);
  return `<div class="chk ${v ? "done" : ""}" onclick="toggleChk('${key}')">
    <span class="box">${v ? "✓" : ""}</span><span class="txt">${esc(text)}</span></div>`;
}
window.setListMode = m => { listMode = m; renderList(); };
window.toggleChk = k => { store.set(k, !store.get(k, false)); renderList(); if ($("#page-home").classList.contains("active")) renderHome(); };
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
    <div class="page-head"><h1>資訊</h1></div>
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

/* ===== router ===== */
const PAGES = { home: renderHome, plan: renderPlan, orders: renderOrders, list: renderList, info: renderInfo };
function go(tab, arg) {
  if (tab === "plan" && typeof arg === "number") selDay = arg;
  if (tab === "list" && typeof arg === "number") listMode = arg;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll("#tabbar .tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  $("#page-" + tab).classList.add("active");
  PAGES[tab]();
  if (typeof arg === "string" && document.getElementById(arg)) {
    document.getElementById(arg).scrollIntoView({ block: "start" });
  } else {
    window.scrollTo({ top: 0 });
  }
  if (location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);
}
window.go = go;
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

// 解析單一天分頁（欄位：時間/標題/說明/地圖關鍵字/費用/注意）
function parseEventTab(text) {
  const rows = parseCSV(text);
  if (!rows.length) return null;
  const head = rows[0].map(h => h.trim());
  if (head[0] !== "時間") return null; // 防呆：分頁不存在時 gviz 會退回第一頁，擋掉
  const ci = { time: head.indexOf("時間"), title: head.indexOf("標題"), desc: head.indexOf("說明"), mapq: head.indexOf("地圖關鍵字"), cost: head.indexOf("費用"), warn: head.indexOf("注意") };
  const padTime = t => /^\d:\d\d/.test(t) ? "0" + t : t;
  const evs = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; if (!row) continue;
    const title = (row[ci.title] || "").trim();
    const time = (row[ci.time] || "").trim();
    if (!title) continue;
    const ev = { time: padTime(time), title, desc: (row[ci.desc] || "").trim() };
    const mq = ci.mapq >= 0 ? (row[ci.mapq] || "").trim() : ""; if (mq) ev.mapq = mq;
    const cost = ci.cost >= 0 ? (row[ci.cost] || "").trim() : ""; if (cost) ev.cost = cost;
    const warn = ci.warn >= 0 ? (row[ci.warn] || "").trim() : ""; if (warn) ev.warn = warn;
    evs.push(ev);
  }
  return evs.length ? evs : null;
}

async function refreshFromSheet() {
  if (typeof SHEET_ID === "undefined" || !SHEET_ID) return;
  const tabUrl = name => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  try {
    const results = await Promise.all(DATA.days.map(async d => {
      try {
        const res = await fetch(tabUrl(d.label), { cache: "no-store" });
        if (!res.ok) return null;
        return parseEventTab(await res.text());
      } catch (e) { return null; }
    }));
    let changed = false;
    results.forEach((evs, i) => { if (evs && evs.length) { DATA.days[i].events = evs; changed = true; } });
    if (changed) {
      const active = document.querySelector(".page.active");
      if (active) { const tab = active.id.replace("page-", ""); if (PAGES[tab]) PAGES[tab](); }
    }
  } catch (e) { /* 離線或未公開：靜默使用內建資料 */ }
}

/* ===== init ===== */
let swReady = false;
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").then(() => { swReady = true; updateOfflineNote(); }).catch(() => {});
}
window.addEventListener("online", updateOfflineNote);
window.addEventListener("offline", updateOfflineNote);

const initTab = (location.hash || "#home").slice(1);
const ti = todayDayIndex();
if (ti >= 0) selDay = ti;
go(PAGES[initTab] ? initTab : "home");

refreshFromSheet();

setInterval(() => {
  const active = document.querySelector(".page.active");
  if (!active) return;
  if (active.id === "page-home" && tripPhase() === "during") renderHome();
}, 60000);
