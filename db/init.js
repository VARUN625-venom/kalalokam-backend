// db/init.js
// Creates the SQLite schema (if not already present) and seeds the
// product catalog. Safe to run every time the server starts —
// uses CREATE TABLE IF NOT EXISTS and only seeds products if the
// products table is empty.

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'kalalokam.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT UNIQUE NOT NULL,     -- Google's stable user id ("sub" claim)
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    picture_url TEXT,
    phone TEXT,                          -- E.164-ish string, e.g. +919876543210
    phone_verified INTEGER NOT NULL DEFAULT 0,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS phone_otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price_paise INTEGER NOT NULL,        -- store money as integer paise to avoid float issues
    old_price_paise INTEGER,
    is_new INTEGER NOT NULL DEFAULT 0,
    seed INTEGER NOT NULL DEFAULT 0       -- used by frontend to pick a generated thumbnail
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal_paise INTEGER NOT NULL,
    shipping_paise INTEGER NOT NULL,
    total_paise INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_payment',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    title TEXT NOT NULL,                  -- snapshot in case product changes later
    unit_price_paise INTEGER NOT NULL,
    quantity INTEGER NOT NULL
  );
`);

// ---- Migration: add new columns to an existing users table if missing ----
// (Anyone who already ran this app before this update will have a users
// table without phone/address columns — this adds them safely.)
const existingCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
const newCols = [
  ['phone', 'TEXT'],
  ['phone_verified', 'INTEGER NOT NULL DEFAULT 0'],
  ['address_line1', 'TEXT'],
  ['address_line2', 'TEXT'],
  ['city', 'TEXT'],
  ['state', 'TEXT'],
  ['pincode', 'TEXT']
];
for (const [name, type] of newCols) {
  if (!existingCols.includes(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  }
}

// ---- Seed products only if table is empty ----
const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;

if (count === 0) {
  const NAMES = [
    ["Cheriyal Scroll Painting", "Hand-painted scroll telling a folk tale, natural pigments on khadi cloth.", 1],
    ["Kalamkari Cotton Dupatta", "Block-printed and hand-painted dupatta with traditional vegetable dyes.", 2],
    ["Terracotta Ganesha Idol", "Hand-shaped terracotta idol, fired and finished with a matte glaze.", 3],
    ["Madhubani Peacock Canvas", "Intricate peacock motif painted in the Madhubani folk style.", 1],
    ["Pochampally Ikat Table Runner", "Hand-woven ikat runner in geometric tie-dye patterns.", 2],
    ["Warli Tribal Wall Art", "Minimalist tribal art depicting village life, on treated wood panel.", 4],
    ["Hand-painted Terracotta Diya Set", "Set of 6 diyas hand-painted with floral motifs.", 3],
    ["Nirmal Toy Wooden Elephant", "Lacquered wooden elephant carved using the Nirmal craft technique.", 4],
    ["Kalamkari Wall Hanging", "Large wall hanging panel depicting mythological scenes.", 1],
    ["Bidri Inlay Decorative Bowl", "Hand-inlaid silver-on-blackened-metal decorative bowl.", 3],
    ["Cheriyal Mask – Hanuman", "Hand-carved and painted wooden mask in Cheriyal style.", 4],
    ["Block Print Cotton Cushion Cover", "Hand block-printed cushion cover in indigo and madder dyes.", 2],
    ["Dokra Tribal Brass Figurine", "Lost-wax cast brass figurine made by Dokra metal artisans.", 4],
    ["Hand-painted Pichwai Canvas", "Pichwai-style painting of cows and lotus motifs, fine detail work.", 1],
    ["Etikoppaka Wooden Toy Set", "Lacquer-turned wooden toy set using natural dyes.", 4],
    ["Kondapalli Wooden Doll", "Lightweight wooden doll hand-carved and painted in folk colours.", 4],
    ["Hand-embroidered Kantha Throw", "Kantha-stitch throw made from upcycled cotton layers.", 2],
    ["Banjara Mirror-work Tapestry", "Vibrant tapestry with traditional Banjara mirror embroidery.", 2],
    ["Terracotta Wall Plate – Sun Motif", "Hand-moulded terracotta wall plate with sun relief carving.", 3],
    ["Gond Art Tree of Life Canvas", "Tree-of-life painting in the dot-and-line Gond tribal style.", 1]
  ];

  const CATS = { 1: 'Paintings', 2: 'Textiles', 3: 'Home decor', 4: 'Folk art' };

  const insert = db.prepare(`
    INSERT INTO products (id, title, description, category, price_paise, old_price_paise, is_new, seed)
    VALUES (@id, @title, @description, @category, @price_paise, @old_price_paise, @is_new, @seed)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  const rows = NAMES.map((n, i) => {
    const basePrice = 600 + ((i * 73) % 2400);
    const price = Math.round(basePrice / 10) * 10 + 490;
    const onSale = i % 3 === 0;
    const oldPrice = onSale ? Math.round((basePrice * 1.25) / 10) * 10 + 490 : null;
    return {
      id: i + 1,
      title: n[0],
      description: n[1],
      category: CATS[n[2]],
      price_paise: price * 100,
      old_price_paise: oldPrice ? oldPrice * 100 : null,
      is_new: i % 5 === 0 ? 1 : 0,
      seed: i
    };
  });

  insertMany(rows);
  console.log(`Seeded ${rows.length} products.`);
}

module.exports = db;
