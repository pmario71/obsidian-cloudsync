⚠️ **IMPORTANT NOTICE**: CloudSync is currently in beta and is not yet published in the official Obsidian Community Plugins directory. Please be aware that you may encounter bugs or issues while using this beta version.

There are two methods to install the CloudSync plugin for Obsidian:

## Using BRAT (Recommended) - Beta Reviewers Auto-update Tester

Brat (Beta Reviewers Auto-update Tester) is a utility that simplifies installation of plugins that are not yet published in community directory.

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
   - Open Obsidian Settings
   - Go to Community Plugins
   - Click "Browse" and search for "BRAT"
   - Click "Install" on BRAT
   - Enable the plugin

2. Add **CloudSync** Beta plugin using BRAT
   - Open BRAT settings
   - Click "Add Beta Plugin"
   - Enter `mihakralj/obsidian-cloudsync`
   - Click "Add Plugin"

3. Enable CloudSync
   - Go back to Community Plugins in Settings
   - Find CloudSync in the list
   - Enable the plugin

BRAT will automatically keep your plugin updated with the latest releases.

## Manual Installation

If you prefer to install the plugin manually:

1. Download the latest release
   - Go to the [Releases page](https://github.com/mihakralj/obsidian-cloudsync/releases)
   - Download these files from the latest release:
     - `main.js`
     - `manifest.json`
     - `styles.css`

2. Locate your Obsidian plugins directory for the chosen Vault
   - Open "Manage Vaults" in a drop-down menu when you click on the vault name in the bottom left corner
   - Click on three dots next to the vault you want to select
   - Select "**Reveal Vault in Finder**" (MacOs) or "**Reveal Vault in System Explorer**" (Windows)
   - Navigate to `.obsidian/plugins`

1. Create plugin directory
   - Create a new directory focalled `cloudsync`
   - Copy the downloaded files into this directory

2. Enable the plugin
   - Reload Plugins in Settings - Community Plugins (or restart Obsidian)
   - Open Settings > Community Plugins
   - Enable CloudSync in the list

Note: Manual installation requires you to repeat these steps for each update of plugin. Using BRAT is recommended for easier updates.
