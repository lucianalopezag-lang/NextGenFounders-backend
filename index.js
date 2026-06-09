const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcrypt");
const jwt     = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── CREATE TABLES ────────────────────────────────────────────────────────────
(async () => {
  try {
    // Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id       SERIAL PRIMARY KEY,
        name     TEXT,
        email    TEXT UNIQUE,
        password TEXT,
        age      INT,
        country  TEXT,
        role     TEXT DEFAULT 'user'
      )
    `);

    // Categories (replaces old modules concept for resources)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id    SERIAL PRIMARY KEY,
        title TEXT,
        icon  TEXT
      )
    `);

    // Lessons / Resources (module_id references categories.id)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id        SERIAL PRIMARY KEY,
        module_id INT,
        title     TEXT,
        content   TEXT,
        link      TEXT
      )
    `);

    // Announcements
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id      SERIAL PRIMARY KEY,
        title   TEXT,
        content TEXT,
        image   TEXT,
        date    TEXT
      )
    `);

    // Posts — ensure likes column exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id        SERIAL PRIMARY KEY,
        user_id   INT,
        user_name TEXT,
        content   TEXT,
        link      TEXT,
        likes     INT DEFAULT 0
      )
    `);
    // Add likes column if missing (safe migration)
    await pool.query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0
    `).catch(() => {});
    // Add user_id column if missing
    await pool.query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id INT
    `).catch(() => {});

    // Replies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS replies (
        id        SERIAL PRIMARY KEY,
        post_id   INT,
        user_name TEXT,
        content   TEXT
      )
    `);

    // Challenges — stored in DB (not in-memory)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id          SERIAL PRIMARY KEY,
        title       TEXT,
        icon        TEXT,
        xp          INT DEFAULT 0,
        description TEXT,
        resource_id INT
      )
    `);
    // Safe migrations for description and resource_id
    await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS resource_id INT`).catch(() => {});

    // User progress
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id      SERIAL PRIMARY KEY,
        user_id INT UNIQUE,
        xp      INT DEFAULT 0
      )
    `);

    // User completed challenges
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_challenges (
        id        SERIAL PRIMARY KEY,
        user_id   INT,
        challenge TEXT,
        completed BOOLEAN DEFAULT false,
        UNIQUE(user_id, challenge)
      )
    `);

    console.log("All tables ready ✅");
  } catch(err) {
    console.error("Error creating tables:", err);
  }
})();

// ─── APP SETUP ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const admins = [
  "luciana.lopezag@gmail.com",
  "nextgenfoundersinfo@gmail.com"
];

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send("No token");
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).send("Invalid token");
  }
};

// ─── BASE ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("NextGen Founders API running 🚀");
});

// ─── REGISTER ─────────────────────────────────────────────────────────────────
app.post("/register", async (req, res) => {
  const { name, email, password, age, country } = req.body;
  if (!email || !password) return res.status(400).send("Email and password required");

  const safeName = (name || "").trim() || "Founder";
  const role     = admins.includes(email) ? "admin" : "user";

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password, age, country, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [safeName, email, hashed, age, country, role]
    );
    const userId = result.rows[0].id;
    // Give 50 XP on sign-up
    await pool.query(
      "INSERT INTO user_progress (user_id, xp) VALUES ($1, 50) ON CONFLICT (user_id) DO NOTHING",
      [userId]
    );
    res.json({ message: "User registered ✅" });
  } catch(err) {
    if (err.code === "23505") return res.status(400).send("Email already registered");
    console.error(err);
    res.status(500).send("Error registering user");
  }
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user   = result.rows[0];
    if (!user) return res.status(400).send("User not found");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).send("Invalid password");

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET
    );
    res.json({ token });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error logging in");
  }
});

// ─── ME ───────────────────────────────────────────────────────────────────────
app.get("/me", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, country, role FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching user");
  }
});

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
app.get("/progress", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT xp FROM user_progress WHERE user_id = $1",
      [req.user.id]
    );
    res.json(result.rows[0] || { xp: 0 });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching progress");
  }
});

// ─── USERS (ADMIN) ────────────────────────────────────────────────────────────
app.get("/users", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  try {
    const result = await pool.query(
      "SELECT id, name, email, age, country, role FROM users ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching users");
  }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
app.get("/categories", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories ORDER BY id ASC");
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching categories");
  }
});

app.post("/categories", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  const { title, icon } = req.body;
  if (!title) return res.status(400).send("Title required");
  try {
    await pool.query(
      "INSERT INTO categories (title, icon) VALUES ($1, $2)",
      [title, icon || "📁"]
    );
    res.json({ message: "Category created ✅" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error creating category");
  }
});

app.delete("/categories/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  try {
    await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    res.json({ message: "Category deleted" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error deleting category");
  }
});

// ─── LESSONS / RESOURCES ──────────────────────────────────────────────────────
app.get("/lessons/:moduleId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM lessons WHERE module_id = $1 ORDER BY id ASC",
      [req.params.moduleId]
    );
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching lessons");
  }
});

// Get single lesson/resource by ID (for challenge detail)
app.get("/lessons/resource/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM lessons WHERE id = $1",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).send("Resource not found");
    res.json(result.rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching resource");
  }
});

