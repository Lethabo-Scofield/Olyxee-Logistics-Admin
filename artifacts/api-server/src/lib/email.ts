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

  // Multi-tenant B2B sending: every email goes out from a single verified
  // sender on our own domain, but the display name carries the business's
  // brand and Reply-To points back to that business's support inbox so
  // customer replies reach the right team.
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!fromAddress) {
    logger.warn("EMAIL_FROM_ADDRESS not configured — email not sent");
    return { success: false, error: "Email sender not configured" };
  }

  const escapedName = params.businessName.replace(/["\\]/g, " ").trim() || "Olyxee";
  const from = `${escapedName} <${fromAddress}>`;
  const replyTo = params.supportEmail && /.+@.+\..+/.test(params.supportEmail)
    ? params.supportEmail
    : undefined;

  try {
    const result = await resend.emails.send({
      from,
      to: [params.customerEmail],
      subject,
      text: body,
      ...(replyTo ? { replyTo } : {}),
    });

    if (result.error) {
      console.error("[email] resend error:", result.error);
      logger.error({ error: result.error }, "Failed to send email via Resend");
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const e = err as { message?: string; name?: string };
    console.error("[email] exception:", e?.name, e?.message);
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
