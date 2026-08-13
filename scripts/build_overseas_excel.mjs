import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(await fs.readFile(path.join(root, 'data/overseas_2026Q2.json'), 'utf8'));
const publicChecks = JSON.parse(await fs.readFile(path.join(root, 'data/idc_public_vendor_checks_25Q1_26Q2.json'), 'utf8'));
const periods = ['25Q1', '25Q2', '25Q3', '25Q4', '26Q1', '26Q2'];
const brands = data.meta.brandOrder;
const outputDir = process.env.OVERSEAS_XLSX_OUTPUT_DIR || '/Users/ruoxipei/Desktop/idc-dashboard/outputs/019ffa1b-3225-7383-9cb3-2dc07858f029';
const outputPath = path.join(outputDir, 'IDC海外手机出货_25Q1-26Q2_校验修正版.xlsx');
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const globalSheet = workbook.worksheets.add('全球厂商出货');
const chinaSheet = workbook.worksheets.add('中国厂商出货');
const overseasSheet = workbook.worksheets.add('海外厂商出货');
const audit = workbook.worksheets.add('校验结果');
const calc = workbook.worksheets.add('计算底稿');
const sources = workbook.worksheets.add('来源说明');

const bodyBorder = { preset: 'all', style: 'thin', color: '#D1D5DB' };
const titleStyle = {
  fill: '#111827',
  font: { bold: true, color: '#FFFFFF', size: 15 },
  horizontalAlignment: 'left',
  verticalAlignment: 'center',
};
const blackHeader = {
  fill: '#000000',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  borders: bodyBorder,
};
const blueHeader = {
  fill: '#1E3A8A',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  borders: bodyBorder,
};
const calcRows = [];
const calcIndex = new Map();
const extraCheckMap = new Map(publicChecks.additionalPublicChecks.map((item) => [`${item.brand}|${item.period}`, item]));

function validationFor(brand, period, shipment) {
  const official = publicChecks[period].vendors[brand];
  if (official !== undefined) {
    if (Math.abs(shipment - official) > 1e-9) throw new Error(`${brand} ${period} differs from IDC public table: ${shipment} vs ${official}`);
    return '与IDC公开表一致';
  }
  const extra = extraCheckMap.get(`${brand}|${period}`);
  if (extra) {
    if (Math.abs(shipment - extra.shipment) > 1e-9) throw new Error(`${brand} ${period} differs from supplemental IDC table`);
    return '与IDC当期公开表一致';
  }
  const status = data.brandQuarterlyStatus[brand][period];
  if (status === 'IDC_YOY_DERIVED') return 'IDC官方同比反推，非直接绝对量';
  if (status === 'IDC_OLD_SCOPE') return '旧口径/非当前Top 5，无法用当前公开表复核';
  return '公开信息估算，非IDC直接披露';
}

for (const period of periods) {
  const expected = publicChecks[period];
  if (Math.abs(data.globalQuarterly[period].total - expected.total) > 1e-9) {
    throw new Error(`${period} global total differs from IDC public table`);
  }
}

for (const brand of brands) {
  for (const period of periods) {
    const prev = `${String(Number(period.slice(0, 2)) - 1).padStart(2, '0')}${period.slice(2)}`;
    const source = publicChecks[period];
    const shipment = data.brandQuarterly[brand][period];
    const validation = validationFor(brand, period, shipment);
    calcIndex.set(`${brand}|${period}`, calcRows.length + 2);
    calcRows.push([
      period,
      brand,
      shipment,
      data.brandChinaQuarterly[brand][period],
      null,
      data.brandQuarterly[brand][prev],
      data.brandChinaQuarterly[brand][prev],
      null,
      null,
      null,
      null,
      data.brandQuarterlyStatus[brand][period],
      source.label,
      source.url,
      validation,
      null,
    ]);
  }
}

for (const period of periods) {
  const prev = `${String(Number(period.slice(0, 2)) - 1).padStart(2, '0')}${period.slice(2)}`;
  const source = publicChecks[period];
  calcIndex.set(`市场总计|${period}`, calcRows.length + 2);
  calcRows.push([
    period,
    '市场总计',
    source.total,
    data.globalQuarterly[period].china,
    null,
    source.priorTotal,
    data.globalQuarterly[prev].china,
    null,
    null,
    null,
    null,
    `${source.status} / CHINA_CONFIRMED`,
    `${source.label}；中国总量为用户确认准确看板`,
    source.url,
    '全球总量与IDC公开表一致',
    source.totalYoy / 100,
  ]);
}

