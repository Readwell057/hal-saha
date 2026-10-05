/* Halısaha Kadro Kurucu - arayüz katmanı */
(function () {
  'use strict';

  const L = window.KadroLogic;
  const STORE = 'halisaha-kadro-v1';
  const $ = (s) => document.querySelector(s);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Örnek oyuncular: ad, hücum, orta, defans (kaleciler için kaleci puanı)
  const SAMPLE = [
    ['Emre', 4, 3, 2], ['Kaan', 3, 4, 3], ['Burak', 5, 3, 2], ['Mert', 2, 3, 5],
    ['Can', 3, 4, 4], ['Deniz', 4, 4, 2], ['Onur', 2, 2, 4], ['Selim', 3, 5, 3],
    ['Tolga', 4, 2, 3], ['Yiğit', 3, 3, 4], ['Ahmet', 5, 4, 1], ['Barış', 2, 3, 4],
    ['Cem', 3, 2, 3], ['Eren', 4, 3, 3], ['Furkan', 2, 4, 3], ['Gökhan', 3, 3, 2]
  ];

  function defaultState() {
    const players = SAMPLE.map((r, i) => ({
      id: uid(), name: r[0], gk: false, atk: r[1], bld: r[2], def: r[3], gkp: 3, coming: i < 12
    }));
    players.push({ id: uid(), name: 'Volkan', gk: true, atk: 3, bld: 3, def: 3, gkp: 4, coming: true });
    players.push({ id: uid(), name: 'Murat', gk: true, atk: 3, bld: 3, def: 3, gkp: 3, coming: true });
    return { players: players, perTeam: 6, formation: '', colors: ['#d94a3d', '#6a3fa3'] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.players) && s.perTeam) return s;
      }
    } catch (e) { /* tarayıcı depolaması kapalı olabilir */ }
    return defaultState();
  }

  const state = load();
  state.result = null;

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        players: state.players, perTeam: state.perTeam, formation: state.formation, colors: state.colors
      }));
    } catch (e) { /* yoksay */ }
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- Oyuncu tablosu ---------- */
  function ratingCell(p, key, enabled) {
    const opts = [1, 2, 3, 4, 5].map((n) => '<option value="' + n + '"' + (p[key] === n ? ' selected' : '') + '>' + n + '</option>').join('');
    return '<td><select data-f="' + key + '"' + (enabled ? '' : ' disabled') + ' aria-label="' + esc(p.name) + ' ' + key + '">' + opts + '</select></td>';
  }

  function playerRow(p) {
    return '<tr data-id="' + p.id + '" class="' + (p.coming ? 'is-in' : '') + '">' +
      '<td><input type="checkbox" data-f="coming"' + (p.coming ? ' checked' : '') + ' aria-label="' + esc(p.name) + ' geliyor"></td>' +
      '<td class="c-name"><input class="name" data-f="name" value="' + esc(p.name) + '" maxlength="24" aria-label="Oyuncu adı"></td>' +
      '<td><input type="checkbox" data-f="gk"' + (p.gk ? ' checked' : '') + ' aria-label="' + esc(p.name) + ' kaleci"></td>' +
      ratingCell(p, 'atk', !p.gk) + ratingCell(p, 'bld', !p.gk) + ratingCell(p, 'def', !p.gk) + ratingCell(p, 'gkp', p.gk) +
      '<td><button type="button" class="icon" data-act="del" aria-label="' + esc(p.name) + ' oyuncusunu sil">×</button></td>' +
      '</tr>';
  }

  function renderPlayers() {
    $('#playerBody').innerHTML = state.players.map(playerRow).join('');
  }

  /* ---------- Özet paneli ---------- */
  function renderSummary() {
    const st = L.status(state.players, state.perTeam);
    $('#stField').textContent = st.field;
    $('#stGk').textContent = st.gk;
    $('#stTotal').textContent = st.total;
    $('#perVal').textContent = state.perTeam;
    $('#color1').value = state.colors[0];
    $('#color2').value = state.colors[1];

    const line = $('#statusLine');
    line.className = 'status';
    let msg;
    if (st.missingField > 0) {
      line.classList.add('bad');
      msg = 'Saha oyuncusu eksik: ' + st.missingField + ' kişi';
      if (st.missingGk > 0) msg += ' | Kaleci eksik: ' + st.missingGk;
    } else if (st.missingGk > 0) {
      line.classList.add('warn');
      msg = 'Kaleci eksik: ' + st.missingGk + '. Sahadan biri geçici kaleci olur.';
    } else {
      msg = st.extra > 0 ? 'Kadro tamam. ' + st.extra + ' kişi yedek kalacak.' : 'Kadro tamam, takımlar kurulabilir.';
    }
    line.textContent = msg;
    $('#createBtn').disabled = st.missingField > 0;
  }

  /* ---------- Kadro / saha ---------- */
  function jersey(fill) {
    return '<svg viewBox="0 0 40 40" class="jersey" aria-hidden="true">' +
      '<path d="M14 4 L5 9 L2 18 L8 21 L10 17 L10 36 L30 36 L30 17 L32 21 L38 18 L35 9 L26 4 C24 8 16 8 14 4 Z" ' +
      'fill="' + fill + '" stroke="#000" stroke-opacity=".45" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  function teamCard(team, idx, layout) {
    const color = state.colors[idx];
    const stats = L.teamStats(team);
    let d = 0;
    const players = layout.map((slot) => {
      const fill = slot.role === 'K' ? '#f0bf2f' : color;
      const name = slot.p.standIn ? slot.p.name + ' (K)' : slot.p.name;
      const html = '<div class="pl" style="left:' + slot.x + '%;top:' + slot.y + '%;--d:' + (d * 0.04).toFixed(2) + 's">' +
        jersey(fill) + '<span class="pl-name">' + esc(name) + '</span></div>';
      d++;
      return html;
    }).join('');

    const by = (r) => layout.filter((s) => s.role === r).map((s) => esc(s.p.name)).join(', ') || '-';
    return '<article class="team">' +
      '<div class="team-head"><h3><span class="swatch" style="background:' + color + '"></span>Takım ' + (idx + 1) + '</h3>' +
      '<span class="power">Saha ort. ' + stats.fieldAvg.toFixed(1) + ' | Kaleci ' + stats.gk + '</span></div>' +
      '<div class="pitch"><div class="lines"><div class="l-box"></div><div class="l-goal"></div><div class="l-circle"></div></div>' + players + '</div>' +
      '<dl class="roster">' +
      '<dt>Kaleci</dt><dd>' + esc(team.gk.name) + (team.gk.standIn ? ' (geçici)' : '') + '</dd>' +
      '<dt>Defans</dt><dd>' + by('D') + '</dd>' +
      '<dt>Orta saha</dt><dd>' + by('O') + '</dd>' +
      '<dt>Forvet</dt><dd>' + by('F') + '</dd></dl></article>';
  }

  function renderTeams() {
    const wrap = $('#teams');
    const tools = $('#teamTools');
    if (!state.result) {
      tools.hidden = true;
      wrap.innerHTML = '<p class="empty" style="grid-column:1/-1">Gelenleri işaretle ve “Takımları oluştur” düğmesine bas.</p>';
      return;
    }
    tools.hidden = false;
    const forms = L.formationsFor(state.perTeam);
    if (forms.indexOf(state.formation) === -1) state.formation = forms[0];
    $('#formationSel').innerHTML = forms.map((f) => '<option value="' + f + '"' + (f === state.formation ? ' selected' : '') + '>' + f + '</option>').join('');

    const r = state.result;
    let html = r.teams.map((t, i) => teamCard(t, i, L.layoutTeam(t, state.formation))).join('');
    if (r.reserves.length) {
      html += '<p class="reserves" style="grid-column:1/-1">Yedek: ' + r.reserves.map((p) => esc(p.name)).join(', ') + '</p>';
    }
    wrap.innerHTML = html;
  }

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.textContent = ''; }, 2600);
  }

  function create() {
    const res = L.buildMatch(state.players, state.perTeam);
    if (res.error) { toast(res.error); return; }
    state.result = res;
    renderTeams();
    $('#h-teams').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function resultText() {
    const names = ['Takım 1', 'Takım 2'];
    const parts = state.result.teams.map((t, i) => {
      const lay = L.layoutTeam(t, state.formation);
      const by = (r) => lay.filter((s) => s.role === r).map((s) => s.p.name).join(', ');
      return names[i] + ' (' + state.formation + ')\n' +
        'Kaleci: ' + t.gk.name + '\nDefans: ' + by('D') + '\nOrta saha: ' + by('O') + '\nForvet: ' + by('F');
    });
    if (state.result.reserves.length) parts.push('Yedek: ' + state.result.reserves.map((p) => p.name).join(', '));
    return parts.join('\n\n');
  }

  function copyResult() {
    const text = resultText();
    const done = () => toast('Kadrolar kopyalandı, mesaja yapıştırabilirsin.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Kopyalanamadı.'); }
    document.body.removeChild(ta);
  }

  /* ---------- Olaylar ---------- */
  const body = $('#playerBody');

  body.addEventListener('input', (e) => {
    if (e.target.dataset.f !== 'name') return;
    const p = state.players.find((x) => x.id === e.target.closest('tr').dataset.id);
    if (p) { p.name = e.target.value; save(); }
  });

  body.addEventListener('change', (e) => {
    const f = e.target.dataset.f;
    if (!f || f === 'name') return;
    const tr = e.target.closest('tr');
    const p = state.players.find((x) => x.id === tr.dataset.id);
    if (!p) return;
    if (f === 'coming' || f === 'gk') p[f] = e.target.checked;
    else p[f] = clamp(parseInt(e.target.value, 10) || 1, 1, 5);
    save();
    if (f === 'gk') renderPlayers();
    else if (f === 'coming') tr.classList.toggle('is-in', p.coming);
    renderSummary();
  });

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="del"]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    state.players = state.players.filter((x) => x.id !== id);
    state.result = null;
    save(); renderPlayers(); renderSummary(); renderTeams();
  });

  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#newName');
    const name = input.value.trim();
    if (!name) return;
    state.players.push({ id: uid(), name: name, gk: $('#newGk').checked, atk: 3, bld: 3, def: 3, gkp: 3, coming: true });
    input.value = ''; $('#newGk').checked = false;
    save(); renderPlayers(); renderSummary();
    input.focus();
  });

  $('#allIn').addEventListener('click', () => { state.players.forEach((p) => { p.coming = true; }); save(); renderPlayers(); renderSummary(); });
  $('#allOut').addEventListener('click', () => { state.players.forEach((p) => { p.coming = false; }); save(); renderPlayers(); renderSummary(); });

  function setPer(n) {
    state.perTeam = clamp(n, 3, 10);
    state.formation = '';
    state.result = null;
    save(); renderSummary(); renderTeams();
  }
  $('#perMinus').addEventListener('click', () => setPer(state.perTeam - 1));
  $('#perPlus').addEventListener('click', () => setPer(state.perTeam + 1));

  ['color1', 'color2'].forEach((id, i) => {
    $('#' + id).addEventListener('input', (e) => { state.colors[i] = e.target.value; save(); if (state.result) renderTeams(); });
  });

  $('#createBtn').addEventListener('click', create);
  $('#reBtn').addEventListener('click', create);
  $('#copyBtn').addEventListener('click', copyResult);
  $('#formationSel').addEventListener('change', (e) => { state.formation = e.target.value; save(); renderTeams(); });

  renderPlayers();
  renderSummary();
  renderTeams();
})();
