const Faq = require("../../models/faq.model");

//get all FAQs
exports.retrieveFaqList = async (req, res) => {
  try {
    const [faqs] = await Promise.all([Faq.find({ category: "Listener" }).lean()]);

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
