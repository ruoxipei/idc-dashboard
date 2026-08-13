import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../data/overseas_2026Q2.json', import.meta.url), 'utf8'));
const publicChecks = JSON.parse(fs.readFileSync(new URL('../data/idc_public_vendor_checks_25Q1_26Q2.json', import.meta.url), 'utf8'));
const periods = ['25Q1', '25Q2', '25Q3', '25Q4', '26Q1', '26Q2'];
const brands = data.meta.brandOrder;
const errors = [];

const previous = (period) => `${String(Number(period.slice(0, 2)) - 1).padStart(2, '0')}${period.slice(2)}`;
const overseas = (brand, period) => data.brandQuarterly[brand][period] - data.brandChinaQuarterly[brand][period];

for (const period of periods) {
  if (!data.globalQuarterly[period]) errors.push(`missing globalQuarterly.${period}`);
  const publicPeriod = publicChecks[period];
  if (!publicPeriod) errors.push(`missing IDC public check: ${period}`);
  if (publicPeriod && Math.abs(data.globalQuarterly[period].total - publicPeriod.total) > 1e-9) {
    errors.push(`IDC total mismatch: ${period}`);
  }
  for (const brand of brands) {
    const global = data.brandQuarterly?.[brand]?.[period];
    const china = data.brandChinaQuarterly?.[brand]?.[period];
    const status = data.brandQuarterlyStatus?.[brand]?.[period];
    if (!Number.isFinite(global)) errors.push(`missing global value: ${brand} ${period}`);
    if (!Number.isFinite(china)) errors.push(`missing China value: ${brand} ${period}`);
    if (!status) errors.push(`missing source status: ${brand} ${period}`);
    if (Number.isFinite(global) && Number.isFinite(china) && global < china) {
      errors.push(`negative overseas value: ${brand} ${period} (${global} - ${china})`);
    }
    const publicValue = publicPeriod?.vendors?.[brand];
    if (publicValue !== undefined && Math.abs(global - publicValue) > 1e-9) {
      errors.push(`IDC public vendor mismatch: ${brand} ${period} (${global} vs ${publicValue})`);
    }
  }
}

for (const item of publicChecks.additionalPublicChecks) {
  const actual = data.brandQuarterly?.[item.brand]?.[item.period];
  if (Math.abs(actual - item.shipment) > 1e-9) {
    errors.push(`supplemental IDC vendor mismatch: ${item.brand} ${item.period}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(['厂商', ...periods.flatMap((q) => [`${q}海外`, `${q}YoY`])].join('\t'));
for (const brand of brands) {
  const cells = [brand];
  for (const period of periods) {
    const current = overseas(brand, period);
    const base = overseas(brand, previous(period));
    const yoy = base ? (current / base - 1) * 100 : null;
    cells.push(current.toFixed(2), yoy == null ? '-' : `${yoy.toFixed(1)}%`);
  }
  console.log(cells.join('\t'));
}

const sourcePeriods = new Set(data.sourceLedger.map((item) => item.period));
for (const period of periods) {
  if (!sourcePeriods.has(period)) errors.push(`missing source ledger: ${period}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const officialVendorChecks = periods.reduce((sum, period) => sum + Object.keys(publicChecks[period].vendors).length, 0) + publicChecks.additionalPublicChecks.length;
console.log(`PASS: 6 IDC market totals, ${officialVendorChecks} public IDC vendor cells and ${brands.length * periods.length} overseas formulas checked.`);
