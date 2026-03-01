const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const pool = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const usersSchema = {
  hasPhone: false,
  hasPhoneNumber: true,
  hasPassword: false,
  hasPasswordHash: true
};

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use((error, _req, res, next) => {
  if (error && error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON payload" });
  }
  return next(error);
});

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone_number VARCHAR(20) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [columns] = await pool.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `,
    [process.env.DB_NAME]
  );

  const columnSet = new Set(columns.map((column) => column.COLUMN_NAME));
  usersSchema.hasPhone = columnSet.has("phone");
  usersSchema.hasPhoneNumber = columnSet.has("phone_number");
  usersSchema.hasPassword = columnSet.has("password");
  usersSchema.hasPasswordHash = columnSet.has("password_hash");

  if (!usersSchema.hasPhoneNumber) {
    await pool.query("ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NOT NULL DEFAULT ''");
    usersSchema.hasPhoneNumber = true;
  }

  if (!usersSchema.hasPasswordHash) {
    await pool.query("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT ''");
    usersSchema.hasPasswordHash = true;
  }

  if (!columnSet.has("created_at")) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
    );
  }
}

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$/.test(value);
}

app.get("/api/health", (_req, res) => {
  res.status(200).json({ message: "Backend is running" });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, phoneNumber, password, confirmPassword } = req.body || {};

    if (!username || !email || !phoneNumber || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password must match" });
    }

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insertColumns = ["username", "email"];
    const insertValues = [username, email];

    if (usersSchema.hasPhoneNumber) {
      insertColumns.push("phone_number");
      insertValues.push(phoneNumber);
    }
    if (usersSchema.hasPhone) {
      insertColumns.push("phone");
      insertValues.push(phoneNumber);
    }
    if (usersSchema.hasPasswordHash) {
      insertColumns.push("password_hash");
      insertValues.push(passwordHash);
    }
    if (usersSchema.hasPassword) {
      insertColumns.push("password");
      insertValues.push(passwordHash);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    await pool.query(
      `INSERT INTO users (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({ message: "Signup successful" });
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const passwordColumn = usersSchema.hasPasswordHash
      ? "password_hash"
      : usersSchema.hasPassword
        ? "password"
        : null;

    if (!passwordColumn) {
      return res.status(500).json({ message: "Password column not configured in database" });
    }

    const [users] = await pool.query(
      `SELECT id, username, ${passwordColumn} AS stored_password FROM users WHERE username = ? LIMIT 1`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = users[0];
    const storedPassword = user.stored_password;
    const passwordOk = isBcryptHash(storedPassword)
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username
      },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "1d" }
    );

    res.cookie("authToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

ensureUsersTable()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Backend listening on http://localhost:${PORT}`);
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing process and restart backend.`);
      } else {
        console.error("Server startup error:", error.message);
      }
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error.message);
    process.exit(1);
  });
