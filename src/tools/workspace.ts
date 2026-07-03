import type { PrismaClient } from "@prisma/client";
import { formatResponse, formatError, type ToolResponse } from "./helpers.js";

export async function handleGetWorkspaceStatus(
  _args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const memberships = await prisma.accountMember.findMany({
    where: { userId },
    include: {
      Account: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          _count: { select: { Project: true } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return formatResponse({
      setup: false,
      message:
        "No organizations found. Create one with 'create_organization' first.",
    });
  }

  return formatResponse({
    setup: true,
    organizations: memberships.map((m) => ({
      id: m.Account.id,
      name: m.Account.name,
      slug: m.Account.slug,
      plan: m.Account.plan,
      role: m.role,
      projectCount: m.Account._count.Project,
    })),
  });
}

export async function handleGetProjectContext(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const projectId = args.projectId as string;
  if (!projectId) return formatError("projectId is required");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      projectType: true,
      settings: true,
      gitRemote: true,
      gitBranch: true,
      createdAt: true,
      accountId: true,
      _count: {
        select: {
          Ticket: true,
          ProjectMember: true,
          Sprint: true,
        },
      },
    },
  });

  if (!project) return formatError("Project not found");

  const membership = await prisma.accountMember.findUnique({
    where: {
      accountId_userId: { accountId: project.accountId, userId },
    },
  });
  if (!membership) return formatError("Access denied");

  const openTickets = await prisma.ticket.count({
    where: { projectId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });

  return formatResponse({
    ...project,
    openTicketCount: openTickets,
    totalTicketCount: project._count.Ticket,
    memberCount: project._count.ProjectMember,
    sprintCount: project._count.Sprint,
  });
}

export async function handleCreateOrganization(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const name = args.name as string;
  if (!name) return formatError("name is required");

  const slug =
    (args.slug as string) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const existing = await prisma.account.findFirst({
    where: { slug },
  });
  if (existing) return formatError(`Organization with slug "${slug}" already exists`);

  const account = await prisma.account.create({
    data: {
      name,
      slug,
      description: (args.description as string) || null,
      plan: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    select: { id: true, name: true, slug: true },
  });

  await prisma.accountMember.create({
    data: {
      accountId: account.id,
      userId,
      role: "OWNER",
      joinedAt: new Date(),
    },
  });

  return formatResponse({ created: true, organization: account });
}

export async function handleCreateProject(
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const name = args.name as string;
  if (!name) return formatError("name is required");

  let accountId = args.organizationId as string | undefined;

  if (!accountId) {
    const membership = await prisma.accountMember.findFirst({
      where: { userId },
      select: { accountId: true },
    });
    if (!membership) {
      return formatError(
        "No organization found. Create one first or provide organizationId."
      );
    }
    accountId = membership.accountId;
  }

  const key =
    (args.key as string) ||
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5);

  const project = await prisma.project.create({
    data: {
      name,
      accountId,
      ownerId: userId,
      key,
      description: (args.description as string) || null,
      projectType: (args.projectType as string) || "software",
      updatedAt: new Date(),
    },
    select: { id: true, name: true, key: true, accountId: true },
  });

  return formatResponse({ created: true, project });
}
