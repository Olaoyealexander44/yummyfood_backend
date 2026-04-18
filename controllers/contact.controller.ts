import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

export const sendContactEmail = async (req: Request, res: Response) => {
  const { name, email, phone, message } = req.body;

  try {
    console.log(`[CONTACT] Preparing to send email from: ${name} (${email})`);

    // Create a transporter using your Gmail App Password
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, 
      auth: {
        user: 'olaoyealexander44@gmail.com',
        pass: 'nqky rclm xfny pxwo',
      },
    });

    const mailOptions = {
      from: `"YummyFood Contact Form" <olaoyealexander44@gmail.com>`,
      to: 'olaoyealexander44@gmail.com',
      replyTo: email,
      subject: `🍴 YummyFood: New Message from ${name}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f0f0f0; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <div style="background-color: #ff6f00; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Message</h1>
          </div>
          <div style="padding: 30px; background-color: white;">
            <div style="margin-bottom: 20px;">
              <p style="margin: 0; color: #888; font-size: 12px; font-weight: bold; text-transform: uppercase;">Customer Details</p>
              <p style="margin: 5px 0; color: #333; font-size: 16px;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 5px 0; color: #333; font-size: 16px;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 5px 0; color: #333; font-size: 16px;"><strong>Phone:</strong> ${phone}</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <div>
              <p style="margin: 0; color: #888; font-size: 12px; font-weight: bold; text-transform: uppercase;">Message Content</p>
              <p style="margin: 10px 0; color: #555; font-size: 15px; line-height: 1.6; background-color: #f9f9f9; padding: 15px; border-radius: 10px; border-left: 4px solid #ff6f00;">
                ${message}
              </p>
            </div>
          </div>
          <div style="background-color: #fcfcfc; padding: 20px; text-align: center; border-top: 1px solid #f0f0f0;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">&copy; 2024 YummyFood Nigeria. Sent via Admin Dashboard.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[CONTACT SUCCESS] Message from ${name} sent to olaoyealexander44@gmail.com`);
    
    res.status(200).json({ message: 'Your message has been sent successfully!' });
  } catch (error: any) {
    console.error(`[CONTACT ERROR] Failed to send email: ${error.message}`);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
};