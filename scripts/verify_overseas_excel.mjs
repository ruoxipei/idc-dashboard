import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error('usage: node verify_overseas_excel.mjs <workbook.xlsx>');

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const sheets = await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 3000 });
console.log(sheets.ndjson || sheets);

const requiredSheets = ['全球厂商出货', '中国厂商出货', '海外厂商出货', '计算底稿', '来源说明'];
const sheetText = sheets.ndjson || String(sheets);
for (const name of requiredSheets) {
  if (!sheetText.includes(`"name":"${name}"`)) throw new Error(`missing required sheet: ${name}`);
}

async function inspectTable(sheetName) {
  const result = await workbook.inspect({
    kind: 'table',
    range: `${sheetName}!A2:T14`,
    include: 'values,formulas',
    tableMaxRows: 14,
    tableMaxCols: 20,
    maxChars: 18000,
  });
  const text = result.ndjson || String(result);
  console.log(text);
  const record = text.split('\n').map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).find((item) => item?.kind === 'table');
  if (!record) throw new Error(`unable to inspect table: ${sheetName}`);
  return record.values;
}

const globalValues = await inspectTable('全球厂商出货');
const chinaValues = await inspectTable('中国厂商出货');
const overseasValues = await inspectTable('海外厂商出货');

function rowMap(values) {
  return new Map(values.slice(2).map((row) => [row[0], row]));
}

const globalRows = rowMap(globalValues);
const chinaRows = rowMap(chinaValues);
const overseasRows = rowMap(overseasValues);
const idc26Q2 = new Map([
  ['Samsung', 62.7],
  ['Apple', 55.8],
  ['Xiaomi', 31.2],
  ['OPPO', 28.8],
  ['vivo', 21.2],
]);
for (const [brand, expected] of idc26Q2) {
  const actual = globalRows.get(brand)?.[18];
  if (Math.abs(actual - expected) > 1e-9) throw new Error(`26Q2 global mismatch for ${brand}: ${actual} vs ${expected}`);
  const china = chinaRows.get(brand)?.[18];
  const overseas = overseasRows.get(brand)?.[18];
  if (Math.abs(overseas - (actual - china)) > 1e-9) throw new Error(`26Q2 overseas formula mismatch for ${brand}`);
}

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
  maxChars: 8000,
});
const errorText = errors.ndjson || String(errors);
console.log(errorText);
if (errorText.includes('"match"')) process.exit(1);
console.log('PASS: three market sheets, IDC 26Q2 vendor values, overseas formulas and formula-error scan verified.');
