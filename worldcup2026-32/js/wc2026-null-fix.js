/**
 * WC2026 TCI Dashboard — Null-Safe Patch (CORRECTED)
 * Apply after the main <script> block. This overrides the broken functions
 * with null-safe versions and provides hardcoded prize-tier fallbacks.
 */

// ============================================================
// 1. HARDCODED FIFA WC2026 PRIZE TIERS (ultimate fallback)
// ============================================================
var WC2026_PRIZE_TIERS_HARD = {
  'Group Stage': 9,
  'Round of 32': 11,
  'Round of 16': 15,
  'Quarter-Finals': 19,
  'Fourth Place': 27,
  'Third Place': 29,
  'Runner-up': 33,
  'Winner': 50
};

// ============================================================
// 2. SAFE PRIZE TIER RESOLVER (never returns null)
// ============================================================
// Save original BEFORE any override
var _origGetPrizeTiers = window.getPrizeTiers;

function getPrizeTiersSafe() {
  // Try original first (if it exists and DB has data)
  var tiers = null;
  try {
    if(_origGetPrizeTiers) tiers = _origGetPrizeTiers();
  } catch(e) {}

  if(tiers && typeof tiers === 'object' && Object.keys(tiers).length >= 4) {
    return tiers;
  }
  console.warn('[null-fix] DB prize tiers missing/invalid — using hardcoded WC2026 values');
  return Object.assign({}, WC2026_PRIZE_TIERS_HARD);
}

// NEVER override getPrizeTiers globally — the render overrides use getPrizeTiersSafe directly

// Convenience: prize for any stage label, never fails
function getPrizeSafe(stageLabel) {
  var tiers = getPrizeTiersSafe();
  var s = String(stageLabel || '').toLowerCase().trim();
  if(s.indexOf('group') >= 0) return tiers['Group Stage'];
  if(s.indexOf('round of 32') >= 0 || s === 'r32') return tiers['Round of 32'];
  if(s.indexOf('round of 16') >= 0 || s === 'r16') return tiers['Round of 16'];
  if(s.indexOf('quarter') >= 0 || s === 'qf') return tiers['Quarter-Finals'];
  if(s.indexOf('semi') >= 0 || s === 'sf') return 0;
  if(s.indexOf('champion') >= 0 || s.indexOf('winner') >= 0) return tiers['Winner'];
  if(s.indexOf('runner') >= 0 || s.indexOf('second') >= 0) return tiers['Runner-up'];
  if(s.indexOf('third') >= 0 || s === '3rd') return tiers['Third Place'];
  if(s.indexOf('fourth') >= 0 || s === '4th') return tiers['Fourth Place'];
  if(s.indexOf('final') >= 0) return tiers['Winner'];
  return tiers['Group Stage'];
}

// ============================================================
// 3. SAFE STANDINGS EXTRACTOR (handles null/string/array)
// ============================================================
function getStandings(g) {
  if(!g) return [];
  var st = g.standings;
  if(!st) return [];
  if(Array.isArray(st)) return st;
  if(typeof st === 'string') {
    try { return JSON.parse(st) || []; } catch(e) { return []; }
  }
  return [];
}

// Count teams safely from _dbGroups
function countTeams(groups) {
  groups = groups || window._dbGroups || [];
  return groups.reduce(function(n, g) { return n + getStandings(g).length; }, 0);
}

// ============================================================
// 4. OVERRIDE: renderPrizeLadderTable (null-safe)
// ============================================================
(function(){
  var _orig = window.renderPrizeLadderTable;
  window.renderPrizeLadderTable = function() {
    var tiers = getPrizeTiersSafe();
    var tbody = document.getElementById('prize-ladder-body');
    if(!tbody) return;

    var stageInfo = [
      ['Group Stage','Group Stage','33rd–48th',16],
      ['Round of 32','Round of 32','17th–32nd',16],
      ['Round of 16','Round of 16','9th–16th',8],
      ['Quarter-Finals','Quarter-Finals','5th–8th',4],
      ['Fourth Place','Fourth Place','4th',1],
      ['Third Place','Third Place','3rd',1],
      ['Runner-up','Runner-up','2nd',1],
      ['Winner','Champion','1st',1]
    ];

    var baseline = tiers['Group Stage'] || 9;
    var prevPrize = baseline;
    var cumDelta = 0;
    var html = '';

    stageInfo.forEach(function(s, i) {
      var prize = tiers[s[0]];
      if(typeof prize !== 'number') return;
      var delta = i === 0 ? 0 : prize - prevPrize;
      if(i > 0) cumDelta += delta;
      var deltaDisplay = i === 0
        ? '<span style="color:#64748b;font-weight:700">—</span>'
        : '<span style="color:#16a34a;font-weight:800;background:#dcfce7">+' + delta + 'M</span>';
      var cumDisplay = i === 0
        ? '<span style="color:#64748b">$0M</span>'
        : '<span style="color:#16a34a;font-weight:700">+' + cumDelta + 'M</span>';
      html += '<tr' + (i > 0 ? ' style="background:#fefce8"' : '') + '>' +
        '<td>' + s[1] + '</td><td>' + s[2] + '</td><td>$' + prize + 'M</td>' +
        '<td>' + deltaDisplay + '</td><td>' + s[3] + '</td><td>' + cumDisplay + '</td></tr>';
      prevPrize = prize;
    });

    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:1rem">Prize data unavailable</td></tr>';
  };
})();