calc.showGridLines = false;
calc.getRange('A1:P1').values = [[
  '季度','厂商','全球出货(M)','中国出货(M)','海外出货(M)',
  '上年同期全球(M)','上年同期中国(M)','上年同期海外(M)',
  '全球YoY计算','中国YoY','海外YoY','来源状态','公开来源说明','公开来源URL','全球值校验','全球YoY展示',
]];
calc.getRange('A1:P1').format = blueHeader;
const calcEndRow = calcRows.length + 1;
calc.getRange(`A2:P${calcEndRow}`).values = calcRows;
for (let row = 2; row <= calcEndRow; row += 1) {
  calc.getRange(`E${row}`).formulas = [[`=C${row}-D${row}`]];
  calc.getRange(`H${row}`).formulas = [[`=F${row}-G${row}`]];
  calc.getRange(`I${row}`).formulas = [[`=IF(F${row}=0,"",C${row}/F${row}-1)`]];
  calc.getRange(`J${row}`).formulas = [[`=IF(G${row}=0,"",D${row}/G${row}-1)`]];
  calc.getRange(`K${row}`).formulas = [[`=IF(H${row}=0,"",E${row}/H${row}-1)`]];
  if (calcRows[row - 2][15] === null) {
    const [period, brand] = calcRows[row - 2];
    const officialYoy = publicChecks[period].officialYoy[brand];
    const extraYoy = extraCheckMap.get(`${brand}|${period}`)?.yoy;
    if (officialYoy !== undefined) calc.getRange(`P${row}`).values = [[officialYoy / 100]];
    else if (extraYoy !== undefined) calc.getRange(`P${row}`).values = [[extraYoy / 100]];
    else calc.getRange(`P${row}`).formulas = [[`=I${row}`]];
  }
}
calc.getRange(`A2:P${calcEndRow}`).format = { borders: bodyBorder, verticalAlignment: 'center' };
calc.getRange(`C2:H${calcEndRow}`).format.numberFormat = '0.00';
calc.getRange(`I2:K${calcEndRow}`).format.numberFormat = '+0.0%;-0.0%;0.0%';
calc.getRange(`P2:P${calcEndRow}`).format.numberFormat = '+0.0%;-0.0%;0.0%';
calc.getRange(`A1:P${calcEndRow}`).format.font = { name: 'Arial' };
calc.getRange(`A1:B${calcEndRow}`).format.columnWidth = 13;
calc.getRange(`C1:K${calcEndRow}`).format.columnWidth = 16;
calc.getRange(`L1:L${calcEndRow}`).format.columnWidth = 34;
calc.getRange(`M1:M${calcEndRow}`).format.columnWidth = 50;
calc.getRange(`N1:N${calcEndRow}`).format.columnWidth = 58;
calc.getRange(`O1:O${calcEndRow}`).format.columnWidth = 36;
calc.getRange(`P1:P${calcEndRow}`).format.columnWidth = 18;
calc.getRange(`M2:O${calcEndRow}`).format.wrapText = true;
calc.freezePanes.freezeRows(1);

const marketConfigs = [
  {
    sheet: globalSheet,
    name: '全球',
    valueCol: 'C',
    priorCol: 'F',
    yoyCol: 'P',
    accent: '#DBEAFE',
    note: '全球绝对量优先采用IDC公开Top 5表；橙/紫/红为估算、同比反推或旧口径。厂商YoY有公开值时取IDC，否则按底稿计算；25Q1/25Q2重列值的版本边界见“校验结果”。',
  },
  {
    sheet: chinaSheet,
    name: '中国',
    valueCol: 'D',
    priorCol: 'G',
    yoyCol: 'J',
    accent: '#FEE2E2',
    note: '中国厂商与市场总量完整保留用户确认准确的看板底稿；YoY按同一份中国底稿计算。',
  },
  {
    sheet: overseasSheet,
    name: '海外',
    valueCol: 'E',
    priorCol: 'H',
    yoyCol: 'K',
    accent: '#CFFAFE',
    note: '海外不是IDC直接公布字段；每个单元格均为全球出货减中国出货，YoY按倒减后的同期值计算。',
  },
];

