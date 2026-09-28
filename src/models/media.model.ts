import mongoose from "mongoose";
import type { Document } from "mongoose";

export type MediaType = "photos" | "videos";
export type MediaCategory = "events" | "community" | "team" | "all";

export interface IMedia extends Document {
  title: string;
  description: string;
  alt: string;
  type: MediaType;
  category: Exclude<MediaCategory, "all">;
  date: string;
  image?: string | null;
  video?: string | null;
  authorId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}


const mediaSchema = new mongoose.Schema<IMedia>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [180, "Title cannot exceed 180 characters"],
    },
    description: { type: String, default: "", trim: true, maxlength: [2000, "Description cannot exceed 2000 characters"] },
    alt: { type: String, default: "", trim: true, maxlength: [240, "Alt text cannot exceed 240 characters"] },
    type: { type: String, required: true, enum: { values: ["photos", "videos"], message: "Type must be 'photos' or 'videos'" } },
    category: {
      type: String,
      required: true,
      enum: { values: ["events", "community", "team"], message: "Category must be one of: events, community, team" },
      index: true,
    },
    date: { type: String, required: true, default: () => String(new Date().getFullYear()) },
    image: { type: String, default: null },
    video: { type: String, default: null },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

mediaSchema.index({ title: "text", description: "text" });
mediaSchema.index({ createdAt: -1 });

export const Media = mongoose.model<IMedia>("Media", mediaSchema);
export default Media;