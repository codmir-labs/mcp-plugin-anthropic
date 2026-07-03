export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const CONNECTOR_TOOLS: ToolDefinition[] = [
  {
    name: "get_workspace_status",
    description:
      "Check the user's Codmir workspace — organizations, projects, and setup status. Call this first to orient yourself.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_project_context",
    description:
      "Get a project overview: tech stack, open ticket count, team size, recent activity. Use to understand what the user is working on.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_organization",
    description:
      "Create a new organization/workspace. Required before creating projects.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Organization name",
        },
        description: {
          type: "string",
          description: "Optional description",
        },
        slug: {
          type: "string",
          description:
            "URL-friendly identifier (auto-generated from name if omitted)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create_project",
    description:
      "Create a new project within an organization. Required before creating tickets.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Project name",
        },
        organizationId: {
          type: "string",
          description: "Organization ID (uses default org if omitted)",
        },
        description: {
          type: "string",
          description: "Optional description",
        },
        key: {
          type: "string",
          description:
            "Short project key for ticket prefixes like PROJ-42 (auto-generated if omitted)",
        },
        projectType: {
          type: "string",
          enum: ["software", "marketing", "operations", "design", "other"],
          description: "Type of project",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_todo",
    description:
      "Get the to-do list for a project — actionable tickets sorted by priority. The quickest way to see what needs attention.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        status: {
          type: "string",
          enum: ["all", "open", "in_progress", "review"],
          description: "Filter by status (default: all actionable)",
        },
        priority: {
          type: "string",
          enum: ["all", "critical", "high", "medium", "low"],
          description: "Filter by priority (default: all)",
        },
        limit: {
          type: "number",
          description: "Max items to return (default: 50)",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_ticket",
    description:
      "Get full ticket details including comments, assignee, labels, and history. Use when the user asks about a specific work item.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: 'Ticket ID or key (e.g. "PROJ-42")',
        },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "create_ticket",
    description:
      "Create a new ticket in Codmir. Use to capture bugs, features, or tasks that come up in conversation.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        title: {
          type: "string",
          description: "Ticket title",
        },
        description: {
          type: "string",
          description: "Detailed description (markdown supported)",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          description: "Ticket priority (default: MEDIUM)",
        },
        type: {
          type: "string",
          enum: ["BUG", "FEATURE", "TASK", "IMPROVEMENT"],
          description: "Ticket type (default: TASK)",
        },
      },
      required: ["projectId", "title"],
    },
  },
  {
    name: "update_ticket",
    description:
      "Update a ticket's fields — title, description, priority, type, status, assignee, or due date.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "The ticket ID to update",
        },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        },
        type: {
          type: "string",
          enum: ["BUG", "FEATURE", "TASK", "IMPROVEMENT", "STORY", "EPIC"],
        },
        status: {
          type: "string",
          enum: ["OPEN", "IN_PROGRESS", "REVIEW", "DONE", "CLOSED"],
        },
        assigneeId: {
          type: "string",
          description: 'User ID to assign (or "unassign" to remove)',
        },
        dueDate: { type: "string", description: "Due date (ISO 8601)" },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "search_tickets",
    description:
      "Search tickets by keyword across title and description. Use when you know what you're looking for but not the exact ticket.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        query: {
          type: "string",
          description: "Search query",
        },
        status: {
          type: "string",
          enum: ["all", "open", "in_progress", "done", "canceled"],
          description: "Filter by status (default: all)",
        },
        limit: {
          type: "number",
          description: "Max results (default: 20)",
        },
      },
      required: ["projectId", "query"],
    },
  },
  {
    name: "add_comment",
    description:
      "Add a comment to a ticket. Use to log progress, decisions, blockers, or context. Comments persist across sessions.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "The ticket ID",
        },
        content: {
          type: "string",
          description: "Comment text (markdown supported)",
        },
      },
      required: ["ticketId", "content"],
    },
  },
  {
    name: "update_todo_status",
    description:
      "Quick-update a ticket's status. Use to mark items done, in progress, or reopen them.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "The ticket ID",
        },
        status: {
          type: "string",
          enum: ["open", "in_progress", "review", "done", "closed"],
          description: "New status",
        },
      },
      required: ["ticketId", "status"],
    },
  },
  {
    name: "store_conversation",
    description:
      "Save this conversation as project documentation. Use to preserve important context, solutions, or decisions for the team.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        title: {
          type: "string",
          description: "Title for the saved context",
        },
        summary: {
          type: "string",
          description: "Summary of the conversation",
        },
        content: {
          type: "string",
          description: "Full content to save",
        },
        ticketId: {
          type: "string",
          description: "Optional ticket to link to",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization",
        },
      },
      required: ["projectId", "title", "summary"],
    },
  },
  {
    name: "execute_task",
    description:
      "Dispatch an AI-powered task to a Codmir agent — bug fix, feature, refactor. The task is queued and executed on the user's workstation.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        instructions: {
          type: "string",
          description: "What the AI agent should do",
        },
        ticketId: {
          type: "string",
          description: "Optional ticket to link this task to",
        },
      },
      required: ["projectId", "instructions"],
    },
  },
  {
    name: "check_task_status",
    description: "Check the status of a running agent task execution.",
    inputSchema: {
      type: "object",
      properties: {
        executionId: {
          type: "string",
          description: "The execution ID returned when the task was started",
        },
      },
      required: ["executionId"],
    },
  },
];
