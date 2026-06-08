const mongoose = require("mongoose");

const listenerMatchHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastListenerId: { type: mongoose.Schema.Types.ObjectId, ref: "Listener", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("ListenerMatchHistory", listenerMatchHistorySchema);
