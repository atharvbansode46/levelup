import { randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import db from "../db.js";

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return secret;
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    weeklyTargetDays: user.weekly_target_days,
    sessionMinutes: user.session_minutes,
    createdAt: user.created_at,
  };
}
function tokenFor(user) {
  return jwt.sign({ sub: user.id }, jwtSecret(), { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Please sign in to continue" });
  try {
    const payload = jwt.verify(token, jwtSecret());
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
    if (!user) return res.status(401).json({ error: "Account not found" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again" });
  }
}

router.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check your details", details: parsed.error.flatten().fieldErrors });
  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return res.status(409).json({ error: "An account with this email already exists" });

  const user = { id: randomUUID(), name, email, passwordHash: bcrypt.hashSync(password, 12), createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO users (id,name,email,password_hash,created_at) VALUES (@id,@name,@email,@passwordHash,@createdAt)").run(user);
  const saved = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  return res.status(201).json({ user: publicUser(saved), token: tokenFor(saved) });
});

router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password" });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(parsed.data.email.toLowerCase());
  if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) return res.status(401).json({ error: "Email or password is incorrect" });
  return res.json({ user: publicUser(user), token: tokenFor(user) });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
export default router;
