import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(await fs.readFile(path.join(root, 'data/overseas_2026Q2.json'), 'utf8'));
const periods = ['25Q1', '25Q2', '25Q3', '25Q4', '26Q1', '26Q2'];
const halfYears = ['25H1', '25H2', '26H1'];
const displayPeriods = [...periods, ...halfYears];
const letters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S'];
const brands = data.meta.brandOrder;
const outputDir = process.env.OVERSEAS_XLSX_OUTPUT_DIR || '/Users/ruoxipei/Desktop/idc-dashboard/outputs/019ffa1b-3225-7383-9cb3-2dc07858f029';
const outputPath = path.join(outputDir, 'IDC海外手机出货_25Q1-26Q2.xlsx');

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const detail = workbook.worksheets.add('海外出货明细');
const calc = workbook.worksheets.add('计算底稿');
const sources = workbook.worksheets.add('来源说明');

const titleStyle = {
  fill: '#1E3A8A',
  font: { bold: true, color: '#FFFFFF', size: 18 },
  verticalAlignment: 'center',
};
const periodStyle = {
  fill: '#DBEAFE',
  font: { bold: true, color: '#1E3A8A' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  borders: { preset: 'all', style: 'thin', color: '#CBD5E1' },
};
const headerStyle = {
  fill: '#EFF6FF',
  font: { bold: true, color: '#1E293B' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  borders: { preset: 'all', style: 'thin', color: '#CBD5E1' },
};
const bodyBorder = { preset: 'all', style: 'thin', color: '#E2E8F0' };

detail.showGridLines = false;
detail.getRange('A1:S1').merge();
detail.getRange('A1').values = [['IDC口径手机出货｜全球 / 中国 / 海外｜25Q1–26Q2 + 半年汇总']];
detail.getRange('A1:S1').format = titleStyle;
detail.getRange('A1:S1').format.rowHeight = 32;
detail.getRange('A2:S2').merge();
detail.getRange('A2').values = [['全球取 IDC 公开全量；中国取用户确认准确的看板总量；海外 = 全球 − 中国。半年出货为两季度之和，半年 YoY 与上年同期两季度合计比较。单位：百万部（M）']];
detail.getRange('A2:S2').format = { fill: '#FEF3C7', font: { color: '#78350F' }, wrapText: true, verticalAlignment: 'center' };
detail.getRange('A2:S2').format.rowHeight = 34;
detail.getRange('A4:A5').merge();
detail.getRange('A4').values = [['厂商']];
detail.getRange('A4:A5').format = periodStyle;

displayPeriods.forEach((period, index) => {
  const startCol = 2 + index * 2;
  detail.getRange(`${letters[startCol - 1]}4:${letters[startCol]}4`).merge();
  detail.getRange(`${letters[startCol - 1]}4`).values = [[period]];
  detail.getRange(`${letters[startCol - 1]}4:${letters[startCol]}4`).format = periodStyle;
  detail.getRange(`${letters[startCol - 1]}5:${letters[startCol]}5`).values = [['出货量(M)', 'YoY']];
  detail.getRange(`${letters[startCol - 1]}5:${letters[startCol]}5`).format = headerStyle;
});

const calcRows = [];
const calcIndex = new Map();
for (const brand of brands) {
  for (const period of periods) {
    const prev = `${String(Number(period.slice(0, 2)) - 1).padStart(2, '0')}${period.slice(2)}`;
    const source = data.sourceLedger.find((item) => item.period === period);
    calcIndex.set(`${brand}|${period}`, calcRows.length + 2);
    calcRows.push([
      period,
      brand,
      data.brandQuarterly[brand][period],
      data.brandChinaQuarterly[brand][period],
      null,
      data.brandQuarterly[brand][prev],
      data.brandChinaQuarterly[brand][prev],
      null,
      null,
      data.brandQuarterlyStatus[brand][period],
      source?.label || '',
      source?.url || '',
    ]);
  }
}

for (const period of periods) {
  const prev = `${String(Number(period.slice(0, 2)) - 1).padStart(2, '0')}${period.slice(2)}`;
  const source = data.sourceLedger.find((item) => item.period === period);
  calcIndex.set(`市场总计|${period}`, calcRows.length + 2);
  calcRows.push([
    period,
    '市场总计',
    data.globalQuarterly[period].total,
    data.globalQuarterly[period].china,
    null,
    data.globalQuarterly[prev].total,
    data.globalQuarterly[prev].china,
    null,
    null,
    'IDC_GLOBAL_TOTAL / CHINA_CONFIRMED',
    `${source?.label || ''}；中国总量为用户确认准确底稿`,
    source?.url || '',
  ]);
}

brands.forEach((brand, brandIndex) => {
  const row = 6 + brandIndex;
  detail.getRange(`A${row}`).values = [[brand]];
  detail.getRange(`A${row}`).format = { font: { bold: true, color: '#1E293B' }, fill: brandIndex % 2 ? '#F8FAFC' : '#FFFFFF', borders: bodyBorder };
  periods.forEach((period, periodIndex) => {
    const startCol = 2 + periodIndex * 2;
    const calcRow = calcIndex.get(`${brand}|${period}`);
    const overseasCell = `${letters[startCol - 1]}${row}`;
    const yoyCell = `${letters[startCol]}${row}`;
    detail.getRange(overseasCell).formulas = [[`='计算底稿'!E${calcRow}`]];
    detail.getRange(yoyCell).formulas = [[`='计算底稿'!I${calcRow}`]];
    const status = data.brandQuarterlyStatus[brand][period];
    const fill = status === 'ESTIMATE' ? '#FFF7ED' : status === 'IDC_YOY_DERIVED' ? '#F5F3FF' : status === 'IDC_OLD_SCOPE' ? '#FEF2F2' : (brandIndex % 2 ? '#F8FAFC' : '#FFFFFF');
    detail.getRange(`${overseasCell}:${yoyCell}`).format = { fill, borders: bodyBorder, horizontalAlignment: 'center' };
    detail.getRange(overseasCell).format.numberFormat = '0.0';
    detail.getRange(yoyCell).format.numberFormat = '+0.0%;-0.0%;0.0%';
  });

  const summaryDefs = [
    { label: '25H1', dest: ['N', 'O'], currentCols: ['B', 'D'], sourcePeriods: ['25Q1', '25Q2'] },
    { label: '25H2', dest: ['P', 'Q'], currentCols: ['F', 'H'], sourcePeriods: ['25Q3', '25Q4'] },
    { label: '26H1', dest: ['R', 'S'], currentCols: ['J', 'L'], sourcePeriods: ['26Q1', '26Q2'], previousCols: ['B', 'D'] },
  ];
  for (const summary of summaryDefs) {
    const [shipmentCol, yoyCol] = summary.dest;
    detail.getRange(`${shipmentCol}${row}`).formulas = [[`=SUM(${summary.currentCols[0]}${row},${summary.currentCols[1]}${row})`]];
    if (summary.previousCols) {
      detail.getRange(`${yoyCol}${row}`).formulas = [[`=IF(SUM(${summary.previousCols[0]}${row},${summary.previousCols[1]}${row})=0,"",${shipmentCol}${row}/SUM(${summary.previousCols[0]}${row},${summary.previousCols[1]}${row})-1)`]];
    } else {
      const baseRows = summary.sourcePeriods.map((period) => calcIndex.get(`${brand}|${period}`));
      detail.getRange(`${yoyCol}${row}`).formulas = [[`=IF(SUM('计算底稿'!H${baseRows[0]},'计算底稿'!H${baseRows[1]})=0,"",${shipmentCol}${row}/SUM('计算底稿'!H${baseRows[0]},'计算底稿'!H${baseRows[1]})-1)`]];
    }
    const statuses = summary.sourcePeriods.map((period) => data.brandQuarterlyStatus[brand][period]);
    const fill = statuses.includes('IDC_OLD_SCOPE') ? '#FEF2F2' : statuses.includes('ESTIMATE') ? '#FFF7ED' : statuses.includes('IDC_YOY_DERIVED') ? '#F5F3FF' : '#E0F2FE';
    detail.getRange(`${shipmentCol}${row}:${yoyCol}${row}`).format = { fill, borders: bodyBorder, horizontalAlignment: 'center' };
    detail.getRange(`${shipmentCol}${row}`).format.numberFormat = '0.0';
    detail.getRange(`${yoyCol}${row}`).format.numberFormat = '+0.0%;-0.0%;0.0%';
  }
});

const vendorTotalRow = 14;
const globalTotalRow = 15;
const chinaTotalRow = 16;
const overseasTotalRow = 17;
detail.getRange(`A${vendorTotalRow}`).values = [['8厂商合计']];
detail.getRange(`A${globalTotalRow}`).values = [['全球市场总计']];
detail.getRange(`A${chinaTotalRow}`).values = [['中国市场总计']];
detail.getRange(`A${overseasTotalRow}`).values = [['海外市场总计']];
detail.getRange(`A${vendorTotalRow}:S${vendorTotalRow}`).format = { fill: '#ECFDF5', font: { bold: true, color: '#065F46' }, borders: bodyBorder };
detail.getRange(`A${globalTotalRow}:S${globalTotalRow}`).format = { fill: '#E0E7FF', font: { bold: true, color: '#1E3A8A' }, borders: bodyBorder };
detail.getRange(`A${chinaTotalRow}:S${chinaTotalRow}`).format = { fill: '#FEE2E2', font: { bold: true, color: '#991B1B' }, borders: bodyBorder };
detail.getRange(`A${overseasTotalRow}:S${overseasTotalRow}`).format = { fill: '#CFFAFE', font: { bold: true, color: '#155E75' }, borders: bodyBorder };

const vendorBaseFormula = (sourcePeriods) => sourcePeriods.flatMap((period) =>
  brands.map((brand) => `'计算底稿'!H${calcIndex.get(`${brand}|${period}`)}`)
).join(',');
const marketBaseFormula = (sourcePeriods, column) => sourcePeriods.map((period) =>
  `'计算底稿'!${column}${calcIndex.get(`市场总计|${period}`)}`
).join(',');

periods.forEach((period, periodIndex) => {
  const startCol = 2 + periodIndex * 2;
  const shipmentCol = letters[startCol - 1];
  const yoyCol = letters[startCol];
  const calcMarketRow = calcIndex.get(`市场总计|${period}`);
  const vendorBase = vendorBaseFormula([period]);
  detail.getRange(`${shipmentCol}${vendorTotalRow}`).formulas = [[`=SUM(${shipmentCol}6:${shipmentCol}13)`]];
  detail.getRange(`${yoyCol}${vendorTotalRow}`).formulas = [[`=IF(SUM(${vendorBase})=0,"",${shipmentCol}${vendorTotalRow}/SUM(${vendorBase})-1)`]];
  detail.getRange(`${shipmentCol}${globalTotalRow}`).formulas = [[`='计算底稿'!C${calcMarketRow}`]];
  detail.getRange(`${yoyCol}${globalTotalRow}`).formulas = [[`=IF('计算底稿'!F${calcMarketRow}=0,"",'计算底稿'!C${calcMarketRow}/'计算底稿'!F${calcMarketRow}-1)`]];
  detail.getRange(`${shipmentCol}${chinaTotalRow}`).formulas = [[`='计算底稿'!D${calcMarketRow}`]];
  detail.getRange(`${yoyCol}${chinaTotalRow}`).formulas = [[`=IF('计算底稿'!G${calcMarketRow}=0,"",'计算底稿'!D${calcMarketRow}/'计算底稿'!G${calcMarketRow}-1)`]];
  detail.getRange(`${shipmentCol}${overseasTotalRow}`).formulas = [[`='计算底稿'!E${calcMarketRow}`]];
  detail.getRange(`${yoyCol}${overseasTotalRow}`).formulas = [[`='计算底稿'!I${calcMarketRow}`]];
});

const totalSummaryDefs = [
  { dest: ['N', 'O'], currentCols: ['B', 'D'], sourcePeriods: ['25Q1', '25Q2'] },
  { dest: ['P', 'Q'], currentCols: ['F', 'H'], sourcePeriods: ['25Q3', '25Q4'] },
  { dest: ['R', 'S'], currentCols: ['J', 'L'], sourcePeriods: ['26Q1', '26Q2'], previousCols: ['N'] },
];
for (const summary of totalSummaryDefs) {
  const [shipmentCol, yoyCol] = summary.dest;
  for (const row of [vendorTotalRow, globalTotalRow, chinaTotalRow, overseasTotalRow]) {
    detail.getRange(`${shipmentCol}${row}`).formulas = [[`=SUM(${summary.currentCols[0]}${row},${summary.currentCols[1]}${row})`]];
  }
  if (summary.previousCols) {
    detail.getRange(`${yoyCol}${vendorTotalRow}`).formulas = [[`=IF(${summary.previousCols[0]}${vendorTotalRow}=0,"",${shipmentCol}${vendorTotalRow}/${summary.previousCols[0]}${vendorTotalRow}-1)`]];
    for (const row of [globalTotalRow, chinaTotalRow, overseasTotalRow]) {
      detail.getRange(`${yoyCol}${row}`).formulas = [[`=IF(${summary.previousCols[0]}${row}=0,"",${shipmentCol}${row}/${summary.previousCols[0]}${row}-1)`]];
    }
  } else {
    const vendorBase = vendorBaseFormula(summary.sourcePeriods);
    detail.getRange(`${yoyCol}${vendorTotalRow}`).formulas = [[`=IF(SUM(${vendorBase})=0,"",${shipmentCol}${vendorTotalRow}/SUM(${vendorBase})-1)`]];
    const marketRows = [
      [globalTotalRow, 'F'],
      [chinaTotalRow, 'G'],
      [overseasTotalRow, 'H'],
    ];
    for (const [row, baseColumn] of marketRows) {
      const marketBase = marketBaseFormula(summary.sourcePeriods, baseColumn);
      detail.getRange(`${yoyCol}${row}`).formulas = [[`=IF(SUM(${marketBase})=0,"",${shipmentCol}${row}/SUM(${marketBase})-1)`]];
    }
  }
}

for (const row of [vendorTotalRow, globalTotalRow, chinaTotalRow, overseasTotalRow]) {
  for (const shipmentCol of ['B','D','F','H','J','L','N','P','R']) detail.getRange(`${shipmentCol}${row}`).format.numberFormat = '0.0';
  for (const yoyCol of ['C','E','G','I','K','M','O','Q','S']) detail.getRange(`${yoyCol}${row}`).format.numberFormat = '+0.0%;-0.0%;0.0%';
  detail.getRange(`B${row}:S${row}`).format.horizontalAlignment = 'center';
}

detail.getRange('A19:S19').merge();
detail.getRange('A19').values = [['总计说明：全球市场总计取 IDC 全球全量；中国市场总计取用户确认准确的看板总量；海外市场总计 = 全球 − 中国；8厂商合计仅汇总表内厂商。']];
detail.getRange('A19:S19').format = { fill: '#F8FAFC', font: { color: '#64748B', italic: true }, wrapText: true };
detail.getRange('A19:S19').format.rowHeight = 30;
detail.getRange('A1:S19').format.font = { name: 'Arial' };
detail.getRange('A1:A19').format.columnWidth = 15;
detail.getRange('B1:S19').format.columnWidth = 13;
detail.getRange('A4:S17').format.rowHeight = 24;
detail.freezePanes.freezeRows(5);
detail.freezePanes.freezeColumns(1);

calc.showGridLines = false;
calc.getRange('A1:L1').values = [[
  '季度','厂商','全球出货(M)','中国出货(M)','海外出货(M)','上年同期全球(M)','上年同期中国(M)','上年同期海外(M)','海外YoY','来源状态','公开来源说明','公开来源URL',
]];
calc.getRange('A1:L1').format = { fill: '#0F766E', font: { bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', borders: bodyBorder };
const calcEndRow = calcRows.length + 1;
calc.getRange(`A2:L${calcEndRow}`).values = calcRows;
calc.getRange(`E2:E${calcEndRow}`).formulas = calcRows.map((_, index) => [[`=C${index + 2}-D${index + 2}`]]).flat();
calc.getRange(`H2:H${calcEndRow}`).formulas = calcRows.map((_, index) => [[`=F${index + 2}-G${index + 2}`]]).flat();
calc.getRange(`I2:I${calcEndRow}`).formulas = calcRows.map((_, index) => [[`=IF(H${index + 2}=0,"",E${index + 2}/H${index + 2}-1)`]]).flat();
calc.getRange(`A2:L${calcEndRow}`).format = { borders: bodyBorder, verticalAlignment: 'center' };
calc.getRange(`C2:H${calcEndRow}`).format.numberFormat = '0.00';
calc.getRange(`I2:I${calcEndRow}`).format.numberFormat = '+0.0%;-0.0%;0.0%';
calc.getRange(`A1:L${calcEndRow}`).format.font = { name: 'Arial' };
calc.getRange(`A1:B${calcEndRow}`).format.columnWidth = 13;
calc.getRange(`C1:I${calcEndRow}`).format.columnWidth = 16;
calc.getRange(`J1:J${calcEndRow}`).format.columnWidth = 20;
calc.getRange(`K1:K${calcEndRow}`).format.columnWidth = 46;
calc.getRange(`L1:L${calcEndRow}`).format.columnWidth = 52;
calc.getRange(`K2:L${calcEndRow}`).format.wrapText = true;
calc.freezePanes.freezeRows(1);

sources.showGridLines = false;
sources.getRange('A1:C1').merge();
sources.getRange('A1').values = [['  数据来源、公式与口径边界']];
sources.getRange('A1:C1').format = { fill: '#1E3A8A', font: { bold: true, color: '#FFFFFF', size: 14 }, verticalAlignment: 'center' };
sources.getRange('A3:C8').values = [
  ['项目','定义','处理'],
  ['海外出货','全球出货 − 中国出货','计算值，不标成 IDC 直接披露'],
  ['中国出货','用户确认准确的 8 厂商季度数据与市场总量','原值保留，不修改'],
  ['全球出货','IDC 公开季度表优先','25Q1/25Q2 优先采用 2026 表中回溯重列值'],
  ['未公开厂商','Honor / Huawei / Transsion 部分季度','公开新闻约束估算；对应单元格着色'],
  ['OPPO','IDC 自 26Q1 起并入 realme','25Q3/25Q4 仍为旧公开口径，标红提示断点'],
];
sources.getRange('A3:C3').format = headerStyle;
sources.getRange('A4:C8').format = { borders: bodyBorder, wrapText: true, verticalAlignment: 'top' };
sources.getRange('A10:C10').values = [['季度','来源说明','URL']];
sources.getRange('A10:C10').format = headerStyle;
const ledgerRows = data.sourceLedger.map((item) => [item.period, item.label, item.url]);
sources.getRange(`A11:C${10 + ledgerRows.length}`).values = ledgerRows;
sources.getRange(`A11:C${10 + ledgerRows.length}`).format = { borders: bodyBorder, wrapText: true, verticalAlignment: 'top' };
sources.getRange('A19:C22').values = [
  ['状态代码','含义','在明细表中的颜色'],
  ['IDC_FINAL / IDC_PRELIM / IDC_REVISED','IDC 官方最终、初值或回溯重列','无特殊底色'],
  ['IDC_YOY_DERIVED','按 IDC 官方全球同比反推绝对量','紫色'],
  ['ESTIMATE / IDC_OLD_SCOPE','估算 / OPPO 旧口径','橙色 / 红色'],
];
sources.getRange('A19:C19').format = headerStyle;
sources.getRange('A20:C22').format = { borders: bodyBorder, wrapText: true };
sources.getRange('A1:C22').format.font = { name: 'Arial' };
sources.getRange('A1:A22').format.columnWidth = 26;
sources.getRange('B1:B22').format.columnWidth = 58;
sources.getRange('C1:C22').format.columnWidth = 70;
sources.freezePanes.freezeRows(1);

const overview = await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 3000 });
console.log(overview.ndjson || overview);
const formulaInspect = await workbook.inspect({ kind: 'formula', sheetId: '计算底稿', range: `E1:I${calcEndRow}`, maxChars: 5000, options: { maxResults: 180 } });
console.log(formulaInspect.ndjson || formulaInspect);

const previewRanges = { '海外出货明细': 'A1:S19', '计算底稿': `A1:L${calcEndRow}`, '来源说明': 'A1:C22' };
for (const sheetName of ['海外出货明细', '计算底稿', '来源说明']) {
  const preview = await workbook.render({ sheetName, range: previewRanges[sheetName], scale: 1, format: 'png' });
  await fs.writeFile(path.join(outputDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(`SAVED ${outputPath}`);
