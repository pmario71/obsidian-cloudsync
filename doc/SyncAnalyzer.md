# Sync Class Diagram

```mermaid
classDiagram
    SyncAnalyzer -- AbstractManager : uses
    SyncAnalyzer -- CacheManager : uses
    SyncAnalyzer -- File : uses
    SyncAnalyzer --> Scenario : creates
    Scenario --> SyncRule : uses
    CloudSyncMain -- LocalManager : uses
    CloudSyncMain -- AbstractManager : uses
    CloudSyncMain -- CacheManager : uses
    SyncExecutor -- FileOperations : uses
    Synchronize -- SyncAnalyzer : uses
    Synchronize -- SyncExecutor : uses

    class SyncAnalyzer {
        -localFiles: File[]
        -remoteFiles: File[]
        -local: AbstractManager
        -remote: AbstractManager
        -cache: CacheManager
        +SyncAnalyzer(local: AbstractManager, remote: AbstractManager, cache: CacheManager)
        +analyze(): Promise<Scenario[]>
        -analyzeLocalFiles(scenarios: Scenario[]): void
        -analyzeRemoteFiles(scenarios: Scenario[]): void
        -handleMissingRemoteFile(localFile: File, scenarios: Scenario[]): void
        -handleMissingLocalFile(remoteFile: File, scenarios: Scenario[]): void
        -handleFileDifference(localFile: File, remoteFile: File, scenarios: Scenario[]): void
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
        +getLastSync(): Date
        +updateLastSync(): void
    }

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

    class CloudSyncMain {
        -settings: CloudSyncSettings
        -local: LocalManager
        -remote: AbstractManager
        -cache: CacheManager
        +runCloudSync(): Promise~void~
        +setSyncIcon(icon: Element)
    }

    class FileOperations {
        +copyToRemote(file: File): Promise~void~
        +copyToLocal(file: File): Promise~void~
        +deleteFromRemote(file: File): Promise~void~
        +deleteFromLocal(file: File): Promise~void~
    }

    class SyncExecutor {
        +execute(scenarios: Scenario[]): Promise~void~
    }

    class Synchronize {
        +syncActions(): Promise~Scenario[]~
        +runAllScenarios(scenarios: Scenario[]): Promise~void~
    }
```

# Cloud Provider Class Diagram

```mermaid
classDiagram
    AbstractManager <|-- LocalManager : extends
    AbstractManager <|-- AWSManager : extends
    AbstractManager <|-- AzureManager : extends
    AbstractManager <|-- GCPManager : extends

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

    class LocalManager {
        +name: "Local"
        -basePath: string
        -vaultName: string
        -hashCache: Record<string, HashCacheEntry>
        -app: App
        -cache: CacheManager
        +getBasePath(): string
        +getApp(): App
        +getVaultName(): string
        -getDefaultIgnoreList(): string[]
        -normalizeVaultPath(path: string): string
        -ensureDirectoryExists(filePath: string): Promise~void~
        -computeHashStreaming(relativePath: string): Promise~string~
        -getFileHashAndMimeType(filePath: string, stats: FileStats, normalizedPath: string): Promise~HashInfo~
        -normalizePathForCloud(path: string): string
        -getIgnoreList(): string[]
        -processFileBatch(filePaths: string[]): Promise~File[]~
    }

    class AWSManager {
        +name: "AWS"
        -bucket: string
        -region: string
        -accessKey: string
        -secretKey: string
        -endpoint: string
        -auth: AWSAuth
        -signing: AWSSigning
        -fileOps: AWSFiles
        -paths: AWSPaths
        -vaultPrefix: string
        -validateSettings(): void
        -initializeClient(skipRegionDiscovery: boolean): Promise~void~
        +discoverRegion(): Promise~string~
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
        -vaultPrefix: string
        -paths: GCPPathHandler
        -auth: GCPAuth
        -fileOps: GCPFiles
        -currentSession: GCPSession
        -validateSettings(): void
        -initializeClient(): Promise~void~
        -ensureSession(): Promise~void~
        +startSyncSession(): Promise~void~
    }
