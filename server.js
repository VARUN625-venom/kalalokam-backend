require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const MONGODB_URI = process.env.MONGODB_URI;

if (!GOOGLE_CLIENT_ID) {
  console.warn('[warning] GOOGLE_CLIENT_ID not set in .env\n');
}
if (!MONGODB_URI) {
  console.error('[ERROR] MONGODB_URI not set in .env');
  process.exit(1);
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieSession({
  name: 'kalalokam_session',
  keys: [process.env.SESSION_SECRET || 'dev-secret'],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: 'lax'
}));
app.use(express.static(path.join(__dirname, 'public')));

// ================================================================
// MONGOOSE SCHEMAS
// ================================================================

const userSchema = new mongoose.Schema({
  google_sub: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  name: String,
  picture_url: String,
  phone: String,
  phone_verified: { type: Boolean, default: false },
  address_line1: String,
  address_line2: String,
  city: String,
  state: String,
  pincode: String,
  created_at: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  _id: Number,
  title: String,
  description: String,
  category: String,
  price: Number,
  oldPrice: Number,
  isNew: Boolean,
  seed: Number
});

const orderSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  items: [{
    productId: Number,
    title: String,
    quantity: Number,
    unitPrice: Number
  }],
  subtotal: Number,
  shipping: Number,
  total: Number,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const phoneOtpSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  phone: String,
  code: String,
  expiresAt: Date,
  attempts: { type: Number, default: 0 }
});

const cartSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  products: [{
    productId: Number,
    quantity: Number
  }]
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const PhoneOtp = mongoose.model('PhoneOtp', phoneOtpSchema);
const Cart = mongoose.model('Cart', cartSchema);

// ================================================================
// MONGODB CONNECTION & SEED
// ================================================================

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Seed products if empty
    const count = await Product.countDocuments();
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
      
      const products = NAMES.map((n, i) => ({
        _id: i + 1,
        title: n[0],
        description: n[1],
        category: CATS[n[2]],
        price: Math.round((600 + (i * 73) % 2400) / 10) * 10 + 490,
        oldPrice: i % 3 === 0 ? Math.round((600 * 1.25 + (i * 73) % 2400) / 10) * 10 + 490 : null,
        isNew: i % 5 === 0,
        seed: i
      }));
      
      await Product.insertMany(products);
      console.log('Seeded 20 products');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// ================================================================
// HELPERS
// ================================================================

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'not_logged_in' });
  }
  next();
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u._id,
    email: u.email,
    name: u.name,
    picture_url: u.picture_url,
    phone: u.phone || null,
    phoneVerified: !!u.phone_verified,
    address: {
      line1: u.address_line1 || '',
      line2: u.address_line2 || '',
      city: u.city || '',
      state: u.state || '',
      pincode: u.pincode || ''
    }
  };
}

// ================================================================
// AUTH
// ================================================================

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'missing_credential' });

  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();

    if (!payload.email_verified) return res.status(400).json({ error: 'email_not_verified' });

    let user = await User.findOne({ google_sub: payload.sub });
    if (!user) {
      user = new User({
        google_sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        picture_url: payload.picture || null
      });
      await user.save();
    } else {
      user.name = payload.name || user.name;
      user.picture_url = payload.picture || user.picture_url;
      await user.save();
    }

    req.session.userId = user._id.toString();
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'invalid_token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  try {
    const user = await User.findById(req.session.userId);
    res.json({ user: publicUser(user) });
  } catch (e) {
    req.session = null;
    res.json({ user: null });
  }
});

// ================================================================
// PRODUCTS
// ================================================================

app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json({ products });
});

// ================================================================
// CART
// ================================================================

async function getCartForUser(userId) {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return [];

  const items = [];
  for (const item of cart.products) {
    const product = await Product.findById(item.productId);
    if (product) {
      items.push({
        productId: product._id,
        title: product.title,
        quantity: item.quantity,
        price: product.price,
        seed: product.seed
      });
    }
  }
  return items;
}

app.get('/api/cart', requireAuth, async (req, res) => {
  const items = await getCartForUser(req.session.userId);
  res.json({ items });
});

app.post('/api/cart/add', requireAuth, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: 'not_found' });

  let cart = await Cart.findOne({ user_id: req.session.userId });
  if (!cart) cart = new Cart({ user_id: req.session.userId, products: [] });

  const existing = cart.products.find(p => p.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.products.push({ productId, quantity });
  }
  await cart.save();

  const items = await getCartForUser(req.session.userId);
  res.json({ items });
});

