/**
 * Tajiri POS · auth backend (Express + MySQL)
 *
 * Stores welcome-page accounts in a MySQL `users` table.
 *
 * Run:
 *   1) npm install express mysql2 cors
 *   2) Create the table (see users.sql, or let the server auto-create it)
 *   3) node server.js        (serves /api/auth/signup and /api/auth/login on :3001)
 */

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
app.use(cors());
app.use(express.json());

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "tajiri_pos",
};

async function getDb() {
  const connection = await mysql.createConnection(DB_CONFIG);
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      username VARCHAR(60) NOT NULL UNIQUE,
      email VARCHAR(190) NOT NULL UNIQUE,
      phone VARCHAR(30) DEFAULT NULL,
      role ENUM('admin','manager','cashier') NOT NULL DEFAULT 'cashier',
      password_hash CHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return connection;
}

/* ---------- POST /api/auth/signup ---------- */
app.post("/api/auth/signup", async (req, res) => {
  const { name, username, email, phone, role, passwordHash } = req.body || {};
  if (!name || !username || !email || !passwordHash) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  let connection;
  try {
    connection = await getDb();
    await connection.execute(
      `INSERT INTO users (name, username, email, phone, role, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, username, email, phone || null, role || "cashier", passwordHash],
    );
    res.json({ ok: true });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const field = error.message.includes("username") ? "username" : "email";
      return res
        .status(409)
        .json({ error: `That ${field} is already registered.` });
    }
    console.error("Signup failed:", error);
    res.status(500).json({ error: "Could not create the account." });
  } finally {
    if (connection) await connection.end();
  }
});

/* ---------- POST /api/auth/login ---------- */
app.post("/api/auth/login", async (req, res) => {
  const { identity, passwordHash } = req.body || {};
  if (!identity || !passwordHash) {
    return res.status(400).json({ error: "Missing credentials." });
  }
  let connection;
  try {
    connection = await getDb();
    const [rows] = await connection.execute(
      `SELECT name, username, email, role FROM users
       WHERE (username = ? OR email = ?) AND password_hash = ?`,
      [identity.toLowerCase(), identity.toLowerCase(), passwordHash],
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    res.json({ ok: true, user: rows[0] });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ error: "Could not sign you in." });
  } finally {
    if (connection) await connection.end();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Tajiri POS auth server running on http://localhost:${PORT}`),
);
