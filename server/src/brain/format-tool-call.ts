export function formatToolCall(toolName: string, toolArgs: string): string {
  try {
    const args = JSON.parse(toolArgs);
    switch (toolName) {
      case "list_files":
        if (args.search) return `🔧 Searching files for "${args.search}"`;
        return `🔧 Listing files in ${args.directory || "/"}`;
      case "open_file": {
        const filename = (args.path || "").split("/").pop() || args.path;
        return `🔧 Opening ${filename}`;
      }
      case "check_calendar":
        return `🔧 Checking calendar${args.date ? ` for ${args.date}` : ""}`;
      case "create_event":
        return `🔧 Creating event: "${args.title || "Untitled"}"`;
      case "send_email":
        return `🔧 Sending email to ${args.to || "recipient"}`;
      case "browse_url":
        return `🔧 Browsing ${args.url || "page"}`;
      case "read_page":
        return "🔧 Reading page";
      case "click":
        return `🔧 Clicking "${args.text || args.selector || "element"}"`;
      case "type":
        return `🔧 Typing text`;
    }
  } catch {
    // JSON parse failed — fall through
  }
  return `🔧 ${toolName}(${toolArgs})`;
}
