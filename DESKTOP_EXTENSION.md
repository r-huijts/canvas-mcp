# Canvas MCP Desktop Extension

This guide explains how to package the Canvas MCP server as a Claude Desktop Extension (.dxt file) for easy one-click installation.

## 🎯 Benefits of Desktop Extension

- **No Node.js required**: Users don't need to install Node.js or manage dependencies
- **One-click install**: Simply drag and drop the .dxt file into Claude Desktop
- **Secure config**: API tokens stored securely in OS keychain
- **Auto-updates**: Extensions can update automatically
- **User-friendly setup**: GUI for configuration instead of editing JSON files

## 🔧 Building the Extension

### Prerequisites

1. Install the DXT toolchain:
```bash
npm install -g @anthropic-ai/dxt
```

2. Build the TypeScript project:
```bash
npm run build
```

### Package the Extension

1. **Build and package in one command:**
```bash
npm run build-extension
```

2. **Or step by step:**
```bash
# Compile TypeScript to JavaScript
npm run build

# Package as .dxt file
npx @anthropic-ai/dxt pack
```

This will create a `canvas-mcp.dxt` file that can be installed in Claude Desktop.

## 📁 Extension Structure

The packaged extension contains:

```
canvas-mcp.dxt (ZIP archive)
├── manifest.json          # Extension metadata and configuration
├── dist/                  # Compiled JavaScript from TypeScript
│   ├── index.js          # Main entry point
│   ├── canvasClient.js   # Canvas API client
│   ├── anonymizer.js     # Data anonymization utilities
│   └── tools/            # All Canvas tools
├── node_modules/         # Bundled dependencies
├── package.json          # NPM package definition
└── icon.png             # Extension icon (optional)
```

## 🔑 User Configuration

When users install the extension, they'll be prompted to configure:

### Canvas API Token
- **What**: Personal access token from Canvas
- **How to get**: Canvas → Account → Settings → Approved Integrations → New Access Token
- **Security**: Stored securely in OS keychain, never exposed

### Canvas Base URL  
- **What**: Your institution's Canvas URL
- **Examples**: 
  - `https://yourschool.instructure.com`
  - `https://fhict.instructure.com` (default)
  - `https://canvas.university.edu`

## 🚀 Installation for End Users

1. **Download** the `canvas-mcp.dxt` file
2. **Open** Claude Desktop settings
3. **Drag & drop** the .dxt file into the Extensions section
4. **Configure** your Canvas API token and base URL
5. **Start using** Canvas tools immediately!

## 🛠️ Development and Testing

### Local Testing
1. Build the extension: `npm run build-extension`
2. Install locally in Claude Desktop by dragging the .dxt file
3. Test all tools and configurations

### Validation
The DXT toolchain automatically validates:
- Manifest syntax and required fields
- Server entry point exists
- Dependencies are bundled correctly

### Debugging
- Check Claude Desktop logs for MCP server errors
- Verify API token and base URL are correct
- Ensure Canvas instance is accessible

## 📋 Tool Categories

The extension provides these Canvas capabilities:

### 🎓 **Course Management**
- `list-courses` - View available courses
- `post-announcement` - Create course announcements

### 📝 **Assignments**  
- `list-assignments` - View with submission status
- `create-assignment` - Create new assignments
- `update-assignment` - Modify existing assignments
- `grade-submission` - Grade student work

### 👥 **Students & Sections**
- `list-students` - Course enrollment (privacy-aware)
- `list-sections` - Course sections
- `list-assignment-submissions` - Track submissions

### 📄 **Pages & Content**
- `generate-styleguide` - 🎨 Create formatting standards
- `update-page-content` - Create/edit pages with style compliance
- `patch-page-content` - Smart editing with natural language

### 📊 **Analytics & Rubrics**
- `get-rubric-statistics` - Comprehensive rubric analysis
- `analyze-rubric-statistics` - Prompt for statistical insights

### 🗂️ **Organization**
- `list-modules` - Course module management
- `list-assignment-groups` - Assignment grouping

## 🔒 Privacy & Security

- **Student anonymization**: All student data can be anonymized by default
- **Secure storage**: API tokens stored in OS keychain
- **Local processing**: No data sent to third parties
- **Network access**: Only connects to specified Canvas instance

## 📤 Publishing

To submit to the official Claude Desktop Extension directory:

1. Ensure extension follows [submission guidelines](https://claude.ai/extension-guidelines)
2. Test across Windows and macOS
3. Submit through the [extension submission form](https://claude.ai/submit-extension)
4. Wait for review and approval

## 🆘 Troubleshooting

### Common Issues

**"Failed to connect to Canvas"**
- Verify base URL is correct and accessible
- Check API token is valid and has necessary permissions
- Ensure network connectivity

**"Tools not appearing"**
- Verify extension is enabled in Claude Desktop
- Check manifest.json syntax
- Restart Claude Desktop

**"Permission denied"**
- API token may lack required Canvas permissions
- Check Canvas admin settings for API access

### Getting Help

- Check the [issues page](https://github.com/your-org/canvas-mcp/issues)
- Review Canvas API documentation
- Contact support via the repository

---

*This extension transforms Canvas LMS management into a conversational AI experience, making course administration more intuitive and efficient.* 🎓✨ 