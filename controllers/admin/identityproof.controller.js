const IdentityProof = require("../../models/identityproof.model");

//add new identity proof type
exports.addIdentityProof = async (req, res) => {
  try {
    if (!req.query.title) {
      return res.status(200).json({ status: false, message: "Invalid input: Title is required." });
    }

    const title = req.query.title.trim();
    const identityProof = new IdentityProof({ title });
    await identityProof.save();

    return res.status(200).json({
      status: true,
      message: "Identity proof type added successfully.",
      data: identityProof,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};

//modify an existing identity proof type
exports.modifyIdentityProof = async (req, res) => {
  try {
    if (!req.query.identityProofId) {
      return res.status(200).json({ status: false, message: "identityProofId is required." });
    }

    const identityProof = await IdentityProof.findById(req.query.identityProofId);
    if (!identityProof) {
      return res.status(200).json({ status: false, message: "Identity proof type not found." });
    }

    identityProof.title = req.query.title ? req.query.title.trim() : identityProof.title;
    await identityProof.save();

    return res.status(200).json({
      status: true,
      message: "Identity proof type updated successfully.",
      data: identityProof,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};

//get all identity proof types
exports.fetchIdentityProofs = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [total, identityProofs] = await Promise.all([
      IdentityProof.countDocuments(),
      IdentityProof.find()
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Identity proof types retrieved successfully.",
      total,
      data: identityProofs,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};

//remove an identity proof type
exports.removeIdentityProof = async (req, res) => {
  try {
    if (!req.query.identityProofId) {
      return res.status(200).json({ status: false, message: "identityProofId is required." });
    }

    const identityProof = await IdentityProof.findById(req.query.identityProofId);
    if (!identityProof) {
      return res.status(200).json({ status: false, message: "Identity proof type not found." });
    }

    await identityProof.deleteOne();

    return res.status(200).json({
      status: true,
      message: "Identity proof type deleted successfully.",
      data: identityProof,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};
