import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  auth: {
    pass: process.env.SMTP_PASS,
    user: process.env.SMTP_USER,
  },
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  tls: {
    rejectUnauthorized: false,
  },
})

export async function sendOtpEmail(to: string, code: string) {
  const from = process.env.EMAIL_FROM ?? 'no-reply@example.com'
  const info = await transporter.sendMail({
    from: `"Smart Reply Assistant" <${from}>`,
    html: getOTPEmailTemplate(code),
    subject: 'Your Smart Reply Assistant verification code',
    text: `Your verification code is ${code}. This code expires in 10 minutes. If you didn't request this code, please ignore this email.`,
    to,
  })
  console.log('OTP email sent', info.messageId)
}

function getOTPEmailTemplate(otp: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Verification Code</title>
        <style>
          /* Utility styles for older email clients */
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', Arial, sans-serif;
            background-color: #f3f4f6; /* tailwind gray-100 */
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          }
          .brand-gradient {
            background: linear-gradient(90deg, #2563eb, #7c3aed, #4338ca);
          }
          .code-gradient {
            background: linear-gradient(90deg, #2563eb, #7c3aed);
          }
          .code-box {
            padding: 20px 32px;
            border-radius: 8px;
            display: inline-block;
            margin: 32px auto 0;
          }
        </style>
      </head>
      <body>
        <!-- Full-width banner -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="brand-gradient" style="padding: 40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container">
                <tr>
                  <td align="center" style="padding: 48px 24px 32px;">
                    <h1 style="margin: 0; font-size: 28px; color: #2563eb; font-weight: 700;">Smart Reply Assistant</h1>
                    <p style="font-size: 16px; color: #4b5563; margin: 24px 0 0;">Use the code below to sign in</p>
                    <!-- OTP code -->
                    <div class="code-gradient code-box">
                      <span style="font-size: 40px; letter-spacing: 8px; color: #ffffff; font-weight: 700;">${otp}</span>
                    </div>
                    <p style="font-size: 14px; color: #6b7280; margin: 32px 0 0;">This code expires in 10&nbsp;minutes.</p>
                    <p style="font-size: 12px; color: #9ca3af; margin: 40px 0 0;">If you did not request this code, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="background-color: #f3f4f6; padding: 20px;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">© ${new Date().getFullYear()} Smart Reply Assistant. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}
