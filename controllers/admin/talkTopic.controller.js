const TalkTopic = require("../../models/talkTopic.model");

//create TalkTopic
exports.createTalkTopic = async (req, res) => {
  try {
    if (!req.query.name) {
      return res.status(200).json({ status: false, message: "Invalid input! Name is required." });
    }

    const name = req.query.name.trim();
    const talkTopic = await new TalkTopic({ name }).save();

    return res.status(200).json({
      status: true,
      message: "TalkTopic created successfully!",
      data: talkTopic,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//update TalkTopic
exports.updateTalkTopic = async (req, res) => {
  try {
    if (!req.query.talkTopicId) {
      return res.status(200).json({ status: false, message: "TalkTopic ID is required." });
    }

    const talkTopic = await TalkTopic.findById(req.query.talkTopicId);
    if (!talkTopic) {
      return res.status(200).json({ status: false, message: "TalkTopic not found." });
    }

    talkTopic.name = req.query.name ? req.query.name.trim() : talkTopic.name;
    await talkTopic.save();

    return res.status(200).json({
      status: true,
      message: "TalkTopic updated successfully!",
      data: talkTopic,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//get all TalkTopics
exports.getTalkTopics = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [total, talkTopics] = await Promise.all([
      TalkTopic.countDocuments(),
      TalkTopic.find()
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "TalkTopics retrieved successfully!",
      total: total,
      data: talkTopics,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//get all TalkTopics (dropdown)
exports.fetchTalkTopicMetrics = async (req, res) => {
  try {
    const [talkTopics] = await Promise.all([TalkTopic.find().lean()]);

    return res.status(200).json({
      status: true,
      message: "TalkTopics retrieved successfully!",
      data: talkTopics,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//delete TalkTopic
exports.deleteTalkTopic = async (req, res) => {
  try {
    if (!req.query.talkTopicId) {
      return res.status(200).json({ status: false, message: "TalkTopic ID is required." });
    }

    const talkTopic = await TalkTopic.findById(req.query.talkTopicId);
    if (!talkTopic) {
      return res.status(200).json({ status: false, message: "TalkTopic not found." });
    }

    await talkTopic.deleteOne();

    return res.status(200).json({
      status: true,
      message: "TalkTopic deleted successfully!",
      data: talkTopic,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};
