/* Halısaha Kadro Kurucu - saf mantık katmanı (arayüzden bağımsız, Node ile test edilebilir) */
(function (root) {
  'use strict';

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function totals(team) {
    return team.reduce(
      (s, p) => ({ atk: s.atk + p.atk, bld: s.bld + p.bld, def: s.def + p.def }),
      { atk: 0, bld: 0, def: 0 }
    );
  }

  function fieldSum(team) {
    const t = totals(team);
    return t.atk + t.bld + t.def;
  }

  // İki takım arasındaki dengesizlik: toplam güç farkı + hücum/orta/defans farkları
  function cost(A, B) {
    const a = totals(A), b = totals(B);
    const sa = a.atk + a.bld + a.def, sb = b.atk + b.bld + b.def;
    return Math.abs(sa - sb) * 2 +
      Math.abs(a.atk - b.atk) + Math.abs(a.bld - b.bld) + Math.abs(a.def - b.def);
  }

  // Rastgele başlangıç + takas ile iyileştirme; en iyi sonuçlar arasından rastgele seçer
  function balance(pool, perTeam, tries) {
    tries = tries || 300;
    const results = [];
    for (let t = 0; t < tries; t++) {
      const p = shuffle(pool);
      let A = p.slice(0, perTeam), B = p.slice(perTeam);
      let best = cost(A, B), improved = true;
      while (improved) {
        improved = false;
        outer:
        for (let i = 0; i < A.length; i++) {
          for (let j = 0; j < B.length; j++) {
            [A[i], B[j]] = [B[j], A[i]];
            const c = cost(A, B);
            if (c < best) { best = c; improved = true; break outer; }
            [A[i], B[j]] = [B[j], A[i]];
          }
        }
      }
      results.push({ A, B, cost: best });
    }
    results.sort((x, y) => x.cost - y.cost);
    const top = results.filter(r => r.cost <= results[0].cost + 1).slice(0, 12);
    return top[Math.floor(Math.random() * top.length)];
  }

  function status(players, perTeam) {
    const coming = players.filter(p => p.coming);
    const gk = coming.filter(p => p.gk).length;
    const field = coming.length - gk;
    const needField = perTeam * 2 + Math.max(0, 2 - gk);
    return {
      field: field,
      gk: gk,
      total: coming.length,
      missingField: Math.max(0, needField - field),
      missingGk: Math.max(0, 2 - gk),
      extra: Math.max(0, field - needField) + Math.max(0, gk - 2)
    };
  }

  function buildMatch(players, perTeam) {
    const st = status(players, perTeam);
    if (st.missingField > 0) {
      return { error: 'Saha oyuncusu eksik: ' + st.missingField + ' kişi' };
    }
    const coming = players.filter(p => p.coming);
    let keepers = shuffle(coming.filter(p => p.gk)).sort((a, b) => b.gkp - a.gkp);
    let pool = coming.filter(p => !p.gk);
    const reserves = [];

    while (keepers.length > 2) reserves.push(keepers.pop());

    if (keepers.length < 2) {
      // Yeterli kaleci yok: savunma puanı en yüksek saha oyuncuları geçici kaleci olur
      pool = shuffle(pool).sort((a, b) => b.def - a.def);
      while (keepers.length < 2) {
        const s = pool.shift();
        keepers.push(Object.assign({}, s, { gkp: s.def, standIn: true }));
      }
    }

    pool = shuffle(pool);
    const need = perTeam * 2;
    while (pool.length > need) reserves.push(pool.pop());

    const res = balance(pool, perTeam);
    keepers.sort((a, b) => b.gkp - a.gkp);
    const strong = keepers[0], weak = keepers[1];
    // Güçlü kaleci, saha oyuncuları görece zayıf kalan takıma gider
    const teams = fieldSum(res.A) <= fieldSum(res.B)
      ? [{ gk: strong, field: res.A }, { gk: weak, field: res.B }]
      : [{ gk: weak, field: res.A }, { gk: strong, field: res.B }];
    return { teams: teams, reserves: reserves };
  }

  // n saha oyuncusu için savunma-orta-forvet dizilişleri (en dengeli olan başta)
  function formationsFor(n) {
    const out = [];
    for (let d = 1; d <= 4; d++) {
      for (let f = 1; f <= 3; f++) {
        const m = n - d - f;
        if (m >= 1 && m <= 4) {
          out.push({
            key: d + '-' + m + '-' + f,
            s: Math.abs(d - 2.5) + Math.abs(f - 1.4) + Math.abs(m - n / 2.2) * 0.3
          });
        }
      }
    }
    out.sort((a, b) => a.s - b.s);
    const keys = out.slice(0, 6).map(o => o.key);
    return keys.length ? keys : ['1-' + Math.max(1, n - 2) + '-1'];
  }

  // Oyuncuları dizilişteki mevkilere puanlarına göre yerleştirir ve saha koordinatı verir
  function layoutTeam(team, key) {
    const parts = key.split('-').map(Number);
    const cap = { D: parts[0], O: parts[1], F: parts[2] };
    const triples = [];
    team.field.forEach(p => {
      const avg = (p.atk + p.bld + p.def) / 3;
      [['D', p.def], ['O', p.bld], ['F', p.atk]].forEach(r => {
        triples.push({ p: p, r: r[0], v: r[1] - avg + r[1] * 0.01 + Math.random() * 0.001 });
      });
    });
    triples.sort((a, b) => b.v - a.v);
    const taken = new Set();
    const lines = { D: [], O: [], F: [] };
    triples.forEach(t => {
      if (!taken.has(t.p.id) && lines[t.r].length < cap[t.r]) {
        lines[t.r].push(t.p);
        taken.add(t.p.id);
      }
    });
    const ys = { D: 31, O: 55, F: 79 };
    const out = [{ p: team.gk, role: 'K', x: 50, y: 11 }];
    ['D', 'O', 'F'].forEach(r => {
      const k = lines[r].length;
      lines[r].forEach((p, i) => {
        out.push({ p: p, role: r, x: ((i + 1) / (k + 1)) * 100, y: ys[r] });
      });
    });
    return out;
  }

  function teamStats(team) {
    const n = team.field.length || 1;
    return {
      fieldAvg: fieldSum(team.field) / (3 * n),
      gk: team.gk.gkp
    };
  }

  const api = {
    shuffle, balance, status, buildMatch, formationsFor, layoutTeam, teamStats, fieldSum
  };
  root.KadroLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
