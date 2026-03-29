import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logEvent } from "./observability-service.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: config.smtp.user && config.smtp.pass ? {
    user: config.smtp.user,
    pass: config.smtp.pass,
  } : undefined,
});

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!config.smtp.host) {
    logEvent("warn", "email_skipped", { reason: "SMTP_HOST not configured", ...options });
    // In development or if not configured, we just log it.
    if (process.env.NODE_ENV !== "production") {
       console.log("--- EMAIL SIMULATION ---");
       console.log(`To: ${options.to}`);
       console.log(`Subject: ${options.subject}`);
       console.log(`Body: ${options.text}`);
       console.log("------------------------");
    }
    return;
  }

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    logEvent("info", "email_sent", { to: options.to, subject: options.subject });
  } catch (error) {
    logEvent("error", "email_failed", { 
      to: options.to, 
      subject: options.subject, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

export async function sendInviteEmail(to: string, hubName: string, inviteUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: `You've been invited to join ${hubName} on Skerry`,
    text: `You've been invited to join the ${hubName} hub. Click the link below to accept the invitation:\n\n${inviteUrl}`,
    html: `
      <h1>Welcome to ${hubName}!</h1>
      <p>You've been invited to join the <strong>${hubName}</strong> hub on Skerry.</p>
      <p><a href="${inviteUrl}">Click here to accept the invitation and get started.</a></p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p>${inviteUrl}</p>
    `
  });
}

export async function sendMentionNotification(to: string, senderName: string, channelName: string, messagePreview: string, jumpUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: `${senderName} mentioned you in #${channelName}`,
    text: `${senderName}: "${messagePreview}"\n\nJump to message: ${jumpUrl}`,
    html: `
      <p><strong>${senderName}</strong> mentioned you in <strong>#${channelName}</strong>:</p>
      <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; color: #555;">
        ${messagePreview}
      </blockquote>
      <p><a href="${jumpUrl}">View in Skerry</a></p>
    `
  });
}
