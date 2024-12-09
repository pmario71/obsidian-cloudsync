CloudSync follows a systematic process to ensure files in Obsidian vault stay synchronized with cloud storage. Here's a breakdown of how the synchronization process works:

## Initialization and Authentication

#### 1. Local Vault Initialization
   - Plugin initializes access to local Obsidian vault
   - Tests read/write permissions to Vault directory
   - Retrieves the vault name for cloud storage organization

#### 2. Cloud Provider Authentication
   - Authenticates with each enabled cloud provider (Azure, AWS, or GCP)
   - Verifies access permissions and connectivity
   - Generates tokens required for secure connection using provider-specific protocols

## Synchronization Process

#### 3. File Discovery
   - **Local Files**: Creates a complete inventory of local files and their MD5 values
   - **Remote Files**: Retrieves the list of files and MD5 values stored in cloud storage
   - **Cache Reading**: Loads the last sync timestamp and files from a local cache file

#### 4. Sync Scenarios
   Based on the comparison, files are categorized into scenarios:

1. Local file exists, there is no remote file, file is NOT in cache
   - <u>Conclusion:</u> New file was created locally since the last sync
   - <u>Action:</u> Upload local file to remote: `LOCAL_TO_REMOTE`

2.  Local file exists, there no remote file, file exists in cache
   - <u>Conclusion:</u> File was deleted on remote since the last sync
   - <u>Action:</u> Delete local file: `DELETE_LOCAL`

3.  Remote file exists, there is no local file, file is NOT in cache
- <u>Conclusion:</u> New file was created on remote since the last sync
- <u>Action:</u> Download remote file to local: `REMOTE_TO_LOCAL`

4. Remote file exists, there is no local file, file exists in cache
- <u>Conclusion:</u> File was deleted locally since the last sync
- <u>Action:</u> Delete remote file: `DELETE_REMOTE`

5. Local file exists, remote file exists, same MD5
- <u>Conclusion:</u> Files are the same
- <u>Action:</u> No action

6. Local file exists, remote file exists, different MD5, cached MD5 matches **remote** MD5
- <u>Conclusion:</u> Local file was modified since the last sync
- <u>Action:</u> Upload local file to remote: `LOCAL_TO_REMOTE`

7.  Local file exists, remote file exists, different MD5, cacheed MD5 matches **local** MD5
- <u>Conclusion:</u> Remote file was modified since the last sync
- <u>Action:</u> Download remote file to local: `REMOTE_TO_LOCAL`

8. Local file exists, remote file exists, different MD5, cached MD5 matches **neither** local nor remote MD5
- <u>Conclusion:</u> Both local and remote files were modified since the last sync
- <u>Action:</u> Merge changes from both files: `DIFF_MERGE`

#### 5. Cache Update
   - After successful sync, the cache is updated with:
     - New file states (MD5 hashes)
     - Timestamp of last successful sync
   - Cache helps determine changes in subsequent syncs

#### 6. Automatic Synchronization
   - When enabled, the plugin automatically triggers the sync process at configurable intervals
   - Each auto-sync follows the same process as manual sync
   - Timer resets after each successful sync completion

```mermaid
flowchart LR
    A[Start] --> B{Local file exists?}

    B -->|Yes| C{Remote file exists?}
    B -->|No| D{Remote file exists?}

    C -->|Yes| E{Same MD5?}
    C -->|No| F{In Cache?}

    D -->|Yes| G{In Cache?}
    D -->|No| H[Invalid State]

    E -->|Yes| I[No Action]
    E -->|No| J{Cache MD5 matches?}

    F -->|Yes| K[DELETE_LOCAL]
    F -->|No| L[LOCAL_TO_REMOTE]

    G -->|Yes| M[DELETE_REMOTE]
    G -->|No| N[REMOTE_TO_LOCAL]

    J -->|Remote| O[LOCAL_TO_REMOTE]
    J -->|Local| P[REMOTE_TO_LOCAL]
    J -->|Neither| Q[DIFF_MERGE]
