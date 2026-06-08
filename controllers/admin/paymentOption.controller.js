const PaymentOption = require("../../models/paymentOption.model");

//fs
const fs = require("fs");

//path
const path = require("path");

//create Payment Option
exports.createPaymentOption = async (req, res) => {
  try {
    const { name, details } = req.body;

    if (!name) {
      return res.status(200).json({ status: false, message: "Name is required." });
    }

    let parsedDetails = [];

    if (details) {
      if (Array.isArray(details)) {
        parsedDetails = details;
      } else if (typeof details === "string") {
        parsedDetails = details
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        return res.status(200).json({ status: false, message: "Details must be an array or comma-separated string." });
      }
    }

    const option = new PaymentOption({
      name,
      image: req.file ? req.file.path : "",
      details: parsedDetails,
    });

    await option.save();

    return res.status(200).json({
      status: true,
      message: "Payment option has been created by the admin.",
      data: option,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//update Payment Option
exports.updatePaymentOption = async (req, res) => {
  try {
    const { paymentOptionId, name, details } = req.body;

    if (!paymentOptionId) {
      return res.status(200).json({ status: false, message: "paymentOptionId is required." });
    }

    const option = await PaymentOption.findById(paymentOptionId);
    if (!option) {
      return res.status(200).json({ status: false, message: "Payment option not found." });
    }

    if (req.file) {
      if (option.image) {
        const imagePath = path.normalize(option.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      option.image = req.file.path;
    }

    option.name = name ?? option.name;

    if (details) {
      if (Array.isArray(details)) {
        option.details = details;
      } else if (typeof details === "string") {
        option.details = details
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean);
      }
    }

    await option.save();

    return res.status(200).json({
      status: true,
      message: "Payment option has been updated by the admin.",
      data: option,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//toggle Payment Option Status (isActive)
exports.togglePaymentOptionStatus = async (req, res) => {
  try {
    const { paymentOptionId } = req.query;

    if (!paymentOptionId) {
      return res.status(200).json({ status: false, message: "paymentOptionId is required." });
    }

    const option = await PaymentOption.findById(paymentOptionId);
    if (!option) {
      return res.status(200).json({ status: false, message: "Payment option not found." });
    }

    option.isActive = !option.isActive;
    await option.save();

    return res.status(200).json({
      status: true,
      message: "Payment option status has been toggled.",
      data: option,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//get all Payment Options
exports.getAllPaymentOptions = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [total, options] = await Promise.all([
      PaymentOption.countDocuments(),
      PaymentOption.find()
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrieved all payment options.",
      total,
      data: options,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//delete Payment Option
exports.deletePaymentOption = async (req, res) => {
  try {
    const { paymentOptionId } = req.query;

    if (!paymentOptionId) {
      return res.status(200).json({ status: false, message: "paymentOptionId is required." });
    }

    const option = await PaymentOption.findById(paymentOptionId).select("_id image");
    if (!option) {
      return res.status(200).json({ status: false, message: "Payment option not found." });
    }

    if (option.image) {
      const imagePath = path.normalize(option.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await PaymentOption.findByIdAndDelete(paymentOptionId);

    return res.status(200).json({
      status: true,
      message: "Payment option has been deleted by the admin.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