const quarterColumns = [['I','J'], ['K','L'], ['M','N'], ['O','P'], ['Q','R'], ['S','T']];
const halfDefs = [
  { label: '25H1', cols: ['B','C'], current: ['I','K'], periods: ['25Q1','25Q2'] },
  { label: '25H2', cols: ['D','E'], current: ['M','O'], periods: ['25Q3','25Q4'] },
  { label: '26H1', cols: ['F','G'], current: ['Q','S'], periods: ['26Q1','26Q2'], compareCell: 'B' },
];

function sourceFill(status, fallback) {
  if (status === 'ESTIMATE') return '#FFF7ED';
  if (status === 'IDC_YOY_DERIVED') return '#F5F3FF';
  if (status === 'IDC_OLD_SCOPE') return '#FEF2F2';
  return fallback;
}

function priorRefs(config, sourcePeriods, brand = null) {
  return sourcePeriods.map((period) => {
    const row = calcIndex.get(`${brand || '市场总计'}|${period}`);
    return `'计算底稿'!${config.priorCol}${row}`;
  }).join(',');
}

function vendorPriorRefs(config, sourcePeriods) {
  return sourcePeriods.flatMap((period) => brands.map((brand) => {
    const row = calcIndex.get(`${brand}|${period}`);
    return `'计算底稿'!${config.priorCol}${row}`;
  })).join(',');
}

