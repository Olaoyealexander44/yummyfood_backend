import type { Response } from "express";
import { Media } from "../models/media.model.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

const pickPublicFields = (doc: any) => ({
  id: doc._id,
  title: doc.title,
  description: doc.description,
  alt: doc.alt,
  type: doc.type,
  category: doc.category,
  date: doc.date,
  image: doc.image,
  video: doc.video,
  authorId: doc.authorId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

/**
 * GET /api/media?category=events|community|team
 * Public — no login required.
 */
export const getAllMedia = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const category = (req.query.category as string) || "all";
    const query: any = {};
    if (category && category !== "all") query.category = category;

    const docs = await Media.find(query).sort({ createdAt: -1 }).lean().exec();
    res.status(200).json({
      success: true,
      count: docs.length,
      data: docs.map(pickPublicFields),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to load media." });
  }
};

/** GET /api/media/:id */
export const getMediaById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const doc = await Media.findById(req.params.id).lean().exec();
    if (!doc) {
      res.status(404).json({ success: false, message: "Media post not found." });
      return;
    }
    res.status(200).json({ success: true, data: pickPublicFields(doc) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to load media post." });
  }
};

/** POST /api/media — JWT protected */
export const createMedia = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { title, description, alt, type, category, date, image, video } = req.body;
    if (!title || !type || !category) {
      res.status(400).json({ success: false, message: "Title, type, and category are required." });
      return;
    }
    if (type === "photos" && !image) {
      res.status(400).json({ success: false, message: "Photo posts require an image." });
      return;
    }
    if (type === "videos" && !video) {
      res.status(400).json({ success: false, message: "Video posts require a video source." });
      return;
    }
    const doc = await Media.create({
      title,
      description: description || "",
      alt: alt || title,
      type,
      category,
      date: date || String(new Date().getFullYear()),
      image: image || null,
      video: video || null,
      authorId: req.admin?.id || null,
    });
    res.status(201).json({ success: true, message: "Media post created.", data: pickPublicFields(doc) });
  } catch (err: any) {
    if (err.name === "ValidationError") {
      const firstMsg = Object.values(err.errors || {})[0] as any;
      res.status(400).json({ success: false, message: firstMsg?.message || "Validation error." });
      return;
    }
    res.status(500).json({ success: false, message: err.message || "Failed to create media post." });
  }
};

/** PUT /api/media/:id — JWT protected */
export const updateMedia = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const existing = await Media.findById(req.params.id).exec();
    if (!existing) {
      res.status(404).json({ success: false, message: "Media post not found." });
      return;
    }
    const { title, description, alt, type, category, date, image, video } = req.body;
    if (title !== undefined) existing.title = title;
    if (description !== undefined) existing.description = description;
    if (alt !== undefined) existing.alt = alt;
    if (type !== undefined) existing.type = type;
    if (category !== undefined) existing.category = category;
    if (date !== undefined) existing.date = date;
    if (image !== undefined) existing.image = image;
    if (video !== undefined) existing.video = video;
    await existing.save();
    res.status(200).json({ success: true, message: "Media post updated.", data: pickPublicFields(existing) });
  } catch (err: any) {
    if (err.name === "ValidationError") {
      const firstMsg = Object.values(err.errors || {})[0] as any;
      res.status(400).json({ success: false, message: firstMsg?.message || "Validation error." });
      return;
    }
    if (err.kind === "ObjectId") {
      res.status(404).json({ success: false, message: "Media post not found." });
      return;
    }
    res.status(500).json({ success: false, message: err.message || "Failed to update media post." });
  }
};

/** DELETE /api/media/:id — JWT protected */
export const deleteMedia = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const doc = await Media.findByIdAndDelete(req.params.id).exec();
    if (!doc) {
      res.status(404).json({ success: false, message: "Media post not found." });
      return;
    }
    res.status(200).json({ success: true, message: "Media post deleted.", data: { id: doc._id } });
  } catch (err: any) {
    if (err.kind === "ObjectId") {
      res.status(404).json({ success: false, message: "Media post not found." });
      return;
    }
    res.status(500).json({ success: false, message: err.message || "Failed to delete media post." });
  }
};