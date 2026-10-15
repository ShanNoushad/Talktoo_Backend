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
const Razorpay = require("razorpay");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//create Razorpay order (called before checkout opens)
exports.createRazorpayOrder = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { coinPlanId } = req.query;
    if (!coinPlanId) {
      return res.status(200).json({ status: false, message: "coinPlanId is required." });
    }

    const coinPlan = await CoinPlan.findById(coinPlanId).select("_id coins price").lean();
    if (!coinPlan) {
      return res.status(200).json({ status: false, message: "CoinPlan not found." });
    }

    const order = await razorpayInstance.orders.create({
      amount: Math.round(coinPlan.price * 100), // paise
      currency: "INR",
      notes: {
        userId: req.user.userId.toString(),
        coinPlanId: coinPlanId.toString(),
      },
    });

    return res.status(200).json({
      status: true,
      message: "Razorpay order created successfully.",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};