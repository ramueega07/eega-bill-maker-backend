import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Ensure data directory exists and open DB within it
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'invoices.sqlite');
const db = new Database(dbPath);

// Create table for invoices (store searchable columns plus full JSON)
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceNo TEXT UNIQUE,
    date TEXT,
    receiverName TEXT,
    consigneeName TEXT,
    grandTotal REAL,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// Insert or replace an invoice
const insertStmt = db.prepare(`
  INSERT INTO invoices (invoiceNo, date, receiverName, consigneeName, grandTotal, data)
  VALUES (@invoiceNo, @date, @receiverName, @consigneeName, @grandTotal, @data)
  ON CONFLICT(invoiceNo) DO UPDATE SET
    date=excluded.date,
    receiverName=excluded.receiverName,
    consigneeName=excluded.consigneeName,
    grandTotal=excluded.grandTotal,
    data=excluded.data
`);

app.post('/api/invoices', (req, res) => {
  try {
    const invoice = req.body;
    if (!invoice || !invoice.invoiceNo) {
      return res.status(400).json({ error: 'invoiceNo required' });
    }
    const payload = {
      invoiceNo: invoice.invoiceNo,
      date: invoice.date,
      receiverName: invoice.receiver?.name || '',
      consigneeName: invoice.consignee?.name || '',
      grandTotal: Number(invoice.grandTotal) || 0,
      data: JSON.stringify(invoice)
    };
    insertStmt.run(payload);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/invoices', (req, res) => {
  try {
    const { fromDate, toDate, invoiceNo, customerName } = req.query;
    const where = [];
    const params = {};
    if (fromDate && toDate) {
      where.push('date BETWEEN @fromDate AND @toDate');
      params.fromDate = fromDate;
      params.toDate = toDate;
    }
    if (invoiceNo) {
      where.push('invoiceNo LIKE @invoiceNo');
      params.invoiceNo = `%${invoiceNo}%`;
    }
    if (customerName) {
      where.push('(receiverName LIKE @customer OR consigneeName LIKE @customer)');
      params.customer = `%${customerName}%`;
    }
    const sql = `SELECT invoiceNo, date, receiverName, consigneeName, grandTotal, data FROM invoices
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY date DESC, invoiceNo DESC`;
    const rows = db.prepare(sql).all(params);
    const invoices = rows.map(r => JSON.parse(r.data));
    return res.json(invoices);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/invoices/:invoiceNo', (req, res) => {
  try {
    const row = db.prepare('SELECT data FROM invoices WHERE invoiceNo = ?').get(req.params.invoiceNo);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(JSON.parse(row.data));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Next invoice number for a given date (YYYYMMDD)
app.get('/api/next-invoice', (req, res) => {
  try {
    const dateInput = req.query.date || new Date().toISOString().split('T')[0];
    const date = dateInput.replace(/-/g, '');
    if (!/^\d{8}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYYMMDD' });
    }
    const prefix = `INV${date}-`;
    const rows = db.prepare('SELECT invoiceNo FROM invoices WHERE invoiceNo LIKE ?').all(`${prefix}%`);
    let maxSeq = 0;
    for (const r of rows) {
      const parts = String(r.invoiceNo).split('-');
      const seq = parseInt(parts[1], 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    const nextSeq = maxSeq + 1;
    const padded = String(nextSeq).padStart(3, '0');
    return res.json({ invoiceNo: `${prefix}${padded}`, sequence: nextSeq });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Export JSON of all invoices
app.get('/api/export/json', (_req, res) => {
  try {
    const rows = db.prepare('SELECT data FROM invoices ORDER BY date DESC, invoiceNo DESC').all();
    const invoices = rows.map(r => JSON.parse(r.data));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.json"');
    return res.send(JSON.stringify(invoices, null, 2));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Export CSV of key fields
app.get('/api/export/csv', (_req, res) => {
  try {
    const rows = db.prepare('SELECT invoiceNo, date, receiverName, consigneeName, grandTotal FROM invoices ORDER BY date DESC, invoiceNo DESC').all();
    const header = ['invoiceNo', 'date', 'receiverName', 'consigneeName', 'grandTotal'];
    const csv = [header.join(',')]
      .concat(rows.map(r => header.map(h => String(r[h] ?? '').replaceAll('"', '""')).map(v => v.includes(',') ? `"${v}"` : v).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(port, () => {
  console.log(`RKF Bill Server listening on http://localhost:${port}`);
});


