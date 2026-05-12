/* IDC PRC Dashboard — 单文件 SPA, 数据外挂 JSON */

// ================== 全局状态 ==================
let DATA = null;            // 当前加载的数据
let STATE = {
  selectedBrands: ['华为','小米','OPPO','vivo','荣耀','Apple'],
  startMonth: null,         // YYYY-MM, 由数据加载后自动初始化
  endMonth: null,           // YYYY-MM
  selectedModels: new Set(),
  priceView: 'market'
};

// ================== 工具函数 ==================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmtW = (n) => (n/10000).toFixed(1);
const fmtPct = (n) => (n>=0?'+':'') + n.toFixed(1) + '%';
const fmt0 = (n) => Math.round(n).toLocaleString();

function showStatus(msg, ms=1800) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(()=>el.classList.remove('show'), ms);
}

// === 时间相关 ===
function monthToIdx(m) { return DATA.meta.months.indexOf(m); }
function idxToMonth(i) { return DATA.meta.months[i]; }
function shiftMonth(m, delta) {
  const [y, mn] = m.split('-').map(Number);
  const d = new Date(y, mn - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// 当前选中的月份序列
function getMonthsInRange() {
  if (!STATE.startMonth || !STATE.endMonth) return DATA.meta.months;
  const i1 = monthToIdx(STATE.startMonth);
  const i2 = monthToIdx(STATE.endMonth);
  if (i1 < 0 || i2 < 0) return DATA.meta.months;
  return DATA.meta.months.slice(Math.min(i1,i2), Math.max(i1,i2)+1);
}

// 对比期：YoY = 起止各回退 12 个月
function getPrevMonths() {
  const xs = getMonthsInRange();
  return xs.map(m => shiftMonth(m, -12));
}

function quarterOf(m) { const [y,mn] = m.split('-').map(Number); return `${y}Q${Math.ceil(mn/3)}`; }

function getQuarterMonths(q) {
  const m = q.match(/(\d{4})Q(\d)/);
  if (!m) return [];
  const y = +m[1], qn = +m[2];
  return [(qn-1)*3+1, (qn-1)*3+2, (qn-1)*3+3].map(x=>`${y}-${String(x).padStart(2,'0')}`);
}

// 全局品牌配色（前端覆盖，确保统一）
const BRAND_COLORS = {
  '华为':   '#c8102e',  // 深红
  '小米':   '#ff8c00',  // 橙
  'OPPO':   '#5cb85c',  // 绿
  'vivo':   '#1f8efa',  // 亮蓝
  '荣耀':   '#7dc8f7',  // 浅蓝
  'Apple':  '#a8a8a8',  // 中灰
  '其他品牌':'#e5e7eb'   // 极浅灰（白）
};
function brandColor(b) { return BRAND_COLORS[b] || (DATA && DATA.meta.brandColors[b]) || '#94a3b8'; }

// 描述当前时间区间
function periodDesc() {
  const xs = getMonthsInRange();
  if (xs.length === 0) return '--';
  if (xs.length === 1) return xs[0];
  return `${xs[0]} ~ ${xs[xs.length-1]} (${xs.length}个月)`;
}

function comparePeriodDesc() {
  const xs = getMonthsInRange();
  if (xs.length === 0) return '--';
  const prev = xs.map(m => shiftMonth(m, -12));
  if (prev.length === 1) return `去年同月 ${prev[0]}`;
  return `去年同期 ${prev[0]} ~ ${prev[prev.length-1]}`;
}

// ================== 数据加载 ==================
async function loadData(url='data/latest.json') {
  showStatus('加载数据中...');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
    // 并行加载海外/新闻数据（失败不阻塞）
    loadOverseasData();
    loadNewsData();
    afterDataLoaded();
    showStatus(`✅ 加载成功 (${DATA.meta.period})`);
  } catch (e) {
    showStatus(`❌ 加载失败: ${e.message}`, 4000);
    console.error(e);
  }
}

let OVERSEAS = null;
async function loadOverseasData() {
  try {
    const res = await fetch('data/overseas_2026Q1.json');
    if (!res.ok) return;
    OVERSEAS = await res.json();
    if (DATA) renderOverseas();
  } catch (e) { console.warn('海外数据加载失败:', e); }
}

let NEWS = { week: null, month: null };
let NEWS_STATE = { region: 'domestic', period: 'week' };
async function loadNewsData() {
  const t = Date.now(); // cache-bust
  try {
    const resW = await fetch('data/news_2026-W17.json?t=' + t);
    if (resW.ok) NEWS.week = await resW.json();
    try {
      const resM = await fetch('data/news_2026-04.json?t=' + t);
      if (resM.ok) NEWS.month = await resM.json();
    } catch(_) {}
    if (!NEWS.month) NEWS.month = NEWS.week;
    renderNews();
  } catch (e) { console.warn('新闻数据加载失败:', e); }
}

function afterDataLoaded() {
  $('#periodLabel').textContent = DATA.meta.period;
  $('#monthRange').textContent = `${DATA.meta.months[0]} ~ ${DATA.meta.months.slice(-1)[0]}`;
  $('#modelCount').textContent = DATA.models.length;
  // 默认：最新 6 个月（月度走势更易读）
  const ms = DATA.meta.months;
  STATE.startMonth = ms[Math.max(0, ms.length-6)];
  STATE.endMonth = ms[ms.length-1];
  buildBrandPills();
  buildMonthSelectors();
  populatePeriodSelect();
  updateComparePeriodLabel();
  setActivePreset('latest6');
  renderAll();
}

function buildMonthSelectors() {
  const months = DATA.meta.months;
  const startSel = $('#startMonth'), endSel = $('#endMonth');
  const opts = months.map(m => `<option value="${m}">${m}</option>`).join('');
  startSel.innerHTML = opts;
  endSel.innerHTML = opts;
  startSel.value = STATE.startMonth;
  endSel.value = STATE.endMonth;
}

function updateComparePeriodLabel() {
  $('#comparePeriod').textContent = comparePeriodDesc();
}

function buildBrandPills() {
  const wrap = $('#brandPills');
  wrap.innerHTML = '';
  DATA.meta.brandOrder.forEach(b => {
    const c = brandColor(b);
    // 颜色过浅时（如 Apple/其他品牌），active 文字用深色避免不可读
    const isLight = ['#a8a8a8','#e5e7eb','#7dc8f7','#cbd5e1'].includes(c);
    const activeText = isLight ? '#1e293b' : '#fff';
    const pill = document.createElement('span');
    pill.className = 'brand-pill' + (STATE.selectedBrands.includes(b) ? ' active' : '');
    pill.textContent = b;
    pill.style.borderColor = c;
    pill.style.background = STATE.selectedBrands.includes(b) ? c : '#fff';
    pill.style.color = STATE.selectedBrands.includes(b) ? activeText : (isLight ? '#475569' : c);
    pill.onclick = () => {
      const idx = STATE.selectedBrands.indexOf(b);
      if (idx >= 0) STATE.selectedBrands.splice(idx, 1);
      else STATE.selectedBrands.push(b);
      buildBrandPills();
      renderAll();
    };
    wrap.appendChild(pill);
  });
}

async function populatePeriodSelect() {
  // 简易实现：硬编码当前可用的（无 server 列目录能力）
  const periods = [DATA.meta.period];
  const sel = $('#periodSelect');
  sel.innerHTML = periods.map(p => `<option value="${p}">${p}</option>`).join('');
}

// ================== 渲染调度 ==================
function renderAll() {
  if (!DATA) return;
  renderOverview();
  renderBrand();
  renderModel();
  renderPrice();
  renderHarmony();
  renderOverseas();
}

// ================== Tab 1: 总览 ==================
function renderOverview() {
  const xs = getMonthsInRange();
  if (xs.length === 0) return;

  // 当期 = 时间范围内合计；同期 = 各回退12月
  const prevXs = getPrevMonths();
  const periodLabel = periodDesc();

  // ===== 第一行：两张大卡 =====
  // 大卡A：当期总出货量（含全部品牌：HMOVR+Apple+其他品牌，作为权威总量口径）
  let totCur = 0, totPrev = 0;
  DATA.meta.brandOrder.forEach(b => {
    xs.forEach(m => totCur += DATA.groupMonthly[b]?.[m] || 0);
    prevXs.forEach(m => totPrev += DATA.groupMonthly[b]?.[m] || 0);
  });
  const totYoy = totPrev ? ((totCur/totPrev-1)*100) : null;
  const yoyCls = totYoy == null ? '' : (totYoy >= 0 ? 'pos-w' : 'neg-w');
  const yoyStr = totYoy == null ? '-' : fmtPct(totYoy);

  // 大卡B：今年累计 (YTD) — 取最新月所在年的 1月 ~ 最新月（同样含全部品牌）
  const lastM = DATA.meta.months[DATA.meta.months.length-1];
  const curYear = lastM.slice(0, 4);
  const ytdMonths = DATA.meta.months.filter(m => m.startsWith(curYear));
  const ytdPrevMonths = ytdMonths.map(m => shiftMonth(m, -12));
  let ytdCur = 0, ytdPrev = 0;
  DATA.meta.brandOrder.forEach(b => {
    ytdMonths.forEach(m => ytdCur += DATA.groupMonthly[b]?.[m] || 0);
    ytdPrevMonths.forEach(m => ytdPrev += DATA.groupMonthly[b]?.[m] || 0);
  });
  const ytdYoy = ytdPrev ? ((ytdCur/ytdPrev-1)*100) : null;
  const ytdYoyCls = ytdYoy == null ? '' : (ytdYoy >= 0 ? 'pos-w' : 'neg-w');
  const ytdLabel = `${ytdMonths[0]} ~ ${ytdMonths[ytdMonths.length-1]} (${ytdMonths.length}个月)`;

  $('#overviewKpiTotal').innerHTML = `
    <div class="kpi-total">
      <div class="left">
        <div>
          <div class="label-big">当期总出货量</div>
          <div class="value-big">${fmtW(totCur)} <span class="unit">万台</span></div>
        </div>
        <div style="font-size:11.5px; opacity:0.85;">${periodLabel}</div>
      </div>
      <div class="compare">
        <div class="item">同期: <b>${fmtW(totPrev)}</b> 万</div>
        <div class="item">YoY: <b class="${yoyCls}">${yoyStr}</b></div>
        <div class="item">月均: <b>${fmtW(totCur/xs.length)}</b> 万</div>
      </div>
    </div>
    <div class="kpi-total alt">
      <div class="left">
        <div>
          <div class="label-big">📅 今年累计 (${curYear} YTD)</div>
          <div class="value-big">${fmtW(ytdCur)} <span class="unit">万台</span></div>
        </div>
        <div style="font-size:11.5px; opacity:0.85;">${ytdLabel}</div>
      </div>
      <div class="compare">
        <div class="item">去年同期: <b>${fmtW(ytdPrev)}</b> 万</div>
        <div class="item">YoY: <b class="${ytdYoyCls}">${ytdYoy == null ? '-' : fmtPct(ytdYoy)}</b></div>
        <div class="item">月均: <b>${fmtW(ytdCur/ytdMonths.length)}</b> 万</div>
      </div>
    </div>
  `;

  // ===== HMOVR 厂商小卡（不含 Apple、不含其他品牌） =====
  const brandKpis = [];
  ['华为','小米','OPPO','vivo','荣耀'].forEach(b => {
    if (!STATE.selectedBrands.includes(b)) return;
    let cur = 0, prev = 0;
    xs.forEach(m => cur += DATA.groupMonthly[b]?.[m] || 0);
    prevXs.forEach(m => prev += DATA.groupMonthly[b]?.[m] || 0);
    const yoy = prev ? ((cur/prev-1)*100) : null;
    const share = totCur ? (cur/totCur*100) : 0;
    brandKpis.push({ b, cur, yoy, share, color: brandColor(b) });
  });
  $('#overviewKpiBrands').innerHTML = brandKpis.map(k => {
    const cls = k.yoy == null ? 'flat' : (k.yoy >= 0 ? 'pos' : 'neg');
    const yoyStr = k.yoy == null ? '-' : fmtPct(k.yoy);
    return `<div class="kpi" style="border-left-color:${k.color}">
      <div class="label">${k.b}</div>
      <div class="value">${fmtW(k.cur)} <span style="font-size:13px; font-weight:500; color:#94a3b8;">万</span></div>
      <div class="delta ${cls}">YoY ${yoyStr} ｜ 份额 ${k.share.toFixed(1)}%</div>
    </div>`;
  }).join('');

  // ===== 月度堆叠图（柱内显示份额%，柱顶显示总量，顶部加YoY折线） =====
  // 默认始终展示至少6个柱子：若筛选区间 <6 个月，往前补齐到6个月
  // 若筛选区间 >=6 个月，则按实际数量展示
  const MIN_BARS = 6;
  let chartXs = xs;
  if (xs.length < MIN_BARS) {
    const lastMonth = xs[xs.length - 1];
    const allMonths = DATA.meta.months;
    const lastIdx = allMonths.indexOf(lastMonth);
    const startIdx = Math.max(0, lastIdx - MIN_BARS + 1);
    chartXs = allMonths.slice(startIdx, lastIdx + 1);
  }
  const chartPrevXs = chartXs.map(m => shiftMonth(m, -12));

  // 每月各品牌出货
  const monthTotals = chartXs.map(m => {
    let s = 0;
    STATE.selectedBrands.forEach(b => s += DATA.groupMonthly[b]?.[m] || 0);
    return s / 10000; // 万台
  });
  // YoY 数组
  const monthYoy = chartXs.map((m, i) => {
    const prevM = chartPrevXs[i];
    let cur = 0, prev = 0;
    STATE.selectedBrands.forEach(b => {
      cur += DATA.groupMonthly[b]?.[m] || 0;
      prev += DATA.groupMonthly[b]?.[prevM] || 0;
    });
    return prev ? ((cur/prev-1)*100) : null;
  });

  // 每个厂商一组堆叠柱，柱内文本=份额%
  const stackTraces = STATE.selectedBrands.map(b => {
    const ys = chartXs.map(m => (DATA.groupMonthly[b]?.[m] || 0) / 10000);
    const txts = chartXs.map((m, i) => {
      const total = monthTotals[i];
      if (total === 0) return '';
      const pct = (ys[i] / total) * 100;
      return pct >= 4 ? pct.toFixed(0) + '%' : ''; // 占比 < 4% 不显示，避免拥挤
    });
    return {
      x: chartXs, y: ys, name: b, type: 'bar',
      marker: { color: brandColor(b) },
      text: txts, textposition: 'inside',
      textfont: { size: 11, color: '#fff', weight: 700 },
      insidetextanchor: 'middle',
      hovertemplate: '%{x}<br>'+b+': %{y:.1f} 万 (%{text})<extra></extra>',
      yaxis: 'y'
    };
  });

  // 柱顶总量数字（透明 scatter + 文本）
  stackTraces.push({
    x: chartXs, y: monthTotals,
    text: monthTotals.map(v => Math.round(v).toString()),
    textposition: 'top center',
    textfont: { size: 12, color: '#1e3a8a', weight: 700 },
    mode: 'text', type: 'scatter',
    showlegend: false, hoverinfo: 'skip', cliponaxis: false,
    yaxis: 'y'
  });

  // 顶部 YoY 折线（独立 y2 轴）
  stackTraces.push({
    x: chartXs,
    y: monthYoy,
    name: 'YoY',
    type: 'scatter',
    mode: 'lines+markers+text',
    line: { color: '#0ea5e9', width: 2 },
    marker: { color: '#0ea5e9', size: 7 },
    text: monthYoy.map(v => v == null ? '' : (v >= 0 ? '+' : '') + Math.round(v) + '%'),
    textposition: 'top center',
    textfont: { size: 10, color: '#0ea5e9', weight: 600 },
    yaxis: 'y2',
    hovertemplate: '%{x}<br>YoY: %{text}<extra></extra>',
    cliponaxis: false
  });

  Plotly.newPlot('chartMonthlyStack', stackTraces, {
    barmode: 'stack',
    yaxis: { title: '出货量 (万台)', automargin: true, domain: [0, 0.82] },
    yaxis2: {
      title: { text: 'YoY (%)', font: { size: 10, color: '#0ea5e9' } },
      ticksuffix: '%', side: 'left',
      domain: [0.88, 1], showgrid: false, zeroline: true,
      zerolinecolor: '#cbd5e1', tickfont: { size: 9, color: '#0ea5e9' }
    },
    xaxis: {
      type: 'category',
      tickmode: 'array',
      tickvals: chartXs,
      ticktext: chartXs.map(m => m.slice(5)+'\n'+m.slice(0,4)), // "01\n2026"
      tickfont: { size: 10 }
    },
    legend: { orientation: 'h', y: -0.18, font: { size: 11 } },
    margin: { t: 30, b: 70, l: 60, r: 30 },
    bargap: 0.55
  }, { responsive: true, displayModeBar: false });

  // ===== TOP10 机型（按时间范围合计，仅 HMOVR） =====
  const HMOVR = ['华为','小米','OPPO','vivo','荣耀'];
  const modelInRange = DATA.models.map(m => {
    let u = 0;
    xs.forEach(mo => u += m.byMonth[mo] || 0);
    return { ...m, periodUnits: u };
  }).filter(m => m.periodUnits > 0
    && HMOVR.includes(m.group)
    && STATE.selectedBrands.includes(m.group)
  ).sort((a,b)=>b.periodUnits-a.periodUnits).slice(0,10);

  Plotly.newPlot('chartTopModel', [{
    x: modelInRange.map(m => m.periodUnits/10000),
    y: modelInRange.map(m => `${m.brand} ${m.model}`),
    type:'bar', orientation:'h',
    marker:{color: modelInRange.map(m => brandColor(m.group))},
    text: modelInRange.map(m => fmtW(m.periodUnits)+'万'),
    textposition:'outside',
    cliponaxis: false
  }], {
    yaxis:{autorange:'reversed', automargin:true},
    margin:{t:30, b:30, l:140, r:80},
    title: { text: periodLabel, font: { size: 11, color: '#64748b' }, x: 0, xanchor: 'left' }
  }, {responsive:true, displayModeBar:false});

  // ===== YTD 累计明细表（仅展示合计/同期/YoY/份额，不再列各月明细） =====
  // 总计行口径 = 大卡口径（含全部品牌），与顶部大卡一致
  const ytdTbl = $('#overviewYtdTable');
  let ytdHtml = `<thead><tr><th>厂商</th>`;
  ytdHtml += `<th>${curYear} YTD 合计</th><th>去年同期</th><th>YoY</th><th>份额</th></tr></thead><tbody>`;
  // 总计：用 brandOrder 全量（= 大卡口径）
  let ytdGrand = 0, ytdGrandPrev = 0;
  DATA.meta.brandOrder.forEach(b => {
    ytdMonths.forEach(m => ytdGrand += DATA.groupMonthly[b]?.[m] || 0);
    ytdPrevMonths.forEach(m => ytdGrandPrev += DATA.groupMonthly[b]?.[m] || 0);
  });
  // 各厂商行：selectedBrands + 其他品牌（让数据闭环与大卡一致）
  const ytdRowBrands = [...STATE.selectedBrands];
  if (!ytdRowBrands.includes('其他品牌')) ytdRowBrands.push('其他品牌');
  ytdRowBrands.forEach(b => {
    ytdHtml += `<tr><td><span style="display:inline-block;width:10px;height:10px;background:${brandColor(b)};border-radius:50%;margin-right:6px;"></span>${b}</td>`;
    let cur=0, prev=0;
    ytdMonths.forEach(m => cur += DATA.groupMonthly[b]?.[m] || 0);
    ytdPrevMonths.forEach(m => prev += DATA.groupMonthly[b]?.[m] || 0);
    const yoy = prev ? ((cur/prev-1)*100) : null;
    const share = ytdGrand ? (cur/ytdGrand*100) : 0;
    ytdHtml += `<td><b>${fmtW(cur)}</b></td><td>${fmtW(prev)}</td>
      <td class="${yoy>=0?'pos':'neg'}">${yoy==null?'-':fmtPct(yoy)}</td>
      <td>${share.toFixed(1)}%</td></tr>`;
  });
  const grandYoy = ytdGrandPrev ? ((ytdGrand/ytdGrandPrev-1)*100) : null;
  ytdHtml += `<tr class="total-row"><td>全市场总计 (含其他品牌)</td>`;
  ytdHtml += `<td><b>${fmtW(ytdGrand)}</b></td><td>${fmtW(ytdGrandPrev)}</td>
    <td class="${grandYoy>=0?'pos':'neg'}">${grandYoy==null?'-':fmtPct(grandYoy)}</td>
    <td>100.0%</td></tr></tbody>`;
  ytdTbl.innerHTML = ytdHtml;

  // ===== 月度明细表（按时间范围 + YoY） =====
  // 始终包含"其他品牌"让数字闭环（= 大卡全市场口径）
  const tbl = $('#overviewMonthlyTable');
  let html = '<thead><tr><th>厂商</th>';
  xs.forEach(m => html += `<th>${m}</th>`);
  html += `<th>当期合计</th><th>YoY</th></tr></thead><tbody>`;
  // 展示行：selectedBrands + 其他品牌（如果不在 selectedBrands 里）
  const rowBrands = [...STATE.selectedBrands];
  if (!rowBrands.includes('其他品牌')) rowBrands.push('其他品牌');
  rowBrands.forEach(b => {
    html += `<tr><td><span style="display:inline-block;width:10px;height:10px;background:${brandColor(b)};border-radius:50%;margin-right:6px;"></span>${b}</td>`;
    xs.forEach(m => html += `<td>${fmtW(DATA.groupMonthly[b]?.[m]||0)}</td>`);
    let cur=0, prev=0;
    xs.forEach(m => cur += DATA.groupMonthly[b]?.[m] || 0);
    prevXs.forEach(m => prev += DATA.groupMonthly[b]?.[m] || 0);
    const yoy = prev ? ((cur/prev-1)*100) : null;
    html += `<td><b>${fmtW(cur)}</b></td><td class="${yoy>=0?'pos':'neg'}">${yoy==null?'-':fmtPct(yoy)}</td></tr>`;
  });
  html += `<tr class="total-row"><td>全市场总计 (含其他品牌)</td>`;
  xs.forEach(m => {
    let s = 0;
    DATA.meta.brandOrder.forEach(b => s += DATA.groupMonthly[b]?.[m] || 0);
    html += `<td>${fmtW(s)}</td>`;
  });
  let qtotCur=0, qtotPrev=0;
  xs.forEach(m => DATA.meta.brandOrder.forEach(b => qtotCur += DATA.groupMonthly[b]?.[m] || 0));
  prevXs.forEach(m => DATA.meta.brandOrder.forEach(b => qtotPrev += DATA.groupMonthly[b]?.[m] || 0));
  const tYoy = qtotPrev ? ((qtotCur/qtotPrev-1)*100) : null;
  html += `<td><b>${fmtW(qtotCur)}</b></td><td class="${tYoy>=0?'pos':'neg'}">${tYoy==null?'-':fmtPct(tYoy)}</td></tr>`;
  html += '</tbody>';
  tbl.innerHTML = html;
}

// ================== Tab 2: 厂商深钻 ==================
function renderBrand() {
  const xs = getMonthsInRange();
  const periodLabel = periodDesc();
  const sel = STATE.selectedBrands.filter(b => b !== '其他品牌');

  // 月度对比：维度转置 —— 横轴=厂商，每月一组柱
  // 月份按时间顺序用蓝→红渐变（早→近），强化时间感
  function monthGradient(idx, total) {
    if (total <= 1) return '#1e3a8a';
    const t = idx / (total - 1);
    // 早期：浅蓝 #93c5fd → 中期：紫 #6d28d9 → 近期：红 #dc2626
    const lerp = (a,b,k) => Math.round(a + (b-a)*k);
    let r, g, b;
    if (t < 0.5) {
      const k = t * 2;
      r = lerp(147, 109, k); g = lerp(197, 40, k); b = lerp(253, 217, k);
    } else {
      const k = (t - 0.5) * 2;
      r = lerp(109, 220, k); g = lerp(40, 38, k); b = lerp(217, 38, k);
    }
    return `rgb(${r},${g},${b})`;
  }
  const traces = xs.map((m, i) => ({
    x: sel,
    y: sel.map(b => (DATA.groupMonthly[b]?.[m] || 0) / 10000),
    name: m, type:'bar',
    marker:{color: monthGradient(i, xs.length)},
    hovertemplate: '%{x}<br>'+m+': %{y:.1f} 万<extra></extra>'
  }));
  Plotly.newPlot('chartBrandTrend', traces, {
    barmode:'group',
    yaxis:{title:'出货量 (万台)', automargin:true},
    xaxis:{type:'category', tickfont:{size:12, color:'#1e293b'}, tickangle:0},
    legend:{orientation:'h', y:-0.18, font:{size:11}},
    margin:{t:20, b:60, l:55, r:30},
    bargap:0.25, bargroupgap:0.06
  }, {responsive:true, displayModeBar:false});

  // $500+ 高端段份额演变（按季度）—— 已搬到价格段 section 用 chartPriceHigh 渲染，这里不再单独渲染
  // 留空以兼容历史代码引用

  // 各品牌 TOP10
  const brandsToShow = sel.slice(0, 5); // 最多展示 5 家
  const top10Traces = [];
  const ann = [];
  const N = brandsToShow.length;
  if (N === 0) {
    Plotly.purge('chartBrandTop10');
    $('#chartBrandTop10').innerHTML = '<div class="empty">请在顶部至少选择一个厂商</div>';
  } else {
    // 加大子图间距，避免左侧标签与上一子图柱体重叠
    const xGap = 0.06;
    const xSlot = (1 - xGap*(N-1)) / N;
    brandsToShow.forEach((b, idx) => {
      const xL = idx * (xSlot + xGap);
      const xR = xL + xSlot;
      const top = DATA.models.filter(m => m.group === b).map(m => {
        let u = 0;
        xs.forEach(mo => u += m.byMonth[mo] || 0);
        return { model: `${m.brand}/${m.model}`, units: u };
      }).filter(m => m.units > 0).sort((a,c)=>c.units-a.units).slice(0,10);
      const i = idx+1;
      const xKey = idx===0?'x':'x'+i, yKey = idx===0?'y':'y'+i;
      top10Traces.push({
        x: top.map(t=>t.units/10000),
        // 完全去掉品牌前缀，仅保留机型名（如 Mate 80 / 17 Pro Max）
        y: top.map(t=>{
          // 去除 brand/ 前缀（如 "Huawei/" "Xiaomi/" "OnePlus/"）
          let name = t.model.replace(/^[^\/]+\//, '');
          return name.length > 14 ? name.slice(0, 14) + '…' : name;
        }),
        type:'bar', orientation:'h',
        marker:{color: brandColor(b)},
        text: top.map(t=>fmtW(t.units)),
        // 数值放柱内右侧，避免溢出到下一子图
        textposition:'inside',
        insidetextanchor:'end',
        textfont:{size:9, color:'#fff'},
        constraintext:'inside',
        xaxis: xKey, yaxis: yKey, showlegend: false, name: b,
        hovertemplate: '%{y}: %{x:.1f}万<extra></extra>'
      });
      ann.push({
        text: `<b style="color:${brandColor(b)}">${b}</b>`,
        xref:'paper', yref:'paper', x: xL, y: 1.02,
        xanchor:'left', yanchor:'bottom', showarrow:false, font:{size:13}
      });
    });
    const layout = {
      margin:{t:40, l:10, r:10, b:10}, height: 420,
      annotations: ann, showlegend: false,
      title: { text: periodLabel, font: { size: 11, color: '#64748b' }, x: 0, xanchor: 'left', y: 0.995 }
    };
    brandsToShow.forEach((b, idx) => {
      const xL = idx * (xSlot + xGap);
      const xR = xL + xSlot;
      const i = idx+1;
      const xKey = idx===0?'xaxis':'xaxis'+i, yKey = idx===0?'yaxis':'yaxis'+i;
      // 隐藏 X 轴刻度数值（柱内已显示数值）
      layout[xKey] = { domain:[xL,xR], anchor: idx===0?'y':'y'+i, automargin:true, showticklabels:false, showgrid:false, zeroline:false };
      layout[yKey] = { domain:[0,1], anchor: idx===0?'x':'x'+i, autorange:'reversed', automargin:true, tickfont:{size:9}, showgrid:false };
    });
    Plotly.newPlot('chartBrandTop10', top10Traces, layout, {responsive:true, displayModeBar:false});
  }
}

// ================== Tab 3: 机型分析 ==================
function renderModel() {
  searchModel();
  renderModelLifecycle();
  renderFlagshipBar();
}

function searchModel() {
  const kw = ($('#modelSearch').value || '').trim().toLowerCase();
  let list = DATA.models.slice(0, 100); // 默认前100
  if (kw) list = DATA.models.filter(m => `${m.brand} ${m.model}`.toLowerCase().includes(kw));
  list = list.slice(0, 60);
  let html = '<thead><tr><th></th><th>厂商</th><th>品牌</th><th>机型</th><th>累计(万)</th><th>价格段</th><th>上市</th></tr></thead><tbody>';
  list.forEach(m => {
    const key = `${m.company}|${m.brand}|${m.model}`;
    const checked = STATE.selectedModels.has(key) ? 'checked' : '';
    html += `<tr><td><input type="checkbox" data-key="${encodeURIComponent(key)}" ${checked} onchange="toggleModel(this)"></td>
      <td><span style="display:inline-block;width:10px;height:10px;background:${brandColor(m.group)};border-radius:50%;margin-right:6px;"></span>${m.group}</td>
      <td>${m.brand}</td><td>${m.model}</td>
      <td>${fmtW(m.total)}</td><td style="font-size:11px;">${m.priceBand||'-'}</td><td style="font-size:11px;">${m.launchDate||'-'}</td></tr>`;
  });
  html += '</tbody>';
  $('#modelSearchTable').innerHTML = html;
}

function toggleModel(checkbox) {
  const key = decodeURIComponent(checkbox.dataset.key);
  if (checkbox.checked) {
    if (STATE.selectedModels.size >= 6) {
      checkbox.checked = false;
      showStatus('最多选 6 个机型', 2000); return;
    }
    STATE.selectedModels.add(key);
  } else {
    STATE.selectedModels.delete(key);
  }
  renderModelLifecycle();
}

function renderModelLifecycle() {
  if (STATE.selectedModels.size === 0) {
    Plotly.purge('chartModelLifecycle');
    $('#chartModelLifecycle').innerHTML = '<div class="empty">在上方表格勾选机型查看生命周期对比</div>';
    return;
  }
  const lcM = ['M0','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11'];
  const palette = ['#dc2626','#f59e0b','#10b981','#3b82f6','#8b5cf6','#0ea5e9'];
  const traces = [];
  let i = 0;
  STATE.selectedModels.forEach(key => {
    const m = DATA.models.find(x => `${x.company}|${x.brand}|${x.model}` === key);
    if (!m || !m.launchDate) return;
    const d = new Date(m.launchDate);
    if (isNaN(d)) return;
    const ys = [];
    for (let k=0; k<12; k++) {
      const dt = new Date(d.getFullYear(), d.getMonth()+k, 1);
      const mk = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      ys.push((m.byMonth[mk]||0)/10000);
    }
    traces.push({
      x: lcM, y: ys, name: `${m.brand} ${m.model} (${m.launchDate})`,
      type:'scatter', mode:'lines+markers',
      line:{color: palette[i % palette.length], width: 2.5}
    });
    i++;
  });
  Plotly.newPlot('chartModelLifecycle', traces, {
    yaxis:{title:'月度出货 (万台)'},
    xaxis:{title:'上市后第 N 个月'},
    legend:{orientation:'h', y:-0.18, font:{size:11}},
    margin:{t:20, b:80, l:55, r:30}
  }, {responsive:true, displayModeBar:false});
}

function renderFlagshipBar() {
  // 各旗舰 M0~M5 累计
  const items = Object.values(DATA.flagships).map(f => {
    if (!f.byMonth || Object.keys(f.byMonth).length === 0) return null;
    const ms = Object.keys(f.byMonth).sort();
    const launch = ms[0];
    const [yL, mL] = launch.split('-').map(Number);
    let lc5 = 0;
    for (let k=0; k<6; k++) {
      const dt = new Date(yL, mL-1+k, 1);
      const mk = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      lc5 += f.byMonth[mk] || 0;
    }
    return { ...f, m05: lc5, launch };
  }).filter(Boolean);

  // 配对：本代 vs 上代（按品牌）
  const pairs = [
    ['华为 Mate', '华为 Mate 80 系列', '华为 Mate 70 系列'],
    ['华为 Pura', '华为 Pura 80 系列', '华为 Pura 70 系列'],
    ['小米 数字', '小米 17 系列', '小米 15 系列'],
    ['OPPO Find X', 'OPPO Find X9 系列', 'OPPO Find X8 系列'],
    ['vivo X', 'vivo X300 系列', 'vivo X200 系列'],
    ['荣耀 Magic', '荣耀 Magic 8 系列', '荣耀 Magic 7 系列']
  ];
  const cats = pairs.map(p => p[0]);
  const cur = pairs.map(p => {
    const it = items.find(i => i.name === p[1]);
    return it ? it.m05/10000 : 0;
  });
  const prev = pairs.map(p => {
    const it = items.find(i => i.name === p[2]);
    return it ? it.m05/10000 : 0;
  });
  Plotly.newPlot('chartFlagshipBar', [
    { x: cats, y: cur, name:'本代 (M0~M5)', type:'bar', marker:{color:'#1e3a8a'},
      text: cur.map((v,i)=>{
        const yoy = prev[i] ? ((v/prev[i]-1)*100) : 0;
        return '<b>'+v.toFixed(0)+'万</b> ('+(yoy>=0?'+':'')+yoy.toFixed(0)+'%)';
      }), textposition:'outside', textfont:{size:11, color:'#1e3a8a'}, cliponaxis:false },
    { x: cats, y: prev, name:'上代 (M0~M5)', type:'bar', marker:{color:'#cbd5e1'},
      text: prev.map(v=>v.toFixed(0)+'万'), textposition:'outside',
      textfont:{size:10, color:'#64748b'}, cliponaxis:false }
  ], {
    barmode:'group', yaxis:{title:'万台', automargin:true},
    legend:{orientation:'h', y:-0.18, font:{size:11}, traceorder:'normal'},
    margin:{t:30, b:60, l:55, r:30}
  }, {responsive:true, displayModeBar:false});
}

// ================== Tab 4: 价格段 ==================
function renderPrice() {
  const tiers = DATA.meta.tiers;
  const tierColors = {'<$150':'#cbd5e1','$150-300':'#94a3b8','$300-500':'#3b82f6','$500-700':'#1e3a8a','$700-1000':'#7c3aed','$1000+':'#be185d'};
  const allQs = [...new Set(DATA.meta.months.map(quarterOf))];
  const xs = getMonthsInRange();
  const visibleQs = allQs.filter(q => {
    const qms = getQuarterMonths(q);
    return qms.some(m => xs.includes(m));
  });

  // 价格段堆叠
  let qTierData; // {q: {tier: units}}
  if (STATE.priceView === 'market') {
    qTierData = {};
    visibleQs.forEach(q => {
      qTierData[q] = {};
      getQuarterMonths(q).forEach(m => {
        const tm = DATA.marketTier[m] || {};
        Object.entries(tm).forEach(([t,u]) => qTierData[q][t] = (qTierData[q][t]||0) + u);
      });
    });
  } else {
    // 选中厂商合计
    qTierData = {};
    visibleQs.forEach(q => {
      qTierData[q] = {};
      getQuarterMonths(q).forEach(m => {
        STATE.selectedBrands.forEach(b => {
          const tm = DATA.groupMonthlyTier[b]?.[m] || {};
          Object.entries(tm).forEach(([t,u]) => qTierData[q][t] = (qTierData[q][t]||0) + u);
        });
      });
    });
  }
  const totalsByQ = visibleQs.map(q => Object.values(qTierData[q]||{}).reduce((s,v)=>s+v,0));
  const tierTraces = tiers.map(t => ({
    x: visibleQs,
    y: visibleQs.map((q,i) => totalsByQ[i] ? ((qTierData[q]?.[t]||0)/totalsByQ[i]*100) : 0),
    name: t, type:'bar', marker:{color: tierColors[t]},
    text: visibleQs.map((q,i) => {
      const v = totalsByQ[i] ? ((qTierData[q]?.[t]||0)/totalsByQ[i]*100) : 0;
      return v >= 3 ? v.toFixed(1)+'%' : '';
    }),
    textposition:'inside', textfont:{size:10, color:'#fff'}
  }));
  Plotly.newPlot('chartPriceStack', tierTraces, {
    barmode:'stack', yaxis:{title:'份额 (%)', ticksuffix:'%'},
    legend:{orientation:'h', y:-0.18, font:{size:11}},
    margin:{t:20, b:60, l:55, r:30}
  }, {responsive:true, displayModeBar:false});

  // 各厂商 $700+ 高端段份额（当期 vs 去年同期）柱状对比
  const sel = STATE.selectedBrands.filter(b => b !== '其他品牌');
  const lastM = DATA.meta.months[DATA.meta.months.length-1];
  const curQ = quarterOf(lastM);
  const prevYQ = `${+curQ.slice(0,4)-1}${curQ.slice(4)}`;
  const curQMs = getQuarterMonths(curQ);
  const prevQMs = getQuarterMonths(prevYQ);
  const HIGH_TIERS = ['$700-1000','$1000+'];

  function calcHighShare(b, ms) {
    let tot=0, high=0;
    ms.forEach(m => {
      const tm = DATA.groupMonthlyTier[b]?.[m] || {};
      Object.entries(tm).forEach(([t,u]) => {
        tot += u;
        if (HIGH_TIERS.includes(t)) high += u;
      });
    });
    return tot ? (high/tot*100) : 0;
  }
  const curShares = sel.map(b => calcHighShare(b, curQMs));
  const prevShares = sel.map(b => calcHighShare(b, prevQMs));

  Plotly.newPlot('chartPriceHigh', [
    { x: sel, y: prevShares, name: `${prevYQ} ($700+)`, type:'bar', marker:{color:'#cbd5e1'},
      text: prevShares.map(v => v.toFixed(1)+'%'), textposition:'outside',
      textfont:{size:10, color:'#64748b'}, cliponaxis:false },
    { x: sel, y: curShares, name: `${curQ} ($700+)`, type:'bar', marker:{color:'#1e3a8a'},
      text: curShares.map((v,i) => {
        const dlt = v - prevShares[i];
        return '<b>'+v.toFixed(1)+'%</b> ('+(dlt>=0?'+':'')+dlt.toFixed(1)+'pp)';
      }), textposition:'outside',
      textfont:{size:11, color:'#1e3a8a'}, cliponaxis:false }
  ], {
    barmode:'group',
    yaxis:{
      title:'$700+ 高端段份额 (%)',
      ticksuffix:'%',
      automargin:true,
      // 留 15% 顶部空间给数据标签，避免 Apple 这种 ~90% 时溢出
      range:[0, Math.max(100, Math.max(...curShares, ...prevShares) * 1.15)]
    },
    legend:{orientation:'h', y:-0.18, font:{size:11}, traceorder:'normal'},
    margin:{t:30, b:60, l:55, r:30},
    bargap:0.3
  }, {responsive:true, displayModeBar:false});
}

// ================== Tab 5: 鸿蒙 ==================
function renderHarmony() {
  const hwM = Object.keys(DATA.huaweiHM).sort();
  const purePure = hwM.map(m => DATA.huaweiHM[m].pure / 10000);
  const pureOld = hwM.map(m => DATA.huaweiHM[m].oldHM / 10000);
  const pureAnd = hwM.map(m => DATA.huaweiHM[m].android / 10000);

  // KPI 三卡
  let totPure=0, totOld=0;
  hwM.forEach(m => { totPure += DATA.huaweiHM[m].pure; totOld += DATA.huaweiHM[m].oldHM; });

  // 第三张卡跟随顶部「时间范围」筛选
  const xs = getMonthsInRange();
  const periodLabel = periodDesc();
  let pPure = 0, pHwTotal = 0;
  xs.forEach(m => {
    pPure += DATA.huaweiHM[m]?.pure || 0;
    pHwTotal += DATA.groupMonthly['华为']?.[m] || 0;
  });
  const pShare = pHwTotal ? (pPure/pHwTotal*100).toFixed(1) : 0;

  $('#harmonyKpi').innerHTML = `
    <div class="kpi" style="border-left-color:#fb923c;">
      <div class="label">Next 双框 累计 (${hwM[0]} 起)</div>
      <div class="value">${fmtW(totOld)} 万</div>
      <div class="delta flat">含 Mate 60/70、Pura 70、nova 12/13、Mate X5/X6 等</div>
    </div>
    <div class="kpi" style="border-left-color:#dc2626;">
      <div class="label">Next 单框 累计 (25-03 起)</div>
      <div class="value">${fmtW(totPure)} 万</div>
      <div class="delta flat">含 nova 14/15、Pura 80、Mate 80、Pura X 等纯血新旗舰</div>
    </div>
    <div class="kpi" style="border-left-color:#dc2626; background:linear-gradient(135deg,#fef2f2,#fff);">
      <div class="label">Next 单框 ${periodLabel} 出货</div>
      <div class="value" style="color:#dc2626;">${fmtW(pPure)} 万</div>
      <div class="delta pos">占华为 ${pShare}%</div>
    </div>`;

  // 堆叠图
  Plotly.newPlot('chartHmStack', [
    { x: hwM, y: purePure, name:'Next 单框 (HarmonyOS NEXT)', type:'bar', marker:{color:'#dc2626'} },
    { x: hwM, y: pureOld, name:'Next 双框', type:'bar', marker:{color:'#fb923c'} },
    { x: hwM, y: pureAnd, name:'Android', type:'bar', marker:{color:'#94a3b8'} }
  ], {
    barmode:'stack', yaxis:{title:'万台'},
    legend:{orientation:'h', y:-0.18, font:{size:11}},
    margin:{t:20, b:60, l:55, r:30}
  }, {responsive:true, displayModeBar:false});

  // 占比折线
  const totalArr = hwM.map(m => (DATA.huaweiHM[m].pure + DATA.huaweiHM[m].oldHM + DATA.huaweiHM[m].android));
  const pureShare = hwM.map((m,i) => totalArr[i] ? (DATA.huaweiHM[m].pure/totalArr[i]*100) : 0);
  Plotly.newPlot('chartHmShare', [{
    x: hwM, y: pureShare, type:'scatter', mode:'lines+markers',
    line:{color:'#dc2626', width:3}, marker:{size:6},
    fill:'tozeroy', fillcolor:'rgba(220,38,38,0.12)'
  }], {
    yaxis:{title:'占比 (%)', ticksuffix:'%', range:[0,90]},
    margin:{t:20, b:60, l:50, r:20}
  }, {responsive:true, displayModeBar:false});

  // 系列累计排行
  const series = DATA.series.slice().sort((a,b)=>b.total-a.total);
  Plotly.newPlot('chartHmSeries', [{
    x: series.map(s => s.total/10000),
    y: series.map(s => s.series),
    type:'bar', orientation:'h',
    marker:{color: series.map(s => s.isPure ? '#dc2626' : '#fb923c')},
    text: series.map(s => fmtW(s.total)+'万 '+(s.isPure?'[Next 单框]':'[Next 双框]')),
    textposition:'outside', textfont:{size:10}, cliponaxis:false
  }], {
    yaxis:{autorange:'reversed', automargin:true},
    xaxis:{title:'累计出货 (万台)'},
    margin:{t:10, b:40, l:120, r:140}
  }, {responsive:true, displayModeBar:false});
}

// ================== 导出功能 ==================
function downloadChart(divId, filename) {
  Plotly.downloadImage(divId, { format:'png', filename: filename, width: 1400, height: 700, scale: 2 });
  showStatus('📷 已导出 PNG');
}

function downloadTable(tableId, filename) {
  const tbl = document.getElementById(tableId);
  if (!tbl || typeof XLSX === 'undefined') { showStatus('❌ XLSX 未加载'); return; }
  const wb = XLSX.utils.table_to_book(tbl, { sheet: filename });
  XLSX.writeFile(wb, `${filename}_${DATA.meta.period}.xlsx`);
  showStatus('📊 已导出 Excel');
}

// ================== 事件绑定 ==================
function bindEvents() {
  $$('.tab').forEach(tab => tab.onclick = () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('#tab-' + tab.dataset.tab).classList.add('active');
    // 切换 Tab 后强制重绘所有 Plotly 图，让宽度自适应
    setTimeout(() => {
      $$('.chart').forEach(div => {
        if (div.offsetParent !== null && typeof Plotly !== 'undefined') {
          try { Plotly.Plots.resize(div); } catch(_) {}
        }
      });
    }, 50);
  });

  // 窗口 resize 时也触发
  window.addEventListener('resize', () => {
    if (typeof Plotly === 'undefined') return;
    $$('.chart').forEach(div => {
      if (div.offsetParent !== null) {
        try { Plotly.Plots.resize(div); } catch(_) {}
      }
    });
  });

  // 月份起止下拉
  $('#startMonth').onchange = (e) => {
    STATE.startMonth = e.target.value;
    // 自动校正：起 > 止时交换
    if (monthToIdx(STATE.startMonth) > monthToIdx(STATE.endMonth)) {
      STATE.endMonth = STATE.startMonth;
      $('#endMonth').value = STATE.endMonth;
    }
    setActivePreset(null);
    updateComparePeriodLabel();
    renderAll();
  };
  $('#endMonth').onchange = (e) => {
    STATE.endMonth = e.target.value;
    if (monthToIdx(STATE.endMonth) < monthToIdx(STATE.startMonth)) {
      STATE.startMonth = STATE.endMonth;
      $('#startMonth').value = STATE.startMonth;
    }
    setActivePreset(null);
    updateComparePeriodLabel();
    renderAll();
  };

  // 快捷按钮
  $$('.preset-btn').forEach(btn => btn.onclick = () => {
    applyPreset(btn.dataset.preset);
    setActivePreset(btn.dataset.preset);
  });

  $('#resetFilter').onclick = () => {
    STATE.selectedBrands = ['华为','小米','OPPO','vivo','荣耀','Apple'];
    STATE.selectedModels.clear();
    applyPreset('latest6'); // 默认近6月
    setActivePreset('latest6');
    buildBrandPills();
  };

  $('#periodSelect').onchange = (e) => loadData(`data/data_${e.target.value}.json`);

  // 加载文件
  $('#loadFileBtn').onclick = () => $('#fileInput').click();
  $('#fileInput').onchange = (e) => handleFile(e.target.files[0]);

  // 拖文件
  document.addEventListener('dragover', (e) => { e.preventDefault(); $('#dropzone').classList.add('show'); });
  document.addEventListener('dragleave', (e) => { if (e.clientX===0 && e.clientY===0) $('#dropzone').classList.remove('show'); });
  document.addEventListener('drop', (e) => {
    e.preventDefault(); $('#dropzone').classList.remove('show');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // 机型搜索
  $('#modelSearchBtn').onclick = searchModel;
  $('#modelSearch').addEventListener('keypress', (e) => { if (e.key === 'Enter') searchModel(); });
  $('#modelClearBtn').onclick = () => {
    STATE.selectedModels.clear();
    searchModel();
    renderModelLifecycle();
  };

  // 价格段视角切换（active 高亮）
  const updatePriceViewBtn = () => {
    $('#priceViewMarket').style.background = STATE.priceView === 'market' ? '#1e3a8a' : '';
    $('#priceViewMarket').style.color = STATE.priceView === 'market' ? '#fff' : '';
    $('#priceViewBrand').style.background = STATE.priceView === 'brand' ? '#1e3a8a' : '';
    $('#priceViewBrand').style.color = STATE.priceView === 'brand' ? '#fff' : '';
  };
  $('#priceViewMarket').onclick = () => { STATE.priceView = 'market'; updatePriceViewBtn(); renderPrice(); };
  $('#priceViewBrand').onclick = () => { STATE.priceView = 'brand'; updatePriceViewBtn(); renderPrice(); };
  setTimeout(updatePriceViewBtn, 100);

  // 新闻 Tab 切换
  $$('#newsRegionGroup .news-toggle').forEach(btn => {
    btn.onclick = () => {
      $$('#newsRegionGroup .news-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      NEWS_STATE.region = btn.dataset.region;
      renderNews();
    };
  });
  $$('#newsPeriodGroup .news-toggle').forEach(btn => {
    btn.onclick = () => {
      $$('#newsPeriodGroup .news-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      NEWS_STATE.period = btn.dataset.period;
      renderNews();
    };
  });
}

function applyPreset(name) {
  const months = DATA.meta.months;
  const last = months[months.length-1];
  switch (name) {
    case 'latest':
      STATE.startMonth = last; STATE.endMonth = last; break;
    case 'latest3':
      STATE.startMonth = months[Math.max(0, months.length-3)]; STATE.endMonth = last; break;
    case 'latest6':
      STATE.startMonth = months[Math.max(0, months.length-6)]; STATE.endMonth = last; break;
    case 'curQ': {
      // 最新月所在的整季度（含当月所有月份，即使尚未结束）
      const q = quarterOf(last);
      const qms = getQuarterMonths(q).filter(m => months.includes(m));
      STATE.startMonth = qms[0]; STATE.endMonth = qms[qms.length-1];
      break;
    }
    case 'curY': {
      const y = last.slice(0,4);
      const ymonths = months.filter(m => m.startsWith(y));
      STATE.startMonth = ymonths[0]; STATE.endMonth = ymonths[ymonths.length-1];
      break;
    }
    case 'lastY':
      STATE.startMonth = months[Math.max(0, months.length-12)]; STATE.endMonth = last; break;
    case 'all':
      STATE.startMonth = months[0]; STATE.endMonth = last; break;
  }
  $('#startMonth').value = STATE.startMonth;
  $('#endMonth').value = STATE.endMonth;
  updateComparePeriodLabel();
  renderAll();
}

function setActivePreset(name) {
  $$('.preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === name));
}

function handleFile(file) {
  if (!file) return;
  if (file.name.endsWith('.json')) {
    const r = new FileReader();
    r.onload = () => {
      try { DATA = JSON.parse(r.result); afterDataLoaded(); showStatus('✅ 已加载 ' + file.name); }
      catch(e) { showStatus('❌ JSON 解析失败'); }
    };
    r.readAsText(file);
  } else if (file.name.endsWith('.xlsx')) {
    showStatus('⚠️ Excel 直接解析尚未实现，请先用 build_data.js 转 JSON', 4000);
  }
}

// ================== Tab 4: 海外 / 全球 ==================
function renderOverseas() {
  if (!OVERSEAS) return;
  const O = OVERSEAS;
  const qs = O.meta.quarters;
  const lastQ = qs[qs.length-1];
  const prevYQ = qs[qs.length-5] || qs[0]; // 上一年同期
  const brands = O.meta.brandOrder;
  const regions = O.meta.regionOrder;
  const bColor = (b) => O.meta.brandColors[b] || '#94a3b8';
  const rColor = (r) => O.meta.regionColors[r] || '#94a3b8';

  // ===== KPI 三大卡 =====
  const lastG = O.globalQuarterly[lastQ];
  const overseasLast = lastG.total - lastG.china;
  const prevG = O.globalQuarterly[prevYQ];
  const overseasPrev = prevG.total - prevG.china;
  const overseasYoY = ((overseasLast/overseasPrev - 1) * 100);
  const chinaYoY = ((lastG.china/prevG.china - 1) * 100);

  $('#overseasKpiTotal').innerHTML = `
    <div class="kpi-total" style="background:linear-gradient(135deg,#1e3a8a,#3730a3);">
      <div class="left">
        <div>
          <div class="label-big">🌐 全球总出货</div>
          <div class="value-big">${lastG.total.toFixed(1)} <span class="unit">M</span></div>
        </div>
        <div style="font-size:11.5px; opacity:0.85;">${lastQ}</div>
      </div>
      <div class="compare">
        <div class="item">同期: <b>${prevG.total.toFixed(1)}M</b></div>
        <div class="item">YoY: <b class="${lastG.yoy>=0?'pos-w':'neg-w'}">${lastG.yoy>=0?'+':''}${lastG.yoy.toFixed(1)}%</b></div>
      </div>
    </div>
    <div class="kpi-total" style="background:linear-gradient(135deg,#0e7490,#0891b2);">
      <div class="left">
        <div>
          <div class="label-big">🌍 海外出货 (全球-中国)</div>
          <div class="value-big">${overseasLast.toFixed(1)} <span class="unit">M</span></div>
        </div>
        <div style="font-size:11.5px; opacity:0.85;">占全球 ${(overseasLast/lastG.total*100).toFixed(1)}%</div>
      </div>
      <div class="compare">
        <div class="item">同期: <b>${overseasPrev.toFixed(1)}M</b></div>
        <div class="item">YoY: <b class="${overseasYoY>=0?'pos-w':'neg-w'}">${overseasYoY>=0?'+':''}${overseasYoY.toFixed(1)}%</b></div>
      </div>
    </div>
    <div class="kpi-total" style="background:linear-gradient(135deg,#c8102e,#9f1239);">
      <div class="left">
        <div>
          <div class="label-big">🇨🇳 中国出货</div>
          <div class="value-big">${lastG.china.toFixed(1)} <span class="unit">M</span></div>
        </div>
        <div style="font-size:11.5px; opacity:0.85;">占全球 ${(lastG.china/lastG.total*100).toFixed(1)}%</div>
      </div>
      <div class="compare">
        <div class="item">同期: <b>${prevG.china.toFixed(1)}M</b></div>
        <div class="item">YoY: <b class="${chinaYoY>=0?'pos-w':'neg-w'}">${chinaYoY>=0?'+':''}${chinaYoY.toFixed(1)}%</b></div>
      </div>
    </div>
  `;

  // ===== ① 全球走势：中国 vs 海外 堆叠 + YoY 折线 =====
  const totalArr = qs.map(q => O.globalQuarterly[q].total);
  const chinaArr = qs.map(q => O.globalQuarterly[q].china);
  const overseasArr = qs.map(q => O.globalQuarterly[q].total - O.globalQuarterly[q].china);
  const yoyArr = qs.map(q => O.globalQuarterly[q].yoy);

  Plotly.newPlot('chartGlobalTrend', [
    { x: qs, y: overseasArr, name:'海外', type:'bar', marker:{color:'#0891b2'},
      text: overseasArr.map(v=>v.toFixed(0)), textposition:'inside', textfont:{size:10,color:'#fff'}, yaxis:'y' },
    { x: qs, y: chinaArr, name:'中国', type:'bar', marker:{color:'#c8102e'},
      text: chinaArr.map(v=>v.toFixed(0)), textposition:'inside', textfont:{size:10,color:'#fff'}, yaxis:'y' },
    { x: qs, y: totalArr.map(v=>v.toFixed(0)), text: totalArr.map(v=>Math.round(v)+'M'), mode:'text',
      type:'scatter', textposition:'top center', textfont:{size:11,color:'#1e3a8a',weight:700},
      showlegend:false, hoverinfo:'skip', cliponaxis:false, yaxis:'y' },
    { x: qs, y: yoyArr, name:'YoY %', type:'scatter', mode:'lines+markers+text',
      line:{color:'#0ea5e9',width:2}, marker:{color:'#0ea5e9',size:7},
      text: yoyArr.map(v=>(v>=0?'+':'')+v.toFixed(1)+'%'),
      textposition:'top center', textfont:{size:10,color:'#0ea5e9',weight:600}, yaxis:'y2', cliponaxis:false }
  ], {
    barmode:'stack',
    yaxis:{title:'出货量 (M)', domain:[0,0.78], automargin:true},
    yaxis2:{title:{text:'YoY (%)',font:{size:10,color:'#0ea5e9'}}, domain:[0.85,1],
      ticksuffix:'%', showgrid:false, zeroline:true, zerolinecolor:'#cbd5e1', tickfont:{size:9,color:'#0ea5e9'}},
    xaxis:{type:'category'},
    legend:{orientation:'h', y:-0.18, font:{size:11}},
    margin:{t:30, b:60, l:55, r:30}, bargap:0.4
  }, {responsive:true, displayModeBar:false});

  // ===== ② TOP 厂商表（含全球+海外双 YoY）=====
  const totLast = lastG.total;
  const ranking = brands.map(b => {
    const cur = O.brandQuarterly[b][lastQ] || 0;
    const prev = O.brandQuarterly[b][prevYQ] || 0;
    const yoy = prev ? ((cur/prev-1)*100) : null;
    const share = (cur/totLast*100);
    // 海外 = 全球 - 中国
    const curOv = Math.max(0, cur - (O.brandChinaQuarterly[b][lastQ]||0));
    const prevOv = Math.max(0, prev - (O.brandChinaQuarterly[b][prevYQ]||0));
    const ovYoy = prevOv ? ((curOv/prevOv-1)*100) : null;
    return {b, cur, prev, yoy, share, curOv, prevOv, ovYoy};
  }).sort((a,c) => c.cur - a.cur);

  let topHtml = `<thead><tr>
    <th style="text-align:center;">排名</th>
    <th style="text-align:left;">厂商</th>
    <th style="text-align:center;">${lastQ} 全球出货 (M)</th>
    <th style="text-align:center;">份额</th>
    <th style="text-align:center;">${prevYQ} 同期</th>
    <th style="text-align:center;">全球 YoY</th>
    <th style="text-align:center;">${lastQ} 海外出货 (M)</th>
    <th style="text-align:center;">海外 YoY</th>
  </tr></thead><tbody>`;
  ranking.forEach((r, i) => {
    // 高亮行：荣耀(大涨)绿底加粗、小米(大跌)红底加粗
    let rowStyle = '';
    if (r.b === 'Honor') rowStyle = 'background:#ecfdf5; font-weight:700;';
    else if (r.b === 'Xiaomi') rowStyle = 'background:#fef2f2; font-weight:700;';
    // 海外出货数字按海外 YoY 染色（升绿降红）
    const ovCls = r.ovYoy == null ? '' : (r.ovYoy >= 0 ? 'pos' : 'neg');
    topHtml += `<tr style="${rowStyle}">
      <td style="text-align:center;">#${i+1}</td>
      <td style="text-align:left;"><span style="display:inline-block;width:10px;height:10px;background:${bColor(r.b)};border-radius:50%;margin-right:6px;vertical-align:middle;"></span>${r.b}</td>
      <td style="text-align:center;"><b>${r.cur.toFixed(1)}</b></td>
      <td style="text-align:center;">${r.share.toFixed(1)}%</td>
      <td style="text-align:center;">${r.prev.toFixed(1)}</td>
      <td style="text-align:center;" class="${r.yoy>=0?'pos':'neg'}">${r.yoy==null?'-':((r.yoy>=0?'+':'')+r.yoy.toFixed(1)+'%')}</td>
      <td style="text-align:center;"><b>${r.curOv.toFixed(1)}</b></td>
      <td style="text-align:center;" class="${ovCls}">${r.ovYoy==null?'-':((r.ovYoy>=0?'+':'')+r.ovYoy.toFixed(1)+'%')}</td>
    </tr>`;
  });
  topHtml += '</tbody>';
  $('#overseasTopTbl').innerHTML = topHtml;

  // ===== ③ 海外拆分（最新季度 各厂商 海外 vs 中国）=====
  const splitData = brands.map(b => {
    const total = O.brandQuarterly[b][lastQ] || 0;
    const china = O.brandChinaQuarterly[b][lastQ] || 0;
    const overseas = Math.max(0, total - china);
    return {b, total, china, overseas, ovRate: total ? overseas/total*100 : 0};
  }).sort((a,c) => c.total - a.total);

  Plotly.newPlot('chartOverseasSplit', [
    { x: splitData.map(d=>d.b), y: splitData.map(d=>d.overseas), name:'海外', type:'bar',
      marker:{color:'#0891b2'},
      text: splitData.map(d=>d.overseas.toFixed(1)+'M ('+d.ovRate.toFixed(0)+'%)'),
      textposition:'inside', textfont:{size:10,color:'#fff'} },
    { x: splitData.map(d=>d.b), y: splitData.map(d=>d.china), name:'中国', type:'bar',
      marker:{color:'#c8102e'},
      text: splitData.map(d=>d.china.toFixed(1)+'M'),
      textposition:'inside', textfont:{size:10,color:'#fff'} }
  ], {
    barmode:'stack',
    yaxis:{title:lastQ+' 出货 (M)', automargin:true},
    legend:{orientation:'h', y:-0.18, font:{size:11}},
    margin:{t:20, b:60, l:55, r:30}, bargap:0.3
  }, {responsive:true, displayModeBar:false});

  // ===== ④ 各区域 TOP 厂商 — 多子图水平柱 =====
  const N = regions.length;
  const xGap = 0.04;
  const xSlot = (1 - xGap*(N-1)) / N;
  const regionTraces2 = [];
  const regionAnn = [];
  regions.forEach((r, idx) => {
    const xL = idx*(xSlot+xGap);
    const shares = O.regionBrandShare26Q1[r];
    const arr = Object.entries(shares).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const i = idx+1;
    const xKey = idx===0?'x':'x'+i, yKey = idx===0?'y':'y'+i;
    regionTraces2.push({
      x: arr.map(e=>e[1]),
      y: arr.map(e=>e[0]),
      type:'bar', orientation:'h',
      marker:{color: arr.map(e=>bColor(e[0]) || '#94a3b8')},
      text: arr.map(e=>e[1].toFixed(0)+'%'),
      textposition:'inside', insidetextanchor:'end',
      textfont:{size:10,color:'#fff'},
      xaxis: xKey, yaxis: yKey, showlegend: false
    });
    regionAnn.push({
      text:`<b style="color:${rColor(r)}">${r}</b>`, xref:'paper', yref:'paper',
      x: xL, y: 1.02, xanchor:'left', yanchor:'bottom', showarrow:false, font:{size:12}
    });
  });
  const layoutR = { margin:{t:30,l:10,r:10,b:10}, height:460, annotations: regionAnn, showlegend:false };
  regions.forEach((r, idx) => {
    const xL = idx*(xSlot+xGap), xR = xL+xSlot;
    const i = idx+1;
    const xKey = idx===0?'xaxis':'xaxis'+i, yKey = idx===0?'yaxis':'yaxis'+i;
    layoutR[xKey] = {domain:[xL,xR], anchor:idx===0?'y':'y'+i, showticklabels:false, showgrid:false, zeroline:false};
    layoutR[yKey] = {domain:[0,1], anchor:idx===0?'x':'x'+i, autorange:'reversed', automargin:true, tickfont:{size:10}, showgrid:false};
  });
  Plotly.newPlot('chartRegionShare', regionTraces2, layoutR, {responsive:true, displayModeBar:false});

  // ===== ⑤ 品牌×区域 热力图 =====
  const z = brands.map(b => regions.map(r => (O.brandRegionShare26Q1[b]||{})[r] || 0));
  Plotly.newPlot('chartBrandRegion', [{
    z: z, x: regions, y: brands, type:'heatmap',
    colorscale:[[0,'#f8fafc'],[0.3,'#bfdbfe'],[0.6,'#3b82f6'],[1,'#1e3a8a']],
    text: z.map(row => row.map(v => v>0 ? v.toFixed(0)+'%' : '')),
    texttemplate:'%{text}', textfont:{size:11},
    hovertemplate:'%{y} 在 %{x}: %{z}%<extra></extra>',
    colorbar:{title:'份额 %', tickfont:{size:9}}
  }], {
    margin:{t:20,b:60,l:80,r:30},
    xaxis:{tickfont:{size:11}}, yaxis:{tickfont:{size:11}, automargin:true}
  }, {responsive:true, displayModeBar:false});

  // ===== ⑤ 中国厂商海外占比柱状对比 =====
  const cnBrands = ['Huawei','Honor','Xiaomi','OPPO','vivo','Transsion'];
  const cnData = cnBrands.map(b => {
    const total = O.brandQuarterly[b][lastQ] || 0;
    const china = O.brandChinaQuarterly[b][lastQ] || 0;
    const overseas = Math.max(0, total - china);
    return { b, total, overseasRate: total ? overseas/total*100 : 0, overseas };
  }).sort((a,c) => c.overseasRate - a.overseasRate);

  Plotly.newPlot('chartChinaGo', [{
    x: cnData.map(d=>d.b),
    y: cnData.map(d=>d.overseasRate),
    type:'bar',
    marker:{color: cnData.map(d=>bColor(d.b))},
    text: cnData.map(d => d.overseasRate.toFixed(0)+'% ('+d.overseas.toFixed(1)+'M)'),
    textposition:'outside', textfont:{size:11,color:'#1e293b',weight:700}, cliponaxis:false
  }], {
    yaxis:{title:'海外出货占比 (%)', ticksuffix:'%', range:[0, 110], automargin:true},
    xaxis:{tickfont:{size:12}},
    margin:{t:30, b:50, l:55, r:30}, bargap:0.4
  }, {responsive:true, displayModeBar:false});
}

// ================== Tab 5: 行业新闻动态 ==================
function renderNews() {
  const data = NEWS[NEWS_STATE.period];
  if (!data) {
    $('#newsContainer').innerHTML = '<div class="news-empty">暂无新闻数据，请稍后重试</div>';
    $('#newsPeriodLabel').textContent = '--';
    return;
  }
  $('#newsPeriodLabel').textContent = data.meta.periodLabel;
  const regionData = data[NEWS_STATE.region] || {};
  const cats = data.meta.categoryOrder;
  const colors = data.meta.categoryColors;
  const icons = data.meta.categoryIcons;

  let html = '';
  cats.forEach(cat => {
    const items = regionData[cat] || [];
    if (items.length === 0) return; // 跳过无新闻分类
    const color = colors[cat] || '#94a3b8';
    const icon = icons[cat] || '📌';

    html += `<div class="news-section">
      <div class="news-section-header">
        <span class="bar" style="background:${color};"></span>
        <span class="icon">${icon}</span>
        <span class="title">${cat}</span>
        <span class="count">${items.length} 条</span>
      </div>
      <div class="news-list">`;
    // 按日期倒序
    items.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(it => {
      const safeUrl = it.url || '#';
      html += `<div class="news-item">
        <div class="meta">
          <span class="date">${it.date.slice(5)}</span>
          <span class="source">${it.source || '--'}</span>
        </div>
        <div class="body">
          <div class="title"><a href="${safeUrl}" target="_blank" rel="noopener">${it.title}</a></div>
          <div class="summary">${it.summary || ''}</div>
          ${safeUrl !== '#' ? `<a class="link" href="${safeUrl}" target="_blank" rel="noopener">🔗 查看原文</a>` : ''}
        </div>
      </div>`;
    });
    html += '</div></div>';
  });

  if (!html) html = '<div class="news-empty">本周/本月该地区暂无收录新闻</div>';
  $('#newsContainer').innerHTML = html;
}

// ================== 启动 ==================
window.toggleModel = toggleModel; // 暴露给行内 onclick
bindEvents();
loadData();
