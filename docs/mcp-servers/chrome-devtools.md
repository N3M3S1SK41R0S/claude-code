# Chrome DevTools MCP Server

The [Chrome DevTools MCP server](https://github.com/ChromeDevTools/chrome-devtools-mcp) allows Claude Code to control and inspect a live Chrome browser. This enables powerful capabilities like browser automation, debugging, performance analysis, and network inspection directly from your Claude Code sessions.

## Requirements

- Node.js v20.19 or newer (LTS version)
- Chrome stable version or newer

## Quick Setup

Add the Chrome DevTools MCP server to Claude Code:

```bash
claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
```

Or add it manually to your MCP configuration:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

## Available Tools

The Chrome DevTools MCP server provides 26 tools across several categories:

### Input Automation
| Tool | Description |
|------|-------------|
| `click` | Click on page elements |
| `drag` | Perform drag operations |
| `fill` | Input text into form fields |
| `fill_form` | Complete multiple form fields at once |
| `handle_dialog` | Manage browser dialogs (alerts, confirms, prompts) |
| `hover` | Trigger hover states on elements |
| `press_key` | Simulate keyboard input |
| `upload_file` | Handle file upload inputs |

### Navigation
| Tool | Description |
|------|-------------|
| `navigate_page` | Navigate browser to URLs |
| `new_page` | Open new browser tabs |
| `close_page` | Close browser tabs |
| `list_pages` | List all open pages |
| `select_page` | Switch between pages |
| `wait_for` | Wait for page elements to appear |

### Performance Analysis
| Tool | Description |
|------|-------------|
| `performance_start_trace` | Begin recording a performance trace |
| `performance_stop_trace` | Stop recording and save trace |
| `performance_analyze_insight` | Extract actionable performance insights |

### Network Inspection
| Tool | Description |
|------|-------------|
| `list_network_requests` | View all network requests |
| `get_network_request` | Get details of a specific request |

### Debugging
| Tool | Description |
|------|-------------|
| `evaluate_script` | Execute JavaScript in the page context |
| `list_console_messages` | View console output and Issues panel |
| `get_console_message` | Retrieve specific console messages |
| `take_screenshot` | Capture the current page state |
| `take_snapshot` | Record DOM/accessibility tree structure |

### Emulation
| Tool | Description |
|------|-------------|
| `emulate` | Simulate devices and network conditions |
| `resize_page` | Adjust viewport dimensions |

## Configuration Options

### Headless Mode

Run Chrome without a visible UI:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--headless"]
    }
  }
}
```

### Custom Viewport

Set initial browser dimensions:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--viewport=1920x1080"]
    }
  }
}
```

### Isolated Profile

Use a temporary profile that's cleared after the browser closes:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
    }
  }
}
```

### Connect to Running Chrome

Connect to an existing Chrome instance with remote debugging enabled:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222"
      ]
    }
  }
}
```

Start Chrome with remote debugging:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir=%TEMP%\chrome-debug-profile
```

## Example Use Cases

### Performance Analysis

```
Analyze the performance of https://example.com and identify the top 3 bottlenecks
```

### Debugging

```
Navigate to my local dev server at http://localhost:3000, check for any console errors, and take a screenshot
```

### Automated Testing

```
Fill out the login form on https://example.com/login with test credentials and verify the redirect
```

### Network Inspection

```
List all API requests made when loading https://example.com and show me any that failed
```

### Accessibility Audit

```
Take an accessibility snapshot of https://example.com and identify any issues
```

## Troubleshooting

### Browser doesn't launch

Ensure Chrome is installed and accessible. You can specify a custom path:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--executable-path=/path/to/chrome"
      ]
    }
  }
}
```

### Connection issues

If connecting to a running instance fails, verify:
1. Chrome was started with `--remote-debugging-port=9222`
2. The port isn't blocked by a firewall
3. No other process is using the same port

### Tool timeouts

For long-running operations, you can adjust the MCP tool timeout:

```bash
MCP_TOOL_TIMEOUT=120000 claude
```

## Resources

- [GitHub Repository](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [npm Package](https://www.npmjs.com/package/chrome-devtools-mcp)
- [Chrome DevTools Blog](https://developer.chrome.com/blog/new-in-devtools-143/#mcp)
