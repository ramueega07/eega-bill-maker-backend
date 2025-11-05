import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dataDir = path.resolve(process.cwd(), 'data');
const exportsDir = path.resolve(process.cwd(), 'exports');
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

const dbPath = path.join(dataDir, 'invoices.sqlite');
const db = new Database(dbPath);

const rows = db.prepare('SELECT invoiceNo, date, receiverName, consigneeName, grandTotal FROM invoices ORDER BY date DESC, invoiceNo DESC').all();
const header = ['invoiceNo', 'date', 'receiverName', 'consigneeName', 'grandTotal'];
const csv = [header.join(',')]
  .concat(rows.map(r => header.map(h => String(r[h] ?? '').replaceAll('"', '""')).map(v => v.includes(',') ? `"${v}"` : v).join(',')))
  .join('\n');

const outPath = path.join(exportsDir, `invoices-${new Date().toISOString().slice(0,10)}.csv`);
fs.writeFileSync(outPath, csv);
console.log(`Exported ${rows.length} invoices to ${outPath}`);