app.post("/lessons", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  const { module_id, title, content, link } = req.body;
  if (!title) return res.status(400).send("Title required");
  try {
    await pool.query(
      "INSERT INTO lessons (module_id, title, content, link) VALUES ($1,$2,$3,$4)",
      [module_id, title, content || "", link || ""]
    );
    res.json({ message: "Lesson created ✅" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error creating lesson");
  }
});

app.delete("/lessons/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  try {
    await pool.query("DELETE FROM lessons WHERE id = $1", [req.params.id]);
    res.json({ message: "Lesson deleted" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error deleting lesson");
  }
});

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
app.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM announcements ORDER BY id DESC");
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching announcements");
  }
});

app.post("/announcements", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  const { title, content, image, date } = req.body;
  try {
    await pool.query(
      "INSERT INTO announcements (title, content, image, date) VALUES ($1,$2,$3,$4)",
      [title, content, image || "", date || ""]
    );
    res.json({ message: "Announcement published ✅" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error creating announcement");
  }
});

app.delete("/announcements/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  try {
    await pool.query("DELETE FROM announcements WHERE id = $1", [req.params.id]);
    res.json({ message: "Announcement deleted" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error deleting announcement");
  }
});

// ─── CHALLENGES (NOW IN DATABASE) ─────────────────────────────────────────────
app.get("/challenges", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM challenges ORDER BY id ASC");
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching challenges");
  }
});

app.post("/challenges", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  const { title, icon, xp, description, resource_id } = req.body;
  try {
    await pool.query(
      "INSERT INTO challenges (title, icon, xp, description, resource_id) VALUES ($1,$2,$3,$4,$5)",
      [title, icon || "🏆", parseInt(xp) || 0, description || "", resource_id || null]
    );
    res.json({ message: "Challenge created ✅" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error creating challenge");
  }
});

app.delete("/challenges/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  try {
    await pool.query("DELETE FROM challenges WHERE id = $1", [req.params.id]);
    res.json({ message: "Challenge deleted" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error deleting challenge");
  }
});

// Complete challenge (awards XP once per user)
app.post("/complete-challenge", auth, async (req, res) => {
  const { challenge } = req.body;
  try {
    const existing = await pool.query(
      "SELECT * FROM user_challenges WHERE user_id = $1 AND challenge = $2",
      [req.user.id, String(challenge)]
    );
    if (existing.rows.length) return res.json({ message: "Already completed" });

    // Get challenge XP value
    const cRes = await pool.query("SELECT xp FROM challenges WHERE id = $1", [challenge]);
    const xpReward = cRes.rows[0]?.xp || 50;

    await pool.query(
      "INSERT INTO user_challenges (user_id, challenge, completed) VALUES ($1,$2,true)",
      [req.user.id, String(challenge)]
    );
    await pool.query(
      "INSERT INTO user_progress (user_id, xp) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET xp = user_progress.xp + $2",
      [req.user.id, xpReward]
    );
    res.json({ message: "Challenge completed 🚀", xp: xpReward });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error completing challenge");
  }
});

// ─── POSTS ────────────────────────────────────────────────────────────────────
app.get("/posts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching posts");
  }
});

app.post("/posts", auth, async (req, res) => {
  const { content, link } = req.body;
  if (!content) return res.status(400).send("Content required");
  try {
    const userRes = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.id]);
    const name    = userRes.rows[0]?.name || "Founder";
    await pool.query(
      "INSERT INTO posts (user_id, user_name, content, link, likes) VALUES ($1,$2,$3,$4,0)",
      [req.user.id, name, content, link || ""]
    );
    // +20 XP for posting
    await pool.query(
      "INSERT INTO user_progress (user_id, xp) VALUES ($1,20) ON CONFLICT (user_id) DO UPDATE SET xp = user_progress.xp + 20",
      [req.user.id]
    );
    res.json({ message: "Post created ✅" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error creating post");
  }
});

app.post("/posts/:id/like", auth, async (req, res) => {
  try {
    await pool.query("UPDATE posts SET likes = likes + 1 WHERE id = $1", [req.params.id]);
    res.json({ message: "Post liked ❤️" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error liking post");
  }
});

app.delete("/posts/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).send("Not allowed");
  try {
    await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
    res.json({ message: "Post deleted" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error deleting post");
  }
});

// ─── REPLIES ──────────────────────────────────────────────────────────────────
app.get("/replies/:postId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM replies WHERE post_id = $1 ORDER BY id ASC",
      [req.params.postId]
    );
    res.json(result.rows);
  } catch(err) {
    console.error(err);
    res.status(500).send("Error fetching replies");
  }
});

app.post("/replies", auth, async (req, res) => {
  const { post_id, content } = req.body;
  if (!content) return res.status(400).send("Content required");
  try {
    const userRes = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.id]);
    const name    = userRes.rows[0]?.name || "Founder";
    await pool.query(
      "INSERT INTO replies (post_id, user_name, content) VALUES ($1,$2,$3)",
      [post_id, name, content]
    );
    res.json({ message: "Reply created ✅" });
  } catch(err) {
    console.error(err);
    res.status(500).send("Error creating reply");
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log("NextGen Founders server running on port 3000 🚀"));