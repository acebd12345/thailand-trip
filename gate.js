(function () {
  const LS_KEY = "trip_pw";
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function decrypt(password) {
    const E = window.ENC;
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64(E.salt), iterations: E.iter, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(E.iv) }, key, b64(E.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  function boot(payload) {
    window.DATA = payload.DATA;
    window.SHEET_ID = payload.SHEET_ID;
    const g = document.getElementById("gate");
    if (g) g.remove();
    document.getElementById("app").style.display = "";
    document.getElementById("tabbar").style.display = "";
    const s = document.createElement("script");
    s.src = "app.js";
    document.body.appendChild(s);
  }

  async function tryUnlock(password, remember, onErr) {
    try {
      const payload = await decrypt(password);
      if (remember) { try { localStorage.setItem(LS_KEY, password); } catch (e) {} }
      boot(payload);
      return true;
    } catch (e) {
      if (onErr) onErr();
      return false;
    }
  }

  function showGate() {
    const wrap = document.createElement("div");
    wrap.id = "gate";
    wrap.innerHTML = `
      <div class="gate-card">
        <div class="gate-cover"><span class="eyebrow">THAILAND / 2026</span><div><h2>清邁的慢，<br>曼谷的熱鬧。</h2><p>09.20 — 09.27 · 8 天 7 夜</p></div></div>
        <div class="gate-form"><div class="gate-kick">OUR FAMILY TRIP</div>
        <h1 class="gate-title">我們的泰國旅行</h1>
        <div class="gate-sub">一家人的行程與口袋美食，都在這裡。</div>
        <label class="gate-label" for="gate-pw">旅行通行密碼</label>
        <input id="gate-pw" type="password" autocomplete="current-password" placeholder="輸入通行密碼" aria-describedby="gate-err" />
        <label class="gate-remember"><input type="checkbox" id="gate-remember" /> 記住這台裝置（共用電腦請勿勾）</label>
        <button id="gate-go">打開旅行手冊 ↗</button>
        <div id="gate-err" class="gate-err" role="alert"></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const pw = document.getElementById("gate-pw");
    const err = document.getElementById("gate-err");
    const go = document.getElementById("gate-go");
    const submit = async () => {
      if (go.disabled) return;
      err.textContent = "";
      go.disabled = true; go.textContent = "解鎖中…";
      const ok = await tryUnlock(pw.value.trim(), document.getElementById("gate-remember").checked, () => {
        err.textContent = "密碼不對，再試一次";
        go.disabled = false; go.textContent = "打開旅行手冊 ↗";
        pw.value = ""; pw.focus();
      });
    };
    go.addEventListener("click", submit);
    pw.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

  }

  window.forgetDevice = function () {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    location.reload();
  };

  window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("app").style.display = "none";
    document.getElementById("tabbar").style.display = "none";
    const saved = (() => { try { return localStorage.getItem(LS_KEY); } catch (e) { return null; } })();
    if (saved) {
      const ok = await tryUnlock(saved, false, null);
      if (ok) return;
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
    }
    showGate();
  });
})();
