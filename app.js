// Baguales Clima: runs the dashboard code with readings fetched from the Apps Script data feed.
const BX_CONFIG = {
  dataUrl: 'https://script.google.com/macros/s/AKfycbw9sRlnfrC13tR0vlOrpY6d7EZidxKHn7Dc9aSu48O2omSROQEzuCAra7YcfBbFAhqqdw/exec?data=1',
};
(() => {
  const loaders = {}, calcs = {}, draws = {}, onDatas = [], cache = {};
  let raw = null, params = { rpreset: 'obscur', dst: 'both' };
  const status = (id) => {
    if (id === 'lm' || id === 'an') return raw ? 'ok' : 'loading';
    const c = calcs[id];
    return c ? (c.inputs.every((i) => status(i) === 'ok') ? 'ok' : 'loading') : 'missing';
  };
  const data = (id) => {
    if (status(id) !== 'ok') return { status: status(id), data: [] };
    if (!(id in cache)) {
      if (id === 'lm' || id === 'an') { const o = loaders[id].fn({ answer: { values: raw[id] } }); cache[id] = { status: 'ok', data: o.rows, columns: o.columns }; }
      else { const c = calcs[id]; cache[id] = { status: 'ok', data: c.fn(...c.inputs.map((i) => data(i).data)) }; }
    }
    return cache[id];
  };
  const visible = (el) => !el.closest('[hidden]');
  const runDraw = (n) => {
    const f = draws[n];
    document.querySelectorAll(`[data-draw="${n}"]`).forEach((el) => {
      if (!visible(el)) return;
      try { if (typeof f === 'function') f(el); else { if (!el.__made) el.__made = f.mount(el); if (f.update) f.update(el, el.__made); } }
      catch (e) { console.error('Dibujo ' + n, e); }
    });
  };
  const redraw = () => { onDatas.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); Object.keys(draws).forEach(runDraw); };
  let pending = false;
  const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; redraw(); }); };
  const clearCalcs = () => Object.keys(cache).forEach((k) => { if (calcs[k]) delete cache[k]; });

  window.dash = {
    loader: (id, o) => { loaders[id] = o; },
    calc: (id, o) => { calcs[id] = o; },
    draw: (n, f) => { if (f) draws[n] = f; else runDraw(n); },
    data,
    onData: (f) => { onDatas.push(f); },
    params: () => ({ ...params }),
    setParams: (p) => { Object.entries(p).forEach(([k, v]) => { if (v == null) delete params[k]; else params[k] = v; }); clearCalcs(); schedule(); },
    resetParams: () => { params = { rpreset: 'obscur', dst: 'both' }; clearCalcs(); schedule(); },
    setLink: (id) => { try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ } schedule(); },
    refresh: () => {},
    colors: ['#2a6fb0', '#d9730d'],
  };

  const setNote = (text, warn) => document.querySelectorAll('#bx-loaded').forEach((n) => { n.textContent = text; n.classList.toggle('bx-warn', !!warn); });
  let lastLoad = 0, busy = false;
  const load = async () => {
    if (busy) return;
    busy = true; lastLoad = Date.now();
    try {
      const res = await fetch(BX_CONFIG.dataUrl, { credentials: 'omit' });
      if (!res.ok) throw new Error('el servidor respondió ' + res.status);
      const d = await res.json();
      raw = { lm: d.lm, an: d.an };
      Object.keys(cache).forEach((k) => delete cache[k]);
      const offline = res.headers.get('X-Baguales-Cache') === '1';
      setNote(offline ? 'Sin conexión: se muestran los últimos datos guardados (cargados a las ' + d.at + ').' : 'Datos actualizados a las ' + d.at + ' (hora de Chile). Se actualizan solos cada 5 minutos.', offline);
      document.querySelectorAll('.bx-loading').forEach((el) => { el.hidden = true; });
      schedule();
    } catch (e) {
      if (raw) setNote('No se pudo actualizar (' + e.message + '). Se muestran los datos anteriores.', true);
      else document.querySelectorAll('.bx-loading').forEach((el) => { el.hidden = false; el.textContent = 'No se pudieron cargar los datos: ' + e.message + '. Revise la conexión y vuelva a abrir la app.'; });
    } finally { busy = false; }
  };
  window.addEventListener('load', () => { schedule(); load(); });
  setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastLoad > 60 * 1000) load(); });
  window.addEventListener('online', () => load());
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(schedule, 150); });
})();
d3.formatDefaultLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['$', ''], minus: '−' });
d3.timeFormatDefaultLocale({
  dateTime: '%A, %e de %B de %Y, %X', date: '%d/%m/%Y', time: '%H:%M:%S', periods: ['AM', 'PM'],
  days: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  shortDays: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  shortMonths: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
});

