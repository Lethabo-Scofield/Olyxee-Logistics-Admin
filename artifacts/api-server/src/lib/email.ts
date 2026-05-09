import { Resend } from "resend";
import { logger } from "./logger";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendStatusEmailParams {
  customerEmail: string;
  customerName: string;
  trackingId: string;
  status: string;
  statusMessage: string | null;
  trackingLink: string;
  businessName: string;
  supportEmail: string;
}

export async function sendStatusEmail(params: SendStatusEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const resend = getResend();

  const subject = `Update on your order: ${params.trackingId}`;
  const body = `Hi ${params.customerName},

Your order status has been updated.

Tracking ID: ${params.trackingId}
Current status: ${params.status}
${params.statusMessage ? `\nMessage:\n${params.statusMessage}` : ""}

Track your order here:
${params.trackingLink}

Kind regards,
${params.businessName}`;

  if (!resend) {
    logger.warn("Resend API key not configured — email not sent");
    return { success: false, error: "Email provider not configured" };
  }

  try {
    const result = await resend.emails.send({
      from: `${params.businessName} <${params.supportEmail}>`,
      to: [params.customerEmail],
      subject,
      text: body,
    });

    if (result.error) {
      logger.error({ error: result.error }, "Failed to send email via Resend");
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    logger.error({ err }, "Exception sending email");
    return { success: false, error: "Failed to send email" };
  }
}

export function buildEmailBody(params: SendStatusEmailParams): { subject: string; body: string } {
  return {
    subject: `Update on your order: ${params.trackingId}`,
    body: `Hi ${params.customerName},

Your order status has been updated.

Tracking ID: ${params.trackingId}
Current status: ${params.status}
${params.statusMessage ? `\nMessage:\n${params.statusMessage}` : ""}

Track your order here:
${params.trackingLink}

Kind regards,
${params.businessName}`,
  };
}
