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
    await pool.query("SELECT 1");
    console.log("DB connected");
  } catch (err) {
    console.error("DB error FULL:", err);
  }
})();

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
  await pool.query(
    "INSERT INTO users (name, email, password, age, country, role) VALUES ($1, $2, $3, $4, $5, $6)",
    [name, email, hashedPassword, age, country, role]
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

// Middleware auth
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

// Solo admin
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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
