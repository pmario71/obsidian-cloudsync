# GCP API Operations Flow

## GCP Authentication Flow

```mermaid
sequenceDiagram
    participant App
    participant GCPAuth
    participant CryptoJS
    participant OAuth2

    App->>GCPAuth: initialize(clientEmail, privateKey)
    activate GCPAuth

    GCPAuth->>GCPAuth: processPrivateKey()
    Note over GCPAuth: Clean and format<br/>PEM key

    GCPAuth->>GCPAuth: createJWT()
    Note over GCPAuth: Create claims with:<br/>iss, scope, aud, exp, iat

    GCPAuth->>CryptoJS: Import private key
    GCPAuth->>CryptoJS: Sign JWT with RS256

    GCPAuth->>OAuth2: POST /token
    Note over GCPAuth,OAuth2: Send JWT assertion

    OAuth2-->>GCPAuth: Access token response

    GCPAuth->>GCPAuth: Store token and expiry
    deactivate GCPAuth
```

## List Files Operation

```mermaid
sequenceDiagram
    participant App
    participant GCPFiles
    participant GCPAuth
    participant Storage
    participant XMLParser

    App->>GCPFiles: getFiles()
    activate GCPFiles

    GCPFiles->>GCPFiles: Build URL with prefix

    GCPFiles->>GCPAuth: getHeaders()
    Note over GCPAuth: Check token expiry
    GCPAuth-->>GCPFiles: Authorization headers

    GCPFiles->>Storage: GET /?prefix={prefix}

    alt Success
        Storage-->>GCPFiles: XML response with Contents
        GCPFiles->>XMLParser: Parse response
        loop For each Content
            GCPFiles->>GCPFiles: Process file metadata
            Note over GCPFiles: Extract Key, Size,<br/>LastModified, ETag
        end
    else No Files
        Storage-->>GCPFiles: Empty Contents
        GCPFiles->>GCPFiles: Return root directory
    else Error
        Storage-->>GCPFiles: Error response
        GCPFiles->>App: Throw error
    end

    GCPFiles-->>App: Return File[]
    deactivate GCPFiles
```

## Read File Operation

```mermaid
sequenceDiagram
    participant App
    participant GCPFiles
    participant GCPAuth
    participant Storage

    App->>GCPFiles: readFile(file)
    activate GCPFiles

    GCPFiles->>GCPFiles: Build object URL
    Note over GCPFiles: Add bucket and<br/>vault prefix

    GCPFiles->>GCPAuth: getHeaders()
    GCPAuth-->>GCPFiles: Authorization headers

    GCPFiles->>Storage: GET /bucket/object

    alt Success
        Storage-->>GCPFiles: File content
        GCPFiles->>GCPFiles: Convert to Uint8Array
    else Error
        Storage-->>GCPFiles: Error response
        GCPFiles->>App: Throw error
    end

    GCPFiles-->>App: Return Uint8Array
    deactivate GCPFiles
```

## Write File Operation

```mermaid
sequenceDiagram
    participant App
    participant GCPFiles
    participant GCPAuth
    participant Storage

    App->>GCPFiles: writeFile(file, content)
    activate GCPFiles

    GCPFiles->>GCPFiles: Build object URL
    Note over GCPFiles: Add bucket and<br/>vault prefix

    GCPFiles->>GCPAuth: getHeaders()
    GCPAuth-->>GCPFiles: Authorization headers

    GCPFiles->>Storage: PUT /bucket/object
    Note over GCPFiles: Send with content and<br/>content-length header

    alt Success
        Storage-->>GCPFiles: 200 OK
    else Error
        Storage-->>GCPFiles: Error response
        GCPFiles->>App: Throw error
    end

    GCPFiles-->>App: void
    deactivate GCPFiles
```

## Delete File Operation

```mermaid
sequenceDiagram
    participant App
    participant GCPFiles
    participant GCPAuth
    participant Storage

    App->>GCPFiles: deleteFile(file)
    activate GCPFiles

    GCPFiles->>GCPFiles: Build object URL
    Note over GCPFiles: Add bucket and<br/>vault prefix

    GCPFiles->>GCPAuth: getHeaders()
    GCPAuth-->>GCPFiles: Authorization headers

    GCPFiles->>Storage: DELETE /bucket/object

    alt Success
        Storage-->>GCPFiles: 200 OK
    else Not Found
        Storage-->>GCPFiles: 404 Not Found
        Note over GCPFiles: Treat as success
    else Error
        Storage-->>GCPFiles: Error response
        GCPFiles->>App: Throw error
    end

    GCPFiles-->>App: void
    deactivate GCPFiles
```

## Key Components

1. **Authentication**
   - JWT creation with RS256 signing
   - OAuth2 token exchange
   - Automatic token refresh
   - Private key processing

2. **URL Construction**
   - Object URL formatting
   - Prefix handling
   - Bucket path management
   - Query parameter encoding

3. **File Operations**
   - List: XML/JSON response parsing
   - Read: Direct object download
   - Write: Object upload with headers
   - Delete: Object removal with 404 handling

4. **Error Handling**
   - Token expiration checks
   - HTTP status validation
   - XML error parsing
   - Retry mechanism

5. **Path Management**
   - Vault prefix handling
   - Remote path normalization
   - Directory markers
   - Root directory handling
