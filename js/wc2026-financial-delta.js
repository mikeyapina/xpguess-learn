const SUPABASE_URL = 'https://cckhswhugilbmiarwbvt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNja2hzd2h1Z2lsYm1pYXJ3YnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3NTQ0MDAsImV4cCI6MjA1MjMzMDQwMH0.YOUR_ANON_KEY_HERE'; // <-- REPLACE WITH YOUR REAL ANON KEY

function fmtM(n) {
  if (n == null || typeof n !== 'number' || !isFinite(n)) return '$0.0M';
  return '$' + n.toFixed(1) + 'M';
}
function fmtDelta(n) {
  if (n == null || typeof n !== 'number' || !isFinite(n)) return '$0.0M';
  const sign = n >= 0 ? '+' : '';
  return sign + '$' + n.toFixed(1) + 'M';
}
function fmtResilience(n) {
  if (n == null || typeof n !== 'number' || !isFinite(n)) return '100.0%';
  return n.toFixed(1) + '%';
}
function trend(score) {
  if (!isFinite(score)) return '▬';
  if (score > 105) return '▲';
  if (score < 95) return '▼';
  return '▬';
}

async function fetchSupa(table, order) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  if (order) url += `&order=${encodeURIComponent(order)}`;
  const r = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  return r.json();
}

function safeNum(n, fallback) {
  return (typeof n === 'number' && isFinite(n)) ? n : fallback;
}

function renderContinents(data) {
  const tbody = document.getElementById('continental-financial-tbody');
  if (!tbody) return;
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">No data</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(c => {
    const teams = safeNum(c.teams, 0);
    const alive = safeNum(c.alive, 0);
    const eliminated = safeNum(c.eliminated, 0);
    const earnings = safeNum(c.total_earnings_usd_m, 0);
    const totalDelta = safeNum(c.total_delta_usd_m, 0);
    const resilience = safeNum(c.resilience_score, 100);
    const avgDelta = teams ? totalDelta / teams : 0;
    return `<tr>
      <td><strong>${c.continent_label || 'Unknown'}</strong></td>
      <td style="text-align:center">${teams}</td>
      <td style="text-align:center;color:#16a34a">${alive}</td>
      <td style="text-align:center;color:#dc2626">${eliminated}</td>
      <td style="text-align:right;font-family:monospace">${fmtM(earnings)}</td>
      <td style="text-align:right;font-family:monospace">${fmtDelta(avgDelta)}</td>
      <td style="text-align:right">${fmtResilience(resilience)} ${trend(resilience)}</td>
    </tr>`;
  }).join('');
}

function renderTeams(data) {
  const tbody = document.getElementById('team-delta-tbody');
  if (!tbody) return;
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px">No data</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(t => {
    const baseline = safeNum(t.baseline_prize_usd_m, 9.0);
    const current = safeNum(t.current_prize_usd_m, 9.0);
    const delta = safeNum(t.prize_delta_usd_m, 0);
    const hasData = !!t.has_latest_delta;
    return `<tr style="${!hasData ? 'opacity:0.6' : ''}">
      <td><strong>${t.team_name || 'Unknown'}</strong></td>
      <td>${t.group_name || '-'}</td>
      <td>${t.mapped_stage || 'Group Stage'}</td>
      <td>${t.status || '<span style="color:#999">Group Stage</span>'}</td>
      <td style="text-align:right;font-family:monospace">${fmtM(baseline)}</td>
      <td style="text-align:right;font-family:monospace">${fmtM(current)}</td>
      <td style="text-align:right;font-family:monospace;color:${delta > 0 ? '#16a34a' : '#666'}">${fmtDelta(delta)}</td>
    </tr>`;
  }).join('');
}

async function loadFinancialDelta() {
  const status = document.getElementById('financial-delta-status');
  if (status) status.textContent = 'Loading...';
  try {
    const [teams, continents] = await Promise.all([
      fetchSupa('wc2026_team_financial_live', 'continent_label,team_name'),
      fetchSupa('wc2026_continent_financial_live', 'total_earnings_usd_m.desc'),
    ]);
    renderContinents(continents);
    renderTeams(teams);
    if (status) status.innerHTML = `Updated: ${new Date().toLocaleString()} <button onclick="loadFinancialDelta()" style="margin-left:10px;padding:3px 8px;background:#2563eb;color:#fff;border:none;border-radius:3px;cursor:pointer">Refresh</button>`;
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Error: ' + err.message;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadFinancialDelta);
} else {
  loadFinancialDelta();
}
window.loadFinancialDelta = loadFinancialDelta;
