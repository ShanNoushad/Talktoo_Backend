const PaymentOption = require("../../models/paymentOption.model");

//get all Payment Options
exports.getAvailablePaymentOptions = async (req, res) => {
  try {
    const { start = 1, limit = 20 } = req.query || {};
    const pageNumber = Math.max(parseInt(start, 10), 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const options = await PaymentOption.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean();

    return res.status(200).json({
      status: true,
      message: "Retrieved all payment options.",
      data: options,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