window.wx = (() => {
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const PTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const BINS = [[1, 25, '1–25'], [25, 40, '26–40'], [40, 60, '41–60'], [60, Infinity, '60+']];
  const BAND_COLORS = ['#2e9e44', '#d62828', '#f08c00', '#000000'];
  const STATIONS = [{ id: 'lm', name: 'La Mesada', color: '#2a6fb0', light: '#9cc0e3' }, { id: 'an', name: 'Antena', color: '#d9730d', light: '#f2c08e' }];
  const OBS_H = 8; // Baguales operational day: 08:00 to 07:59
  const toMs = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN; };
  const fromMs = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  const obsStart = (ms) => Math.floor((ms - OBS_H * 3600e3) / 86400e3) * 86400e3 + OBS_H * 3600e3;
  const HOURS = { '24h': 24, '72h': 72, '7d': 168 };
  // Quick ranges count back from the latest reading, so they still show data while the stations are offline.
  const range = (preset, from, to, first, last) => {
    const anchor = last || first;
    if (!anchor) return { from: '', to: '' };
    if (preset === 'custom' && from && to) return from <= to ? { from, to } : { from: to, to: from };
    const a = toMs(anchor);
    if (preset === 'obscur') return { from: fromMs(obsStart(a)), to: anchor };
    if (preset === 'obsprev') { const s = obsStart(a); return { from: fromMs(s - 86400e3), to: fromMs(s - 60e3) }; }
    if (preset === 'season') {
      const y = anchor.slice(0, 4), s = `${y}-05-01 00:00`;
      return { from: first && first > s ? first : s, to: anchor };
    }
    return { from: fromMs(a - (HOURS[preset] || 24) * 3600e3), to: anchor };
  };
  const sector = (deg) => (deg == null || deg === '' || isNaN(deg)) ? null : Math.round(((+deg % 360) + 360) % 360 / 22.5) % 16;
  const compass = (deg) => { const i = sector(deg); return i == null ? '' : PTS[i]; };
  const fmt = (v, f) => {
    if (v == null || v === '') return '—';
    if (f === 'text') return String(v);
    if (f === 'hm') return String(v).slice(11, 16);
    if (f === 'signed') { const n = Number(v); if (!isFinite(n)) return '—'; return (n > 0 ? '+' : '') + n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    if (f === 'time') { const ms = toMs(v); if (isNaN(ms)) return String(v); const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() !== new Date().getUTCFullYear() ? d.getUTCFullYear() + ' ' : ''}${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; }
    if (f === 'date') { const ms = toMs(v); if (isNaN(ms)) return String(v); const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
    const n = Number(v); if (!isFinite(n)) return String(v);
    const dp = f === '0' ? 0 : f === '2' ? 2 : 1;
    return n.toLocaleString('es-CL', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  };
  const rose = (rows) => {
    const counts = PTS.map(() => BINS.map(() => 0));
    let n = 0, calm = 0;
    rows.forEach((r) => {
      const s = r.wind_avg_kmh; if (s == null) return;
      n += 1;
      if (s < 1) { calm += 1; return; }
      const i = sector(r.wind_dir_deg); if (i == null) { calm += 1; return; }
      counts[i][BINS.findIndex(([, hi]) => s <= hi)] += 1;
    });
    const out = [];
    PTS.forEach((p, i) => BINS.forEach(([, , label], b) => out.push({ sector: p, sector_deg: i * 22.5, speed_band: label, readings: counts[i][b], pct: n ? (100 * counts[i][b]) / n : 0 })));
    out.push({ sector: 'Calm', sector_deg: null, speed_band: 'under 1', readings: calm, pct: n ? (100 * calm) / n : 0 });
    return out;
  };
  return { MONTHS, PTS, BINS, BAND_COLORS, STATIONS, OBS_H, toMs, fromMs, obsStart, range, sector, compass, fmt, rose, tableLimit: 300 };
})();

const wxSheetLoader = (station) => ({
  description: 'Convierte la grilla de celdas de la pestaña en una fila por lectura, usando la fila de encabezado como nombres de columna y leyendo los números como números.',
  fn: ({ answer }) => {
    const TEXT = ['time_local', 'source', 'note'];
    const a = answer && answer.content ? answer.content : answer;
    const values = (a && a.values) || [];
    const head = values[0] || [];
    const num = (x) => { if (x == null || x === '') return null; const n = Number(String(x).replace(',', '.')); return isFinite(n) ? n : null; };
    const rows = values.slice(1).filter((r) => r[0]).map((r) => {
      const o = { station: station };
      head.forEach((h, i) => { o[h] = TEXT.includes(h) ? (r[i] == null ? '' : String(r[i])) : num(r[i]); });
      return o;
    });
    return { columns: ['station'].concat(head), rows };
  },
});
dash.loader('lm', wxSheetLoader('lm'));
dash.loader('an', wxSheetLoader('an'));

dash.calc('readings', {
  inputs: ['lm', 'an'],
  title: 'Lecturas depuradas de ambas estaciones',
  description: 'Lecturas de La Mesada y Antena en una sola serie. Los valores fuera de lo físicamente posible quedan en blanco (temperatura fuera de −50 a 45 °C, humedad fuera de 0 a 100 %, viento sobre 250 km/h, ráfaga sobre 300 km/h, radiación solar sobre 1.400 W/m², presión fuera de 850 a 1.090 hPa). El viento en 0 km/h con ráfaga 0 durante una hora o más, con temperatura bajo 1 °C y humedad de 90 % o más, se marca como posible anemómetro congelado y no se cuenta como calma.',
  fn: (laMesada, antena) => {
    const inR = (v, lo, hi) => (v == null || v < lo || v > hi ? null : v);
    const clean = (rows) => {
      const out = rows.map((r) => ({
        ...r,
        temp_c: inR(r.temp_c, -50, 45), temp_hi_c: inR(r.temp_hi_c, -50, 45), temp_lo_c: inR(r.temp_lo_c, -50, 45),
        dew_point_c: inR(r.dew_point_c, -70, 40), wind_chill_c: inR(r.wind_chill_c, -80, 45), rh_pct: inR(r.rh_pct, 0, 100),
        wind_avg_kmh: inR(r.wind_avg_kmh, 0, 250), wind_gust_kmh: inR(r.wind_gust_kmh, 0, 300),
        wind_dir_deg: inR(r.wind_dir_deg, 0, 360), wind_gust_dir_deg: inR(r.wind_gust_dir_deg, 0, 360),
        precip_mm: inR(r.precip_mm, 0, 100), solar_wm2: inR(r.solar_wm2, 0, 1400), pressure_hpa: inR(r.pressure_hpa, 850, 1090),
        wind_flag: '',
      })).filter((r) => r.time_local).sort((a, b) => (a.time_local < b.time_local ? -1 : a.time_local > b.time_local ? 1 : 0));
      // Frozen anemometer: 4+ consecutive readings with zero wind and gust, below 1 °C, humidity 90 % or more.
      const iced = (r) => r.wind_avg_kmh === 0 && (r.wind_gust_kmh === 0 || r.wind_gust_kmh == null) && r.temp_c != null && r.temp_c < 1 && r.rh_pct != null && r.rh_pct >= 90;
      let i = 0;
      while (i < out.length) {
        if (!iced(out[i])) { i += 1; continue; }
        let j = i;
        while (j < out.length && iced(out[j])) j += 1;
        if (j - i >= 4) for (let k = i; k < j; k += 1) { out[k].wind_flag = 'congelado'; out[k].wind_avg_kmh = null; out[k].wind_gust_kmh = null; out[k].wind_dir_deg = null; out[k].wind_gust_dir_deg = null; }
        i = j;
      }
      // Rain tips with humidity under 80 % or at −2 °C or colder are probably snow melting in the gauge, not rain.
      out.forEach((r) => { r.melt_mm = r.precip_mm > 0 && ((r.rh_pct != null && r.rh_pct < 80) || (r.temp_c != null && r.temp_c <= -2)) ? r.precip_mm : 0; });
      out.forEach((r) => { if (r.wind_avg_kmh != null && r.wind_avg_kmh < 1) r.wind_dir_deg = null; if (r.wind_gust_kmh != null && r.wind_gust_kmh < 1) r.wind_gust_dir_deg = null; });
      return out.map((r) => ({ ...r, dir_compass: wx.compass(r.wind_dir_deg) }));
    };
    return clean(laMesada).concat(clean(antena));
  },
});

dash.calc('latest', {
  inputs: ['readings'],
  title: 'Última lectura de cada estación',
  description: 'La lectura más reciente de cada estación con temperatura, y la más reciente de ambas, desde la que cuentan los rangos rápidos.',
  fn: (readings) => {
    const last = {}, first = {};
    readings.forEach((r) => {
      if (r.temp_c == null && r.wind_avg_kmh == null) return;
      if (!last[r.station] || r.time_local > last[r.station].time_local) last[r.station] = r;
      if (!first[r.station] || r.time_local < first[r.station].time_local) first[r.station] = r;
    });
    const rows = wx.STATIONS.map((s) => ({ station: s.id, name: s.name, time_local: last[s.id] ? last[s.id].time_local : null, first_local: first[s.id] ? first[s.id].time_local : null }));
    const times = rows.map((r) => r.time_local).filter(Boolean).sort();
    const firsts = rows.map((r) => r.first_local).filter(Boolean).sort();
    rows.push({ station: 'all', name: 'Ambas', time_local: times[times.length - 1] || null, first_local: firsts[0] || null });
    return rows;
  },
});

dash.calc('ranges', {
  inputs: ['latest'],
  title: 'Rangos de tiempo de cada página',
  description: 'Inicio y fin del rango elegido en Bloques, Gráficos y Datos. Cada página tiene su propio rango. Los rangos rápidos cuentan hacia atrás desde la última lectura; la temporada empieza el 1 de mayo del año de la última lectura.',
  fn: (latest) => {
    const p = dash.params();
    const all = latest.find((r) => r.station === 'all') || {};
    // One range for all three pages; each page has its own copy of the controls.
    const r = wx.range(p.rpreset || 'obscur', p.rfrom, p.rto, all.first_local, all.time_local);
    return ['b', 'g', 'd'].map((k) => ({ page: k, preset: p.rpreset || 'obscur', ...r }));
  },
});

const wxIn = (rows, r) => rows.filter((x) => x.time_local >= r.from && x.time_local <= r.to);

dash.calc('bstats', {
  inputs: ['readings', 'ranges'],
  title: 'Cifras de Bloques por estación',
  description: 'Para cada estación, en el rango elegido en Bloques: última lectura, máximas y mínimas de temperatura, viento, ráfaga máxima, precipitación total, humedad, radiación solar y presión.',
  fn: (readings, ranges) => {
    const r = ranges.find((x) => x.page === 'b');
    if (!r) return [];
    const sel = wxIn(readings, r);
    return wx.STATIONS.map((s) => {
      const rows = sel.filter((x) => x.station === s.id);
      const lastWith = (k) => { for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i][k] != null) return rows[i]; return null; };
      const ext = (k, better) => rows.reduce((b, x) => (x[k] != null && (!b || better(x[k], b[k])) ? x : b), null);
      const vals = (k) => rows.map((x) => x[k]).filter((v) => v != null);
      const mean = (a) => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);
      const tl = lastWith('temp_c'), wl = lastWith('wind_avg_kmh'), hl = lastWith('rh_pct'), sl = lastWith('solar_wm2');
      const tmax = ext('temp_hi_c', (a, b) => a > b) || ext('temp_c', (a, b) => a > b);
      const tmin = ext('temp_lo_c', (a, b) => a < b) || ext('temp_c', (a, b) => a < b);
      const g = ext('wind_gust_kmh', (a, b) => a > b);
      const smax = ext('solar_wm2', (a, b) => a > b);
      const sectors = new Array(16).fill(0);
      rows.forEach((x) => { if (x.wind_avg_kmh != null && x.wind_avg_kmh >= 1) { const i = wx.sector(x.wind_dir_deg); if (i != null) sectors[i] += 1; } });
      const pr = rows.filter((x) => x.pressure_hpa != null);
      const rh = vals('rh_pct');
      return {
        station: s.id, name: s.name, readings: rows.length,
        temp_last: tl ? tl.temp_c : null, temp_last_time: tl ? tl.time_local : null,
        temp_max: tmax ? (tmax.temp_hi_c ?? tmax.temp_c) : null, temp_max_time: tmax ? tmax.time_local : null,
        temp_min: tmin ? (tmin.temp_lo_c ?? tmin.temp_c) : null, temp_min_time: tmin ? tmin.time_local : null,
        temp_mean: mean(vals('temp_c')),
        wind_last: wl ? wl.wind_avg_kmh : null, wind_last_deg: wl ? wl.wind_dir_deg : null, wind_last_dir: wl ? wx.compass(wl.wind_dir_deg) : null,
        wind_last_gust: wl ? wl.wind_gust_kmh : null, wind_last_time: wl ? wl.time_local : null,
        wind_mean: mean(vals('wind_avg_kmh')),
        prevailing_dir: sectors.some((c) => c > 0) ? wx.PTS[sectors.indexOf(Math.max(...sectors))] : null,
        gust_max: g ? g.wind_gust_kmh : null, gust_max_time: g ? g.time_local : null,
        gust_max_deg: g && g.wind_gust_kmh >= 1 ? (g.wind_gust_dir_deg ?? g.wind_dir_deg) : null, gust_max_dir: g && g.wind_gust_kmh >= 1 ? wx.compass(g.wind_gust_dir_deg ?? g.wind_dir_deg) : null,
        precip_mm: Math.round(vals('precip_mm').reduce((t, v) => t + v, 0) * 10) / 10,
        melt_mm: Math.round(vals('melt_mm').reduce((t, v) => t + v, 0) * 10) / 10,
        rh_last: hl ? hl.rh_pct : null, rh_min: rh.length ? Math.min(...rh) : null, rh_max: rh.length ? Math.max(...rh) : null, rh_mean: mean(rh),
        solar_last: sl ? sl.solar_wm2 : null, solar_max: smax ? smax.solar_wm2 : null, solar_max_time: smax ? smax.time_local : null,
        pressure_last: pr.length ? pr[pr.length - 1].pressure_hpa : null,
        pressure_min: pr.length ? Math.min(...pr.map((x) => x.pressure_hpa)) : null,
        pressure_max: pr.length ? Math.max(...pr.map((x) => x.pressure_hpa)) : null,
        pressure_change: pr.length > 1 ? Math.round((pr[pr.length - 1].pressure_hpa - pr[0].pressure_hpa) * 10) / 10 : null,
        frozen: rows.filter((x) => x.wind_flag === 'congelado').length,
      };
    });
  },
});

