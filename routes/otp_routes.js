const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp } = require('../services/twilioService');

// POST /api/otp/send
router.post('/send', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }

  try {
    const status = await sendOtp(phoneNumber);
    return res.status(200).json({ success: true, status });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/otp/verify
router.post('/verify', async (req, res) => {
  const { phoneNumber, code } = req.body;

  if (!phoneNumber || !code) {
    return res.status(400).json({ success: false, message: 'Phone number and code are required' });
  }

  try {
    const approved = await verifyOtp(phoneNumber, code);

    if (!approved) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    return res.status(200).json({ success: true, message: 'OTP verified' });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;