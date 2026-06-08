module.exports = () => {
  return (req, res, next) => {
    const key = req.headers.key;

    if (key) {
      if (key === process.env.secretKey) {
        next();
      } else {
        return res.status(400).json({ status: false, error: "Forbidden: Invalid credentials" });
      }
    } else {
      return res.status(400).json({ status: false, error: "Unauthorized: Credentials missing" });
    }
  };
};
