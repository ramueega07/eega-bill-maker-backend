import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dataDir = path.resolve(process.cwd(), 'data');
const exportsDir = path.resolve(process.cwd(), 'exports');
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

const dbPath = path.join(dataDir, 'invoices.sqlite');
const db = new Database(dbPath);

const rows = db.prepare('SELECT data FROM invoices ORDER BY date DESC, invoiceNo DESC').all();
const invoices = rows.map(r => JSON.parse(r.data));

const outPath = path.join(exportsDir, `invoices-${new Date().toISOString().slice(0,10)}.json`);
fs.writeFileSync(outPath, JSON.stringify(invoices, null, 2));
console.log(`Exported ${invoices.length} invoices to ${outPath}`);


