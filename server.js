const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const { readDB, writeDB, genId, slugify } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mlyn2026';

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'public', 'images'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, genId('img') + ext);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024 }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'mlyn-drohobych-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

// make current path available to all views (for nav active state)
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;
  next();
});

function requireAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

function setFlash(req, message) {
  req.session.flash = message;
}

/* ===================== PUBLIC PAGES ===================== */

app.get('/', (req, res) => {
  const db = readDB();
  res.render('home', { site: db.site, hall: db.hall });
});

app.get('/menu', (req, res) => {
  const db = readDB();
  res.render('menu', { categories: db.menu });
});

app.get('/hall', (req, res) => {
  const db = readDB();
  res.render('hall', { hall: db.hall });
});

app.get('/contacts', (req, res) => {
  const db = readDB();
  res.render('contacts', { contacts: db.contacts, submitted: false });
});

app.post('/contacts', (req, res) => {
  const db = readDB();
  // Демо: заявка просто підтверджується. Для реального запуску
  // тут можна підʼєднати надсилання на email або в Telegram-бот.
  res.render('contacts', { contacts: db.contacts, submitted: true });
});

app.get('/news', (req, res) => {
  const db = readDB();
  const news = [...db.news].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.render('news', { news });
});

app.get('/news/:slug', (req, res) => {
  const db = readDB();
  const post = db.news.find(n => n.slug === req.params.slug);
  if (!post) return res.status(404).render('news-post', { post: null });
  res.render('news-post', { post });
});

/* ===================== ADMIN AUTH ===================== */