dash.calc('gwindow', {
  inputs: ['ranges'],
  title: 'Ventana de 12 horas de los gráficos',
  description: 'Las 12 horas que muestran los gráficos, fijadas por el deslizador dentro del rango elegido en Gráficos. Termina en la lectura más reciente del rango salvo que se mueva el deslizador.',
  fn: (ranges) => {
    const r = ranges.find((x) => x.page === 'g');
    if (!r || !r.from) return [];
    const W = 12 * 3600e3, a = wx.toMs(r.from), b = wx.toMs(r.to);
    let end = wx.toMs(dash.params().gwin || '');
    if (isNaN(end) || end > b) end = b;
    if (end < a + W) end = Math.min(b, a + W);
    return [{ from: wx.fromMs(Math.max(a, end - W)), to: wx.fromMs(end) }];
  },
});

dash.calc('grows', {
  inputs: ['readings', 'gwindow'],
  title: 'Lecturas en la ventana de los gráficos',
  description: 'Las lecturas de ambas estaciones dentro de la ventana de 12 horas de los gráficos.',
  fn: (readings, gwindow) => { const w = gwindow[0]; return w ? wxIn(readings, w) : []; },
});

dash.calc('gprecip', {
  inputs: ['readings', 'ranges'],
  title: 'Lluvia por día de observación',
  description: 'Lluvia de cada estación en el rango elegido en Gráficos, sumada por día de observación (08:00 a 07:59, con la fecha en que empieza), con la parte que probablemente es nieve derretida aparte.',
  fn: (readings, ranges) => {
    const r = ranges.find((x) => x.page === 'g');
    if (!r || !r.from) return [];
    const day = (t) => wx.fromMs(wx.obsStart(wx.toMs(t))).slice(0, 10);
    const out = new Map();
    for (let t = wx.obsStart(wx.toMs(r.from)); t <= wx.toMs(r.to); t += 86400e3) {
      const k = wx.fromMs(t).slice(0, 10);
      out.set(k, { day: k, lm: 0, an: 0, lm_melt: 0, an_melt: 0 });
    }
    wxIn(readings, r).forEach((x) => { const o = out.get(day(x.time_local)); if (o && x.precip_mm) { o[x.station] += x.precip_mm; o[x.station + '_melt'] += x.melt_mm || 0; } });
    const r1 = (v) => Math.round(v * 10) / 10;
    return [...out.values()].map((o) => ({ day: o.day, lm: r1(o.lm), an: r1(o.an), lm_melt: r1(o.lm_melt), an_melt: r1(o.an_melt) }));
  },
});

dash.calc('roses', {
  inputs: ['readings', 'ranges'],
  title: 'Rosas de vientos',
  description: 'Proporción de lecturas por dirección (16 rumbos) y rango de velocidad, para cada estación en el rango elegido en Gráficos. Calma es menos de 1 km/h; las lecturas con posible anemómetro congelado no se cuentan.',
  fn: (readings, ranges) => {
    const r = ranges.find((x) => x.page === 'g');
    if (!r || !r.from) return [];
    const sel = wxIn(readings, r);
    return wx.STATIONS.flatMap((s) => wx.rose(sel.filter((x) => x.station === s.id)).map((x) => ({ station: s.id, ...x })));
  },
});

dash.calc('rose_stats', {
  inputs: ['roses'],
  title: 'Proporción de calma',
  description: 'Proporción de lecturas con viento bajo 1 km/h en cada rosa de vientos.',
  fn: (roses) => wx.STATIONS.map((s) => { const c = roses.find((x) => x.station === s.id && x.sector === 'Calm'); return { station: s.id, calm_pct: c ? c.pct : null }; }),
});

dash.calc('dsel', {
  inputs: ['readings', 'ranges'],
  title: 'Lecturas de la tabla',
  description: 'Lecturas en el rango elegido en Datos, de la estación elegida.',
  fn: (readings, ranges) => {
    const r = ranges.find((x) => x.page === 'd');
    if (!r || !r.from) return [];
    const st = dash.params().dst || 'both';
    return wxIn(readings, r).filter((x) => st === 'both' || x.station === st);
  },
});
// Drawings. Each fills only its own element.
const wxEmpty = (el, text, h) => { el.replaceChildren(); const d = document.createElement('div'); d.className = 'bx-empty'; if (h) d.style.minHeight = h + 'px'; d.textContent = text; el.append(d); };
const wxRow = (id, st) => { const s = dash.data(id); return s.status === 'ok' && Array.isArray(s.data) ? (s.data.find((r) => r.station === st) || null) : null; };
const wxLoading = (el, ids, h) => {
  const st = ids.map((i) => dash.data(i).status);
  if (st.includes('loading')) { el.replaceChildren(); el.classList.add('dash-skeleton'); el.style.minHeight = (h || 120) + 'px'; return true; }
  el.classList.remove('dash-skeleton');
  if (st.includes('error') || st.includes('connect') || st.includes('declined')) { wxEmpty(el, 'No se pudo cargar', h); return true; }
  return false;
};
const wxTip = (el) => { const t = document.createElement('div'); t.className = 'bx-tip'; t.hidden = true; el.append(t); return t; };
const wxPlace = (el, tip, ev) => {
  const box = el.getBoundingClientRect();
  let x = ev.clientX - box.left + 12;
  if (x + tip.offsetWidth > box.width) x = ev.clientX - box.left - tip.offsetWidth - 12;
  tip.style.left = Math.max(0, x) + 'px'; tip.style.top = Math.max(0, ev.clientY - box.top + 12) + 'px';
};

