const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        age INT,
        country TEXT,
        role TEXT
      )
    `);
    console.log("Users table ready");
  } catch (err) {
    console.error("Error creating table", err);
  }
})();
(async () => {
  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        title TEXT,
        description TEXT,
        color TEXT
      )
    `);

    console.log("Modules table ready");

  } catch (err) {

    console.error("Error creating modules table", err);

  }
})();

(async () => {
  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        module_id INT,
        title TEXT,
        content TEXT
      )
    `);

    console.log("Lessons table ready");

  } catch (err) {

    console.error("Error creating lessons table", err);

  }
})();
(async () => {
  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT,
        image TEXT,
        date TEXT
      )
    `);

    console.log("Announcements table ready");

  } catch (err) {

    console.error("Error creating announcements table", err);

  }
})();
(async () => {
  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INT,
        xp INT DEFAULT 0
      )
    `);

    console.log("User progress table ready");

  } catch (err) {

    console.error("Error creating progress table", err);

  }
})();
(async () => {
  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_name TEXT,
        content TEXT,
        link TEXT
      )
    `);

    console.log("Posts table ready");

  } catch (err) {

    console.error("Error creating posts table", err);

  }
})();

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("DB connected");
  } catch (err) {
    console.error("DB error FULL:", err);
  }
})();

const app = express();
app.use(cors());
app.use(express.json());

// Base
app.get("/", (req, res) => {
  res.send("NextGen Founders API running 🚀");
});

// Datos temporales
const users = [];
const admins = [
  "luciana.lopezag@gmail.com",
  "nextgenfoundersinfo@gmail.com"
];

// REGISTER
app.post("/register", async (req, res) => {
  const { name, email, password, age, country } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

const role = admins.includes(email) ? "admin" : "user";

try {
  const newUser = await pool.query(
  "INSERT INTO users (name, email, password, age, country, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
  [name, email, hashedPassword, age, country, role]
);

await pool.query(
  "INSERT INTO user_progress (user_id, xp) VALUES ($1, $2)",
  [newUser.rows[0].id, 50]
);

  res.json({ message: "User registered" });
} catch (err) {
  console.error(err);
  res.status(500).send("Error registering user");
}

});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
  "SELECT * FROM users WHERE email = $1",
  [email]
);

const user = result.rows[0];
  if (!user) return res.status(400).send("User not found");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).send("Invalid password");

  const token = jwt.sign(
    { id: user.id, role: user.role },
   process.env.JWT_SECRET
  );

  res.json({ token });
});

const auth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send("No token");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send("Invalid token");
  }
};

app.get("/me", auth, async (req, res) => {
app.get("/progress", auth, async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT xp FROM user_progress WHERE user_id = $1",
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch(err){

    console.error(err);

    res.status(500).send("Error fetching progress");

  }

});

  try {

    const result = await pool.query(
      "SELECT id, name, email, country, role FROM users WHERE id = $1",
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch(err){

    console.error(err);

    res.status(500).send("Error fetching user");

  }

});


// Solo admin
// GET USERS (ADMIN)

app.get("/users", auth, async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).send("Not allowed");
  }

  try {

    const result = await pool.query(
      "SELECT id, name, email, age, country, role FROM users"
    );

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).send("Error fetching users");

  }

});


// GET MODULES

app.get("/modules", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM modules"
    );

    res.json(result.rows);

  } catch(err){

    console.error(err);

    res.status(500).send("Error fetching modules");

  }

});


// CREATE MODULE

app.post("/modules", auth, async (req, res) => {

  if(req.user.role !== "admin"){
    return res.status(403).send("Not allowed");
  }

  const { title, description, color } = req.body;

  try {

    await pool.query(
      "INSERT INTO modules (title, description, color) VALUES ($1, $2, $3)",
      [title, description, color]
    );

    res.json({
      message: "Module created"
    });

  } catch(err){

    console.error(err);

    res.status(500).send("Error creating module");

  }

});


// GET LESSONS

app.get("/lessons/:moduleId", async (req, res) => {

  const { moduleId } = req.params;

  try {

    const result = await pool.query(
      "SELECT * FROM lessons WHERE module_id = $1",
      [moduleId]
    );

    res.json(result.rows);

  } catch(err){

    console.error(err);

    res.status(500).send("Error fetching lessons");

  }

});


// CREATE LESSON

app.post("/lessons", auth, async (req, res) => {

  if(req.user.role !== "admin"){
    return res.status(403).send("Not allowed");
  }

  const { module_id, title, content } = req.body;

  try {

    await pool.query(
      "INSERT INTO lessons (module_id, title, content) VALUES ($1, $2, $3)",
      [module_id, title, content]
    );

    res.json({
      message: "Lesson created"
    });

  } catch(err){

    console.error(err);

    res.status(500).send("Error creating lesson");

  }

});
// GET ANNOUNCEMENTS

app.get("/announcements", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM announcements ORDER BY id DESC"
    );

    res.json(result.rows);

  } catch(err){

    console.error(err);

    res.status(500).send("Error fetching announcements");

  }

});


// CREATE ANNOUNCEMENT

app.post("/announcements", auth, async (req, res) => {

  if(req.user.role !== "admin"){
    return res.status(403).send("Not allowed");
  }

  const { title, content, image, date } = req.body;

  try {

    await pool.query(

      "INSERT INTO announcements (title, content, image, date) VALUES ($1, $2, $3, $4)",

      [title, content, image, date]

    );

    res.json({
      message: "Announcement created"
    });

  } catch(err){

    console.error(err);

    res.status(500).send("Error creating announcement");

  }

});
// GET POSTS

app.get("/posts", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM posts ORDER BY id DESC"
    );

    res.json(result.rows);

  } catch(err){

    console.error(err);

    res.status(500).send("Error fetching posts");

  }

});


// CREATE POST

app.post("/posts", auth, async (req, res) => {

  const { content, link } = req.body;

  try {

    const userResult = await pool.query(
      "SELECT name FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = userResult.rows[0];

    await pool.query(
      "INSERT INTO posts (user_name, content, link) VALUES ($1, $2, $3)",
      [user.name, content, link]
    );
await pool.query(
  "UPDATE user_progress SET xp = xp + 20 WHERE user_id = $1",
  [req.user.id]
);

    res.json({
      message: "Post created"
    });

  } catch(err){

    console.error(err);

    res.status(500).send("Error creating post");

  }

});
app.delete("/announcements/:id", auth, async (req, res) => {

  if(req.user.role !== "admin"){
    return res.status(403).send("Not allowed");
  }

  try {

    await pool.query(
      "DELETE FROM announcements WHERE id = $1",
      [req.params.id]
    );

    res.json({
      message: "Announcement deleted"
    });

  } catch(err){

    console.error(err);

    res.status(500).send("Error deleting announcement");

  }

});



app.delete("/posts/:id", auth, async (req, res) => {

  if(req.user.role !== "admin"){
    return res.status(403).send("Not allowed");
  }

  try {

    await pool.query(
      "DELETE FROM posts WHERE id = $1",
      [req.params.id]
    );

    res.json({
      message: "Post deleted"
    });

  } catch(err){

    console.error(err);

    res.status(500).send("Error deleting post");

  }

});



app.delete("/lessons/:id", auth, async (req, res) => {

  if(req.user.role !== "admin"){
    return res.status(403).send("Not allowed");
  }

  try {

    await pool.query(
      "DELETE FROM lessons WHERE id = $1",
      [req.params.id]
    );

    res.json({
      message: "Lesson deleted"
    });

  } catch(err){

    console.error(err);

    res.status(500).send("Error deleting lesson");

  }

});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
