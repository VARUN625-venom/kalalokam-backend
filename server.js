require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_EMAIL = 'gudimellavaruntej@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieSession({
  name: 'kalalokam_session',
  keys: [process.env.SESSION_SECRET || 'secret'],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: 'lax'
}));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for real project
const users = {};
const userIdCounter = { val: 1 };
const products = [];
const carts = {};
const orders = {};
const orderIdCounter = { val: 1 };

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function seedProducts() {
  const NAMES = [
    ["Cheriyal Scroll Painting", "Hand-painted scroll", 1],
    ["Kalamkari Cotton Dupatta", "Block-printed dupatta", 2],
    ["Terracotta Ganesha Idol", "Hand-shaped idol", 3],
    ["Madhubani Peacock Canvas", "Intricate peacock", 1],
    ["Pochampally Ikat Table Runner", "Hand-woven ikat", 2],
    ["Warli Tribal Wall Art", "Tribal art", 4],
    ["Hand-painted Terracotta Diya", "Hand-painted diyas", 3],
    ["Nirmal Wooden Elephant", "Wooden elephant", 4],
    ["Kalamkari Wall Hanging", "Wall panel", 1],
    ["Bidri Bowl", "Decorative bowl", 3],
    ["Cheriyal Mask", "Wooden mask", 4],
    ["Block Print Cushion", "Cushion cover", 2],
    ["Dokra Figurine", "Brass figurine", 4],
    ["Pichwai Canvas", "Pichwai painting", 1],
    ["Etikoppaka Toy Set", "Toy set", 4],
    ["Kondapalli Doll", "Wooden doll", 4],
    ["Kantha Throw", "Cotton throw", 2],
    ["Banjara Tapestry", "Mirror tapestry", 2],
    ["Terracotta Wall Plate", "Wall plate", 3],
    ["Gond Art Canvas", "Tree of life", 1]
  ];
  const CATS = { 1: 'Paintings', 2: 'Textiles', 3: 'Home decor', 4: 'Folk art' };
  NAMES.forEach((n, i) => {
    const price = 600 + (i * 73) % 2400;
    products.push({
      id: i + 1,
      title: n[0],
      description: n[1],
      category: CATS[n[2]],
      price: price,
      isNew: i % 5 === 0,
      seed: i
    });
  });
  console.log('Seeded ' + products.length + ' products');
}
seedProducts();

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.email === ADMIN_EMAIL
  };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'not_logged_in' });
  next();
}

// AUTH
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'missing_fields' });
  if (Object.values(users).find(u => u.email === email)) return res.status(400).json({ error: 'email_exists' });
  
  const user = {
    id: userIdCounter.val++,
    email,
    password: hashPassword(password),
    name
  };
  users[user.id] = user;
  carts[user.id] = {};
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = Object.values(users).find(u => u.email === email && u.password === hashPassword(password));
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = users[req.session.userId];
  res.json({ user: publicUser(user) });
});

// PRODUCTS
app.get('/api/products', (req, res) => res.json({ products }));

// CART
app.get('/api/cart', requireAuth, (req, res) => {
  const items = carts[req.session.userId] || {};
  const cartItems = Object.entries(items).map(([pid, qty]) => {
    const p = products.find(x => x.id === parseInt(pid));
    return p ? { productId: p.id, title: p.title, quantity: qty, price: p.price } : null;
  }).filter(Boolean);
  res.json({ items: cartItems });
});

app.post('/api/cart/add', requireAuth, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!products.find(p => p.id === productId)) return res.status(404).json({ error: 'not_found' });
  if (!carts[req.session.userId]) carts[req.session.userId] = {};
  carts[req.session.userId][productId] = (carts[req.session.userId][productId] || 0) + quantity;
  const items = Object.entries(carts[req.session.userId]).map(([pid, qty]) => {
    const p = products.find(x => x.id === parseInt(pid));
    return p ? { productId: p.id, title: p.title, quantity: qty, price: p.price } : null;
  }).filter(Boolean);
  res.json({ items });
});

app.post('/api/cart/update', requireAuth, (req, res) => {
  const { productId, quantity } = req.body;
  if (quantity <= 0) delete carts[req.session.userId][productId];
  else carts[req.session.userId][productId] = quantity;
  const items = Object.entries(carts[req.session.userId] || {}).map(([pid, qty]) => {
    const p = products.find(x => x.id === parseInt(pid));
    return p ? { productId: p.id, title: p.title, quantity: qty, price: p.price } : null;
  }).filter(Boolean);
  res.json({ items });
});

app.post('/api/cart/remove', requireAuth, (req, res) => {
  delete carts[req.session.userId][req.body.productId];
  const items = Object.entries(carts[req.session.userId] || {}).map(([pid, qty]) => {
    const p = products.find(x => x.id === parseInt(pid));
    return p ? { productId: p.id, title: p.title, quantity: qty, price: p.price } : null;
  }).filter(Boolean);
  res.json({ items });
});

// CHECKOUT
app.post('/api/checkout', requireAuth, (req, res) => {
  const cart = carts[req.session.userId] || {};
  const items = Object.entries(cart).map(([pid, qty]) => {
    const p = products.find(x => x.id === parseInt(pid));
    return p ? { productId: p.id, title: p.title, quantity: qty, price: p.price } : null;
  }).filter(Boolean);
  
  if (items.length === 0) return res.status(400).json({ error: 'empty_cart' });
  
  const subtotal = items.reduce((s, c) => s + c.price * c.quantity, 0);
  const shipping = subtotal > 2000 ? 0 : 99;
  const orderId = orderIdCounter.val++;
  
  orders[orderId] = {
    id: orderId,
    userId: req.session.userId,
    customerEmail: users[req.session.userId].email,
    customerName: users[req.session.userId].name,
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    status: 'pending_payment',
    createdAt: new Date().toISOString()
  };
  
  carts[req.session.userId] = {};
  res.json({ orderId, subtotal, shipping, total: subtotal + shipping });
});

// ORDERS
app.get('/api/orders', requireAuth, (req, res) => {
  const userOrders = Object.values(orders).filter(o => o.userId === req.session.userId);
  res.json({ orders: userOrders });
});

// ADMIN
app.get('/api/admin/orders', requireAuth, (req, res) => {
  const user = users[req.session.userId];
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'not_admin' });
  const allOrders = Object.values(orders);
  res.json({ orders: allOrders });
});

app.post('/api/admin/confirm-payment', requireAuth, (req, res) => {
  const user = users[req.session.userId];
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'not_admin' });
  
  const { orderId } = req.body;
  const order = orders[orderId];
  if (!order) return res.status(404).json({ error: 'order_not_found' });
  
  order.status = 'placed';
  order.confirmedAt = new Date().toISOString();
  res.json({ order });
});

app.listen(PORT, () => console.log(`Kalalokam Real Project at http://localhost:${PORT}`));
