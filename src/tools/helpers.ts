import type { PrismaClient } from "@prisma/client";

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function formatResponse(data: unknown): ToolResponse {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function formatError(message: string): ToolResponse {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export async function assertProjectAccess(
  userId: string,
  projectId: string,
  prisma: PrismaClient
): Promise<{ accountId: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { accountId: true },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await prisma.accountMember.findUnique({
    where: {
      accountId_userId: {
        accountId: project.accountId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error(
      "Access denied: not a member of this project's organization"
    );
  }

  return { accountId: project.accountId };
}