dash.draw('val', (el) => {
  const s = dash.data(el.dataset.source);
  let row = null;
  if (s.status === 'ok' && Array.isArray(s.data)) {
    if (el.dataset.where) { const [k, v] = el.dataset.where.split('='); row = s.data.find((r) => String(r[k]) === v) || null; }
    else row = s.data[+(el.dataset.row || 0)] || null;
  }
  if (s.status !== 'loading') el.classList.remove('dash-skeleton');
  el.textContent = row ? wx.fmt(row[el.dataset.field], el.dataset.fmt) : '—';
});

dash.draw('range-input', (el) => {
  const rs = dash.data('ranges'), lt = dash.data('latest');
  const k = el.dataset.page;
  const all = lt.status === 'ok' ? lt.data.find((r) => r.station === 'all') : null;
  // Leave the box alone while someone is typing in it; the dates apply with the Aplicar button or Enter.
  if (document.activeElement === el) return;
  if (all && all.first_local) { el.min = all.first_local.replace(' ', 'T'); el.max = (all.time_local || all.first_local).replace(' ', 'T'); }
  const r = rs.status === 'ok' ? rs.data.find((x) => x.page === k) : null;
  if (r && r[el.dataset.end]) el.value = r[el.dataset.end].replace(' ', 'T');
});

// Temperature: latest, high and low as vertical bars from 0 °C.
dash.draw('tbars', (el) => {
  if (wxLoading(el, ['bstats'], 180)) return;
  const s = wxRow('bstats', el.dataset.st) || {};
  const items = [
    { label: 'Última', v: s.temp_last, t: s.temp_last_time, color: '#4a5560' },
    { label: 'Máx.', v: s.temp_max, t: s.temp_max_time, color: '#d62828' },
    { label: 'Mín.', v: s.temp_min, t: s.temp_min_time, color: '#2f74c0' },
  ];
  const ok = items.filter((d) => d.v != null);
  if (!ok.length) { wxEmpty(el, 'Sin lecturas en este rango', 150); return; }
  el.replaceChildren();
  const W = Math.max(el.clientWidth || 180, 150), H = 180, top = 8, bot = 62;
  const lo = Math.min(0, ...ok.map((d) => d.v)), hi = Math.max(0, ...ok.map((d) => d.v));
  const y = d3.scaleLinear().domain(lo === hi ? [lo - 1, hi + 1] : [lo, hi]).nice(4).range([H - bot, top]);
  const x = d3.scaleBand().domain(items.map((d) => d.label)).range([0, W]).paddingInner(0.3).paddingOuter(0.55);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
    .attr('aria-label', items.map((d) => `${d.label} ${wx.fmt(d.v, '1')} °C`).join(', '));
  svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(0)).attr('y2', y(0)).style('stroke', '#9aa1a9').style('stroke-dasharray', '4 3');
  svg.append('text').attr('x', 0).attr('y', y(0) - 3).attr('class', 'bx-faint').text('0 °C');
  const day = (t) => { const ms = wx.toMs(t); if (isNaN(ms)) return ''; const d = new Date(ms); return `${d.getUTCDate()} ${wx.MONTHS[d.getUTCMonth()]}`; };
  items.forEach((d) => {
    const cx = x(d.label) + x.bandwidth() / 2;
    if (d.v != null) svg.append('rect').attr('x', x(d.label)).attr('width', x.bandwidth()).attr('y', Math.min(y(0), y(d.v))).attr('height', Math.max(1.5, Math.abs(y(d.v) - y(0)))).attr('rx', 2).style('fill', d.color);
    svg.append('text').attr('x', cx).attr('y', H - bot + 14).attr('text-anchor', 'middle').attr('class', 'bx-faint').text(d.label);
    svg.append('text').attr('x', cx).attr('y', H - bot + 30).attr('text-anchor', 'middle').attr('class', 'bx-strong').text(wx.fmt(d.v, '1') + ' °C');
    svg.append('text').attr('x', cx).attr('y', H - bot + 44).attr('text-anchor', 'middle').attr('class', 'bx-faint bx-tiny').text(d.t ? wx.fmt(d.t, 'hm') : '');
    svg.append('text').attr('x', cx).attr('y', H - bot + 56).attr('text-anchor', 'middle').attr('class', 'bx-faint bx-tiny').text(d.t ? day(d.t) : '');
  });
});

