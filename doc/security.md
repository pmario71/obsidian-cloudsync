CloudSync implements security measures across all supported cloud providers to ensure data remains private and secure. Plugin is designed with security as a primary concern, ensuring data from Obsidian vault data remains private and protected while enabling seamless synchronization with cloud storage.

## Core Security Features

1. **Secure Data Transfer**
   - All data transfers use TLS (Transport Layer Security) encryption
   - Direct connection to cloud storage provider with no intermediary servers
   - No data or credentials pass through third-party servers

2. **Authentication & Authorization**
   - Each cloud provider uses its own secure authentication mechanism:
     - Azure: SAS (Shared Access Signature) tokens
     - AWS: AWS Signature Version 4 signing process
     - GCP: Bearer token authentication using OAuth2 access tokens

3. **Credential Security**
   - Authentication tokens and keys are stored locally in `data.json`
   - Access keys are masked in logs
   - No credentials are transmitted to third parties
   - Key credentials are obfuscated in `data.json`

4. **Request Security**
   - All requests are authenticated
   - Content integrity verification through hashing
   - Secure URL encoding for paths and parameters

5. **Error Handling**
   - Secure error messages that don't expose sensitive information
   - Comprehensive logging with masked sensitive data
   - Proper validation of credentials and settings

6. **Access Control**
   - Minimal required permissions model
   - Time-limited access tokens
   - Resource-specific access restrictions
   - Use of separate restricted service accounts instead of root accounts
   - Dedicated IAM roles and service principals with limited scope

7. **User Privacy**
   - No analytics or tracking
   - No remote data collection
   - Local data collection: timestamp of last synch and list of remote files

## Cloud Provider Authentication Details

### Azure Storage

1. **Authentication Mechanism**
   - Primary: Storage Account Shared Key
   - Secondary: SAS (Shared Access Signature) tokens
   - Account-level authentication
   - Container-level access control

2. **Request Signing**
   - SAS token generation for each request
   - Token components:
     - Storage account credentials
     - Time constraints
     - Permitted operations
     - Resource scope
   - Automatic token refresh system

3. **CORS Support**
   - Storage account CORS rules
   - Explicit CORS validation
   - Origin verification
   - Preflight request handling

4. **Permission Management**
   - Granular permission control:
     - Read permission
     - Write permission
     - Delete permission
     - List permission
     - Create permission
   - Resource type restrictions:
     - Container level
     - Blob level
     - Service level

5. **Credential Management**
   - Time-limited SAS tokens (1-hour validity)
   - Automatic token refresh
   - Secure storage of account keys
   - Connection testing and validation

### AWS (Amazon Web Services)

1. **Authentication Mechanism**
   - Uses AWS Signature Version 4 (SigV4) authentication
   - Requires Access Key ID and Secret Access Key
   - Region-aware authentication with automatic region discovery
   - Supports bucket-specific authentication

2. **Request Signing**
   - Every request includes a cryptographic signature
   - Signature components:
     - Request timestamp (amzdate)
     - HTTP method and URI
     - Query parameters
     - Request headers
   - Time-bound signatures prevent replay attacks
   - Canonical request format ensures integrity

3. **CORS Support**
   - CORS headers required for browser access
   - Bucket CORS configuration must be enabled
   - Preflight request handling for non-simple requests
   - Origin validation for security

4. **Permission Management**
   - Bucket-level access control
   - Object-level permissions
   - Supports:
     - List operations
     - Read operations
     - Write operations
     - Delete operations

5. **Credential Management**
   - Access keys stored securely
   - No client-side key regeneration
   - Key rotation support
   - Credential validation on startup

### GCP (Google Cloud Platform)

1. **Authentication Mechanism**
   - OAuth 2.0 authentication
   - Service account credentials
   - Client email and private key based
   - Supports JSON key file format

2. **Request Signing**
   - OAuth 2.0 access tokens
   - Bearer token authentication
   - Token components:
     - Service account identity
     - Scope restrictions
     - Expiration time
   - Request authorization headers

3. **CORS Support**
   - Bucket CORS configuration
   - Origin validation
   - Preflight request handling
   - Header restrictions

4. **Permission Management**
   - Storage-specific scope: devstorage.full_control
   - Granular access control:
     - Read operations
     - Write operations
     - List operations
     - Delete operations
   - Resource-level permissions

5. **Credential Management**
   - Private key validation and formatting
   - Token lifecycle management:
     - 1-hour token lifetime
     - 5-minute refresh buffer
     - Automatic token refresh
   - Secure credential storage
   - Connection testing before operations

## Common Security Patterns

Across all providers, the following security patterns are implemented:

1. **Authentication Flow**
   - Initial credential validation
   - Secure token/signature generation
   - Request authentication
   - Regular credential refresh

2. **Access Control**
   - Minimal required permissions
   - Time-bound access
   - Resource-specific restrictions
   - Operation-level granularity

3. **Security Validation**
   - Connection testing
   - Credential verification
   - Request integrity checks
   - Error handling with security context

4. **Credential Protection**
   - Secure local storage
   - Masked logging
   - No third-party transmission
   - Regular rotation support
