import type { PrismaClient } from "@prisma/client";
import {
  formatResponse,
  formatError,
  assertProjectAccess,
  type ToolResponse,
} from "./helpers.js";

export async function handleStoreConversation(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const projectId = args.projectId as string;
  const title = args.title as string;
  const summary = args.summary as string;
  if (!projectId) return formatError("projectId is required");
  if (!title) return formatError("title is required");
  if (!summary) return formatError("summary is required");

  const { accountId } = await assertProjectAccess(userId, projectId, prisma);

  const ticket = await prisma.$transaction(async (tx) => {
    const counter = await tx.projectTicketCounter.upsert({
      where: { projectId },
      update: { lastIndex: { increment: 1 } },
      create: { projectId, lastIndex: 1 },
    });

    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    const ticketNumber = counter.lastIndex;
    const key = project?.key ? `${project.key}-${ticketNumber}` : undefined;

    const created = await tx.ticket.create({
      data: {
        projectId,
        accountId,
        title: `[Context] ${title}`,
        description: `## Summary\n\n${summary}\n\n${(args.content as string) ? `## Details\n\n${args.content}` : ""}`,
        priority: "LOW",
        type: "TASK",
        status: "DONE",
        reporterId: userId,
        ticketNumber,
        key,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: { id: true, key: true, title: true },
    });

    if (args.ticketId) {
      await tx.comment.create({
        data: {
          ticketId: args.ticketId as string,
          authorId: userId,
          content: `Conversation context saved: ${created.key || created.id} — ${title}`,
          updatedAt: new Date(),
        },
      });
    }

    return created;
  });

  return formatResponse({ stored: true, ticket });
}

export async function handleExecuteTask(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const projectId = args.projectId as string;
  const instructions = args.instructions as string;
  if (!projectId) return formatError("projectId is required");
  if (!instructions) return formatError("instructions is required");

  const { accountId } = await assertProjectAccess(userId, projectId, prisma);

  const ticket = await prisma.$transaction(async (tx) => {
    const counter = await tx.projectTicketCounter.upsert({
      where: { projectId },
      update: { lastIndex: { increment: 1 } },
      create: { projectId, lastIndex: 1 },
    });

    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    const ticketNumber = counter.lastIndex;
    const key = project?.key ? `${project.key}-${ticketNumber}` : undefined;

    const created = await tx.ticket.create({
      data: {
        projectId,
        accountId,
        title: instructions.slice(0, 200),
        description: instructions,
        priority: "MEDIUM",
        type: "TASK",
        status: "OPEN",
        reporterId: userId,
        ticketNumber,
        key,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: { id: true, key: true, title: true, status: true },
    });

    if (args.ticketId) {
      await tx.comment.create({
        data: {
          ticketId: args.ticketId as string,
          authorId: userId,
          content: `Agent task dispatched: ${created.key || created.id}`,
          updatedAt: new Date(),
        },
      });
    }

    return created;
  });

  return formatResponse({
    dispatched: true,
    executionId: ticket.id,
    ticket,
    note: "Task queued. A Codmir agent will pick it up when a daemon instance is available.",
  });
}

export async function handleCheckTaskStatus(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const executionId = args.executionId as string;
  if (!executionId) return formatError("executionId is required");

  const ticket = await prisma.ticket.findUnique({
    where: { id: executionId },
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      priority: true,
      updatedAt: true,
      projectId: true,
      Comment: {
        select: {
          content: true,
          createdAt: true,
          User: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" as const },
        take: 5,
      },
    },
  });

  if (!ticket) return formatError("Task not found");
  await assertProjectAccess(userId, ticket.projectId, prisma);

  return formatResponse({
    executionId: ticket.id,
    key: ticket.key,
    title: ticket.title,
    status: ticket.status,
    lastUpdate: ticket.updatedAt,
    recentActivity: ticket.Comment.map((c) => ({
      author: c.User.name,
      content: c.content,
      at: c.createdAt,
    })),
  });
}