// Compass: pointer on the rim at the direction the wind comes from, pointing inward; speed in the center.
window.wxCompass = (el, d) => {
  el.replaceChildren();
  if (d.speed == null) { wxEmpty(el, d.empty || 'Sin lecturas de viento', 120); return; }
  const S = 132, c = S / 2, R = 50;
  const svg = d3.select(el).append('svg').attr('width', '100%').style('max-width', S + 'px').attr('viewBox', `0 0 ${S} ${S}`).style('display', 'block').style('margin', '4px auto 0')
    .attr('role', 'img').attr('aria-label', `${wx.fmt(d.speed, '1')} km/h` + (d.dir != null ? ` del ${wx.compass(d.dir)}` : ''));
  const g = svg.append('g').attr('transform', `translate(${c},${c})`);
  g.append('circle').attr('r', R).attr('fill', d.fill || 'none').style('stroke', d.rim || '#c9ced4').style('stroke-width', 1.5);
  for (let a = 0; a < 360; a += 22.5) {
    const t = (a - 90) * Math.PI / 180, major = a % 90 === 0, r1 = R - (major ? 7 : 4);
    g.append('line').attr('x1', r1 * Math.cos(t)).attr('y1', r1 * Math.sin(t)).attr('x2', R * Math.cos(t)).attr('y2', R * Math.sin(t)).style('stroke', '#9aa1a9').style('stroke-width', major ? 1.5 : 1);
  }
  [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(([l, a]) => {
    const t = (a - 90) * Math.PI / 180;
    g.append('text').attr('x', (R + 9) * Math.cos(t)).attr('y', (R + 9) * Math.sin(t)).attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('class', 'bx-faint').text(l);
  });
  if (d.dir != null) g.append('path').attr('d', `M0,${-R + 22}L-8,${-R + 3}L8,${-R + 3}Z`).attr('transform', `rotate(${d.dir})`).style('fill', d.color || '#2e7d4f');
  g.append('text').attr('y', -2).attr('text-anchor', 'middle').attr('dominant-baseline', 'central').style('font-size', '22px').style('font-weight', d.weight || '300').style('fill', d.text || 'currentColor').text(wx.fmt(d.speed, '1'));
  g.append('text').attr('y', 16).attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('class', 'bx-faint').text('km/h');
};
dash.draw('compass', (el) => {
  if (wxLoading(el, ['bstats'], 132)) return;
  const s = wxRow('bstats', el.dataset.st) || {};
  wxCompass(el, { speed: s.wind_last, dir: s.wind_last_deg });
});
dash.draw('gustcompass', (el) => {
  if (wxLoading(el, ['bstats'], 132)) return;
  const s = wxRow('bstats', el.dataset.st) || {};
  wxCompass(el, { speed: s.gust_max, dir: s.gust_max_deg, color: '#d62828', rim: '#e8a3a3', fill: '#fdf3f3', text: '#b01f1f', weight: '400' });
});

// Single bar for the precipitation total of the range.
dash.draw('onebar', (el) => {
  if (wxLoading(el, ['bstats'], 128)) return;
  const s = wxRow('bstats', el.dataset.st) || {};
  const total = s.precip_mm;
  el.replaceChildren();
  if (total == null) { wxEmpty(el, 'Sin lecturas', 110); return; }
  const W = 150, H = 128, top = 18, bot = 6, l = 30;
  const y = d3.scaleLinear().domain([0, Math.max(10, total)]).nice(3).range([H - bot, top]);
  const svg = d3.select(el).append('svg').attr('width', '100%').style('max-width', W + 'px').attr('viewBox', `0 0 ${W} ${H}`).style('display', 'block').style('margin', '6px auto 0')
    .attr('role', 'img').attr('aria-label', `Lluvia ${wx.fmt(total, '1')} mm`);
  y.ticks(3).forEach((t) => {
    svg.append('line').attr('x1', l).attr('x2', W).attr('y1', y(t)).attr('y2', y(t)).style('stroke', t ? '#e6e9ec' : '#c9ced4');
    svg.append('text').attr('x', l - 5).attr('y', y(t) + 3).attr('text-anchor', 'end').attr('class', 'bx-faint bx-tiny').text(wx.fmt(t, '0'));
  });
  const bw = 46, bx = l + (W - l - bw) / 2, melt = Math.min(s.melt_mm || 0, total);
  if (total > melt) svg.append('rect').attr('x', bx).attr('width', bw).attr('y', y(total - melt)).attr('height', y(0) - y(total - melt)).style('fill', '#2f74c0');
  if (melt > 0) svg.append('rect').attr('x', bx).attr('width', bw).attr('y', y(total)).attr('height', y(total - melt) - y(total)).style('fill', '#b39ddb');
  svg.append('text').attr('x', bx + bw / 2).attr('y', y(total) - 5).attr('text-anchor', 'middle').attr('class', 'bx-strong').text(wx.fmt(total, '1') + ' mm');
});

// Semicircle gauge: needle at the latest value, band for the range's min–max.
window.wxGauge = (el, d) => {
  el.replaceChildren();
  if (d.v == null) { wxEmpty(el, 'Sin lecturas', 110); return; }
  const W = 180, H = 124, cx = W / 2, cy = 84, R = 58, th = 12, lo = d.min, hi = d.max;
  const ang = (p) => (-90 + 180 * (Math.max(lo, Math.min(hi, p)) - lo) / (hi - lo)) * Math.PI / 180;
  const arc = d3.arc().innerRadius(R - th).outerRadius(R);
  const svg = d3.select(el).append('svg').attr('width', '100%').style('max-width', W + 'px').attr('viewBox', `0 0 ${W} ${H}`).style('display', 'block').style('margin', '4px auto 0')
    .attr('role', 'img').attr('aria-label', `${wx.fmt(d.v, d.dp)} ${d.unit}`);
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  g.append('path').attr('d', arc({ startAngle: ang(lo), endAngle: ang(hi) })).style('fill', '#e6e9ec');
  if (d.bandLo != null && d.bandHi != null) g.append('path').attr('d', arc({ startAngle: ang(d.bandLo), endAngle: ang(Math.max(d.bandHi, d.bandLo + (hi - lo) / 200)) })).style('fill', d.band);
  d.ticks.forEach((p) => {
    const t = ang(p) - Math.PI / 2;
    g.append('line').attr('x1', (R + 1) * Math.cos(t)).attr('y1', (R + 1) * Math.sin(t)).attr('x2', (R + 5) * Math.cos(t)).attr('y2', (R + 5) * Math.sin(t)).style('stroke', '#9aa1a9');
  });
  [lo, (lo + hi) / 2, hi].forEach((p, i) => {
    const t = ang(p) - Math.PI / 2;
    g.append('text').attr('x', (R + 8) * Math.cos(t)).attr('y', (R + 9) * Math.sin(t) + (i === 1 ? -2 : 4)).attr('text-anchor', i === 0 ? 'end' : i === 2 ? 'start' : 'middle').attr('class', 'bx-faint bx-tiny').text(wx.fmt(p, '0'));
  });
  const a = ang(d.v) - Math.PI / 2;
  g.append('line').attr('x2', (R - 3) * Math.cos(a)).attr('y2', (R - 3) * Math.sin(a)).style('stroke', d.needle).style('stroke-width', 3).style('stroke-linecap', 'round');
  g.append('circle').attr('r', 4.5).style('fill', d.needle);
  g.append('text').attr('y', 30).attr('text-anchor', 'middle').style('font-size', '20px').style('font-weight', '300').style('fill', 'currentColor').text(wx.fmt(d.v, d.dp) + ' ' + d.unit);
};
dash.draw('rhgauge', (el) => {
  if (wxLoading(el, ['bstats'], 124)) return;
  const s = wxRow('bstats', el.dataset.st) || {};
  wxGauge(el, { v: s.rh_last, min: 0, max: 100, ticks: [0, 25, 50, 75, 100], bandLo: s.rh_min, bandHi: s.rh_max, band: '#a9c8ea', needle: '#2f74c0', unit: '%', dp: '0' });
});
dash.draw('solargauge', (el) => {
  if (wxLoading(el, ['bstats'], 124)) return;
  const s = wxRow('bstats', el.dataset.st) || {};
  wxGauge(el, { v: s.solar_last, min: 0, max: 1400, ticks: [0, 350, 700, 1050, 1400], bandLo: 0, bandHi: s.solar_max, band: '#f7dc8f', needle: '#c98a00', unit: 'W/m²', dp: '0' });
});

// Barometer dial, 980–1040 hPa (mb).
dash.draw('baro', (el) => {
  if (wxLoading(el, ['bstats'], 128)) return;
  const rows = (dash.data('bstats').data || []);
  const s = rows.find((r) => r.pressure_last != null) || {};
  el.replaceChildren();
  if (s.pressure_last == null) { wxEmpty(el, 'Sin lecturas', 110); return; }
  const LO = 980, HI = 1040, W = 180, H = 128, R = 58, th = 10;
  const ang = (p) => (-120 + 240 * (Math.max(LO, Math.min(HI, p)) - LO) / (HI - LO)) * Math.PI / 180;
  const arc = d3.arc().innerRadius(R - th).outerRadius(R);
  const svg = d3.select(el).append('svg').attr('width', '100%').style('max-width', W + 'px').attr('viewBox', `0 0 ${W} ${H}`).style('display', 'block').style('margin', '4px auto 0')
    .attr('role', 'img').attr('aria-label', `Presión ${wx.fmt(s.pressure_last, '1')} mb`);
  const g = svg.append('g').attr('transform', `translate(${W / 2},74)`);
  g.append('path').attr('d', arc({ startAngle: ang(LO), endAngle: ang(HI) })).style('fill', '#ece8f3');
  if (s.pressure_min != null) g.append('path').attr('d', arc({ startAngle: ang(s.pressure_min), endAngle: ang(Math.max(s.pressure_max, s.pressure_min + 0.4)) })).style('fill', '#b7a6d6');
  for (let p = LO; p <= HI; p += 5) {
    const t = ang(p) - Math.PI / 2, major = p % 20 === 0;
    g.append('line').attr('x1', (R + 1) * Math.cos(t)).attr('y1', (R + 1) * Math.sin(t)).attr('x2', (R + (major ? 6 : 3)) * Math.cos(t)).attr('y2', (R + (major ? 6 : 3)) * Math.sin(t)).style('stroke', '#9aa1a9');
    if (major) g.append('text').attr('x', (R + 15) * Math.cos(t)).attr('y', (R + 15) * Math.sin(t) + 3).attr('text-anchor', 'middle').attr('class', 'bx-faint bx-tiny').text(wx.fmt(p, '0'));
  }
  const a = ang(s.pressure_last) - Math.PI / 2;
  g.append('line').attr('x1', -10 * Math.cos(a)).attr('y1', -10 * Math.sin(a)).attr('x2', (R - 2) * Math.cos(a)).attr('y2', (R - 2) * Math.sin(a)).style('stroke', '#5b3f99').style('stroke-width', 2.5).style('stroke-linecap', 'round');
  g.append('circle').attr('r', 4.5).style('fill', '#5b3f99');
  g.append('text').attr('y', 34).attr('text-anchor', 'middle').style('font-size', '20px').style('font-weight', '300').style('fill', 'currentColor').text(wx.fmt(s.pressure_last, '1'));
  g.append('text').attr('y', 48).attr('text-anchor', 'middle').attr('class', 'bx-faint').text('mb');
});

// Wind rose for one station, both roses on the same scale.
dash.draw('rose', (el) => {
  if (wxLoading(el, ['roses'], 240)) return;
  const all = dash.data('roses').data || [];
  const rows = all.filter((r) => r.station === el.dataset.st);
  el.replaceChildren();
  if (!rows.reduce((s, r) => s + r.readings, 0)) { wxEmpty(el, 'Sin lecturas de viento en este rango', 240); return; }
  const petal = (st) => { const t = {}; all.filter((r) => r.station === st && r.sector !== 'Calm').forEach((r) => { t[r.sector] = (t[r.sector] || 0) + r.pct; }); return Math.max(0, ...Object.values(t)); };
  const maxPct = Math.max(...wx.STATIONS.map((s) => petal(s.id))) || 1;
  const step = Math.max(1, d3.tickStep(0, maxPct, 3)), top = Math.ceil(maxPct / step) * step;
  const W = Math.min(el.clientWidth || 260, 300), R = W / 2 - 16, r0 = 11;
  const rs = d3.scaleLinear().domain([0, top]).range([r0, R]);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', W).attr('viewBox', `0 0 ${W} ${W}`).style('display', 'block').style('margin', '0 auto').attr('role', 'img').attr('aria-label', 'Rosa de vientos');
  const g = svg.append('g').attr('transform', `translate(${W / 2},${W / 2})`);
  for (let v = step; v <= top; v += step) g.append('circle').attr('r', rs(v)).attr('fill', 'none').style('stroke', '#e6e9ec');
  g.append('text').attr('x', W / 2 - 1).attr('y', W / 2 - 1).attr('text-anchor', 'end').attr('class', 'bx-faint bx-tiny').text('anillo ' + step + '%');
  wx.PTS.forEach((p, i) => {
    if (i % 2) return;
    const ang = (i * 22.5 - 90) * Math.PI / 180;
    g.append('line').attr('x1', r0 * Math.cos(ang)).attr('y1', r0 * Math.sin(ang)).attr('x2', R * Math.cos(ang)).attr('y2', R * Math.sin(ang)).style('stroke', '#e6e9ec');
    if (i % 4 === 0) g.append('text').attr('x', (R + 8) * Math.cos(ang)).attr('y', (R + 8) * Math.sin(ang)).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('class', 'bx-faint').text(p);
  });
  const arc = d3.arc(), half = (11.25 - 1.2) * Math.PI / 180;
  const tip = wxTip(el), cum = {};
  rows.filter((r) => r.sector !== 'Calm').forEach((r) => {
    const bi = wx.BINS.findIndex((x) => x[2] === r.speed_band);
    const c0 = cum[r.sector] || 0, c1 = c0 + r.pct;
    cum[r.sector] = c1;
    if (!r.pct) return;
    const mid = r.sector_deg * Math.PI / 180;
    g.append('path').attr('d', arc({ innerRadius: rs(c0), outerRadius: rs(c1), startAngle: mid - half, endAngle: mid + half }))
      .style('fill', wx.BAND_COLORS[bi]).style('stroke', '#fff').style('stroke-width', 0.5)
      .on('pointerenter pointermove', (ev) => {
        tip.replaceChildren();
        [`Del ${r.sector}, ${r.speed_band} km/h`, `${wx.fmt(r.pct, '1')}% del tiempo`, `Todas las velocidades del ${r.sector}: ${wx.fmt(rows.filter((x) => x.sector === r.sector).reduce((t, x) => t + x.pct, 0), '1')}%`]
          .forEach((s) => { const d = document.createElement('div'); d.textContent = s; tip.append(d); });
        tip.hidden = false; wxPlace(el, tip, ev);
      })
      .on('pointerleave', () => { tip.hidden = true; });
  });
  const calm = rows.find((r) => r.sector === 'Calm');
  g.append('circle').attr('r', r0 - 2).style('fill', '#fff').style('stroke', '#c9ced4');
  g.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('class', 'bx-tiny').text(calm ? Math.round(calm.pct) + '%' : '');
});

dash.draw('win-slider', (el) => {
  const rs = dash.data('ranges'), cw = dash.data('gwindow');
  const r = rs.status === 'ok' ? rs.data.find((x) => x.page === 'g') : null;
  const w = cw.status === 'ok' && cw.data ? cw.data[0] : null;
  if (!r || !w || !r.from) { el.disabled = true; return; }
  const STEP = 15 * 60e3, W = 12 * 3600e3, a = wx.toMs(r.from), b = wx.toMs(r.to);
  const n = Math.max(0, Math.ceil((b - a - W) / STEP));
  el.max = String(n);
  el.disabled = n === 0;
  if (document.activeElement !== el) el.value = String(n ? Math.min(n, Math.round((wx.toMs(w.to) - a - W) / STEP)) : 0);
  el.oninput = () => { const v = +el.value; dash.setParams({ gwin: v >= n ? null : wx.fromMs(a + W + v * STEP) }); };
});

// Time-series chart with one series per station.
const WX_CHARTS = {
  temp: { label: 'Temperatura en el tiempo, °C', zero: 0, unit: ' °C', series: [{ key: 'temp_c' }] },
  wind: { label: 'Viento y ráfagas en el tiempo, km/h', floor0: true, unit: ' km/h', series: [{ key: 'wind_avg_kmh', arrows: true, label: 'promedio', title: 'Promedio y dirección' }, { key: 'wind_gust_kmh', dots: true, light: true, label: 'ráfaga', title: 'Ráfaga', hex: '#d62828' }] },
  rh: { label: 'Humedad relativa en el tiempo, %', yDomain: [0, 100], unit: ' %', dp: '0', series: [{ key: 'rh_pct' }] },
  solar: { label: 'Radiación solar en el tiempo, W/m²', floor0: true, unit: ' W/m²', dp: '0', series: [{ key: 'solar_wm2' }] },
  pressure: { label: 'Presión barométrica en el tiempo, mb', unit: ' mb', single: true, series: [{ key: 'pressure_hpa' }] },
};
dash.draw('chart', (el) => {
  if (wxLoading(el, ['grows', 'gwindow'], 200)) return;
  const cfg = WX_CHARTS[el.dataset.chart];
  const rows = dash.data('grows').data || [], w = (dash.data('gwindow').data || [])[0];
  el.replaceChildren();
  const one = el.dataset.st;
  const stations = cfg.single ? [wx.STATIONS[0]] : wx.STATIONS.filter((s) => !one || s.id === one);
  const series = [];
  stations.forEach((st) => cfg.series.forEach((s) => {
    const pts = rows.filter((r) => (cfg.single ? true : r.station === st.id) && r[s.key] != null).map((r) => ({ t: wx.toMs(r.time_local), v: r[s.key], r }));
    if (cfg.single) { const seen = new Set(); for (let i = pts.length - 1; i >= 0; i -= 1) { if (seen.has(pts[i].t)) pts.splice(i, 1); else seen.add(pts[i].t); } pts.sort((a, b) => a.t - b.t); }
    series.push({ ...s, st, pts, color: cfg.single ? '#5b3f99' : (one && s.hex ? s.hex : (one && s.arrows && st.id === 'an' ? '#1e6b3a' : (s.light ? st.light : st.color))), name: cfg.single ? 'Presión' : one && s.title ? s.title : st.name + (s.label ? ' ' + s.label : '') });
  }));
  const all = series.flatMap((s) => s.pts.map((p) => p.v));
  // Per-station graphs share one scale, so the two stations compare at a glance.
  const scaleVals = one ? rows.flatMap((r) => cfg.series.map((s) => r[s.key])).filter((v) => v != null) : all;
  if (!all.length || !w) { wxEmpty(el, 'Sin lecturas en esta ventana', 200); return; }
  const W = Math.max(el.clientWidth || 320, 240), H = 210;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', cfg.label);
  let yd = cfg.yDomain || d3.extent(scaleVals);
  if (!cfg.yDomain) { if (cfg.zero != null) yd = [Math.min(yd[0], cfg.zero), Math.max(yd[1], cfg.zero)]; if (cfg.floor0) yd[0] = 0; if (yd[0] === yd[1]) yd = cfg.floor0 ? [0, Math.max(1, yd[1] * 1.2)] : [yd[0] - 1, yd[1] + 1]; }
  const y = d3.scaleLinear().domain(yd).range([H - 24, 22]);
  if (!cfg.yDomain) y.nice(5);
  const ya = svg.append('g').call(d3.axisLeft(y).ticks(5));
  let wl = 0; ya.selectAll('text').each(function () { wl = Math.max(wl, this.getComputedTextLength()); });
  const m = { l: wl + 12, r: 10 };
  ya.attr('transform', `translate(${m.l},0)`);
  const x = d3.scaleUtc().domain([wx.toMs(w.from), wx.toMs(w.to)]).range([m.l, W - m.r]);
  const [d0, d1] = x.domain().map(Number);
  const bands = svg.insert('g', ':first-child');
  for (let t = Math.floor(d0 / 3600e3) * 3600e3; t < d1; t += 3600e3) {
    if (new Date(t).getUTCHours() % 2) continue;
    const xa = x(Math.max(t, d0)), xb = x(Math.min(t + 3600e3, d1));
    bands.append('rect').attr('x', xa).attr('width', Math.max(0, xb - xa)).attr('y', 22).attr('height', H - 46).style('fill', 'rgba(70,130,200,0.08)');
  }
  svg.append('g').attr('class', 'bx-grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.r - m.l)).tickFormat(''));
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((W - m.l) / 80))).tickFormat((d) => { const t = +d; return t % 86400e3 === 0 ? wx.fmt(wx.fromMs(t), 'date').slice(0, -5) : wx.fromMs(t).slice(11, 16); }));
  if (cfg.zero != null && y.domain()[0] < cfg.zero && y.domain()[1] > cfg.zero) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', '#9aa1a9').style('stroke-dasharray', '4 3');
  series.forEach((s) => {
    if (s.arrows) {
      const ga = svg.append('g');
      s.pts.forEach((d) => {
        const gx = ga.append('g').attr('transform', `translate(${x(d.t)},${y(d.v)})`);
        if (d.r.wind_dir_deg == null) gx.append('circle').attr('r', 2).style('fill', s.color);
        else gx.append('path').attr('d', 'M0,-5.5L3.5,4L0,2L-3.5,4Z').attr('transform', `rotate(${(d.r.wind_dir_deg + 180) % 360})`).style('fill', s.color);
      });
      return;
    }
    if (s.dots) { svg.append('g').selectAll('circle').data(s.pts).join('circle').attr('cx', (d) => x(d.t)).attr('cy', (d) => y(d.v)).attr('r', 2).style('fill', s.color); return; }
    const withGaps = [];
    s.pts.forEach((d, i) => { if (i && d.t - s.pts[i - 1].t > 45 * 60e3) withGaps.push({ gap: true, t: d.t }); withGaps.push(d); });
    svg.append('path').datum(withGaps).attr('d', d3.line().defined((d) => !d.gap).x((d) => x(d.t)).y((d) => y(d.v))).attr('fill', 'none').style('stroke', s.color).style('stroke-width', 1.6);
  });
  // Legend
  const lg = svg.append('g').attr('transform', `translate(${m.l + 2},12)`);
  let lx = 0;
  series.forEach((s) => {
    if (s.arrows) lg.append('path').attr('d', 'M0,-5.5L3.5,4L0,2L-3.5,4Z').attr('transform', `translate(${lx + 5},-4) rotate(90) scale(0.8)`).style('fill', s.color);
    else if (s.dots) lg.append('circle').attr('cx', lx + 5).attr('cy', -4).attr('r', 2.5).style('fill', s.color);
    else lg.append('rect').attr('x', lx).attr('y', -5.5).attr('width', 10).attr('height', 3).style('fill', s.color);
    const t = lg.append('text').attr('x', lx + 14).attr('y', -1).attr('class', 'bx-tiny').text(s.name);
    lx += 24 + t.node().getComputedTextLength();
  });
  // Tooltip: values of each series at the nearest time.
  const tip = wxTip(el);
  const hl = svg.append('line').attr('y1', 22).attr('y2', H - 24).style('stroke', '#9aa1a9').style('visibility', 'hidden');
  const bis = d3.bisector((d) => d.t).center;
  svg.append('rect').attr('x', m.l).attr('y', 0).attr('width', W - m.l - m.r).attr('height', H - 24).attr('fill', 'transparent')
    .on('pointermove', (ev) => {
      const t = +x.invert(d3.pointer(ev)[0]);
      const near = series.map((s) => { const d = s.pts[bis(s.pts, t)]; return d && Math.abs(d.t - t) < 20 * 60e3 ? { s, d } : { s, d: null }; });
      const ref = near.find((n) => n.d);
      if (!ref) return;
      hl.attr('x1', x(ref.d.t)).attr('x2', x(ref.d.t)).style('visibility', 'visible');
      tip.replaceChildren();
      const h = document.createElement('div'); h.className = 'bx-tip-h'; h.textContent = wx.fmt(ref.d.r.time_local, 'time'); tip.append(h);
      near.forEach(({ s, d }) => {
        const l = document.createElement('div');
        const dir = s.arrows && d && d.r.wind_dir_deg != null ? ` del ${wx.compass(d.r.wind_dir_deg)}` : '';
        const frozen = s.arrows && !d ? (rows.find((r) => r.station === s.st.id && Math.abs(wx.toMs(r.time_local) - ref.d.t) < 8 * 60e3 && r.wind_flag === 'congelado') ? ' (anemómetro congelado)' : '') : '';
        l.textContent = `${s.name}: ${d ? wx.fmt(d.v, cfg.dp || '1') + cfg.unit + dir : '—' + frozen}`;
        tip.append(l);
      });
      tip.hidden = false; wxPlace(el, tip, ev);
    })
    .on('pointerleave', () => { tip.hidden = true; hl.style('visibility', 'hidden'); });
});

