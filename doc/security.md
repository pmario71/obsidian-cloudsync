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

## Recommendations for Users

1. Store `data.json` securely - it includes cloud credentials
2. Follow the cloud provider's security best practices
3. Regularly rotate access keys and credentials
4. Monitor cloud storage billing
