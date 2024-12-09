import { ItemView, WorkspaceLeaf } from "obsidian";
import CloudSyncPlugin from "./main";

export const LOG_VIEW_TYPE = "cloud-sync-log-view";

export class LogView extends ItemView {
    private logContainer: HTMLElement;
    private plugin: CloudSyncPlugin;
    private lastProgressLines: Map<string, HTMLElement> = new Map();
    private currentSyncId: number = 0;

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
        return "CloudSync Logs";
    }

    getIcon(): string {
        return "lines-of-text";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.classList.add('cloud-sync-view-container');

        // Create header container
        const headerContainer = container.createDiv('cloud-sync-header');

        // Create clear button in header
        const clearButton = headerContainer.createEl('button', {
            text: 'Clear Log',
            cls: 'cloud-sync-clear-button'
        });
        clearButton.addEventListener('click', () => this.clear());

        // Create content container for logs
        const contentContainer = container.createDiv('cloud-sync-content');
        contentContainer.appendChild(this.logContainer);
    }

    addLogEntry(message: string, type: 'info' | 'error' | 'trace' | 'success' | 'debug' | 'delimiter' = 'info', update = false): void {
        if (type === 'delimiter') {
            const delimiter = document.createElement('div');
            delimiter.classList.add('cloud-sync-log-delimiter');
            this.logContainer.appendChild(delimiter);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
            return;
        }

        // Check for new sync operation
        if (message.includes('Found') && message.includes('files')) {
            this.currentSyncId++;
            this.lastProgressLines.clear(); // Clear progress tracking for new sync
        }

        // Handle progress updates
        if (update && message.startsWith('Sync progress')) {
            const progressType = message.split(' - ')[1].split(' ').slice(1).join(' '); // Extract "local to remote" or similar
            const progressKey = `${this.currentSyncId}-${progressType}`; // Include sync ID in the key
            const lastProgressLine = this.lastProgressLines.get(progressKey);
            if (lastProgressLine) {
                const content = lastProgressLine.querySelector('.cloud-sync-log-content');
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
            const progressType = message.split(' - ')[1].split(' ').slice(1).join(' '); // Extract "local to remote" or similar
            const progressKey = `${this.currentSyncId}-${progressType}`; // Include sync ID in the key
            this.lastProgressLines.set(progressKey, entry);
        }

        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    clear(): void {
        this.logContainer.empty();
        this.lastProgressLines.clear();
        this.currentSyncId = 0;
    }
}