// Precipitation per obs day, grouped bars per station.
dash.draw('pbars', (el) => {
  if (wxLoading(el, ['gprecip'], 200)) return;
  const rows = dash.data('gprecip').data || [];
  el.replaceChildren();
  if (!rows.length) { wxEmpty(el, 'Sin lecturas en este rango', 200); return; }
  const W = Math.max(el.clientWidth || 320, 240), H = 210;
  const mx = Math.max(1, ...rows.flatMap((r) => [r.lm, r.an]));
  const MELT = { lm: '#9cc0e3', an: '#f2c08e' };
  const y = d3.scaleLinear().domain([0, mx * 1.15]).nice(4).range([H - 24, 22]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Lluvia por día de observación, mm');
  const ya = svg.append('g').call(d3.axisLeft(y).ticks(4));
  let wl = 0; ya.selectAll('text').each(function () { wl = Math.max(wl, this.getComputedTextLength()); });
  const ml = wl + 12, mr = 10;
  ya.attr('transform', `translate(${ml},0)`);
  svg.append('g').attr('class', 'bx-grid').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - mr - ml)).tickFormat(''));
  const x = d3.scaleBand().domain(rows.map((r) => r.day)).range([ml, W - mr]).padding(0.2);
  const xi = d3.scaleBand().domain(['lm', 'an']).range([0, x.bandwidth()]).padding(0.08);
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor((W - ml) / 56))));
  svg.append('g').attr('transform', `translate(0,${H - 24})`).call(d3.axisBottom(x).tickValues(rows.map((r) => r.day).filter((_, i) => i % every === 0)).tickFormat((d) => wx.fmt(d + ' 08:00', 'date').slice(0, -5)));
  const tip = wxTip(el);
  wx.STATIONS.forEach((st) => {
    const g = svg.append('g');
    g.selectAll('rect.m').data(rows).join('rect').attr('class', 'm')
      .attr('x', (r) => x(r.day) + xi(st.id)).attr('width', xi.bandwidth()).attr('y', (r) => y(r[st.id])).attr('height', (r) => y(r[st.id] - r[st.id + '_melt']) - y(r[st.id])).style('fill', MELT[st.id]);
    g.selectAll('rect.r').data(rows).join('rect').attr('class', 'r')
      .attr('x', (r) => x(r.day) + xi(st.id)).attr('width', xi.bandwidth()).attr('y', (r) => y(r[st.id] - r[st.id + '_melt'])).attr('height', (r) => y(0) - y(r[st.id] - r[st.id + '_melt'])).style('fill', st.color)
      .on('pointerenter pointermove', (ev, r) => {
        tip.replaceChildren();
        [`Día de obs. del ${wx.fmt(r.day + ' 08:00', 'date')}`, ...wx.STATIONS.map((s) => `${s.name}: ${wx.fmt(r[s.id], '1')} mm` + (r[s.id + '_melt'] ? `, ${wx.fmt(r[s.id + '_melt'], '1')} posible nieve derretida` : ''))].forEach((s) => { const d = document.createElement('div'); d.textContent = s; tip.append(d); });
        tip.hidden = false; wxPlace(el, tip, ev);
      })
      .on('pointerleave', () => { tip.hidden = true; });
  });
  const lg = svg.append('g').attr('transform', `translate(${ml + 2},12)`);
  let lx = 0;
  wx.STATIONS.forEach((st) => { lg.append('rect').attr('x', lx).attr('y', -9).attr('width', 10).attr('height', 10).style('fill', st.color); const t = lg.append('text').attr('x', lx + 14).attr('y', -1).attr('class', 'bx-tiny').text(st.name); lx += 24 + t.node().getComputedTextLength(); });
  lg.append('rect').attr('x', lx).attr('y', -9).attr('width', 5).attr('height', 10).style('fill', MELT.lm); lg.append('rect').attr('x', lx + 5).attr('y', -9).attr('width', 5).attr('height', 10).style('fill', MELT.an);
  lg.append('text').attr('x', lx + 14).attr('y', -1).attr('class', 'bx-tiny').text('Posible nieve derretida (tono claro)');
});

