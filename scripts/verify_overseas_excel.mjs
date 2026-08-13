import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error('usage: node verify_overseas_excel.mjs <workbook.xlsx>');

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const sheets = await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 3000 });
console.log(sheets.ndjson || sheets);

const detail = await workbook.inspect({
  kind: 'table',
  range: '海外出货明细!A4:S13',
  include: 'values,formulas',
  tableMaxRows: 12,
  tableMaxCols: 20,
  maxChars: 18000,
});
console.log(detail.ndjson || detail);

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
console.log('PASS: workbook structure, detail table and formula-error scan verified.');
