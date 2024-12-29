# Internal Architecture

> For a complete overview of CloudSync's technical architecture and implementation details, see [Architecture Documentation](doc/architecture.md).

## System Components

```mermaid
graph LR
    subgraph Plugin Core
        CM[CloudSyncMain] --> Sync[Synchronize]
        Sync --> SA[SyncAnalyzer]
        Sync --> SE[SyncExecutor]
        SA --> Cache[CacheManager]
        SE --> FO[FileOperations]
    end

    subgraph Local Storage
        LM[LocalManager] --> Files[Vault Files]
        LM --> Cache
    end

    subgraph Cloud Providers
        AM[AbstractManager] --> AWS[AWSManager]
        AM --> Azure[AzureManager]
        AM --> GCP[GCPManager]
    end

    CM --> LM
    CM --> AM
    FO --> LM
    FO --> AM
```

## Initialization Flow

```mermaid
sequenceDiagram
    participant Plugin
    participant LocalVault
    participant CloudProviders
    participant Cache

    Plugin->>LocalVault: Initialize vault access
    LocalVault->>LocalVault: Test permissions
    LocalVault->>LocalVault: Get vault name

    loop For each enabled provider
        Plugin->>CloudProviders: Initialize provider
        CloudProviders->>CloudProviders: Validate settings
        CloudProviders->>CloudProviders: Authenticate
        CloudProviders->>CloudProviders: Test connectivity
        CloudProviders-->>Plugin: Provider ready
    end

    Plugin->>Cache: Initialize cache
    Cache->>Cache: Load last sync state
    Cache-->>Plugin: Cache ready

    Note over Plugin: Ready for sync operations
```

## Synchronization Process

### 1. File Discovery Phase

```mermaid
sequenceDiagram
    participant Sync
    participant Local
    participant Remote
    participant Cache

    Sync->>Local: Get file list
    activate Local
    Local->>Local: Scan vault
    Local->>Local: Calculate MD5s
    Local-->>Sync: Local files
    deactivate Local

    Sync->>Remote: Get file list
    activate Remote
    Remote->>Remote: List objects
    Remote->>Remote: Get metadata
    Remote-->>Sync: Remote files
    deactivate Remote

    Sync->>Cache: Get last sync state
    Cache-->>Sync: Cached files
```

### 2. Sync Analysis

```mermaid
stateDiagram-v2
    [*] --> FileExists

    state FileExists {
        [*] --> LocalExists
        [*] --> RemoteExists

        state LocalExists {
            [*] --> HasRemote
            HasRemote --> SameMD5: Yes
            HasRemote --> DiffMD5: Yes
            HasRemote --> NoRemote: No

            state NoRemote {
                [*] --> InCache
                InCache --> LOCAL_TO_REMOTE: No
                InCache --> DELETE_LOCAL: Yes
            }

            state DiffMD5 {
                [*] --> CacheMatch
                CacheMatch --> LOCAL_TO_REMOTE: Remote
                CacheMatch --> REMOTE_TO_LOCAL: Local
                CacheMatch --> DIFF_MERGE: Neither
            }

            SameMD5 --> NO_ACTION
        }

        state RemoteExists {
            [*] --> HasLocal
            HasLocal --> NoLocal: No

            state NoLocal {
                [*] --> RemoteInCache
                RemoteInCache --> REMOTE_TO_LOCAL: No
                RemoteInCache --> DELETE_REMOTE: Yes
            }
        }
    }
```

### 3. File Operations

```mermaid
sequenceDiagram
    participant Executor
    participant FileOps
    participant Local
    participant Remote
    participant Cache

    Executor->>FileOps: Execute scenario

    alt LOCAL_TO_REMOTE
        FileOps->>Local: Read file
        FileOps->>Remote: Write file
    else REMOTE_TO_LOCAL
        FileOps->>Remote: Read file
        FileOps->>Local: Write file
    else DELETE_LOCAL
        FileOps->>Local: Delete file
    else DELETE_REMOTE
        FileOps->>Remote: Delete file
    else DIFF_MERGE
        FileOps->>Local: Read file
        FileOps->>Remote: Read file
        FileOps->>FileOps: Merge changes
        FileOps->>Local: Write merged
        FileOps->>Remote: Write merged
    end

    FileOps->>Cache: Update cache
```

## Cache Management

```mermaid
graph TB
    subgraph Cache Operations
        Init[Initialize Cache] --> Read[Read Cache]
        Read --> Check{Check File Status}
        Check -->|File in Cache| Compare[Compare MD5]
        Check -->|File not in Cache| New[New File]
        Compare -->|Match| Unchanged[File Unchanged]
        Compare -->|Different| Changed[File Changed]
        Changed --> Update[Update Cache]
        New --> Update
        Update --> Write[Write Cache]
    end

    subgraph Cache Data
        Files[File List] --> MD5[MD5 Hashes]
        Files --> Timestamps[Last Modified]
        Files --> Sync[Last Sync Time]
    end
```

## Key Features

1. **Multi-Provider Support**
   - Abstract manager interface
   - Provider-specific implementations
   - Unified file operations

2. **Robust Sync Logic**
   - Three-way comparison (local/remote/cache)
   - Conflict detection
   - Automatic conflict resolution
   - Line-level diff and merge

3. **Cache Management**
   - File state tracking
   - MD5 hash comparison
   - Timestamp management
   - Sync history

4. **Error Handling**
   - Connection retry logic
   - Operation timeout handling
   - Rollback capabilities
   - Detailed logging

5. **Path Management**
   - Cross-platform path normalization
   - Cloud path encoding
   - Vault prefix handling
   - Directory markers

## Automatic Synchronization

The plugin supports automatic synchronization with configurable intervals:

1. **Timer Management**
   - Configurable sync interval
   - Automatic reset after sync
   - Manual sync override

2. **State Tracking**
   - Active sync detection
   - Last sync timestamp
   - Error state handling

3. **Resource Optimization**
   - Throttled operations
   - Batch processing
   - Cache utilization
