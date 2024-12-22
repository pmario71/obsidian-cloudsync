import { ItemView, WorkspaceLeaf } from "obsidian";
import CloudSyncPlugin from "./main";

export const LOG_VIEW_TYPE = "cloud-sync-log-view";

export class LogView extends ItemView {
    private readonly logContainer: HTMLElement;
    private readonly plugin: CloudSyncPlugin;
    private readonly lastProgressLines: Map<string, HTMLElement> = new Map();
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

        const headerContainer = container.createDiv('cloud-sync-header');

        const clearButton = headerContainer.createEl('button', {
            text: 'Clear Log',
            cls: 'cloud-sync-clear-button'
        });
        clearButton.addEventListener('click', () => this.clear());

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

        if (message.includes('changes:')) {
            this.currentSyncId++;
            this.lastProgressLines.clear();
        }

        if (update && message.includes('/')) {
            const emojiKey = message.split(' ')[0];
            const progressKey = `${this.currentSyncId}-${emojiKey}`;
            const lastProgressLine = this.lastProgressLines.get(progressKey);
            if (lastProgressLine) {
                const content = lastProgressLine.querySelector('.cloud-sync-log-content');
                if (content) {
                    content.textContent = message;
                    return;
                }
            }
        }

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

        if (message.includes('/')) {
            const emojiKey = message.split(' ')[0];
            const progressKey = `${this.currentSyncId}-${emojiKey}`;
            this.lastProgressLines.set(progressKey, entry);
        }

        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    clear(): void {
        this.logContainer.empty();
        this.lastProgressLines.clear();
        this.currentSyncId = 0;
    }
}
