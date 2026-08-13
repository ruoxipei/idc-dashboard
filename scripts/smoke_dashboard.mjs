import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8876/dashboard.html';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('[data-tab="overseas"]').click();
await page.waitForFunction(() => document.querySelectorAll('#overseasVendorQuarterlyTbl tbody tr').length === 8);

const result = await page.evaluate(() => ({
  vendorRows: document.querySelectorAll('#overseasVendorQuarterlyTbl tbody tr').length,
  sourceLinks: document.querySelectorAll('#overseasSourceLedger a').length,
  excelHref: document.querySelector('button[onclick*=".xlsx"]')?.getAttribute('onclick') || '',
  note: document.querySelector('#tab-overseas .note')?.textContent || '',
}));

await browser.close();

if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
if (result.vendorRows !== 8) throw new Error(`expected 8 vendor rows, got ${result.vendorRows}`);
if (result.sourceLinks < 6) throw new Error(`expected at least 6 source links, got ${result.sourceLinks}`);
if (!result.excelHref.includes('.xlsx')) throw new Error('Excel download link missing');
if (!result.note.includes('海外推算值')) throw new Error('methodology note missing');
console.log(`PASS: ${result.vendorRows} vendors, ${result.sourceLinks} sources, Excel link and methodology note rendered.`);