for (const config of marketConfigs) {
  const sheet = config.sheet;
  sheet.showGridLines = false;
  sheet.getRange('A1:T1').merge();
  sheet.getRange('A1').values = [[`IDC口径${config.name}手机出货｜25Q1–26Q2 + 半年汇总`]];
  sheet.getRange('A1:T1').format = titleStyle;
  sheet.getRange('A1:T1').format.rowHeight = 30;
  sheet.getRange('A2:A3').merge();
  sheet.getRange('A2').values = [['厂商']];
  sheet.getRange('A2:A3').format = blackHeader;
  halfDefs.forEach((def) => {
    sheet.getRange(`${def.cols[0]}2:${def.cols[1]}2`).merge();
    sheet.getRange(`${def.cols[0]}2`).values = [[def.label]];
    sheet.getRange(`${def.cols[0]}2:${def.cols[1]}2`).format = blackHeader;
    sheet.getRange(`${def.cols[0]}3:${def.cols[1]}3`).values = [[`出货量(M)`, 'YoY']];
    sheet.getRange(`${def.cols[0]}3:${def.cols[1]}3`).format = blackHeader;
  });
  periods.forEach((period, index) => {
    const [shipmentCol, yoyCol] = quarterColumns[index];
    sheet.getRange(`${shipmentCol}2:${yoyCol}2`).merge();
    sheet.getRange(`${shipmentCol}2`).values = [[period]];
    sheet.getRange(`${shipmentCol}2:${yoyCol}2`).format = blackHeader;
    sheet.getRange(`${shipmentCol}3:${yoyCol}3`).values = [[`出货量(M)`, 'YoY']];
    sheet.getRange(`${shipmentCol}3:${yoyCol}3`).format = blackHeader;
  });

  brands.forEach((brand, brandIndex) => {
    const row = 4 + brandIndex;
    const baseFill = brandIndex % 2 ? '#F8FAFC' : '#FFFFFF';
    sheet.getRange(`A${row}`).values = [[brand]];
    sheet.getRange(`A${row}`).format = { fill: baseFill, font: { bold: true, color: '#1F2937' }, borders: bodyBorder };
    periods.forEach((period, index) => {
      const [shipmentCol, yoyCol] = quarterColumns[index];
      const calcRow = calcIndex.get(`${brand}|${period}`);
      sheet.getRange(`${shipmentCol}${row}`).formulas = [[`='计算底稿'!${config.valueCol}${calcRow}`]];
      sheet.getRange(`${yoyCol}${row}`).formulas = [[`='计算底稿'!${config.yoyCol}${calcRow}`]];
      const fill = config.name === '中国' ? baseFill : sourceFill(data.brandQuarterlyStatus[brand][period], baseFill);
      sheet.getRange(`${shipmentCol}${row}:${yoyCol}${row}`).format = { fill, borders: bodyBorder, horizontalAlignment: 'center' };
    });
    for (const def of halfDefs) {
      const [shipmentCol, yoyCol] = def.cols;
      sheet.getRange(`${shipmentCol}${row}`).formulas = [[`=SUM(${def.current[0]}${row},${def.current[1]}${row})`]];
      if (def.compareCell) {
        sheet.getRange(`${yoyCol}${row}`).formulas = [[`=IF(${def.compareCell}${row}=0,"",${shipmentCol}${row}/${def.compareCell}${row}-1)`]];
      } else {
        const refs = priorRefs(config, def.periods, brand);
        sheet.getRange(`${yoyCol}${row}`).formulas = [[`=IF(SUM(${refs})=0,"",${shipmentCol}${row}/SUM(${refs})-1)`]];
      }
      const statuses = def.periods.map((period) => data.brandQuarterlyStatus[brand][period]);
      const fill = config.name === '中国' ? '#F8FAFC' : statuses.includes('IDC_OLD_SCOPE') ? '#FEF2F2' : statuses.includes('ESTIMATE') ? '#FFF7ED' : statuses.includes('IDC_YOY_DERIVED') ? '#F5F3FF' : '#EFF6FF';
      sheet.getRange(`${shipmentCol}${row}:${yoyCol}${row}`).format = { fill, borders: bodyBorder, horizontalAlignment: 'center' };
    }
  });

  const vendorTotalRow = 13;
  const marketTotalRow = 14;
  sheet.getRange(`A${vendorTotalRow}`).values = [['8厂商合计']];
  sheet.getRange(`A${marketTotalRow}`).values = [[`${config.name}市场总计`]];
  sheet.getRange(`A${vendorTotalRow}:T${vendorTotalRow}`).format = { fill: '#ECFDF5', font: { bold: true, color: '#065F46' }, borders: bodyBorder };
  sheet.getRange(`A${marketTotalRow}:T${marketTotalRow}`).format = { fill: config.accent, font: { bold: true, color: '#1E3A8A' }, borders: bodyBorder };

  periods.forEach((period, index) => {
    const [shipmentCol, yoyCol] = quarterColumns[index];
    const calcMarketRow = calcIndex.get(`市场总计|${period}`);
    sheet.getRange(`${shipmentCol}${vendorTotalRow}`).formulas = [[`=SUM(${shipmentCol}4:${shipmentCol}11)`]];
    const refs = vendorPriorRefs(config, [period]);
    sheet.getRange(`${yoyCol}${vendorTotalRow}`).formulas = [[`=IF(SUM(${refs})=0,"",${shipmentCol}${vendorTotalRow}/SUM(${refs})-1)`]];
    sheet.getRange(`${shipmentCol}${marketTotalRow}`).formulas = [[`='计算底稿'!${config.valueCol}${calcMarketRow}`]];
    sheet.getRange(`${yoyCol}${marketTotalRow}`).formulas = [[`='计算底稿'!${config.yoyCol}${calcMarketRow}`]];
  });

  for (const def of halfDefs) {
    const [shipmentCol, yoyCol] = def.cols;
    for (const row of [vendorTotalRow, marketTotalRow]) {
      sheet.getRange(`${shipmentCol}${row}`).formulas = [[`=SUM(${def.current[0]}${row},${def.current[1]}${row})`]];
    }
    if (def.compareCell) {
      for (const row of [vendorTotalRow, marketTotalRow]) {
        sheet.getRange(`${yoyCol}${row}`).formulas = [[`=IF(${def.compareCell}${row}=0,"",${shipmentCol}${row}/${def.compareCell}${row}-1)`]];
      }
    } else {
      const vendorRefs = vendorPriorRefs(config, def.periods);
      const marketRefs = priorRefs(config, def.periods);
      sheet.getRange(`${yoyCol}${vendorTotalRow}`).formulas = [[`=IF(SUM(${vendorRefs})=0,"",${shipmentCol}${vendorTotalRow}/SUM(${vendorRefs})-1)`]];
      sheet.getRange(`${yoyCol}${marketTotalRow}`).formulas = [[`=IF(SUM(${marketRefs})=0,"",${shipmentCol}${marketTotalRow}/SUM(${marketRefs})-1)`]];
    }
  }

  for (const row of [...Array(8).keys()].map((n) => n + 4).concat([vendorTotalRow, marketTotalRow])) {
    for (const col of ['B','D','F','I','K','M','O','Q','S']) sheet.getRange(`${col}${row}`).format.numberFormat = '0.0';
    for (const col of ['C','E','G','J','L','N','P','R','T']) sheet.getRange(`${col}${row}`).format.numberFormat = '+0.0%;-0.0%;0.0%';
  }
  sheet.getRange('A15:T15').merge();
  sheet.getRange('A15').values = [[config.note]];
  sheet.getRange('A15:T15').format = { fill: '#F3F4F6', font: { color: '#4B5563', italic: true }, wrapText: true, verticalAlignment: 'center' };
  sheet.getRange('A15:T15').format.rowHeight = 32;
  sheet.getRange('A1:T15').format.font = { name: 'Arial' };
  sheet.getRange('A1:A15').format.columnWidth = 15;
  sheet.getRange('B1:G15').format.columnWidth = 12;
  sheet.getRange('H1:H15').format.columnWidth = 3;
  sheet.getRange('I1:T15').format.columnWidth = 12;
  sheet.getRange('A2:T14').format.rowHeight = 23;
  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(1);
}

