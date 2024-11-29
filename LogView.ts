import { ItemView, WorkspaceLeaf } from "obsidian";
import CloudSyncPlugin from "./main";

export const LOG_VIEW_TYPE = "cloud-sync-log-view";

export class LogView extends ItemView {
    private logContainer: HTMLElement;
    private plugin: CloudSyncPlugin;
    private progressLines: Map<string, HTMLElement> = new Map();

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

    addLogEntry(message: string, type: 'info' | 'error' | 'trace' | 'success' | 'debug' | 'delimiter' = 'info', update = false): void {
        if (type === 'delimiter') {
            const delimiter = document.createElement('div');
            delimiter.classList.add('cloud-sync-log-delimiter');
            this.logContainer.appendChild(delimiter);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
            return;
        }

        // Handle progress updates
        if (update && message.startsWith('Sync progress')) {
            const progressKey = message.split(' - ')[1].split(' ').slice(1).join(' '); // Extract "local to remote" or similar
            const existingLine = this.progressLines.get(progressKey);
            if (existingLine) {
                const content = existingLine.querySelector('.cloud-sync-log-content');
                if (content) {
                    content.textContent = message;
                    return;
                }
            }
        }

        // Create new log entry
        const entry = document.createElement('div');
        entry.classList.add('cloud-sync-log-entry', `cloud-sync-log-${type}`);
        entry.setAttribute('data-allow-select', 'true');
        entry.contentEditable = 'false';

        const typeIndicator = document.createElement('span');
        typeIndicator.classList.add('cloud-sync-log-type');
        typeIndicator.textContent = type.toUpperCase();
        typeIndicator.setAttribute('data-allow-select', 'true');

        const content = document.createElement('span');
        content.classList.add('cloud-sync-log-content');
        content.textContent = message;
        content.setAttribute('data-allow-select', 'true');

        entry.appendChild(typeIndicator);
        entry.appendChild(content);
        this.logContainer.appendChild(entry);

        // Store progress line reference if this is a progress message
        if (message.startsWith('Sync progress')) {
            const progressKey = message.split(' - ')[1].split(' ').slice(1).join(' '); // Extract "local to remote" or similar
            this.progressLines.set(progressKey, entry);
        }

        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    clear(): void {
        this.logContainer.empty();
        this.progressLines.clear();
    }
}
