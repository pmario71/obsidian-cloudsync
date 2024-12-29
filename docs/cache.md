# Cache Functionality

The cache in CloudSync stores a list of files and their timestamps that were found in remote storage during the last synchronization. This cache serves as a reference point for comparing local and remote file states.

## How Cache Detects Deletions
When CloudSync performs a sync operation, it checks the cache against the current state of cloud storage:
- If a file exists in the cache but is no longer present in cloud storage, this indicates that the file was deleted from the cloud
- In this case, CloudSync will delete the corresponding local file to maintain consistency

## Sync Decision Table

| Local File | Remote File | Cache Entry | Sync Decision |
|------------|-------------|-------------|---------------|
| Exists     | Missing     | Exists      | Delete local file |
| Exists     | Missing     | Missing     | Upload local to remote |
| Missing    | Exists      | *           | Download remote to local |
| Exists     | Exists      | Exists      | Sync if MD5 hashes differ |
| Missing    | Missing     | *           | No action |

Note: If CloudSync cannot detect the container or bucket, the cache is automatically invalidated.

## Clearing Cache to Prevent Local Deletions
The 'Clear Cache' button provides a way to block local deletions when files are missing from cloud storage:
1. When you manually modify cloud storage (e.g., remove files or folders)
2. Clearing the cache removes the local record of files that were previously found in cloud storage
3. Without this cache record, CloudSync cannot detect that files are missing from cloud storage
4. As a result, local files will not be deleted even if their cloud counterparts are missing

This feature is particularly useful when you want to:
- Keep local copies of files that were removed from cloud storage
- Prevent automatic deletions during the next sync operation
- Start fresh with a new cache state for future syncs
