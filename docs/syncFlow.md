# Synchronization Flow

The following sequence diagram illustrates the detailed flow of a synchronization operation in the CloudSync plugin.

```mermaid
sequenceDiagram
    participant User
    participant CloudSyncMain
    participant LocalManager
    participant RemoteManager
    participant Synchronize
    participant SyncAnalyzer
    participant SyncExecutor
    participant FileOperations
    participant CacheManager

    User->>CloudSyncMain: Trigger sync

    %% Initialization Phase
    CloudSyncMain->>LocalManager: initializeLocalVault()
    LocalManager->>LocalManager: testConnectivity()
    CloudSyncMain->>CloudSyncMain: validateProvider()

    %% Provider Authentication
    CloudSyncMain->>RemoteManager: authenticate()
    Note over RemoteManager: AWS/Azure/GCP specific auth

    %% Start Synchronization
    CloudSyncMain->>Synchronize: new Synchronize(local, remote, cachePath)
    activate Synchronize

    %% Cache Reading
    Synchronize->>CacheManager: readCache()

    %% Analysis Phase
    Synchronize->>SyncAnalyzer: analyze()
    activate SyncAnalyzer

    %% File Scanning
    SyncAnalyzer->>LocalManager: getFiles()
    SyncAnalyzer->>RemoteManager: getFiles()

    %% Compare Files
    SyncAnalyzer->>CacheManager: Check cached states
    Note over SyncAnalyzer: Compare local, remote,<br/>and cached states

    %% Generate Scenarios
    SyncAnalyzer-->>Synchronize: Return scenarios
    deactivate SyncAnalyzer

    %% Execution Phase
    Synchronize->>SyncExecutor: execute(scenarios)
    activate SyncExecutor

    loop For each scenario
        alt LOCAL_TO_REMOTE
            SyncExecutor->>FileOperations: copyToRemote()
            FileOperations->>LocalManager: readFile()
            FileOperations->>RemoteManager: writeFile()
        else REMOTE_TO_LOCAL
            SyncExecutor->>FileOperations: copyToLocal()
            FileOperations->>RemoteManager: readFile()
            FileOperations->>LocalManager: writeFile()
        else DELETE_LOCAL
            SyncExecutor->>FileOperations: deleteFromLocal()
            FileOperations->>LocalManager: deleteFile()
        else DELETE_REMOTE
            SyncExecutor->>FileOperations: deleteFromRemote()
            FileOperations->>RemoteManager: deleteFile()
        end

        SyncExecutor->>CacheManager: Update cache
    end

    deactivate SyncExecutor

    %% Finalization
    Synchronize->>CacheManager: writeCache()
    deactivate Synchronize

    CloudSyncMain-->>User: Sync complete

```

## Flow Description

1. **Initialization Phase**
   - User triggers synchronization
   - CloudSyncMain initializes the local vault
   - Validates provider configuration
   - Authenticates with the remote provider (AWS/Azure/GCP)

2. **Analysis Phase**
   - Creates new Synchronize instance with local and remote managers
   - Reads the existing cache state
   - SyncAnalyzer scans both local and remote files
   - Compares file states (local vs remote vs cache)
   - Generates synchronization scenarios based on differences

3. **Execution Phase**
   - SyncExecutor processes each scenario
   - Performs appropriate file operations based on sync rules:
     - LOCAL_TO_REMOTE: Copy local file to remote
     - REMOTE_TO_LOCAL: Copy remote file to local
     - DELETE_LOCAL: Remove local file
     - DELETE_REMOTE: Remove remote file
   - Updates cache after each operation

4. **Finalization**
   - Writes final state to cache
   - Reports completion to user

## Key Features

- **Bidirectional Sync**: Supports both upload and download operations
- **Conflict Detection**: Uses cached state to detect conflicts
- **Atomic Operations**: Each file operation is handled independently
- **Error Handling**: Each phase includes error handling and rollback capabilities
- **State Management**: Maintains cache state for future synchronizations