// ============================================================
// 5. OVERRIDE: drawPrizeDeltaGraph (null-safe)
// ============================================================
(function(){
  var _orig = window.drawPrizeDeltaGraph;
  window.drawPrizeDeltaGraph = function() {
    var canvas = document.getElementById('prize-delta-canvas');
    if(!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var tiers = getPrizeTiersSafe();

    var stageOrder = [
      {label:'Group Stage',display:'Group Stage',teams:16},
      {label:'Round of 32',display:'R32',teams:16},
      {label:'Round of 16',display:'R16',teams:8},
      {label:'Quarter-Finals',display:'QF',teams:4},
      {label:'Fourth Place',display:'4th',teams:1},
      {label:'Third Place',display:'3rd',teams:1},
      {label:'Runner-up',display:'Runner-up',teams:1},
      {label:'Winner',display:'Champion',teams:1}
    ];

    var baseline = tiers['Group Stage'] || 9;
    var prev = baseline;
    var cum = 0;
    var data = [];
    stageOrder.forEach(function(s) {
      var prize = tiers[s.label];
      if(typeof prize !== 'number') return;
      var delta = prize - prev;
      cum += delta;
      data.push({stage:s.display,prize:prize,delta:delta,cum:cum,teams:s.teams});
      prev = prize;
    });

    if(data.length === 0) {
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Prize data unavailable', w/2, h/2);
      return;
    }

    var padding = {top:40,right:30,bottom:80,left:60};
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;
    var maxVal = 50;

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for(var i=0;i<=5;i++){
      var y = padding.top + (chartH/5)*i;
      ctx.beginPath(); ctx.moveTo(padding.left,y); ctx.lineTo(padding.left+chartW,y); ctx.stroke();
      ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText((maxVal - i*10)+'M', padding.left-8, y+4);
    }

    var barW = chartW / data.length * 0.6;
    var spacing = chartW / data.length;
    ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 3; ctx.beginPath();

    data.forEach(function(d,i){
      var x = padding.left + spacing*i + (spacing-barW)/2;
      var barH = (d.delta/maxVal)*chartH;
      var y = padding.top + chartH - barH;

      var grad = ctx.createLinearGradient(0,y,0,y+barH);
      grad.addColorStop(0,'#16a34a'); grad.addColorStop(1,'#dcfce7');
      ctx.fillStyle = grad; ctx.fillRect(x,y,barW,barH);
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 1; ctx.strokeRect(x,y,barW,barH);

      if(d.delta > 0) {
        ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('+'+d.delta+'M', x+barW/2, y-6);
      }
      ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.stage, x+barW/2, padding.top+chartH+18);
      ctx.fillStyle = '#0f172a'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('$'+d.prize+'M', x+barW/2, padding.top+chartH+35);
      ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif';
      ctx.fillText(d.teams+' teams', x+barW/2, padding.top+chartH+50);

      var cx = padding.left + spacing*i + spacing/2;
      var cy = padding.top + chartH - (d.cum/maxVal)*chartH;
      if(i===0) ctx.moveTo(cx,cy); else ctx.lineTo(cx,cy);
    });
    ctx.stroke();

    data.forEach(function(d,i){
      var cx = padding.left + spacing*i + spacing/2;
      var cy = padding.top + chartH - (d.cum/maxVal)*chartH;
      ctx.fillStyle = '#d4a843'; ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });

    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Stage Delta (bars) + Cumulative Delta (gold line)', padding.left, 20);
    var ly = h-15;
    ctx.fillStyle = '#16a34a'; ctx.fillRect(padding.left,ly-8,12,12);
    ctx.fillStyle = '#0f172a'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Stage Delta', padding.left+18, ly+2);
    ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(padding.left+120,ly-2); ctx.lineTo(padding.left+140,ly-2); ctx.stroke();
    ctx.fillStyle = '#d4a843'; ctx.beginPath(); ctx.arc(padding.left+130,ly-2,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.fillText('Cumulative Delta', padding.left+148, ly+2);
  };
})();

// ============================================================
// 6. OVERRIDE: renderTeamFinancialDelta (null-safe)
// ============================================================
(function(){
  window.renderTeamFinancialDelta = function() {
    var tbody = document.getElementById('financial-delta-body');
    var cards = document.getElementById('financial-delta-cards');
    var analysisDiv = document.getElementById('financial-delta-analysis');
    if(!tbody) return;

    var prizeTiers = getPrizeTiersSafe();
    var groups = window._dbGroups || [];
    var matches = dbMatches || [];
    if(groups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:1rem">No group data loaded</td></tr>';
      return;
    }

    var elimData = getTeamStatusFromMatches(matches);
    var teamsInMatches = {};
    elimData.participated.forEach(function(t){ teamsInMatches[t]=true; });

    var teamData = {};
    groups.forEach(function(g){
      getStandings(g).forEach(function(s){
        var seed = s.seed || '?';
        var isElim = !teamsInMatches[s.team];
        teamData[seed] = {
          seed:seed, team:s.team||'Unknown', group:g.group_letter||'?',
          continent: continentLabel(getContinent(s.team)),
          continentCode: getContinent(s.team),
          baseline:9, currentPrize:9, delta:0,
          exitStage: 'Group Stage',
          status: isElim ? 'Eliminated Group Stage' : 'Still Alive',
          eliminated: isElim, nextMatchup: isElim ? '—' : 'TBD'
        };
      });
    });

    matches.forEach(function(m){
      if(!m || !m.winner || !m.team1 || !m.team2) return;
      var loser = (m.winner===m.team1)?m.team2:m.team1;
      var stage = m.stage || 'Round of 32';

      var t1Seed=null, t2Seed=null;
      for(var seed in teamData){
        if(normalizeTeamName(teamData[seed].team)===normalizeTeamName(m.team1)) t1Seed=seed;
        if(normalizeTeamName(teamData[seed].team)===normalizeTeamName(m.team2)) t2Seed=seed;
      }
      var loserSeed = (m.winner===m.team1)?t2Seed:t1Seed;
      var winnerSeed = (m.winner===m.team1)?t1Seed:t2Seed;

      if(loserSeed && teamData[loserSeed]){
        teamData[loserSeed].currentPrize = getPrizeSafe(stage);
        teamData[loserSeed].delta = teamData[loserSeed].currentPrize - 9;
        teamData[loserSeed].exitStage = stage;
        teamData[loserSeed].status = 'Eliminated '+stage;
        teamData[loserSeed].eliminated = true;
      }
      if(winnerSeed && teamData[winnerSeed]){
        var roundOrder = ['Round of 32','Round of 16','Quarter-Finals','Semi-Finals','Final'];
        var ci = roundOrder.indexOf(stage);
        if(stage==='Final'){
          teamData[winnerSeed].currentPrize = prizeTiers['Winner']||50;
          teamData[winnerSeed].delta = teamData[winnerSeed].currentPrize - 9;
          teamData[winnerSeed].status = 'Champion';
        } else if(stage==='Semi-Finals'){
          teamData[winnerSeed].currentPrize = prizeTiers['Quarter-Finals']||19;
          teamData[winnerSeed].delta = teamData[winnerSeed].currentPrize - 9;
          teamData[winnerSeed].status = 'Advanced to Final';
        } else {
          var ns = roundOrder[ci+1] || stage;
          teamData[winnerSeed].currentPrize = prizeTiers[ns] || prizeTiers[stage] || getPrizeSafe(ns);
          teamData[winnerSeed].delta = teamData[winnerSeed].currentPrize - 9;
          teamData[winnerSeed].status = 'Advanced to '+ns;
        }
      }
    });

    for(var sd in teamData){
      var t = teamData[sd];
      if(!t.eliminated){
        t.nextMatchup = t.status==='Still Alive' ? 'Round of 16 pending' : 'Round of 16';
      }
    }

    if(cards){
      var totalD=0, aliveC=0, elimC=0, maxD=0, maxDT='';
      for(var s in teamData){
        var tm = teamData[s]; totalD += tm.currentPrize;
        if(tm.eliminated) elimC++; else aliveC++;
        if(tm.delta > maxD){ maxD = tm.delta; maxDT = tm.team; }
      }
      cards.innerHTML =
        '<div style="background:#0f172a;border-radius:12px;padding:1.25rem;text-align:center;color:#fff">'+
        '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#d4a843;margin-bottom:.5rem">Total Distributed</div>'+
        '<div style="font-size:2rem;font-weight:800">$'+totalD.toFixed(1)+'M</div>'+
        '<div style="font-size:.75rem;color:#94a3b8">of $1.1B pool</div></div>'+
        '<div style="background:#fff;border:2px solid #16a34a;border-radius:12px;padding:1.25rem;text-align:center">'+
        '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#16a34a;margin-bottom:.5rem">Teams Alive</div>'+
        '<div style="font-size:2rem;font-weight:800;color:#16a34a">'+aliveC+'</div></div>'+
        '<div style="background:#fff;border:2px solid #dc2626;border-radius:12px;padding:1.25rem;text-align:center">'+
        '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#dc2626;margin-bottom:.5rem">Eliminated</div>'+
        '<div style="font-size:2rem;font-weight:800;color:#dc2626">'+elimC+'</div></div>'+
        '<div style="background:#fff;border:2px solid #d4a843;border-radius:12px;padding:1.25rem;text-align:center">'+
        '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#d4a843;margin-bottom:.5rem">Top Delta</div>'+
        '<div style="font-size:1.5rem;font-weight:800;color:#0f172a">+'+maxD+'M</div>'+
        '<div style="font-size:.75rem;color:#64748b">'+maxDT+'</div></div>';
    }

    tbody.innerHTML = '';
    var sorted = Object.keys(teamData).sort(function(a,b){return teamData[b].delta - teamData[a].delta;});
    sorted.forEach(function(seed){
      var t = teamData[seed];
      var tr = document.createElement('tr');
      tr.style.opacity = t.eliminated ? '0.6' : '1';
      tr.innerHTML = '<td><strong>'+t.team+'</strong></td><td>'+t.group+'</td><td>'+t.seed+'</td>'+
        '<td>'+t.continent+'</td>'+
        '<td style="color:'+(t.eliminated?'#dc2626':'#16a34a')+';font-weight:700;font-size:.8rem">'+t.status+'</td>'+
        '<td style="font-weight:800;color:#0f172a">$'+t.currentPrize.toFixed(1)+'M</td>'+
        '<td style="color:'+(t.delta>0?'#16a34a':'#64748b')+';font-weight:700">+'+t.delta.toFixed(1)+'M</td>'+
        '<td>'+t.exitStage+'</td><td style="font-size:.8rem;color:#64748b">'+t.nextMatchup+'</td>';
      tbody.appendChild(tr);
    });

    if(analysisDiv){
      var sc = {}, td = 0;
      for(var s2 in teamData){ var tm2=teamData[s2]; td+=tm2.currentPrize; if(!sc[tm2.exitStage])sc[tm2.exitStage]={c:0,t:0}; sc[tm2.exitStage].c++; sc[tm2.exitStage].t+=tm2.currentPrize; }
      var h = '<strong>Stage-to-Stage Delta Analysis:</strong><br><ul style="margin:.5rem 0 .5rem 1.2rem">';
      h += '<li><strong>Total distributed:</strong> $'+td.toFixed(1)+'M</li>';
      for(var stg in sc){ if(stg!=='Group Stage'||sc[stg].c<48) h+='<li><strong>'+stg+':</strong> '+sc[stg].c+' teams, $'+sc[stg].t.toFixed(1)+'M</li>'; }
      h += '</ul>';
      analysisDiv.innerHTML = h;
    }
  };
})();

// ============================================================
// 7. OVERRIDE: computeContinentalAdvancementYield (null-safe)
// ============================================================
(function(){
  window.computeContinentalAdvancementYield = function(groups, matches, prizeTiers) {
    groups = groups || window._dbGroups || [];
    matches = matches || dbMatches || [];
    prizeTiers = prizeTiers || getPrizeTiersSafe();

    if(!groups || groups.length === 0) {
      console.warn('computeCAY: no groups');
      return [];
    }

    var stageOrder = ['Group Stage','Round of 32','Round of 16','Quarter-Finals','Semi-Finals','Final','Champion'];
    var r16Delta = (prizeTiers['Round of 16']||15) - (prizeTiers['Round of 32']||11);
    var groupPrize = prizeTiers['Group Stage'] || 9;
    var champPrize = prizeTiers['Winner'] || 50;

    var continents = ['north_america','south_america','europe','africa','asia','oceania'];
    var data = {};
    continents.forEach(function(c){
      data[c] = {continent:c, continentLabel:continentLabel(c), continentFlag:continentFlag(c),
        original_teams:0, teams_alive:0, teams_pending:0, teams_eliminated:0, teams_unknown:0,
        teams_reached_r16_or_deeper:0, current_total_prize:0, max_possible_remaining:0};
    });

    groups.forEach(function(g){
      getStandings(g).forEach(function(s){
        var cont = getTeamContinent(s.team || '');
        if(data[cont]) data[cont].original_teams++;
      });
    });

    groups.forEach(function(g){
      getStandings(g).forEach(function(s){
        var status = getTeamTournamentStatus(s.team || '', matches);
        var cont = getTeamContinent(s.team || '');
        if(!data[cont]) return;

        if(status.status==='Alive'){
          data[cont].teams_alive++;
          data[cont].teams_reached_r16_or_deeper++;
          data[cont].max_possible_remaining += champPrize;
        } else if(status.status==='Pending'){
          data[cont].teams_pending++;
          data[cont].max_possible_remaining += champPrize;
        } else if(status.status==='Eliminated'){
          data[cont].teams_eliminated++;
        } else {
          data[cont].teams_unknown++;
          data[cont].max_possible_remaining += champPrize;
        }
        data[cont].current_total_prize += (status.prizeMoney || groupPrize);
      });
    });

    var results = [];
    continents.forEach(function(c){
      var d = data[c];
      if(d.original_teams === 0) return;
      d.cae = d.original_teams > 0 ? ((d.teams_reached_r16_or_deeper / d.original_teams)*100).toFixed(1) : '0.0';
      d.incremental_advancement_value = d.teams_reached_r16_or_deeper * r16Delta;
      d.advancement_yield_per_team = d.original_teams > 0 ? (d.incremental_advancement_value / d.original_teams) : 0;
      var baseline = d.original_teams * groupPrize;
      d.cer = baseline > 0 ? ((d.current_total_prize / baseline)*100).toFixed(1) : '100.0';
      var maxP = d.original_teams * champPrize;
      d.fsr = maxP > 0 ? ((d.max_possible_remaining / maxP)*100).toFixed(1) : '100.0';
      results.push(d);
    });
    return results;
  };
})();

// ============================================================
// 8. OVERRIDE: renderContinentKPI (null-safe prize tiers)
// ============================================================
(function(){
  window.renderContinentKPI = function() {
    var cards = document.getElementById('cont-cards');
    var tbody = document.getElementById('cont-body');
    if(!cards || !tbody) return;

    var prizeTiers = getPrizeTiersSafe();
    var groups = window._dbGroups || [];
    var matches = dbMatches || [];

    if(groups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:1rem">No group data</td></tr>';
      return;
    }

    var elimData = getTeamStatusFromMatches(matches);
    var teamsInMatches = {};
    elimData.participated.forEach(function(t){ teamsInMatches[t]=true; });

    var teamData = {};
    var nameToSeed = {};
    groups.forEach(function(g){
      getStandings(g).forEach(function(s, idx){
        var pos = s.position || s.pos || (s.seed ? parseInt(s.seed.slice(1)) : null) || (idx+1);
        var seed = s.seed || (g.group_letter+pos);
        var cont = getTeamContinent(s.team || '');
        nameToSeed[s.team] = seed;
        teamData[seed] = {
          seed:seed, team:s.team||'Unknown', group:g.group_letter||'',
          continent:cont, continentLabel:continentLabel(cont),
          prizeMoney: prizeTiers['Group Stage']||9, knockoutRound:'Group Stage',
          eliminated: false, status: 'Unknown'
        };
      });
    });

    var statusData = getTeamStatusFromMatches(matches);
    for(var sd in teamData){
      var rawName = teamData[sd].team;
      var normName = normalizeTeamName(rawName);
      if(statusData.completedWinners.has(normName)){
        teamData[sd].status='Alive'; teamData[sd].eliminated=false;
      } else if(statusData.completedLosers.has(normName)){
        teamData[sd].eliminated=true;
      } else if(statusData.pendingTeams.has(normName)){
        teamData[sd].status='Pending'; teamData[sd].eliminated=false;
      } else {
        teamData[sd].status='Unknown'; teamData[sd].eliminated=false;
        teamData[sd].knockoutRound='Awaiting Fixture';
      }
    }

    function findSeedByName(matchName){
      if(!matchName) return null;
      var norm = normalizeTeamName(matchName);
      if(nameToSeed[norm]) return nameToSeed[norm];
      for(var key in nameToSeed){
        if(key.length>3 && (norm.indexOf(key)>=0 || key.indexOf(norm)>=0)) return nameToSeed[key];
      }
      for(var seed in teamData){
        if(normalizeTeamName(teamData[seed].team) === norm) return seed;
      }
      return null;
    }

    var roundOrder = ['Group Stage','Round of 32','Round of 16','Quarter-Finals','Semi-Finals','Final'];
    matches.forEach(function(m){
      if(!m || !m.winner || !m.team1 || !m.team2) return;
      var t1s = findSeedByName(m.team1);
      var t2s = findSeedByName(m.team2);
      if(!t1s || !t2s) return;
      var ws = (m.winner===m.team1)?t1s:t2s;
      var ls = (m.winner===m.team1)?t2s:t1s;
      var stage = m.stage || 'Round of 32';

      if(ls && teamData[ls]){
        if(stage==='Semi-Finals'){
          teamData[ls].knockoutRound='Fourth Place';
          teamData[ls].prizeMoney = prizeTiers['Fourth Place']||27;
        } else {
          teamData[ls].knockoutRound=stage;
          teamData[ls].prizeMoney = prizeTiers[stage] || getPrizeSafe(stage);
        }
        teamData[ls].eliminated=true;
      }
      if(ws && teamData[ws]){
        var mi = roundOrder.indexOf(teamData[ws].knockoutRound);
        var mIdx = roundOrder.indexOf(stage);
        if(mIdx >= 0){
          var nr = roundOrder[mIdx+1] || stage;
          teamData[ws].knockoutRound = nr;
          if(stage==='Semi-Finals'){
            teamData[ws].prizeMoney = prizeTiers['Quarter-Finals']||19;
          } else {
            teamData[ws].prizeMoney = prizeTiers[nr] || prizeTiers[stage] || getPrizeSafe(nr);
          }
        }
      }
    });

    var allConts = ['north_america','south_america','europe','africa','asia','oceania','unknown'];
    var contData = {};
    allConts.forEach(function(c){
      contData[c] = {code:c,label:continentLabel(c),flag:continentFlag(c),teams:0,alive:0,pending:0,eliminated:0,unknown:0,r32Out:0,r16Out:0,qfOut:0,sfPlus:0,totalEarnings:0,teamEarnings:[]};
    });

    for(var sk in teamData){
      var td = teamData[sk]; var cd = td.continent;
      if(!contData[cd]) continue;
      contData[cd].teams++; contData[cd].totalEarnings += (td.prizeMoney||0);
      contData[cd].teamEarnings.push({team:td.team, round:td.knockoutRound, prize:td.prizeMoney, eliminated:td.eliminated, status:td.status});
      if(td.status==='Alive'){ contData[cd].alive++; if(['Semi-Finals','Final','Winner','Runner-up','Third Place','Fourth Place'].indexOf(td.knockoutRound)>=0) contData[cd].sfPlus++; }
      else if(td.status==='Pending') contData[cd].pending++;
      else if(td.status==='Unknown') contData[cd].unknown++;
      else if(td.eliminated){ contData[cd].eliminated++; if(td.knockoutRound==='Round of 32')contData[cd].r32Out++; else if(td.knockoutRound==='Round of 16')contData[cd].r16Out++; else if(td.knockoutRound==='Quarter-Finals')contData[cd].qfOut++; }
    }

    var totalTeams=0, totalEarnings=0;
    allConts.forEach(function(c){ totalTeams+=contData[c].teams; totalEarnings+=contData[c].totalEarnings; });
    var avg = totalTeams>0 ? totalEarnings/totalTeams : 0;
    allConts.forEach(function(c){ var d=contData[c]; if(d.teams>0){ d.avgEarnings=d.totalEarnings/d.teams; d.resilience=avg>0?((d.avgEarnings/avg)*100).toFixed(1):'100.0'; }});

    var sorted = allConts.filter(function(c){return contData[c].teams>0;}).sort(function(a,b){return contData[b].resilience-contData[a].resilience;});

    var cardColors = {north_america:{bg:'#dbeafe',border:'#3b82f6'},south_america:{bg:'#dcfce7',border:'#16a34a'},europe:{bg:'#fef3c7',border:'#f59e0b'},africa:{bg:'#fee2e2',border:'#dc2626'},asia:{bg:'#f3e8ff',border:'#9333ea'},oceania:{bg:'#ccfbf1',border:'#14b8a6'},unknown:{bg:'#f1f5f9',border:'#94a3b8'}};
    cards.innerHTML = '';
    sorted.forEach(function(c){
      var d=contData[c]; var col=cardColors[c]||cardColors.europe;
      var resColor = parseFloat(d.resilience)>=100?'#16a34a':'#dc2626';
      var card = document.createElement('div');
      card.style.cssText = 'background:'+col.bg+';border:2px solid '+col.border+';border-radius:12px;padding:1.25rem';
      card.innerHTML = '<div style="font-size:1.5rem;margin-bottom:.25rem">'+d.flag+'</div>'+
        '<div style="font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:.5rem">'+d.label+'</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.3rem;font-size:.85rem;text-align:center">'+
        '<div><div style="font-size:1.1rem;font-weight:800;color:#16a34a">'+d.alive+'</div><div style="color:#64748b;font-size:.65rem">Alive</div></div>'+
        '<div><div style="font-size:1.1rem;font-weight:800;color:#f59e0b">'+d.pending+'</div><div style="color:#64748b;font-size:.65rem">Pending</div></div>'+
        '<div><div style="font-size:1.1rem;font-weight:800;color:#dc2626">'+d.eliminated+'</div><div style="color:#64748b;font-size:.65rem">Out</div></div>'+
        '<div><div style="font-size:1.1rem;font-weight:800;color:#94a3b8">'+d.unknown+'</div><div style="color:#64748b;font-size:.65rem">Awaiting</div></div></div>'+
        '<div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid '+col.border+';display:flex;justify-content:space-between;align-items:center">'+
        '<div style="font-size:.85rem;color:#64748b">$'+d.totalEarnings.toFixed(1)+'M total</div>'+
        '<div style="font-size:1rem;font-weight:700;color:'+resColor+'">'+d.resilience+'%</div></div>';
      cards.appendChild(card);
    });

    tbody.innerHTML = '';
    sorted.forEach(function(c){
      var d=contData[c];
      var resColor=parseFloat(d.resilience)>=100?'#16a34a':'#dc2626';
      var tr=document.createElement('tr');
      tr.innerHTML = '<td><strong>'+d.flag+' '+d.label+'</strong></td><td>'+d.teams+'</td>'+
        '<td style="color:#16a34a;font-weight:700">'+d.alive+'</td><td style="color:#dc2626">'+d.eliminated+'</td>'+
        '<td>'+d.r32Out+'</td><td>'+d.r16Out+'</td><td>'+d.qfOut+'</td><td style="font-weight:700">'+d.sfPlus+'</td>'+
        '<td>$'+d.avgEarnings.toFixed(1)+'M</td><td style="font-weight:700;color:#0f172a">$'+d.totalEarnings.toFixed(1)+'M</td>'+
        '<td style="color:'+resColor+';font-weight:700">'+d.resilience+'%</td>';
      tbody.appendChild(tr);
    });

    var prizeDiv = document.getElementById('cont-prize');
    if(prizeDiv){
      prizeDiv.innerHTML = '';
      sorted.forEach(function(c){
        var d=contData[c]; if(d.teamEarnings.length===0) return;
        var col=cardColors[c]||cardColors.europe;
        var wrap=document.createElement('div');
        var h = '<div style="font-size:.85rem;font-weight:700;color:#0f172a;margin-bottom:.3rem;padding:.3rem .5rem;background:'+col.bg+';border-left:3px solid '+col.border+'">'+d.flag+' '+d.label+' — $'+d.totalEarnings.toFixed(1)+'M total</div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:.25rem">';
        d.teamEarnings.sort(function(a,b){return b.prize-a.prize;});
        d.teamEarnings.forEach(function(t){
          var sc=t.eliminated?'#dc2626':'#16a34a'; var op=t.eliminated?'0.6':'1';
          h += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:.4rem .6rem;font-size:.75rem;opacity:'+op+'">'+
            '<strong>'+t.team+'</strong> <span style="color:#94a3b8">'+t.round+'</span> <span style="color:'+sc+';font-weight:700">$'+t.prize.toFixed(1)+'M</span></div>';
        });
        h += '</div>';
        wrap.innerHTML = h; prizeDiv.appendChild(wrap);
      });
    }

    var analysisDiv = document.getElementById('cont-analysis');
    if(analysisDiv && sorted.length > 0){
      var best=sorted[0], worst=sorted[sorted.length-1];
      var h = '<strong>Financial Resilience Analysis:</strong><br><ul style="margin:.5rem 0 .5rem 1.2rem">';
      h += '<li><strong>Best performer:</strong> '+continentFlag(best)+' '+continentLabel(best)+' ('+contData[best].resilience+'% resilience)</li>';
      h += '<li><strong>Underperforming:</strong> '+continentFlag(worst)+' '+continentLabel(worst)+' ('+contData[worst].resilience+'% resilience)</li>';
      var deepRunners=[];
      sorted.forEach(function(c){ if(contData[c].sfPlus>0) deepRunners.push(continentLabel(c)+' ('+contData[c].sfPlus+')'); });
      if(deepRunners.length>0) h+='<li><strong>Deep runs (SF+):</strong> '+deepRunners.join(', ')+'</li>';
      var top3E=0; sorted.slice(0,3).forEach(function(c){top3E+=contData[c].totalEarnings;});
      var conc = totalEarnings>0?((top3E/totalEarnings)*100).toFixed(1):0;
      h += '<li><strong>Prize concentration:</strong> Top 3 continents hold '+conc+'% of all prize money</li></ul>';
      analysisDiv.innerHTML = h;
    }
  };
})();

// ============================================================
// 9. OVERRIDE: renderEPIReport (renders groups even with 0 matches)
// ============================================================
(function(){
  window.renderEPIReport = function() {
    var cards = document.getElementById('epi-cards');
    var tbody = document.getElementById('epi-body');
    var dailyBody = document.getElementById('epi-daily-body');
    var analysisDiv = document.getElementById('epi-analysis');
    var headlineText = document.getElementById('epi-headline-text');
    if(!cards || !tbody) return;

    var groups = (window._dbGroups || []).filter(function(g){return g && g.standings !== undefined && g.standings !== null;});
    var matches = dbMatches || [];

    if(groups.length === 0){
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:1rem">No group data. Load wc2026_groups into Supabase.</td></tr>';
      if(headlineText) headlineText.innerHTML = '<span style="color:#94a3b8">Waiting for group data...</span>';
      return;
    }

    var envData = {};
    var envColors = {suppressed:{color:'#f59e0b',label:'Suppressed'},balanced:{color:'#3b82f6',label:'Balanced'},open:{color:'#16a34a',label:'Open'},dominant:{color:'#dc2626',label:'Dominant'},inverted:{color:'#f97316',label:'Inverted'}};
    ['suppressed','balanced','open','dominant','inverted'].forEach(function(e){
      envData[e] = {env:e, label:envColors[e].label, color:envColors[e].color, groups:new Set(), qualified:0, alive:0, groupGoals:0, koGoals:0, wins:0, losses:0};
    });

    var elimData = getTeamStatusFromMatches(matches);
    var teamsInMatches = {};
    elimData.participated.forEach(function(t){ teamsInMatches[t]=true; });

    groups.forEach(function(g){
      var env = (g.environment_type || 'balanced').toLowerCase();
      if(!envData[env]) env = 'balanced';
      var st = getStandings(g);
      var aliveCount = st.filter(function(s){return teamsInMatches[s.team];}).length;
      envData[env].groups.add(g.group_letter);
      envData[env].qualified += st.length;
      envData[env].alive += aliveCount;
      envData[env].groupGoals += (g.total_goals || 0);
    });

    if(matches.length > 0){
      matches.forEach(function(m){
        if(!m || !m.winner || !m.team1 || !m.team2) return;
        var t1Env=null, t2Env=null;
        groups.forEach(function(g){
          getStandings(g).forEach(function(s){
            if(normalizeTeamName(s.team)===normalizeTeamName(m.team1)) t1Env=(g.environment_type||'balanced').toLowerCase();
            if(normalizeTeamName(s.team)===normalizeTeamName(m.team2)) t2Env=(g.environment_type||'balanced').toLowerCase();
          });
        });
        if(t1Env && envData[t1Env]) envData[t1Env].koGoals += (m.score1 || 0);
        if(t2Env && envData[t2Env]) envData[t2Env].koGoals += (m.score2 || 0);
        var wEnv = (m.winner===m.team1)?t1Env:t2Env;
        var lEnv = (m.winner===m.team1)?t2Env:t1Env;
        if(wEnv && envData[wEnv]) envData[wEnv].wins++;
        if(lEnv && envData[lEnv]){ envData[lEnv].losses++; envData[lEnv].alive--; }
      });
    }

    var epiRows = [];
    for(var e in envData){
      var d = envData[e];
      d.epi = d.qualified > 0 ? ((d.alive / d.qualified) * 100).toFixed(1) : 0;
      d.offensivePreservation = d.groupGoals > 0 ? (((d.groupGoals - d.koGoals) / d.groupGoals) * 100).toFixed(1) : 0;
      if(d.epi >= 75) d.trend = '&#9650; Strong Preservation';
      else if(d.epi >= 50) d.trend = '&#9650; Moderate';
      else if(d.epi >= 25) d.trend = '&#9660; Decaying';
      else d.trend = '&#9660; Collapsed';
      epiRows.push(d);
    }
    epiRows.sort(function(a,b){return parseFloat(b.epi)-parseFloat(a.epi);});

    var activeRows = epiRows.filter(function(d){return d.qualified > 0;});

    if(headlineText && activeRows.length > 0){
      var openEnv = activeRows.find(function(d){return d.env==='open';});
      var topEnv = openEnv || activeRows[0];
      var hl = '';
      if(openEnv){
        hl = '<strong>Open environments preserve at '+openEnv.epi+'% EPI ('+openEnv.alive+'/'+openEnv.qualified+' teams alive).</strong>';
        var others = activeRows.filter(function(d){return d.env!=='open' && d.qualified>0;});
        if(others.length > 0){
          var bo = others[0];
          hl += ' This is '+(parseFloat(openEnv.epi)>=parseFloat(bo.epi)?'at or above':'below')+' the '+bo.label+' baseline of '+bo.epi+'%.';
        }
      } else {
        hl = '<strong>'+topEnv.label+' environments lead in preservation at '+topEnv.epi+'% EPI.</strong>';
      }
      if(activeRows.length > 1){
        var bottom = activeRows[activeRows.length-1];
        if(bottom && bottom.env !== topEnv.env){
          hl += ' '+bottom.label+' environments trail at '+bottom.epi+'%.';
        }
      }
      if(matches.length === 0) hl += '<br><span style="color:#f59e0b">&#9888; No knockout matches recorded yet — EPI reflects group-stage survival only.</span>';
      else hl += '<br><span style="color:#94a3b8">Every match adds another observation to the survival curve.</span>';
      headlineText.innerHTML = hl;
    }

    cards.innerHTML = '';
    epiRows.forEach(function(d){
      if(d.qualified === 0) return;
      var tc = parseFloat(d.epi) >= 50 ? '#16a34a' : '#dc2626';
      var card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:2px solid '+d.color+';border-radius:12px;padding:1.25rem;text-align:center';
      card.innerHTML = '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:'+d.color+';font-weight:700;margin-bottom:.5rem">'+d.label+'</div>'+
        '<div style="font-size:2.5rem;font-weight:800;color:'+d.color+'">'+d.epi+'%</div>'+
        '<div style="font-size:.8rem;color:#64748b;margin-top:.25rem">EPI — '+d.alive+'/'+d.qualified+' alive</div>'+
        '<div style="margin-top:.5rem;font-size:.75rem;color:'+tc+'">'+d.trend+'</div>'+
        '<div style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid '+d.color+';font-size:.75rem;color:#64748b">Offensive Preservation: '+d.offensivePreservation+'%</div>';
      cards.appendChild(card);
    });

    if(cards.innerHTML === ''){
      cards.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;padding:1rem">No environments with qualified teams</div>';
    }

    tbody.innerHTML = '';
    epiRows.forEach(function(d){
      if(d.qualified === 0) return;
      var tc = d.trend.indexOf('&#9650;') >= 0 ? '#16a34a' : '#dc2626';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><span class="gei-badge gei-'+d.env+'" style="padding:.25rem .6rem;font-size:.75rem">'+d.label+'</span></td>'+
        '<td>'+d.groups.size+'</td><td>'+d.qualified+'</td>'+
        '<td style="color:'+(d.alive>0?'#16a34a':'#94a3b8')+';font-weight:700">'+d.alive+'</td>'+
        '<td style="font-weight:800;color:#0f172a">'+d.epi+'%</td>'+
        '<td>'+d.groupGoals+'</td><td>'+d.koGoals+'</td>'+
        '<td style="color:#dc2626;font-weight:700">'+d.offensivePreservation+'%</td>'+
        '<td style="color:'+tc+';font-size:.8rem">'+d.trend+'</td>';
      tbody.appendChild(tr);
    });

    if(tbody.innerHTML === ''){
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:1rem">No data to display</td></tr>';
    }

    if(dailyBody){
      if(matches.length === 0){
        dailyBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No match data recorded yet. EPI snapshots will appear after each match day.</td></tr>';
      } else {
        var matchesByDate = {};
        matches.forEach(function(m){ if(m.date){ if(!matchesByDate[m.date]) matchesByDate[m.date]=[]; matchesByDate[m.date].push(m); }});
        var dates = Object.keys(matchesByDate).sort();
        var cumElim = {suppressed:0,balanced:0,open:0,dominant:0,inverted:0};
        dailyBody.innerHTML = '';
        dates.forEach(function(date){
          matchesByDate[date].forEach(function(m){
            if(!m.winner) return;
            var loser = (m.winner===m.team1)?m.team2:m.team1;
            groups.forEach(function(g){
              getStandings(g).forEach(function(s){
                if(s.team===loser){ var e=(g.environment_type||'balanced').toLowerCase(); cumElim[e]++; }
              });
            });
          });
          var tr = document.createElement('tr');
          var rowHtml = '<td><strong>'+date+'</strong></td>';
          ['suppressed','balanced','open','dominant','inverted'].forEach(function(e){
            var d = envData[e];
            var alive = Math.max(0, d.qualified - cumElim[e]);
            var pct = d.qualified > 0 ? ((alive/d.qualified)*100).toFixed(1) : '0.0';
            rowHtml += '<td style="color:'+envColors[e].color+'">'+pct+'%</td>';
          });
          rowHtml += '<td style="font-size:.75rem;color:#64748b">'+matchesByDate[date].length+' match'+(matchesByDate[date].length>1?'es':'')+'</td>';
          tr.innerHTML = rowHtml;
          dailyBody.appendChild(tr);
        });
      }
    }

    var eviGrid = document.getElementById('evi-grid');
    if(eviGrid){
      eviGrid.innerHTML = '';
      epiRows.forEach(function(d){
        if(d.qualified === 0) return;
        var div = document.createElement('div');
        div.style.cssText = 'background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;text-align:center';
        div.innerHTML = '<div style="font-size:.75rem;color:'+d.color+';font-weight:700;margin-bottom:.3rem">'+d.label+'</div>'+
          '<div style="font-size:1.5rem;font-weight:800;color:#0f172a">'+d.epi+'%</div>'+
          '<div style="margin-top:.5rem;font-size:.7rem;padding:.2rem .4rem;border-radius:4px;background:#16a34a20;color:#16a34a;display:inline-block">Stable</div>';
        eviGrid.appendChild(div);
      });
    }

    if(matches.length > 0){
      var dailyData = [];
      var mbd = {};
      matches.forEach(function(m){ if(m.date){ if(!mbd[m.date])mbd[m.date]=[]; mbd[m.date].push(m); }});
      var ds = Object.keys(mbd).sort();
      var ce = {suppressed:0,balanced:0,open:0,dominant:0,inverted:0};
      ds.forEach(function(date){
        mbd[date].forEach(function(m){
          if(!m.winner) return;
          var loser=(m.winner===m.team1)?m.team2:m.team1;
          groups.forEach(function(g){
            getStandings(g).forEach(function(s){ if(s.team===loser) ce[(g.environment_type||'balanced').toLowerCase()]++; });
          });
        });
        var row = {date:date};
        ['suppressed','balanced','open','dominant','inverted'].forEach(function(e){
          var d = envData[e]; var alive = Math.max(0, d.qualified - ce[e]);
          row[e] = d.qualified > 0 ? ((alive/d.qualified)*100).toFixed(1) : '0.0';
        });
        row.notes = mbd[date].length + ' match' + (mbd[date].length>1?'es':'');
        dailyData.push(row);
      });
      if(dailyData.length > 0) drawEPISurvivalCurves(dailyData, envColors);
    } else {
      var canvas = document.getElementById('epi-canvas');
      if(canvas){
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Survival curves will appear after the first knockout match day.', canvas.width/2, canvas.height/2);
      }
    }

    if(analysisDiv){
      var h = '<strong>Environment Preservation Analysis:</strong><br><ul style="margin:.5rem 0 .5rem 1.2rem">';
      if(activeRows.length > 0){
        h += '<li><strong>Strongest preservation:</strong> '+activeRows[0].label+' environments at '+activeRows[0].epi+'% EPI</li>';
        h += '<li><strong>Weakest active:</strong> '+activeRows[activeRows.length-1].label+' environments at '+activeRows[activeRows.length-1].epi+'% EPI</li>';
      }
      if(matches.length === 0){
        h += '<li><span style="color:#f59e0b">&#9888; No knockout matches yet — survival curves start after Round of 32 begins</span></li>';
      }
      h += '</ul><p style="margin-top:.5rem"><strong>Research value:</strong> Every match day adds another observation to the survival curve.</p>';
      analysisDiv.innerHTML = h;
    }
  };
})();

// ============================================================
// 10. FIX: sortTable + sortEPIDaily (extract nested function)
// ============================================================
window.sortTable = function(tableId, col, dirs, numeric) {
  var table = document.getElementById(tableId);
  if(!table) return;
  var tbody = table.querySelector('tbody');
  if(!tbody) return;
  var rows = Array.from(tbody.querySelectorAll('tr'));
  var key = tableId + '-' + col;
  dirs[key] = !dirs[key];

  rows.sort(function(a, b) {
    var av = a.cells[col] ? a.cells[col].textContent.trim() : '';
    var bv = b.cells[col] ? b.cells[col].textContent.trim() : '';
    if(numeric) {
      var an = parseFloat(av.replace(/[^0-9.]/g, '')) || 0;
      var bn = parseFloat(bv.replace(/[^0-9.]/g, '')) || 0;
      return dirs[key] ? an - bn : bn - an;
    }
    return dirs[key] ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  rows.forEach(function(r) { tbody.appendChild(r); });
};

window.sortEPIDaily = function(col) {
  var table = document.getElementById('epi-daily-table');
  if(!table) return;
  var tbody = table.querySelector('tbody');
  if(!tbody) return;
  var rows = Array.from(tbody.querySelectorAll('tr'));
  if(!window._epiSortDirs) window._epiSortDirs = {};
  var key = 'epi-daily-' + col;
  window._epiSortDirs[key] = !window._epiSortDirs[key];
  var asc = window._epiSortDirs[key];

  rows.sort(function(a, b) {
    var av = a.cells[col] ? a.cells[col].textContent.trim() : '';
    var bv = b.cells[col] ? b.cells[col].textContent.trim() : '';
    if(col >= 1 && col <= 5) {
      var an = parseFloat(av.replace(/[^0-9.]/g, '')) || 0;
      var bn = parseFloat(bv.replace(/[^0-9.]/g, '')) || 0;
      return asc ? an - bn : bn - an;
    }
    return asc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  rows.forEach(function(r) { tbody.appendChild(r); });
};

// ============================================================
// 11. FIX: getTeamTournamentStatus (null-safe)
// ============================================================
(function(){
  var _orig = window.getTeamTournamentStatus;
  window.getTeamTournamentStatus = function(teamName, matches) {
    if(!teamName) return {status:'Unknown',currentStage:null,eliminatedAtStage:null,prizeMoney:9};
    matches = matches || dbMatches || [];
    return _orig ? _orig(teamName, matches) : {status:'Unknown',currentStage:null,eliminatedAtStage:null,prizeMoney:9};
  };
})();

// ============================================================
// 12. FIX: renderGoalTracker (null-safe standings access)
// ============================================================
(function(){
  var _orig = window.renderGoalTracker;
  window.renderGoalTracker = function() {
    var groupBody = document.getElementById('group-goal-body');
    var teamBody = document.getElementById('team-goal-body');
    if(!groupBody || !teamBody) return;

    var groups = (window._dbGroups || []).filter(function(g){return g && g.standings !== null && g.standings !== undefined;});
    var matches = dbMatches || [];
    var rounds = ['Round of 32','Round of 16','Quarter-Finals','Semi-Finals','Final'];

    if(groups.length === 0){
      groupBody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#94a3b8">No group data</td></tr>';
      teamBody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#94a3b8">No group data</td></tr>';
      return;
    }

    var teamGoals = {};
    var elimData = getTeamStatusFromMatches(matches);
    var teamsInMatches = {};
    elimData.participated.forEach(function(t){ teamsInMatches[t]=true; });

    groups.forEach(function(g){
      var st = getStandings(g);
      st.forEach(function(s){
        var seed = s.seed || '?';
        var isElim = !teamsInMatches[s.team];
        teamGoals[seed] = {
          seed:seed, team:s.team||'Unknown', group:g.group_letter||'?',
          envType:g.environment_type||'balanced',
          groupGoals:s.gs_goals||0,
          koGoalsByRound:{}, koTotal:0,
          status: isElim ? 'Eliminated Group Stage' : 'Still Alive'
        };
        rounds.forEach(function(r){ teamGoals[seed].koGoalsByRound[r]=0; });
      });
    });

    matches.forEach(function(m){
      if(!m.team1 || !m.team2) return;
      var t1Seed=null, t2Seed=null;
      for(var seed in teamGoals){
        if(normalizeTeamName(teamGoals[seed].team)===normalizeTeamName(m.team1)) t1Seed=seed;
        if(normalizeTeamName(teamGoals[seed].team)===normalizeTeamName(m.team2)) t2Seed=seed;
      }
      var rk = m.stage || 'Round of 32';
      if(t1Seed && m.score1!=null){ teamGoals[t1Seed].koGoalsByRound[rk]=(teamGoals[t1Seed].koGoalsByRound[rk]||0)+m.score1; teamGoals[t1Seed].koTotal+=m.score1; }
      if(t2Seed && m.score2!=null){ teamGoals[t2Seed].koGoalsByRound[rk]=(teamGoals[t2Seed].koGoalsByRound[rk]||0)+m.score2; teamGoals[t2Seed].koTotal+=m.score2; }
      if(m.winner && t1Seed && t2Seed){ var ls=(m.winner===m.team1)?t2Seed:t1Seed; teamGoals[ls].status='Eliminated '+(m.stage||''); }
    });

    var groupGoalData={};
    var envColors={suppressed:'#dc2626',balanced:'#2563eb',open:'#16a34a',dominant:'#f59e0b',inverted:'#f97316'};
    groups.forEach(function(g){
      groupGoalData[g.group_letter]={letter:g.group_letter,env:g.environment_type||'balanced',groupGoals:0,koByRound:{},koTotal:0};
      rounds.forEach(function(r){ groupGoalData[g.group_letter].koByRound[r]=0; });
    });
    for(var seed in teamGoals){
      var t=teamGoals[seed];
      if(groupGoalData[t.group]){
        groupGoalData[t.group].groupGoals+=t.groupGoals;
        groupGoalData[t.group].koTotal+=t.koTotal;
        rounds.forEach(function(r){ groupGoalData[t.group].koByRound[r]+=(t.koGoalsByRound[r]||0); });
      }
    }

    groupBody.innerHTML='';
    Object.keys(groupGoalData).sort().forEach(function(letter){
      var g=groupGoalData[letter];
      var c=envColors[g.env]||'#64748b';
      var total=g.groupGoals+g.koTotal;
      var drop=g.groupGoals>0?Math.round(((g.groupGoals-g.koTotal)/g.groupGoals)*100):0;
      var dropColor=drop>0?'#dc2626':(drop<0?'#16a34a':'#64748b');
      var dropSign=drop>0?'-':(drop<0?'+':'');
      var tr=document.createElement('tr');
      tr.innerHTML='<td><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:'+c+';color:#fff;font-size:13px;font-weight:800;border-radius:6px">'+letter+'</span></td>'+
        '<td><span class="gei-badge gei-'+g.env+'">'+g.env.charAt(0).toUpperCase()+g.env.slice(1)+'</span></td>'+
        '<td style="font-weight:700;background:#fefce8">'+g.groupGoals+'</td>'+
        '<td>'+(g.koByRound['Round of 32']||0)+'</td><td>'+(g.koByRound['Round of 16']||0)+'</td>'+
        '<td>'+(g.koByRound['Quarter-Finals']||0)+'</td><td>'+(g.koByRound['Semi-Finals']||0)+'</td>'+
        '<td>'+(g.koByRound['Final']||0)+'</td><td style="font-weight:700">'+g.koTotal+'</td>'+
        '<td style="font-weight:800;color:#0f172a">'+total+'</td>'+
        '<td style="color:'+dropColor+';font-weight:700">'+dropSign+Math.abs(drop)+'%</td>';
      groupBody.appendChild(tr);
    });

    teamBody.innerHTML='';
    Object.keys(teamGoals).sort().forEach(function(seed){
      var t=teamGoals[seed];
      var c=envColors[t.envType]||'#64748b';
      var total=t.groupGoals+t.koTotal;
      var isElim=t.status!=='Still Alive';
      var tr=document.createElement('tr');
      tr.style.opacity=isElim?'0.6':'1';
      tr.innerHTML='<td><strong>'+(t.team||seed)+'</strong>'+(isElim?' &#10060;':'')+'</td>'+
        '<td><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:'+c+';color:#fff;font-size:11px;font-weight:700;border-radius:4px">'+t.group+'</span></td>'+
        '<td>'+seed+'</td><td style="font-weight:700;background:#fefce8">'+t.groupGoals+'</td>'+
        '<td>'+(t.koGoalsByRound['Round of 32']||'-')+'</td>'+
        '<td>'+(t.koGoalsByRound['Round of 16']||'-')+'</td>'+
        '<td>'+(t.koGoalsByRound['Quarter-Finals']||'-')+'</td>'+
        '<td>'+(t.koGoalsByRound['Semi-Finals']||'-')+'</td>'+
        '<td>'+(t.koGoalsByRound['Final']||'-')+'</td>'+
        '<td style="font-weight:700">'+(t.koTotal||'-')+'</td>'+
        '<td style="font-weight:800;color:#0f172a">'+total+'</td>'+
        '<td style="font-size:.8rem;color:'+(isElim?'#dc2626':'#16a34a')+'">'+t.status+'</td>';
      teamBody.appendChild(tr);
    });

    var analysisDiv=document.getElementById('goal-analysis-content');
    if(analysisDiv){
      var totalGG=0,totalKG=0;
      Object.keys(groupGoalData).forEach(function(l){totalGG+=groupGoalData[l].groupGoals;totalKG+=groupGoalData[l].koTotal;});
      var overall=totalGG>0?Math.round(((totalGG-totalKG)/totalGG)*100):0;
      var html='<strong>Overall:</strong> '+totalGG+' group-stage goals. '+totalKG+' knockout goals. ';
      html+=overall>0?'<span style="color:#dc2626">Down '+overall+'%</span> in knockouts.':'<span style="color:#16a34a">Maintained</span>.';
      analysisDiv.innerHTML=html;
    }
  };
})();

// ============================================================
// 13. AUTO-APPLY FIXES ON LOAD
// ============================================================
(function applyNullFixes(){
  console.log('[null-fix] CORRECTED patch loaded. All render functions now null-safe.');
  console.log('[null-fix] getPrizeTiersSafe will use hardcoded FIFA WC2026 fallback when DB is empty.');

  // Re-render if data already loaded
  if(window._dbGroups && window._dbGroups.length > 0){
    console.log('[null-fix] Data detected — re-rendering all panels...');
    setTimeout(function(){
      try{ renderPrizeLadderTable(); }catch(e){console.error('prize ladder:', e);}
      try{ drawPrizeDeltaGraph(); }catch(e){console.error('prize graph:', e);}
      try{ renderTeamFinancialDelta(); }catch(e){console.error('financial delta:', e);}
      try{ renderContinentKPI(); }catch(e){console.error('continent KPI:', e);}
      try{ renderContinentalAdvancementYield(); }catch(e){console.error('CAY:', e);}
      try{ renderEPIReport(); }catch(e){console.error('EPI:', e);}
      try{ renderGoalTracker(); }catch(e){console.error('goal tracker:', e);}
      try{ renderFSIReport(); }catch(e){console.error('FSI:', e);}
      try{ renderKPIReport(); }catch(e){console.error('KPI:', e);}
      try{ renderGroupMetric(); }catch(e){console.error('group metric:', e);}
    }, 500);
  }
})();
