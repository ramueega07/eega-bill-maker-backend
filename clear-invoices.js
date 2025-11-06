import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'invoices.sqlite');

if (!fs.existsSync(dbPath)) {
  console.log('Database file does not exist.');
  process.exit(0);
}

const db = new Database(dbPath);

// Get count before deletion
const countBefore = db.prepare('SELECT COUNT(*) as count FROM invoices').get();

if (countBefore.count === 0) {
  console.log('No invoices found in database. Database is already empty.');
  db.close();
  process.exit(0);
}

console.log(`Found ${countBefore.count} invoice(s) in the database.`);

// Delete all invoices
const deleteStmt = db.prepare('DELETE FROM invoices');
const result = deleteStmt.run();

console.log(`Successfully deleted ${result.changes} invoice(s) from the database.`);
console.log('Database is now ready for production use.');

db.close();

