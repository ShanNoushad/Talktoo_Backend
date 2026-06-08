const Faq = require("../../models/faq.model");

//create FAQ
exports.createFaq = async (req, res) => {
  try {
    const { category, question, answer } = req.query;

    if (!category || !question || !answer) {
      return res.status(200).json({ status: false, message: "Category, question, and answer are required." });
    }

    if (!["User", "Listener"].includes(category)) {
      return res.status(200).json({ status: false, message: "Invalid category! Must be 'User' or 'Listener'." });
    }

    const faq = await new Faq({
      category,
      question: question.trim(),
      answer: answer.trim(),
    }).save();

    return res.status(200).json({
      status: true,
      message: "FAQ created successfully!",
      data: faq,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//update FAQ
exports.updateFaq = async (req, res) => {
  try {
    if (!req.query.faqId) {
      return res.status(200).json({ status: false, message: "FAQ ID is required." });
    }

    const faq = await Faq.findById(req.query.faqId);
    if (!faq) {
      return res.status(200).json({ status: false, message: "FAQ not found." });
    }

    const { category, question, answer } = req.query;

    if (category && !["User", "Listener"].includes(category)) {
      return res.status(200).json({ status: false, message: "Invalid category! Must be 'User' or 'Listener'." });
    }

    faq.category = category ? category : faq.category;
    faq.question = question ? question.trim() : faq.question;
    faq.answer = answer ? answer.trim() : faq.answer;
    await faq.save();

    return res.status(200).json({
      status: true,
      message: "FAQ updated successfully!",
      data: faq,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//get all FAQs
exports.getFaqs = async (req, res) => {
  try {
    let { category } = req.query;

    category = category?.trim();
    const validCategories = ["User", "Listener"];

    if (!category || !validCategories.includes(category)) {
      return res.status(200).json({ status: false, message: "Invalid category. Allowed values are: 'User' or 'Listener'." });
    }

    const filter = { category };

    const [total, faqs] = await Promise.all([Faq.countDocuments(filter), Faq.find(filter).sort({createdAt:-1}).lean()]);

    return res.status(200).json({
      status: true,
      message: "FAQs retrieved successfully!",
      total,
      data: faqs,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//delete FAQ
exports.deleteFaq = async (req, res) => {
  try {
    if (!req.query.faqId) {
      return res.status(200).json({ status: false, message: "FAQ ID is required." });
    }

    const faq = await Faq.findById(req.query.faqId);
    if (!faq) {
      return res.status(200).json({ status: false, message: "FAQ not found." });
    }

    await faq.deleteOne();

    return res.status(200).json({
      status: true,
      message: "FAQ deleted successfully!",
      data: faq,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};
