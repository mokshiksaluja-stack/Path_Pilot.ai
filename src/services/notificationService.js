const nodemailer = require('nodemailer');
const { renderTemplate } = require('../templates/notificationTemplates');

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:5002';

/**
 * Notification Delivery Service
 * Dispatches nudges across Email (Nodemailer / SMTP) and WhatsApp channels,
 * and syncs delivery audit logs with PostgreSQL via Core Service.
 */
class NotificationService {
  constructor() {
    this.mailer = null;
    this.initMailer();
  }

  /**
   * Initializes real Nodemailer SMTP transporter if credentials are provided in .env
   */
  initMailer() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (user && pass) {
      this.mailer = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || 'gmail',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: process.env.SMTP_SECURE === 'true' || true,
        auth: {
          user: user.trim(),
          pass: pass.trim().replace(/\s+/g, ''), // Strip spaces if pasted as "abcd efgh ijkl mnop"
        },
      });

      console.log(`📧 [Notification Service] Nodemailer initialized with SMTP account: ${user}`);
    } else {
      console.log(`ℹ️  [Notification Service] No SMTP_USER / SMTP_PASS found. Running in Mock Email mode.`);
    }
  }

  /**
   * Processes and delivers a notification job.
   * @param {Object} data Job payload
   */
  async processNotification(data) {
    const {
      userId,
      channel = 'EMAIL',
      type = 'DAILY_REMINDER',
      userName = 'Learner',
      userEmail = 'alex@pathpilot.ai',
      userPhone = '+15550192834',
    } = data;

    console.log(`📨 [Notification Service] Preparing ${type} via ${channel} for ${userName} (${userId})...`);

    // 1. Render channel-specific message
    const messageContent = renderTemplate(type, channel, data);

    // 2. Dispatch to appropriate delivery channel
    let deliveryReceipt;
    if (channel.toUpperCase() === 'EMAIL') {
      deliveryReceipt = await this.deliverEmail({
        to: userEmail,
        subject: messageContent.subject,
        body: messageContent.body,
        data,
      });
    } else if (channel.toUpperCase() === 'WHATSAPP') {
      deliveryReceipt = await this.deliverWhatsApp({
        to: userPhone,
        text: messageContent,
      });
    } else {
      throw new Error(`Unsupported notification channel: ${channel}`);
    }

    // 3. Persist audit record in PostgreSQL via Core Service
    await this.logToCoreService({
      userId,
      channel: channel.toUpperCase(),
      status: 'SENT',
    });

    return {
      success: true,
      jobType: type,
      channel: channel.toUpperCase(),
      receipt: deliveryReceipt,
      content: messageContent,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Dispatches Email via real Nodemailer or mock provider
   */
  async deliverEmail({ to, subject, body, data }) {
    if (this.mailer) {
      try {
        const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;
        
        // Styled HTML version of the notification
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #faf8ff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
              <span style="font-size: 22px; font-weight: 700; color: #191b23;">🚀 PathPilot AI</span>
            </div>
            <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
              <h2 style="color: #004ac6; margin-top: 0; font-size: 20px;">${subject}</h2>
              <p style="white-space: pre-line; color: #434655; font-size: 15px; line-height: 1.6;">${body}</p>
              ${data?.resourceUrl ? `
                <div style="margin-top: 24px;">
                  <a href="${data.resourceUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; padding: 12px 24px; border-radius: 9999px; text-decoration: none;">Start Today's Micro-Task &rarr;</a>
                </div>
              ` : ''}
            </div>
            <p style="text-align: center; color: #737686; font-size: 12px; margin-top: 24px;">
              PathPilot AI • Adaptive Learning Acceleration Platform • Automated Study Nudge
            </p>
          </div>
        `;

        const info = await this.mailer.sendMail({
          from: `"PathPilot AI" <${fromAddress}>`,
          to,
          subject,
          text: body,
          html,
        });

        console.log(`✅ [REAL EMAIL DISPATCHED VIA NODEMAILER] To: ${to}`);
        console.log(`    Message ID: ${info.messageId}`);
        console.log(`    Response: ${info.response}`);

        return {
          messageId: info.messageId,
          recipient: to,
          delivered: true,
          mode: 'LIVE_SMTP',
        };
      } catch (err) {
        console.error(`💥 [Nodemailer SMTP Error] Failed to send email: ${err.message}`);
        throw err;
      }
    }

    // Fallback: Mock delivery
    await new Promise((resolve) => setTimeout(resolve, 80));
    console.log(`✉️  [MOCK EMAIL DISPATCHED] To: ${to}`);
    console.log(`    Subject: "${subject}"`);
    console.log(`    Preview: "${body.split('\n')[0]}"`);

    return {
      messageId: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      recipient: to,
      delivered: true,
      mode: 'MOCK',
    };
  }

  /**
   * Mock WhatsApp Provider (simulates Twilio WhatsApp / Meta Cloud API)
   */
  async deliverWhatsApp({ to, text }) {
    await new Promise((resolve) => setTimeout(resolve, 80));

    console.log(`📱 [MOCK WHATSAPP DISPATCHED] To: ${to}`);
    console.log(`    Message: "${text.substring(0, 80)}..."`);

    return {
      messageId: `wa-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      recipient: to,
      delivered: true,
      mode: 'MOCK',
    };
  }

  /**
   * Logs notification event to Core Service PostgreSQL database.
   */
  async logToCoreService({ userId, channel, status }) {
    try {
      const response = await fetch(`${CORE_SERVICE_URL}/api/v1/core/notifications/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, channel, status }),
      });

      if (!response.ok) {
        console.warn(`⚠️ [Notification Service] Failed to sync log to Core Service: HTTP ${response.status}`);
      } else {
        const result = await response.json();
        console.log(`💾 [Notification Service] Audit log persisted in PostgreSQL (Log ID: ${result.data?.id})`);
      }
    } catch (err) {
      console.warn(`⚠️ [Notification Service] Core Service unreachable for audit logging: ${err.message}`);
    }
  }
}

module.exports = new NotificationService();
