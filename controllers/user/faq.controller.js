const Faq = require("../../models/faq.model");

//get all FAQs
exports.listFaqs = async (req, res) => {
  try {
    const { category } = req.query;

    if (category && !["User", "Listener"].includes(category)) {
      return res.status(200).json({ status: false, message: "Invalid category." });
    }

    const query = category ? { category } : {};

    const [faqs] = await Promise.all([Faq.find(query).lean()]);

    return res.status(200).json({
      status: true,
      message: "FAQs retrieved successfully!",
      data: faqs,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};
