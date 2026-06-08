const TalkTopic = require("../../models/talkTopic.model");

//get talk topic list
exports.getTalkTopics = async (req, res) => {
  try {
    const talkTopics = await TalkTopic.find({}).select("name").sort({ createdAt: -1 }).lean();

    res.status(200).json({
      status: true,
      message: `Talk topics retrieved successfully.`,
      talkTopics,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to retrieve talk topics." });
  }
};
