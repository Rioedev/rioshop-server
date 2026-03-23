import dotenv from "dotenv";
import emailService from "../src/services/emailService.js";

dotenv.config();

const cliTarget = process.argv[2];
const targetEmail = (cliTarget || process.env.SMTP_TEST_TO || "").trim();

if (!targetEmail) {
  console.error("Missing target email. Usage: npm run email:test -- your@email.com");
  process.exit(1);
}

const run = async () => {
  try {
    const verifyOk = await emailService.getTransporter().verify();
    console.log("SMTP_VERIFY_OK=", verifyOk);
  } catch (error) {
    console.error("SMTP_VERIFY_ERROR=", error?.message || error);
    process.exit(1);
  }

  const result = await emailService.sendMail({
    to: targetEmail,
    subject: "[RioShop] Email test",
    html: "<p>Đây là email test từ RioShop backend.</p>",
    text: "Day la email test tu RioShop backend.",
    throwOnError: false,
  });

  console.log("SEND_RESULT=", JSON.stringify(result));
  process.exit(result.success ? 0 : 2);
};

void run();
