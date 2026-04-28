const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
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

  const user = {
    id: Date.now(),
    name,
    email,
    password: hashedPassword,
    age,
    country,
    role: admins.includes(email) ? "admin" : "user"
  };

  users.push(user);

  res.json({ message: "User registered" });
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
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
app.get("/users", auth, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).send("Not allowed");
  }
  const safeUsers = users.map(user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  age: user.age,
  country: user.country,
  role: user.role
}));

res.json(safeUsers);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
