const IdentityProof = require("../../models/identityproof.model");

//get all identity proof types
exports.listIdentityProofs = async (req, res) => {
  try {
    const identityProofs = await IdentityProof.find().select("_id title createdAt").lean();

    return res.status(200).json({
      status: true,
      message: "Identity proof types retrieved successfully.",
      data: identityProofs,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};
