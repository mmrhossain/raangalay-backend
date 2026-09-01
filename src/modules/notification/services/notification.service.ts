import { prisma } from "../../../lib/prisma.ts";
import { AppError } from "../../../common/errors/AppError.ts";

export type TemplateVariables = Record<
  string,
  string | number | boolean | null | undefined
>;

const render = (template: string, data: TemplateVariables): string =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = data[key];
    return value === null || value === undefined ? "" : String(value);
  });

const recipientFor = (channel: string, user: { email: string }): string => {
  if (channel === "EMAIL") return user.email;
  return user.email;
};

export const createNotification = async (
  userId: string,
  templateCode: string,
  data: TemplateVariables = {}
) => {
  const template = await prisma.notificationTemplate.findUnique({
    where: { code: templateCode },
  });

  if (!template) {
    throw new AppError(
      `Notification template '${templateCode}' not found`,
      404
    );
  }

  if (!template.isActive) {
    throw new AppError(
      `Notification template '${templateCode}' is inactive`,
      400
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);

  return prisma.notification.create({
    data: {
      userId,
      templateId: template.id,
      channel: template.channel,
      recipient: recipientFor(template.channel, user),
      subject: template.subject ? render(template.subject, data) : null,
      content: render(template.content, data),
      metadata: { templateCode, variables: data },
      status: "PENDING",
    },
    select: {
      id: true,
      status: true,
      channel: true,
      recipient: true,
      createdAt: true,
    },
  });
};
