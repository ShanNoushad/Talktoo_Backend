const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const sendOtp = async (phoneNumber) => {
  const verification = await client.verify.v2
    .services(SERVICE_SID)
    .verifications.create({
      to: phoneNumber,
      channel: 'sms',
    });
  return verification.status;
};

const verifyOtp = async (phoneNumber, code) => {
  const result = await client.verify.v2
    .services(SERVICE_SID)
    .verificationChecks.create({
      to: phoneNumber,
      code: code,
    });
  return result.status === 'approved';
};

module.exports = { sendOtp, verifyOtp };