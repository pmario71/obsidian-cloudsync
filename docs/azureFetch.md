# Azure API Operations Flow

## Authentication Flow

```mermaid
sequenceDiagram
    participant App
    participant AzureAuth
    participant Azure

    App->>AzureAuth: Generate SAS token
    activate AzureAuth
    Note over AzureAuth: Create string to sign:<br/>account + permissions + services<br/>+ resourceTypes + dates
    AzureAuth->>AzureAuth: Create HMAC-SHA256 signature<br/>using access key
    AzureAuth->>AzureAuth: Build SAS token with params:<br/>permissions, services, dates
    AzureAuth-->>App: Return SAS token
    deactivate AzureAuth

    App->>Azure: Verify container (with SAS)
    alt Container exists
        Azure-->>App: 200 OK
    else Container not found
        Azure-->>App: 404 Not Found
        App->>Azure: Create container
        Azure-->>App: 201 Created
    end
```

## List Files Operation

```mermaid
sequenceDiagram
    participant App
    participant AzureFiles
    participant AzurePaths
    participant Azure
    participant XMLParser

    App->>AzureFiles: getFiles()
    activate AzureFiles

    AzureFiles->>AzurePaths: getContainerUrl(account, sasToken, 'list')
    AzurePaths-->>AzureFiles: List URL with SAS token

    AzureFiles->>Azure: GET container?restype=container&comp=list

    alt Success
        Azure-->>AzureFiles: XML response with blobs
        AzureFiles->>XMLParser: Parse blob list
        loop For each blob
            AzureFiles->>AzureFiles: Process blob properties
            Note over AzureFiles: Extract name, size,<br/>content type, MD5
        end
    else Container not found
        Azure-->>AzureFiles: 404 Not Found
        AzureFiles->>App: Throw NEW_CONTAINER
    else Error
        Azure-->>AzureFiles: Error response
        AzureFiles->>App: Throw error
    end

    AzureFiles-->>App: Return File[]
    deactivate AzureFiles
```

## Read File Operation

```mermaid
sequenceDiagram
    participant App
    participant AzureFiles
    participant AzurePaths
    participant Azure

    App->>AzureFiles: readFile(file)
    activate AzureFiles

    AzureFiles->>AzurePaths: getBlobUrl(account, file.remoteName, sasToken)
    AzurePaths-->>AzureFiles: Blob URL with SAS token

    AzureFiles->>Azure: GET blob

    alt Success
        Azure-->>AzureFiles: File content
        AzureFiles->>AzureFiles: Convert to Uint8Array
    else Error
        Azure-->>AzureFiles: Error response
        AzureFiles->>App: Throw error
    end

    AzureFiles-->>App: Return Uint8Array
    deactivate AzureFiles
```

## Write File Operation

```mermaid
sequenceDiagram
    participant App
    participant AzureFiles
    participant AzurePaths
    participant Azure

    App->>AzureFiles: writeFile(file, content)
    activate AzureFiles

    AzureFiles->>AzurePaths: getBlobUrl(account, file.remoteName, sasToken)
    AzurePaths-->>AzureFiles: Blob URL with SAS token

    Note over AzureFiles: Set headers:<br/>Content-Type: application/octet-stream<br/>x-ms-blob-type: BlockBlob

    AzureFiles->>Azure: PUT blob

    alt Success
        Azure-->>AzureFiles: 201 Created
    else Error
        Azure-->>AzureFiles: Error response
        AzureFiles->>App: Throw error
    end

    AzureFiles-->>App: void
    deactivate AzureFiles
```

## Delete File Operation

```mermaid
sequenceDiagram
    participant App
    participant AzureFiles
    participant AzurePaths
    participant Azure

    App->>AzureFiles: deleteFile(file)
    activate AzureFiles

    AzureFiles->>AzurePaths: getBlobUrl(account, file.remoteName, sasToken)
    AzurePaths-->>AzureFiles: Blob URL with SAS token

    AzureFiles->>Azure: DELETE blob

    alt Success
        Azure-->>AzureFiles: 200 OK
    else Error
        Azure-->>AzureFiles: Error response
        AzureFiles->>App: Throw error
    end

    AzureFiles-->>App: void
    deactivate AzureFiles
```

## Key Components

1. **Authentication**
   - Uses SAS (Shared Access Signature) tokens
   - Tokens include permissions and expiry time
   - HMAC-SHA256 signing of token parameters

2. **URL Construction**
   - Container URLs for list operations
   - Blob URLs for individual file operations
   - Proper encoding of container and blob names
   - SAS token appended to all URLs

3. **File Operations**
   - List: XML parsing of container contents
   - Read: Direct blob download
   - Write: BlockBlob upload with content type
   - Delete: Simple blob deletion

4. **Error Handling**
   - Container existence check
   - Automatic container creation
   - HTTP status code validation
   - Detailed error messages
   - CORS validation

5. **Path Management**
   - Path normalization
   - Cloud path encoding
   - Remote name handling
   - Container name encoding
