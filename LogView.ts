import { ItemView, WorkspaceLeaf } from "obsidian";
import CloudSyncPlugin from "./main";

export const LOG_VIEW_TYPE = "cloud-sync-log-view";

export class LogView extends ItemView {
    private logContainer: HTMLElement;
    private plugin: CloudSyncPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: CloudSyncPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.logContainer = document.createElement('div');
        this.logContainer.classList.add('cloud-sync-log-container');
        this.logContainer.setAttribute('data-allow-select', 'true');
        this.logContainer.contentEditable = 'false';
    }

    getViewType(): string {
        return LOG_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Cloud Sync Logs";
    }

    getIcon(): string {
        return "lines-of-text";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.appendChild(this.logContainer);
    }

    addLogEntry(message: string, type: 'info' | 'error' | 'trace' | 'success' | 'debug' = 'info'): void {
        const entry = document.createElement('div');
        entry.classList.add('cloud-sync-log-entry', `cloud-sync-log-${type}`);
        entry.setAttribute('data-allow-select', 'true');
        entry.contentEditable = 'false';

        const timestamp = document.createElement('span');
        timestamp.classList.add('cloud-sync-log-timestamp');
        timestamp.textContent = new Date().toLocaleTimeString();
        timestamp.setAttribute('data-allow-select', 'true');

        const typeIndicator = document.createElement('span');
        typeIndicator.classList.add('cloud-sync-log-type');
        typeIndicator.textContent = type.toUpperCase();
        typeIndicator.setAttribute('data-allow-select', 'true');

        const content = document.createElement('span');
        content.classList.add('cloud-sync-log-content');
        content.textContent = message;
        content.setAttribute('data-allow-select', 'true');

        entry.appendChild(timestamp);
        entry.appendChild(typeIndicator);
        entry.appendChild(content);
        this.logContainer.appendChild(entry);

        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    clear(): void {
        this.logContainer.empty();
    }
}