audit.showGridLines = false;
audit.getRange('A1:L1').values = [[
  '季度','厂商','全球出货(M)','中国出货(M)','海外出货(M)','海外公式核对','全球YoY展示','全球值校验结论','来源状态','来源说明','来源URL','口径备注',
]];
audit.getRange('A1:L1').format = blueHeader;
const auditEntries = [];
for (const brand of [...brands, '市场总计']) {
  for (const period of periods) auditEntries.push({ brand, period, calcRow: calcIndex.get(`${brand}|${period}`) });
}
auditEntries.forEach((entry, index) => {
  const row = index + 2;
  const { brand, period, calcRow } = entry;
  const source = publicChecks[period];
  audit.getRange(`A${row}:B${row}`).values = [[period, brand]];
  audit.getRange(`C${row}`).formulas = [[`='计算底稿'!C${calcRow}`]];
  audit.getRange(`D${row}`).formulas = [[`='计算底稿'!D${calcRow}`]];
  audit.getRange(`E${row}`).formulas = [[`='计算底稿'!E${calcRow}`]];
  audit.getRange(`F${row}`).formulas = [[`=IF(ABS(E${row}-(C${row}-D${row}))<0.000001,"PASS","FAIL")`]];
  audit.getRange(`G${row}`).formulas = [[`='计算底稿'!P${calcRow}`]];
  audit.getRange(`H${row}`).formulas = [[`='计算底稿'!O${calcRow}`]];
  audit.getRange(`I${row}`).formulas = [[`='计算底稿'!L${calcRow}`]];
  audit.getRange(`J${row}`).formulas = [[`='计算底稿'!M${calcRow}`]];
  audit.getRange(`K${row}`).formulas = [[`='计算底稿'!N${calcRow}`]];
  const note = brand === '市场总计'
    ? '全球总量取IDC公开表；中国总量取用户准确看板；海外为差值'
    : source.vendors[brand] !== undefined || extraCheckMap.has(`${brand}|${period}`)
      ? '全球绝对量已与IDC公开表逐项对齐'
      : '不在当期IDC公开Top 5绝对量表内，不声称为IDC直接值';
  audit.getRange(`L${row}`).values = [[note]];
});
const auditEndRow = auditEntries.length + 1;
audit.getRange(`A2:L${auditEndRow}`).format = { borders: bodyBorder, verticalAlignment: 'top' };
audit.getRange(`C2:E${auditEndRow}`).format.numberFormat = '0.00';
audit.getRange(`G2:G${auditEndRow}`).format.numberFormat = '+0.0%;-0.0%;0.0%';
audit.getRange(`F2:F${auditEndRow}`).format = { fill: '#ECFDF5', font: { bold: true, color: '#065F46' }, horizontalAlignment: 'center', borders: bodyBorder };
audit.getRange(`A1:L${auditEndRow}`).format.font = { name: 'Arial' };
audit.getRange(`A1:B${auditEndRow}`).format.columnWidth = 13;
audit.getRange(`C1:G${auditEndRow}`).format.columnWidth = 17;
audit.getRange(`H1:I${auditEndRow}`).format.columnWidth = 34;
audit.getRange(`J1:J${auditEndRow}`).format.columnWidth = 48;
audit.getRange(`K1:K${auditEndRow}`).format.columnWidth = 62;
audit.getRange(`L1:L${auditEndRow}`).format.columnWidth = 44;
audit.getRange(`H2:L${auditEndRow}`).format.wrapText = true;
audit.freezePanes.freezeRows(1);
audit.freezePanes.freezeColumns(2);