app.post('/api/cart/update', requireAuth, async (req, res) => {
  const { productId, quantity } = req.body;
  let cart = await Cart.findOne({ user_id: req.session.userId });
  if (!cart) return res.json({ items: [] });

  if (quantity <= 0) {
    cart.products = cart.products.filter(p => p.productId !== productId);
  } else {
    const item = cart.products.find(p => p.productId === productId);
    if (item) item.quantity = quantity;
  }
  await cart.save();
  const items = await getCartForUser(req.session.userId);
  res.json({ items });
});

app.post('/api/cart/remove', requireAuth, async (req, res) => {
  const { productId } = req.body;
  let cart = await Cart.findOne({ user_id: req.session.userId });
  if (cart) {
    cart.products = cart.products.filter(p => p.productId !== productId);
    await cart.save();
  }
  const items = await getCartForUser(req.session.userId);
  res.json({ items });
});

// ================================================================
// PROFILE
// ================================================================

app.put('/api/profile/address', requireAuth, async (req, res) => {
  const { line1 = '', line2 = '', city = '', state = '', pincode = '' } = req.body || {};
  const user = await User.findById(req.session.userId);

  if (!line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
    return res.status(400).json({ error: 'missing' });
  }
  if (!/^[0-9]{4,8}$/.test(pincode.trim())) {
    return res.status(400).json({ error: 'invalid_pincode' });
  }

  user.address_line1 = line1.trim();
  user.address_line2 = line2.trim();
  user.city = city.trim();
  user.state = state.trim();
  user.pincode = pincode.trim();
  await user.save();

  res.json({ user: publicUser(user) });
});

app.post('/api/profile/phone/send-otp', requireAuth, async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !/^\+?[0-9]{8,15}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'invalid' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await PhoneOtp.deleteOne({ user_id: req.session.userId });
  await PhoneOtp.create({
    user_id: req.session.userId,
    phone: phone.trim(),
    code,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  console.log(`[DEV] OTP for ${req.session.userId}: ${code}`);
  res.json({ ok: true, dev_only_code: code });
});

app.post('/api/profile/phone/verify-otp', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  const otp = await PhoneOtp.findOne({ user_id: req.session.userId });

  if (!otp) return res.status(400).json({ error: 'no_otp' });
  if (new Date() > otp.expiresAt) {
    await PhoneOtp.deleteOne({ _id: otp._id });
    return res.status(400).json({ error: 'expired' });
  }
  if (otp.attempts >= 5) {
    await PhoneOtp.deleteOne({ _id: otp._id });
    return res.status(429).json({ error: 'too_many' });
  }
  if (String(code).trim() !== otp.code) {
    otp.attempts++;
    await otp.save();
    return res.status(400).json({ error: 'wrong' });
  }

  const user = await User.findById(req.session.userId);
  user.phone = otp.phone;
  user.phone_verified = true;
  await user.save();
  await PhoneOtp.deleteOne({ _id: otp._id });

  res.json({ user: publicUser(user) });
});

// ================================================================
// ORDERS
// ================================================================

app.post('/api/checkout', requireAuth, async (req, res) => {
  const items = await getCartForUser(req.session.userId);
  if (items.length === 0) return res.status(400).json({ error: 'empty' });

  const subtotal = items.reduce((s, c) => s + c.price * c.quantity, 0);
  const shipping = subtotal > 2000 ? 0 : 99;

  const order = new Order({
    user_id: req.session.userId,
    items: items.map(c => ({ productId: c.productId, title: c.title, quantity: c.quantity, unitPrice: c.price })),
    subtotal,
    shipping,
    total: subtotal + shipping,
    status: 'pending'
  });
  await order.save();

  const cart = await Cart.findOne({ user_id: req.session.userId });
  if (cart) {
    cart.products = [];
    await cart.save();
  }

  res.json({ orderId: order._id, subtotal, shipping, total: subtotal + shipping });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  const orders = await Order.find({ user_id: req.session.userId }).sort({ created_at: -1 });
  res.json({ orders });
});

// ================================================================

app.listen(PORT, () => {
  console.log(`Kalalokam backend running at http://localhost:${PORT}`);
});
