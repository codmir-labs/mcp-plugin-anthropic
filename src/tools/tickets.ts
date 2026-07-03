import type { PrismaClient } from "@prisma/client";
import {
  formatResponse,
  formatError,
  assertProjectAccess,
  type ToolResponse,
} from "./helpers.js";

export async function handleListTodo(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const projectId = args.projectId as string;
  if (!projectId) return formatError("projectId is required");
  await assertProjectAccess(userId, projectId, prisma);

  const statusFilter = args.status as string | undefined;
  const priorityFilter = args.priority as string | undefined;
  const limit = Math.min((args.limit as number) || 50, 100);

  const where: Record<string, unknown> = {
    projectId,
    archived: false,
  };

  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter.toUpperCase();
  } else {
    where.status = { in: ["OPEN", "IN_PROGRESS", "TODO"] };
  }

  if (priorityFilter && priorityFilter !== "all") {
    where.priority = priorityFilter.toUpperCase();
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      priority: true,
      type: true,
      assigneeId: true,
      due_date: true,
      User_Ticket_assigneeIdToUser: {
        select: { name: true, email: true },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  return formatResponse({
    count: tickets.length,
    items: tickets.map((t) => ({
      id: t.id,
      key: t.key,
      title: t.title,
      status: t.status,
      priority: t.priority,
      type: t.type,
      assignee: t.User_Ticket_assigneeIdToUser?.name || t.assigneeId,
      dueDate: t.due_date,
    })),
  });
}

export async function handleGetTicket(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const ticketId = args.ticketId as string;
  if (!ticketId) return formatError("ticketId is required");

  const where = ticketId.includes("-") ? { key: ticketId } : { id: ticketId };

  const ticket = await prisma.ticket.findFirst({
    where,
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      type: true,
      createdAt: true,
      updatedAt: true,
      due_date: true,
      estimatedMinutes: true,
      projectId: true,
      accountId: true,
      User_Ticket_assigneeIdToUser: {
        select: { id: true, name: true, email: true },
      },
      User_Ticket_reporterIdToUser: {
        select: { id: true, name: true, email: true },
      },
      Comment: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          User: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
      Label: {
        select: { id: true, name: true, color: true },
      },
    },
  });

  if (!ticket) return formatError("Ticket not found");
  await assertProjectAccess(userId, ticket.projectId, prisma);

  return formatResponse({
    ...ticket,
    assignee: ticket.User_Ticket_assigneeIdToUser,
    reporter: ticket.User_Ticket_reporterIdToUser,
    comments: ticket.Comment.map((c) => ({
      id: c.id,
      content: c.content,
      author: c.User.name,
      createdAt: c.createdAt,
    })),
    labels: ticket.Label,
  });
}

export async function handleCreateTicket(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const projectId = args.projectId as string;
  const title = args.title as string;
  if (!projectId) return formatError("projectId is required");
  if (!title) return formatError("title is required");

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

    return tx.ticket.create({
      data: {
        projectId,
        accountId,
        title,
        description: (args.description as string) || null,
        priority:
          (args.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") || "MEDIUM",
        type:
          (args.type as "BUG" | "FEATURE" | "TASK" | "IMPROVEMENT") || "TASK",
        status: "OPEN",
        reporterId: userId,
        ticketNumber,
        key,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: { id: true, key: true, title: true, status: true },
    });
  });

  return formatResponse({ created: true, ticket });
}

export async function handleUpdateTicket(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const ticketId = args.ticketId as string;
  if (!ticketId) return formatError("ticketId is required");

  const existing = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { projectId: true },
  });
  if (!existing) return formatError("Ticket not found");
  await assertProjectAccess(userId, existing.projectId, prisma);

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (args.title) data.title = args.title;
  if (args.description !== undefined) data.description = args.description;
  if (args.priority) data.priority = (args.priority as string).toUpperCase();
  if (args.type) data.type = (args.type as string).toUpperCase();
  if (args.status) data.status = (args.status as string).toUpperCase();
  if (args.assigneeId) {
    data.assigneeId =
      args.assigneeId === "unassign" ? null : args.assigneeId;
  }
  if (args.dueDate) data.due_date = new Date(args.dueDate as string);

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data,
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      priority: true,
    },
  });

  return formatResponse({ updated: true, ticket });
}

export async function handleSearchTickets(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const projectId = args.projectId as string;
  const query = args.query as string;
  if (!projectId) return formatError("projectId is required");
  if (!query) return formatError("query is required");
  await assertProjectAccess(userId, projectId, prisma);

  const limit = Math.min((args.limit as number) || 20, 50);
  const statusFilter = args.status as string | undefined;

  const where: Record<string, unknown> = {
    projectId,
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ],
  };

  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter.toUpperCase();
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      priority: true,
      type: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return formatResponse({ count: tickets.length, results: tickets });
}

export async function handleAddComment(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const ticketId = args.ticketId as string;
  const content = args.content as string;
  if (!ticketId) return formatError("ticketId is required");
  if (!content) return formatError("content is required");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { projectId: true },
  });
  if (!ticket) return formatError("Ticket not found");
  await assertProjectAccess(userId, ticket.projectId, prisma);

  const comment = await prisma.comment.create({
    data: {
      ticketId,
      authorId: userId,
      content,
      updatedAt: new Date(),
    },
    select: { id: true, content: true, createdAt: true },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { lastActivityAt: new Date(), updatedAt: new Date() },
  });

  return formatResponse({ created: true, comment });
}

export async function handleUpdateTodoStatus(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const ticketId = args.ticketId as string;
  const status = args.status as string;
  if (!ticketId) return formatError("ticketId is required");
  if (!status) return formatError("status is required");

  const existing = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { projectId: true },
  });
  if (!existing) return formatError("Ticket not found");
  await assertProjectAccess(userId, existing.projectId, prisma);

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: status.toUpperCase() as any,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    },
    select: { id: true, key: true, title: true, status: true },
  });

  return formatResponse({ updated: true, ticket });
}