dash.draw('table-body', (tb) => {
  const s = dash.data('dsel');
  tb.replaceChildren();
  if (s.status !== 'ok') return;
  const NAME = { lm: 'La Mesada', an: 'Antena' };
  const cols = [['time_local', 'text'], ['station', 'st'], ['temp_c', '1'], ['dew_point_c', '1'], ['rh_pct', '0'], ['wind_avg_kmh', '1'], ['wind_gust_kmh', '1'], ['dir_compass', 'text'], ['precip_mm', 'rain'], ['melt_mm', 'melt'], ['solar_wm2', '0'], ['pressure_hpa', '1'], ['note', 'note']];
  const frag = document.createDocumentFragment();
  s.data.slice().reverse().slice(0, wx.tableLimit).forEach((r) => {
    const tr = document.createElement('tr');
    cols.forEach(([k, f]) => {
      const td = document.createElement('td');
      const v = r[k];
      if (f === 'st') { td.textContent = NAME[v] || v; td.className = 'bx-l'; }
      else if (f === 'rain') td.textContent = v == null ? '' : wx.fmt(v, '1') + (r.melt_mm ? '*' : '');
      else if (f === 'melt') td.textContent = v ? wx.fmt(v, '1') : '';
      else if (f === 'note') { td.textContent = [r.wind_flag === 'congelado' ? 'Posible anemómetro congelado' : '', v || ''].filter(Boolean).join('. '); td.className = 'bx-l bx-note'; }
      else td.textContent = v == null || v === '' ? '' : (f === 'text' ? String(v) : wx.fmt(v, f));
      tr.append(td);
    });
    frag.append(tr);
  });
  tb.append(frag);
});
// Controls: listen, and set classes, hidden and values only.
const bxTabs = document.querySelectorAll('.bx-tab[data-tab]');
const bxOpen = (id) => {
  bxTabs.forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  document.querySelectorAll('.bx-page').forEach((s) => { s.hidden = s.id !== id; });
  dash.setLink(id);
};
bxTabs.forEach((b) => b.addEventListener('click', () => bxOpen(b.dataset.tab)));
(() => {
  const h = (location.hash || '').replace('#', '');
  if (h && document.getElementById(h) && document.getElementById(h).classList.contains('bx-page')) bxOpen(h);
})();

