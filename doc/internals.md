CloudSync follows a systematic process to ensure files in Obsidian vault stay synchronized with cloud storage. Here's a breakdown of how the synchronization process works:

## Initialization and Authentication

#### 1. Local Vault Initialization
   - Plugin initializes access to local Obsidian vault
   - Tests read/write permissions to Vault directory
   - Retrieves the vault name for cloud storage organization

#### 2. Cloud Provider Authentication
   - Authenticates with each enabled cloud provider (Azure, AWS, or GCP)
   - Verifies access permissions and connectivity
   - Establishes secure connection using provider-specific protocols

## Synchronization Process

#### 3. File Discovery
   - **Local Files**: Creates a complete inventory of local files and their MD5 values
   - **Remote Files**: Retrieves the list of files and MD5 values stored in cloud storage
   - **Cache Reading**: Loads the last sync timestamp and files from a local cache file

#### 4. Sync Scenarios
   Based on the comparison, files are categorized into scenarios:

1. Local file exists, no remote file
- File IS NOT mentioned in cache
- <u>Conclusion:</u> New file created locally since last sync
- <u>Action:</u> Upload local file to remote: `LOCAL_TO_REMOTE`

2.  Local file exists, no remote file
- File IS mentioned in cache
- <u>Conclusion:</u> File was deleted on remote since the last sync
- <u>Action:</u> Delete local file: `DELETE_LOCAL`

3.  Remote file exists, no local file
- File IS NOT mentioned in cache
- <u>Conclusion:</u> New file created on remote since the last sync
- <u>Action:</u> Download remote file to local: `REMOTE_TO_LOCAL`

4. Remote file exists, no local file
- File IS mentioned in cache
- <u>Conclusion:</u> File was deleted locally since the last sync
- <u>Action:</u> Delete remote file: `DELETE_REMOTE`

5. Local file exists, remote file exists, files have different MD5 hash
- Cache MD5 matches **remote** MD5
- <u>Conclusion:</u> Local file was modified since the last sync
- <u>Action:</u> Upload local file to remote: `LOCAL_TO_REMOTE`

6.  Local file exists, remote file exists, files have different MD5 hash
- Cache MD5 matches **local** MD5
- <u>Conclusion:</u> Remote file was modified since the last sync
- <u>Action:</u> Download remote file to local: `REMOTE_TO_LOCAL`

7. Local file exists, remote file exists, files have different MD5 hash
- Cache MD5 matches **neither** local nor remote MD5
- <u>Conclusion:</u> Both files were modified since the last sync
- <u>Action:</u> Merge changes from both files: `DIFF_MERGE`

#### 5. Cache Update
   - After successful sync, the cache is updated with:
     - New file states (MD5 hashes)
     - Timestamp of last successful sync
   - Cache helps determine changes in subsequent syncs
