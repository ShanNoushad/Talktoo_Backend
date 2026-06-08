const mongoose = require("mongoose");

const talkTopicSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("TalkTopic", talkTopicSchema);
