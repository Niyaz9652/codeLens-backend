import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    language: String,
    code: String,
    result: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);
