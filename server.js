const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: false
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Middleware to check if user is logged in
function auth(req, res, next) {
  if (req.session.user) return next();
  res.status(403).send("نیاز به ورود به حساب کاربری دارید");
}

// Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], err => {
    if (err) return res.status(500).send("خطا در ثبت نام");
    res.send("ثبت نام موفق بود");
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send("نام کاربری یا رمز عبور اشتباه است");
    }
    req.session.user = username;
    res.send("ورود موفق");
  });
});

app.post('/api/products', auth, upload.single('image'), (req, res) => {
  const { name, price, description } = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : '';
  if (!name || !price || !description || !image) {
    return res.status(400).send("اطلاعات ناقص است");
  }
  db.run("INSERT INTO products (name, price, description, image) VALUES (?, ?, ?, ?)",
    [name, price, description, image], function (err) {
      if (err) return res.status(500).send("خطا در افزودن محصول");
      res.json({ id: this.lastID });
    });
});

app.get('/api/products', (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.delete('/api/products/:id', auth, (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", req.params.id, function (err) {
    if (err) return res.status(500).send(err.message);
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
