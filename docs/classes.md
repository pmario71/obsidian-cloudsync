# Class Diagrams

## Core Components

### Main Plugin Structure

```mermaid
classDiagram
    CloudSyncMain -- LocalManager : uses
    CloudSyncMain -- AbstractManager : uses
    CloudSyncMain -- Synchronize : uses

    class CloudSyncMain {
        -localVault: LocalManager
        -remoteVaults: AbstractManager[]
        -settings: CloudSyncSettings
        -statusBar: HTMLElement
        -syncIcon: Element
        +updateSettings(settings: CloudSyncSettings)
        +setSyncIcon(icon: Element)
        +runCloudSync(): Promise~void~
        -validateProvider(provider: string): boolean
        -syncProvider(name: string, vaultName: string): Promise~void~
    }
```

### Synchronization Components

```mermaid
classDiagram
    Synchronize -- SyncAnalyzer : uses
    Synchronize -- SyncExecutor : uses
    Synchronize -- FileOperations : uses
    Synchronize -- CacheManager : uses

    class Synchronize {
        -fileOps: FileOperations
        -cache: CacheManager
        -analyzer: SyncAnalyzer
        -executor: SyncExecutor
        +syncActions(): Promise~Scenario[]~
        +runAllScenarios(scenarios: Scenario[]): Promise~void~
    }

    class SyncAnalyzer {
        -local: AbstractManager
        -remote: AbstractManager
        -cache: CacheManager
        +analyze(): Promise~Scenario[]~
    }

    class SyncExecutor {
        -local: AbstractManager
        -remote: AbstractManager
        -fileOps: FileOperations
        -cache: CacheManager
        +execute(scenarios: Scenario[]): Promise~void~
    }
```

### File and Cache Management

```mermaid
classDiagram
    FileOperations -- AbstractManager : uses
    CacheManager -- File : manages

    class FileOperations {
        -local: AbstractManager
        -remote: AbstractManager
        +copyToRemote(file: File): Promise~void~
        +copyToLocal(file: File): Promise~void~
        +deleteFromRemote(file: File): Promise~void~
        +deleteFromLocal(file: File): Promise~void~
    }

    class CacheManager {
        -cacheFilePath: string
        -app: App
        +getInstance(cacheFilePath: string, app: App): CacheManager
        +readCache(): Promise~void~
        +writeCache(files: File[]): Promise~void~
        +hasFile(fileName: string): boolean
        +getMd5(fileName: string): string
        +getTimestamp(fileName: string): Date
        +isFileUnchanged(fileName: string, md5: string, timestamp: Date): boolean
    }

    class File {
        +name: string
        +localName: string
        +remoteName: string
        +mime: string
        +lastModified: Date
        +size: number
        +md5: string
        +isDirectory: boolean
    }
```

### Sync Rules and Scenarios

```mermaid
classDiagram
    SyncAnalyzer --> Scenario : creates
    Scenario -- SyncRule : uses

    class Scenario {
        +local: File
        +remote: File
        +rule: SyncRule
    }

    class SyncRule {
        <<enumeration>>
        LOCAL_TO_REMOTE
        REMOTE_TO_LOCAL
        DIFF_MERGE
        DELETE_LOCAL
        DELETE_REMOTE
        TO_CACHE
    }
```

## Cloud Provider Architecture

```mermaid
classDiagram
    AbstractManager <|-- LocalManager : extends
    AbstractManager <|-- AWSManager : extends
    AbstractManager <|-- AzureManager : extends
    AbstractManager <|-- GCPManager : extends
    AbstractManager -- File : uses

    class AbstractManager {
        +name: string
        +files: File[]
        +lastScan: Date
        #settings: CloudSyncSettings
        +testConnectivity(): Promise~ConnectionResult~
        +authenticate(): Promise~void~
        +getFiles(): Promise~File[]~
        +readFile(file: File): Promise~Buffer~
        +writeFile(file: File, content: Buffer): Promise~void~
        +deleteFile(file: File): Promise~void~
        +scan(): Promise~void~
        +setLastScan(date: Date): void
        +getLastSync(): Date
    }

    class File {
        +name: string
        +localName: string
        +remoteName: string
        +mime: string
        +lastModified: Date
        +size: number
        +md5: string
        +isDirectory: boolean
    }
```

### Provider Implementations

```mermaid
classDiagram
    class LocalManager {
        +name: "Local"
        -basePath: string
        -vaultName: string
        -app: App
        -cache: CacheManager
        +getBasePath(): string
        +getApp(): App
        +getVaultName(): string
        -getIgnoreList(): string[]
    }

    class AWSManager {
        +name: "AWS"
        -bucket: string
        -region: string
        -accessKey: string
        -secretKey: string
        -endpoint: string
        -auth: AWSAuth
        -fileOps: AWSFiles
        -paths: AWSPathHandler
        -validateSettings(): void
        -initializeClient(): Promise~void~
    }

    class AzureManager {
        +name: "Azure"
        -containerName: string
        -paths: AzurePaths
        -auth: AzureAuth
        -fileOps: AzureFiles
        -validateSettings(): void
        -initializeClient(): Promise~void~
    }

    class GCPManager {
        +name: "GCP"
        -bucket: string
        -paths: GCPPathHandler
        -auth: GCPAuth
        -fileOps: GCPFiles
        -validateSettings(): void
        -initializeClient(): Promise~void~
        +startSyncSession(): Promise~void~
    }
```

The diagrams above illustrate the key components and relationships in the CloudSync plugin:

1. **Main Plugin Structure**: Shows the entry point and core plugin setup through CloudSyncMain.

2. **Synchronization Components**: Details the synchronization process through Synchronize, SyncAnalyzer, and SyncExecutor classes.

3. **File and Cache Management**: Shows how files are handled and cached in the system.

4. **Sync Rules and Scenarios**: Illustrates the decision-making process for file synchronization.

5. **Cloud Provider Architecture**: Shows the abstract manager and file interfaces.

6. **Provider Implementations**: Details how different cloud providers implement the abstract interfaces.

Key features of the architecture:
- Modular design with clear separation of concerns
- Extensible provider system through AbstractManager
- Robust file handling with caching support
- Flexible synchronization rules
- Error handling and logging throughout the system