sources.showGridLines = false;
sources.getRange('A1:D1').merge();
sources.getRange('A1').values = [['数据来源、校验规则与口径边界']];
sources.getRange('A1:D1').format = titleStyle;
sources.getRange('A3:D8').values = [
  ['项目','定义','校验方式','结论边界'],
  ['全球厂商','IDC公开Top 5表优先','公开的绝对量逐格匹配','未公开厂商只标估算/反推，不声称官方'],
  ['中国厂商','用户确认准确看板底稿','原值保留不修改','本轮不用外部新闻替换'],
  ['海外厂商','全球出货 − 中国出货','每格使用Excel公式倒减','不是IDC直接披露的海外字段'],
  ['季度全市场YoY','IDC当期公布的标题/总计YoY','直接保留官方值','25Q1/25Q2绝对量为后续重列，与当期YoY可能非同一数据版本'],
  ['半年YoY','当期两季度合计/上年同期两季度合计−1','Excel公式计算','25H1涉及IDC历史重列，按公开可得对比值计算'],
];
sources.getRange('A3:D3').format = blueHeader;
sources.getRange('A4:D8').format = { borders: bodyBorder, wrapText: true, verticalAlignment: 'top' };
sources.getRange('A10:D10').values = [['季度','IDC核对基准','状态','URL']];
sources.getRange('A10:D10').format = blueHeader;
const sourceRows = periods.map((period) => [period, publicChecks[period].label, publicChecks[period].status, publicChecks[period].url]);
sources.getRange(`A11:D${10 + sourceRows.length}`).values = sourceRows;
sources.getRange(`A11:D${10 + sourceRows.length}`).format = { borders: bodyBorder, wrapText: true, verticalAlignment: 'top' };
sources.getRange('A18:D22').values = [
  ['状态代码','含义','是否IDC直接绝对量','颜色'],
  ['IDC_FINAL / IDC_PRELIM / IDC_REVISED','IDC最终、初值或回溯重列','是（仅限公开表所列厂商）','白/蓝'],
  ['IDC_YOY_DERIVED','按IDC官方全球同比反推','否','紫'],
  ['ESTIMATE','公开信息约束估算','否','橙'],
  ['IDC_OLD_SCOPE','OPPO旧口径/非当前公开Top 5','不能按当前表直接复核','红'],
];
sources.getRange('A18:D18').format = blueHeader;
sources.getRange('A19:D22').format = { borders: bodyBorder, wrapText: true };
sources.getRange('A1:D22').format.font = { name: 'Arial' };
sources.getRange('A1:A22').format.columnWidth = 26;
sources.getRange('B1:B22').format.columnWidth = 58;
sources.getRange('C1:C22').format.columnWidth = 34;
sources.getRange('D1:D22').format.columnWidth = 70;
sources.freezePanes.freezeRows(1);

const overview = await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 5000 });
console.log(overview.ndjson || overview);
const errorScan = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'builder formula error scan',
  maxChars: 8000,
});
console.log(errorScan.ndjson || errorScan);

const previewRanges = {
  '全球厂商出货': 'A1:T15',
  '中国厂商出货': 'A1:T15',
  '海外厂商出货': 'A1:T15',
  '校验结果': `A1:L${auditEndRow}`,
  '计算底稿': `A1:P${calcEndRow}`,
  '来源说明': 'A1:D22',
};
for (const [sheetName, range] of Object.entries(previewRanges)) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(outputDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(`SAVED ${outputPath}`);
