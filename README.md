# Codmir MCP Connector for Claude.ai

Connect your Codmir workspace to Claude. Manage projects, tickets, and AI agent tasks directly from any Claude conversation.

## What it does

When you add this connector, Claude can:

- **See your workspace** — projects, organizations, team members
- **Manage tickets** — create, update, search, and comment on work items
- **Track progress** — view to-do lists, check statuses, mark items done
- **Dispatch AI tasks** — send work to a Codmir agent running on your workstation
- **Save context** — store conversation insights as project documentation

## Setup

1. Get your API token from Codmir (Settings → API Tokens)
2. Add this connector in Claude.ai (Settings → Connectors)
3. Paste your token when prompted

## Available tools

| Tool | Description |
|------|-------------|
| `get_workspace_status` | Check workspace setup and list organizations |
| `get_project_context` | Project overview with stats |
| `create_organization` | Create a new organization |
| `create_project` | Create a new project |
| `list_todo` | Get actionable tickets sorted by priority |
| `get_ticket` | Full ticket details with comments |
| `create_ticket` | Create bugs, features, or tasks |
| `update_ticket` | Update ticket fields |
| `search_tickets` | Search by keyword |
| `add_comment` | Add comments to tickets |
| `update_todo_status` | Quick status updates |
| `store_conversation` | Save conversation as documentation |
| `execute_task` | Dispatch work to a Codmir AI agent |
| `check_task_status` | Check agent task progress |

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Build
pnpm build

# Start production
pnpm start
```

## Environment

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3304) |
| `DATABASE_URL` | PostgreSQL connection string |

## License

Proprietary — Codmir Labs
