# AWS API Operations Flow

## AWS Request Signing Process

```mermaid
sequenceDiagram
    participant App
    participant AWSSigning
    participant CryptoJS

    App->>AWSSigning: signRequest(method, path, params)
    activate AWSSigning

    Note over AWSSigning: Generate date stamp and<br/>amzdate (ISO format)

    alt Has Request Body
        AWSSigning->>CryptoJS: Calculate SHA256 hash
    else No Body
        AWSSigning->>AWSSigning: Use empty hash
    end

    AWSSigning->>AWSSigning: Build canonical request
    Note over AWSSigning: Method + URI + Query +<br/>Headers + Signed Headers +<br/>Payload Hash

    AWSSigning->>AWSSigning: Create string to sign
    Note over AWSSigning: Algorithm + Date +<br/>Credential Scope + Hash

    AWSSigning->>CryptoJS: Generate signing key
    Note over CryptoJS: HMAC-SHA256 chain:<br/>Date → Region → Service → Request

    AWSSigning->>CryptoJS: Calculate final signature

    AWSSigning->>AWSSigning: Build Authorization header
    Note over AWSSigning: Algorithm + Credential +<br/>SignedHeaders + Signature

    AWSSigning-->>App: Return signed headers
    deactivate AWSSigning
```

## List Files Operation

```mermaid
sequenceDiagram
    participant App
    participant AWSFiles
    participant AWSSigning
    participant S3
    participant XMLParser

    App->>AWSFiles: getFiles()
    activate AWSFiles

    AWSFiles->>AWSFiles: Build S3 path with prefix

    AWSFiles->>AWSSigning: Sign GET request
    AWSSigning-->>AWSFiles: Return signed headers

    AWSFiles->>S3: GET /?list-type=2&prefix={prefix}

    alt Success
        S3-->>AWSFiles: XML response with Contents
        AWSFiles->>XMLParser: Parse response
        loop For each Content
            AWSFiles->>AWSFiles: Process file metadata
            Note over AWSFiles: Extract Key, Size,<br/>ETag, LastModified
        end
    else No Files
        S3-->>AWSFiles: Empty Contents
        AWSFiles->>AWSFiles: Clear cache
    else Error
        S3-->>AWSFiles: Error response
        AWSFiles->>App: Throw error
    end

    AWSFiles-->>App: Return File[]
    deactivate AWSFiles
```

## Read File Operation

```mermaid
sequenceDiagram
    participant App
    participant AWSFiles
    participant AWSSigning
    participant S3

    App->>AWSFiles: readFile(file)
    activate AWSFiles

    AWSFiles->>AWSFiles: Build S3 path
    Note over AWSFiles: Add bucket and<br/>vault prefix

    AWSFiles->>AWSSigning: Sign GET request
    AWSSigning-->>AWSFiles: Return signed headers

    AWSFiles->>S3: GET /bucket/key

    alt Success
        S3-->>AWSFiles: File content
        AWSFiles->>AWSFiles: Convert to Uint8Array
    else Error
        S3-->>AWSFiles: Error response
        AWSFiles->>App: Throw error
    end

    AWSFiles-->>App: Return Uint8Array
    deactivate AWSFiles
```

## Write File Operation

```mermaid
sequenceDiagram
    participant App
    participant AWSFiles
    participant AWSSigning
    participant S3

    App->>AWSFiles: writeFile(file, content)
    activate AWSFiles

    AWSFiles->>AWSFiles: Build S3 path
    Note over AWSFiles: Add bucket and<br/>vault prefix

    AWSFiles->>AWSSigning: Sign PUT request
    Note over AWSSigning: Include content hash<br/>in signature
    AWSSigning-->>AWSFiles: Return signed headers

    AWSFiles->>S3: PUT /bucket/key
    Note over AWSFiles: Send with content and<br/>content-type header

    alt Success
        S3-->>AWSFiles: 200 OK
    else Error
        S3-->>AWSFiles: Error response
        AWSFiles->>App: Throw error
    end

    AWSFiles-->>App: void
    deactivate AWSFiles
```

## Delete File Operation

```mermaid
sequenceDiagram
    participant App
    participant AWSFiles
    participant AWSSigning
    participant S3

    App->>AWSFiles: deleteFile(file)
    activate AWSFiles

    AWSFiles->>AWSFiles: Build S3 path
    Note over AWSFiles: Add bucket and<br/>vault prefix

    AWSFiles->>AWSSigning: Sign DELETE request
    AWSSigning-->>AWSFiles: Return signed headers

    AWSFiles->>S3: DELETE /bucket/key

    alt Success
        S3-->>AWSFiles: 204 No Content
    else Error
        S3-->>AWSFiles: Error response
        AWSFiles->>App: Throw error
    end

    AWSFiles-->>App: void
    deactivate AWSFiles
```

## Key Components

1. **AWS Request Signing (AWS4-HMAC-SHA256)**
   - Canonical request construction
   - Credential scope building
   - HMAC-SHA256 key derivation
   - Authorization header generation

2. **URL Construction**
   - Proper path encoding
   - Query parameter handling
   - Bucket and key formatting
   - Vault prefix management

3. **File Operations**
   - List: XML parsing of bucket contents
   - Read: Direct object GET
   - Write: PUT with content headers
   - Delete: Object removal

4. **Error Handling**
   - HTTP status code validation
   - XML error parsing
   - Retry mechanism
   - Cache invalidation

5. **Path Management**
   - URI encoding
   - Vault prefix handling
   - Remote path normalization
   - Directory markers
