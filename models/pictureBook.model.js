const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const picturebookSchema = new Schema({
  title: { type: String, required: true },
  story: { type: String, required: true },
  visitedLocation: { type: [String], default: [] },
  isFavourite: { type: Boolean, default: false },
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  createdOn: { type: Date, default: Date.now() },
  imageURL: { type: String, required: true },
  visitedDate: { type: Date, required: true },
});

module.exports = mongoose.model("PictureBook", picturebookSchema);
