import { randomUUID } from "node:crypto";
import { prisma } from "../../../lib/prisma.ts";
import { resend } from "../../../lib/resend.ts";
import { env } from "../../../config/env.ts";
import { Prisma } from "../../../generated/prisma/client.ts";

const POLL_INTERVAL_MS = 10_000;
const BATCH_SIZE = 50;

type ClaimedRow = {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  content: string;
  metadata: Prisma.JsonValue | null;
};

type DeliveryResult = {
  provider: string;
  providerMessageId: string | null;
  response: Prisma.InputJsonValue;
};

let intervalId: NodeJS.Timeout | null = null;
let running = false;

const deliverEmail = async (notification: ClaimedRow): Promise<DeliveryResult> => {
  const from = env.RESEND_FROM ?? env.SMTP_FROM;

  if (!from) {
    throw new Error("No sender address configured (RESEND_FROM/SMTP_FROM)");
  }

  if (!notification.recipient) {
    throw new Error("Missing recipient for email notification");
  }

  const { data, error } = await resend.emails.send({
    from,
    to: notification.recipient,
    subject: notification.subject ?? "Notification",
    html: `<p>${notification.content}</p>`,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Resend returned no message id");
  }

  return {
    provider: "resend",
    providerMessageId: data.id,
    response: { status: "sent", resendId: data.id, sentAt: new Date().toISOString() },
  };
};

const simulateSend = async (notification: ClaimedRow): Promise<DeliveryResult> => {
  const provider = `simulated-${notification.channel.toLowerCase()}`;
  const providerMessageId = randomUUID();

  return {
    provider,
    providerMessageId,
    response: { status: "sent", simulatedAt: new Date().toISOString() },
  };
};

export const processPendingNotifications = async (): Promise<number> => {
  const candidates = await prisma.notification.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  if (candidates.length === 0) return 0;

  const ids = candidates.map((candidate) => candidate.id);

  const claimedRows = await prisma.$queryRaw<ClaimedRow[]>(Prisma.sql`
    UPDATE "Notification"
    SET status = 'PROCESSING', "updatedAt" = now()
    WHERE id IN (${Prisma.join(ids)})
      AND status = 'PENDING'
    RETURNING id, channel, recipient, subject, content, metadata
  `);

  for (const notification of claimedRows) {
    let succeeded = false;
    let delivery: DeliveryResult;

    try {
      delivery =
        notification.channel === "EMAIL"
          ? await deliverEmail(notification)
          : await simulateSend(notification);
      succeeded = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[notification-worker] failed to deliver ${notification.id} (${notification.channel}):`,
        message
      );
      delivery = {
        provider: notification.channel === "EMAIL" ? "resend" : `simulated-${notification.channel.toLowerCase()}`,
        providerMessageId: null,
        response: { status: "failed", error: message, failedAt: new Date().toISOString() },
      };
    }

    try {
      await prisma.notificationLog.create({
        data: {
          notificationId: notification.id,
          provider: delivery.provider,
          providerMessageId: delivery.providerMessageId,
          response: delivery.response,
        },
      });

      await prisma.notification.updateMany({
        where: { id: notification.id, status: "PROCESSING" },
        data: succeeded
          ? { status: "SENT", sentAt: new Date() }
          : { status: "FAILED" },
      });
    } catch (error) {
      console.error(
        `[notification-worker] db write failed for ${notification.id}:`,
        error
      );
    }
  }

  return claimedRows.length;
};

export const startNotificationWorker = (options?: { intervalMs?: number }) => {
  if (running) return;
  running = true;

  const intervalMs = options?.intervalMs ?? POLL_INTERVAL_MS;

  const cycle = async () => {
    try {
      const processed = await processPendingNotifications();
      if (processed > 0) {
        console.log(
          `[notification-worker] processed ${processed} notification(s)`
        );
      }
    } catch (error) {
      console.error("[notification-worker] poll cycle failed:", error);
    }
  };

  void cycle();
  intervalId = setInterval(() => void cycle(), intervalMs);
  intervalId.unref?.();

  console.log(
    `[notification-worker] started (poll interval ${intervalMs}ms)`
  );
};

export const stopNotificationWorker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  running = false;
  console.log("[notification-worker] stopped");
};
