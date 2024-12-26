# Installation Guide

⚠️ **IMPORTANT NOTICE**: CloudSync is currently in beta and is not yet published in the official Obsidian Community Plugins directory. Please be aware that you may encounter bugs or issues while using this beta version.

## Installation Methods

There are two ways to install CloudSync:
1. Using BRAT (recommended for automatic updates)
2. Manual installation (requires manual updates)

## Method 1: Using BRAT (Recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tester) simplifies installation and updates for beta plugins.

### 1. Install BRAT

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Click "Browse"
4. Search for "BRAT"
5. Click "Install"
6. Enable the BRAT plugin

### 2. Add CloudSync Using BRAT

1. Open BRAT settings
2. Click "Add Beta Plugin"
3. Enter repository: `mihakralj/obsidian-cloudsync`
4. Click "Add Plugin"

### 3. Enable CloudSync

1. Return to Community Plugins in Settings
2. Locate CloudSync in the plugin list
3. Enable the plugin
4. Configure cloud provider settings

**Benefits**: BRAT automatically keeps your plugin updated with the latest releases.

## Method 2: Manual Installation

### 1. Download Files

1. Visit the [Releases page](https://github.com/mihakralj/obsidian-cloudsync/releases)
2. Download the latest release files:
   - `main.js`
   - `manifest.json`
   - `styles.css`

### 2. Locate Plugins Directory

1. Open Obsidian
2. Click the vault name in bottom left corner
3. Select "Manage Vaults"
4. Click three dots (⋮) next to your vault
5. Select:
   - **Windows**: "Reveal Vault in System Explorer"
   - **macOS**: "Reveal Vault in Finder"
   - **Linux**: "Open Vault Location"
6. Navigate to `.obsidian/plugins`

### 3. Install Plugin Files

1. Create new directory named `cloudsync`
2. Copy downloaded files into this directory:
   ```
   .obsidian/plugins/cloudsync/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

### 4. Enable Plugin

1. Restart Obsidian (or reload plugins)
2. Open Settings → Community Plugins
3. Enable CloudSync
4. Configure cloud provider settings

**Note**: Manual installation requires repeating these steps for each update. We recommend using BRAT for easier maintenance.

## Next Steps

After installation:
1. Review the [cloud provider setup guides](architecture.md#cloud-provider-implementations)
2. Configure your chosen cloud provider
3. Set up automatic sync settings if desired

## Troubleshooting

If you encounter issues during installation:

1. **Plugin Not Appearing**
   - Verify files are in correct location
   - Restart Obsidian completely
   - Check console for errors (Settings → Developer Tools)

2. **Plugin Not Enabling**
   - Ensure all required files are present
   - Check file permissions
   - Verify Obsidian version compatibility

3. **BRAT Issues**
   - Ensure BRAT is properly installed
   - Check BRAT settings for correct repository
   - Try removing and re-adding CloudSync

For additional help:
- Check [GitHub Issues](https://github.com/mihakralj/obsidian-cloudsync/issues)
- Review error messages in Developer Tools
