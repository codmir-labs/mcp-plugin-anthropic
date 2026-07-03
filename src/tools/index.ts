import type { PrismaClient } from "@prisma/client";
import { CONNECTOR_TOOLS, type ToolDefinition } from "./definitions.js";
import { formatError, type ToolResponse } from "./helpers.js";
import {
  handleGetWorkspaceStatus,
  handleGetProjectContext,
  handleCreateOrganization,
  handleCreateProject,
} from "./workspace.js";
import {
  handleListTodo,
  handleGetTicket,
  handleCreateTicket,
  handleUpdateTicket,
  handleSearchTickets,
  handleAddComment,
  handleUpdateTodoStatus,
} from "./tickets.js";
import {
  handleStoreConversation,
  handleExecuteTask,
  handleCheckTaskStatus,
} from "./tasks.js";

export { CONNECTOR_TOOLS };
export type { ToolDefinition };

type ToolHandler = (
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
) => Promise<ToolResponse>;

const handlers: Record<string, ToolHandler> = {
  get_workspace_status: handleGetWorkspaceStatus,
  get_project_context: handleGetProjectContext,
  create_organization: handleCreateOrganization,
  create_project: handleCreateProject,
  list_todo: handleListTodo,
  get_ticket: handleGetTicket,
  create_ticket: handleCreateTicket,
  update_ticket: handleUpdateTicket,
  search_tickets: handleSearchTickets,
  add_comment: handleAddComment,
  update_todo_status: handleUpdateTodoStatus,
  store_conversation: handleStoreConversation,
  execute_task: handleExecuteTask,
  check_task_status: handleCheckTaskStatus,
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  prisma: PrismaClient
): Promise<ToolResponse> {
  const handler = handlers[name];
  if (!handler) {
    return formatError(`Unknown tool: ${name}`);
  }

  try {
    return await handler(args, userId, prisma);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return formatError(message);
  }
}