document.querySelectorAll('.bx-btn[data-preset]').forEach((b) => b.addEventListener('click', () => {
  dash.setParams({ rpreset: b.dataset.preset, rfrom: null, rto: null, gwin: null });
}));
const bxApply = (k) => {
  const get = (end) => { const el = document.querySelector(`.bx-input[data-page="${k}"][data-end="${end}"]`); return el && el.value ? el.value.replace('T', ' ') : ''; };
  const from = get('from'), to = get('to');
  if (!from || !to) return;
  dash.setParams({ rpreset: 'custom', rfrom: from <= to ? from : to, rto: from <= to ? to : from, gwin: null });
};
document.querySelectorAll('.bx-apply').forEach((b) => b.addEventListener('click', () => bxApply(b.dataset.page)));
document.querySelectorAll('.bx-input[data-end]').forEach((el) => el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); bxApply(el.dataset.page); } }));
document.querySelectorAll('.bx-station').forEach((s) => s.addEventListener('change', () => { wx.tableLimit = 300; dash.setParams({ dst: s.value }); }));
document.querySelectorAll('.bx-more').forEach((b) => b.addEventListener('click', () => { wx.tableLimit += 300; dash.draw('table-body'); }));
document.querySelectorAll('.bx-sw').forEach((sw) => { sw.style.background = wx.BAND_COLORS[+sw.dataset.i] || 'transparent'; });

document.querySelectorAll('.bx-csv').forEach((b) => b.addEventListener('click', () => {
  const s = dash.data('dsel');
  if (s.status !== 'ok') return;
  const NAME = { lm: 'La Mesada', an: 'Antena' };
  const cols = ['time_local', 'station', 'temp_c', 'temp_hi_c', 'temp_lo_c', 'dew_point_c', 'wind_chill_c', 'rh_pct', 'wind_avg_kmh', 'wind_gust_kmh', 'wind_dir_deg', 'dir_compass', 'wind_gust_dir_deg', 'precip_mm', 'melt_mm', 'solar_wm2', 'pressure_hpa', 'wind_flag', 'note'];
  const head = ['hora_local', 'estacion', 'temp_c', 'temp_max_c', 'temp_min_c', 'punto_rocio_c', 'sensacion_termica_c', 'hr_pct', 'viento_prom_kmh', 'rafaga_kmh', 'dir_grados', 'dir', 'dir_rafaga_grados', 'lluvia_mm', 'posible_nieve_derretida_mm', 'radiacion_solar_wm2', 'presion_mb', 'anemometro', 'nota'];
  const esc = (v) => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const csv = [head.join(',')].concat(s.data.map((r) => cols.map((c) => esc(c === 'station' ? NAME[r[c]] : c === 'wind_flag' ? (r[c] ? 'posible congelado' : '') : r[c])).join(','))).join('\n');
  const r = (dash.data('ranges').data || []).find((x) => x.page === 'd');
  const st = dash.params().dst || 'both';
  const name = 'Baguales ' + (st === 'both' ? 'La Mesada y Antena' : NAME[st]) + ' ' + (r ? r.from.slice(0, 10) + ' a ' + r.to.slice(0, 10) : '') + '.csv';
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}));

dash.onData(() => {
  const p = dash.params();
  document.querySelectorAll('.bx-btn[data-preset]').forEach((b) => b.classList.toggle('is-active', (p.rpreset || 'obscur') === b.dataset.preset));
  document.querySelectorAll('.bx-station').forEach((s) => { if (document.activeElement !== s) s.value = p.dst || 'both'; });
  const d = dash.data('dsel');
  document.querySelectorAll('.bx-more').forEach((b) => { b.hidden = !(d.status === 'ok' && d.data.length > wx.tableLimit); });
  const st = dash.data('bstats');
  document.querySelectorAll('.bx-frozen').forEach((el) => { const r = st.status === 'ok' ? st.data.find((x) => x.station === el.dataset.st) : null; el.hidden = !(r && r.frozen > 0); });
});
