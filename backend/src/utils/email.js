import nodemailer from 'nodemailer';

import { env } from './env.js';

let transporter;

async function createTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendOtpEmail(to, otp) {
  try {
    const mailTransporter = await createTransporter();

    const info = await mailTransporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: 'Your OTP for Registration',
      text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
      html: `<b>Your OTP is: ${otp}</b><br><p>It will expire in 10 minutes.</p>`,
    });

    console.log('Message sent: %s', info.messageId);
  } catch (err) {
    console.error('Error sending email:', err);
    throw new Error('Failed to send OTP email');
  }
}

export async function sendTrainingCompleteEmail(to, studentName) {
  try {
    const mailTransporter = await createTransporter();

    const info = await mailTransporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `Face Recognition Training Complete: ${studentName}`,
      text: `The face recognition model has finished training for student: ${studentName}. The system is now ready to recognize them.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #059669; margin-top: 0;">✅ Training Complete</h2>
          <p>Hello,</p>
          <p>The face recognition model has successfully finished training for the new dataset.</p>
          <p>Student Name: <strong>${studentName}</strong></p>
          <p style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; color: #166534; border-radius: 6px;">
            The system is now fully ready to recognize this student during attendance marking.
          </p>
        </div>
      `,
    });

    console.log('Training notification sent: %s', info.messageId);
  } catch (err) {
    console.error('Error sending training email:', err);
    throw new Error('Failed to send training complete email');
  }
}
