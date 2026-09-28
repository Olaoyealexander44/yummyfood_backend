import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  admin?: { id: string; email: string; role: string };
}

/**
 * Protects POST / PUT / DELETE endpoints.
 * Expects header:  Authorization: Bearer <JWT>
 * (JWT is issued by /api/auth/admin/signin on successful login)
 */
export const requireAdminAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      res.status(401).json({ success: false, message: "Unauthorized: missing access token. Sign in first." });
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("⛔ JWT_SECRET not set in .env — auth disabled.");
      res.status(500).json({ success: false, message: "Server misconfiguration." });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id) {
      res.status(401).json({ success: false, message: "Invalid token." });
      return;
    }

    req.admin = {
      id: String(decoded.id),
      email: decoded.email || "",
      role: decoded.role || "admin",
    };

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      message: "Session expired or invalid token. Please sign in again.",
    });
  }
};