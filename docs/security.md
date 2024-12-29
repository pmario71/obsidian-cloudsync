# Security Model

CloudSync implements provider-specific security models optimized for each cloud storage service.

## Azure Blob Storage Security

```mermaid
graph TD
    %% Azure Authentication Flow
    subgraph Azure Security Model
        A1[Storage Account] --> A2[SAS Token]
        A2 --> A3[Shared Key]
        A3 --> A4[Request Signing]

        %% Access Levels
        B1[Account] --> B2[Container]
        B2 --> B3[Blob]

        %% Permissions
        C1[Read] & C2[Write] & C3[Delete] & C4[List]
        B3 --> C1
        B3 --> C2
        B3 --> C3
        B3 --> C4

        %% Token Management
        D1[Generate SAS] --> D2[1-Hour Validity]
        D2 --> D3[Auto-Refresh]
    end

```

### Azure Authentication
- **Storage Account**: Root access point
- **SAS Token**: Time-limited access signature
- **Shared Key**: Cryptographic authentication
- **Request Signing**: HMAC-SHA256 with key

### Azure Access Control
- **Account Level**: Global permissions
- **Container Level**: Vault isolation
- **Blob Level**: File-specific access
- **Operations**: Read, Write, Delete, List

## AWS S3 Security

```mermaid
graph TD
    %% AWS Authentication Flow
    subgraph AWS Security Model
        A1[IAM User/Role] --> A2[Access Key]
        A2 --> A3[Secret Key]
        A3 --> A4[AWS4 Signing]

        %% Access Levels
        B1[Account] --> B2[Bucket]
        B2 --> B3[Object]

        %% Permissions
        C1[GetObject] & C2[PutObject] & C3[DeleteObject] & C4[ListBucket]
        B3 --> C1
        B3 --> C2
        B3 --> C3
        B2 --> C4

        %% Policy Management
        D1[IAM Policy] --> D2[Bucket Policy]
        D2 --> D3[ACLs]
    end

```

### AWS Authentication
- **IAM User/Role**: Identity management
- **Access Key**: Public identifier
- **Secret Key**: Private signing key
- **AWS4 Signing**: SHA-256 HMAC chain

### AWS Access Control
- **Account Level**: IAM policies
- **Bucket Level**: Bucket policies
- **Object Level**: ACLs
- **Operations**: GetObject, PutObject, DeleteObject, ListBucket

## Google Cloud Storage Security

```mermaid
graph TD
    %% GCP Authentication Flow
    subgraph GCP Security Model
        A1[Service Account] --> A2[Private Key]
        A2 --> A3[JWT Token]
        A3 --> A4[OAuth2 Bearer]

        %% Access Levels
        B1[Project] --> B2[Bucket]
        B2 --> B3[Object]

        %% Permissions
        C1[storage.objects.get] & C2[storage.objects.create]
        C3[storage.objects.delete] & C4[storage.objects.list]
        B3 --> C1
        B3 --> C2
        B3 --> C3
        B2 --> C4

        %% IAM Management
        D1[IAM Roles] --> D2[Custom Roles]
        D2 --> D3[Conditions]
    end

```

### GCP Authentication
- **Service Account**: Robot account identity
- **Private Key**: JWT signing key
- **JWT Token**: Self-signed assertion
- **OAuth2**: Bearer token authentication

### GCP Access Control
- **Project Level**: IAM roles
- **Bucket Level**: ACLs
- **Object Level**: Object ACLs
- **Operations**: get, create, delete, list

## Security Implementation

### Azure Implementation
```typescript
interface AzureAuth {
    accountName: string;
    accountKey: string;
    sasToken: string;
    containerName: string;
}

// SAS Token Generation
const generateSasToken = (auth: AzureAuth): string => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 3600000); // 1 hour

    return generateAccountSasToken({
        accountName: auth.accountName,
        accountKey: auth.accountKey,
        permissions: 'rwdl',
        expiry: expiry,
        services: 'b',
        resourceTypes: 'co'
    });
}
```

### AWS Implementation
```typescript
interface AwsAuth {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
}

// AWS4 Request Signing
const signRequest = (auth: AwsAuth, request: Request): string => {
    return aws4.sign({
        host: `${auth.bucket}.s3.${auth.region}.amazonaws.com`,
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: request.body,
        service: 's3',
        region: auth.region
    }, {
        accessKeyId: auth.accessKeyId,
        secretAccessKey: auth.secretAccessKey
    });
}
```

### GCP Implementation
```typescript
interface GcpAuth {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    bucket: string;
}

// OAuth2 Token Generation
const generateToken = async (auth: GcpAuth): Promise<string> => {
    const jwt = new JWT({
        email: auth.clientEmail,
        key: auth.privateKey,
        scopes: ['https://www.googleapis.com/auth/devstorage.read_write']
    });

    const token = await jwt.getAccessToken();
    return token.token;
}
```