app.get('/admin/login', (req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Невірний пароль' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

/* ===================== ADMIN DASHBOARD ===================== */

app.get('/admin', requireAuth, (req, res) => {
  const db = readDB();
  res.render('admin/dashboard', { db, active: 'menu' });
});

/* ---- Site / About text ---- */
app.post('/admin/site', requireAuth, (req, res) => {
  const db = readDB();
  db.site = { ...db.site, ...req.body };
  writeDB(db);
  setFlash(req, 'Текст головної сторінки оновлено');
  res.redirect('/admin#site');
});

/* ---- Menu: categories ---- */
app.post('/admin/menu/category/add', requireAuth, (req, res) => {
  const db = readDB();
  const name = (req.body.name || '').trim();
  if (name) {
    db.menu.push({ id: genId('cat'), name, items: [] });
    writeDB(db);
    setFlash(req, 'Розділ меню додано');
  }
  res.redirect('/admin#menu');
});

app.post('/admin/menu/category/:id/edit', requireAuth, (req, res) => {
  const db = readDB();
  const cat = db.menu.find(c => c.id === req.params.id);
  if (cat) {
    cat.name = (req.body.name || cat.name).trim();
    writeDB(db);
    setFlash(req, 'Розділ меню оновлено');
  }
  res.redirect('/admin#menu');
});

app.post('/admin/menu/category/:id/delete', requireAuth, (req, res) => {
  const db = readDB();
  db.menu = db.menu.filter(c => c.id !== req.params.id);
  writeDB(db);
  setFlash(req, 'Розділ меню видалено');
  res.redirect('/admin#menu');
});

/* ---- Menu: items ---- */
app.post('/admin/menu/item/add', requireAuth, (req, res) => {
  const db = readDB();
  const cat = db.menu.find(c => c.id === req.body.categoryId);
  if (cat && req.body.name) {
    cat.items.push({
      id: genId('item'),
      name: req.body.name.trim(),
      desc: (req.body.desc || '').trim(),
      price: (req.body.price || '').trim()
    });
    writeDB(db);
    setFlash(req, 'Страву додано');
  }
  res.redirect('/admin#menu');
});

app.post('/admin/menu/item/:id/edit', requireAuth, (req, res) => {
  const db = readDB();
  for (const cat of db.menu) {
    const item = cat.items.find(i => i.id === req.params.id);
    if (item) {
      item.name = req.body.name || item.name;
      item.desc = req.body.desc || '';
      item.price = req.body.price || '';
      break;
    }
  }
  writeDB(db);
  setFlash(req, 'Страву оновлено');
  res.redirect('/admin#menu');
});

app.post('/admin/menu/item/:id/delete', requireAuth, (req, res) => {
  const db = readDB();
  for (const cat of db.menu) {
    cat.items = cat.items.filter(i => i.id !== req.params.id);
  }
  writeDB(db);
  setFlash(req, 'Страву видалено');
  res.redirect('/admin#menu');
});

/* ---- Hall ---- */
app.post('/admin/hall/stats', requireAuth, (req, res) => {
  const db = readDB();
  const nums = [].concat(req.body.num || []);
  const labels = [].concat(req.body.label || []);
  db.hall.stats = nums.map((num, i) => ({ num, label: labels[i] || '' }));
  writeDB(db);
  setFlash(req, 'Показники зали оновлено');
  res.redirect('/admin#hall');
});

app.post('/admin/hall/section/:index/edit', requireAuth, (req, res) => {
  const db = readDB();
  const idx = parseInt(req.params.index, 10);
  if (db.hall.sections[idx]) {
    db.hall.sections[idx].eyebrow = req.body.eyebrow || '';
    db.hall.sections[idx].title = req.body.title || '';
    db.hall.sections[idx].text = req.body.text || '';
    db.hall.sections[idx].tags = (req.body.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    writeDB(db);
    setFlash(req, 'Блок зали оновлено');
  }
  res.redirect('/admin#hall');
});

app.post('/admin/hall/section/:index/image', requireAuth, upload.single('image'), (req, res) => {
  const db = readDB();
  const idx = parseInt(req.params.index, 10);
  if (db.hall.sections[idx] && req.file) {
    db.hall.sections[idx].image = req.file.filename;
    writeDB(db);
    setFlash(req, 'Фото блоку оновлено');
  }
  res.redirect('/admin#hall');
});

/* ---- Contacts ---- */
app.post('/admin/contacts', requireAuth, (req, res) => {
  const db = readDB();
  db.contacts = {
    address: req.body.address || '',
    phone: req.body.phone || '',
    directions: req.body.directions || '',
    mapQuery: req.body.mapQuery || ''
  };
  writeDB(db);
  setFlash(req, 'Контакти оновлено');
  res.redirect('/admin#contacts');
});

/* ---- News ---- */
app.post('/admin/news/add', requireAuth, upload.single('image'), (req, res) => {
  const db = readDB();
  const title = (req.body.title || '').trim();
  if (title) {
    db.news.push({
      id: genId('news'),
      slug: slugify(title) + '-' + Date.now().toString(36).slice(-4),
      title,
      date: req.body.date || new Date().toISOString().slice(0, 10),
      excerpt: req.body.excerpt || '',
      content: req.body.content || '',
      image: req.file ? req.file.filename : 'facade-day.jpg'
    });
    writeDB(db);
    setFlash(req, 'Новину додано');
  }
  res.redirect('/admin#news');
});

app.post('/admin/news/:id/edit', requireAuth, upload.single('image'), (req, res) => {
  const db = readDB();
  const post = db.news.find(n => n.id === req.params.id);
  if (post) {
    post.title = req.body.title || post.title;
    post.date = req.body.date || post.date;
    post.excerpt = req.body.excerpt || '';
    post.content = req.body.content || '';
    if (req.file) post.image = req.file.filename;
    writeDB(db);
    setFlash(req, 'Новину оновлено');
  }
  res.redirect('/admin#news');
});

app.post('/admin/news/:id/delete', requireAuth, (req, res) => {
  const db = readDB();
  db.news = db.news.filter(n => n.id !== req.params.id);
  writeDB(db);
  setFlash(req, 'Новину видалено');
  res.redirect('/admin#news');
});

/* ===================== 404 ===================== */
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Млин сайт запущено: http://localhost:${PORT}`);
  console.log(`Адмінка: http://localhost:${PORT}/admin/login (пароль: ${ADMIN_PASSWORD})`);
});
