import { Resend } from 'resend';
import { env } from './env.js';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOtpEmail(to, otp) {
  const { error } = await resend.emails.send({
    from: env.SMTP_FROM,
    to,
    subject: 'Your OTP for Registration',
    text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
    html: `<b>Your OTP is: ${otp}</b><br><p>It will expire in 10 minutes.</p>`,
  });

  if (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email: ' + error.message);
  }

  console.log('OTP email sent to', to);
}

export async function sendTrainingCompleteEmail(to, studentName) {
  const { error } = await resend.emails.send({
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

  if (error) {
    console.error('Error sending training email:', error);
    throw new Error('Failed to send training complete email: ' + error.message);
  }

  console.log('Training notification sent to', to);
}

export async function sendPasswordResetEmail(to, resetUrl) {
  const { error } = await resend.emails.send({
    from: env.SMTP_FROM,
    to,
    subject: 'Password Reset Request - Vedalaya',
    text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #059669; margin-top: 0;">Password Reset</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your account. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Reset Password</a>
        <p style="margin-top: 20px; font-size: 14px; color: #64748b;">
          If the button doesn't work, copy and paste this URL into your browser:<br>
          <a href="${resetUrl}" style="color: #059669;">${resetUrl}</a>
        </p>
        <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email: ' + error.message);
  }

  console.log('Password reset email sent to', to);
}
