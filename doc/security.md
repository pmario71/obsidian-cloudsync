CloudSync implements security measures across all supported cloud providers to ensure data remains private and secure.

## Core Security Features

1. **Secure Data Transfer**
   - All data transfers use TLS (Transport Layer Security) encryption
   - Direct connection to your cloud storage provider with no intermediary servers
   - No data passes through third-party servers

2. **Authentication & Authorization**
   - Each cloud provider uses its own secure authentication mechanism:
     - Azure: SAS (Shared Access Signature) tokens
     - AWS: AWS Signature Version 4 signing process
     - GCP: Service Account authentication with private key credentials

3. **Credential Security**
   - Authentication tokens and keys are stored locally in `data.json`
   - Access keys are masked in logs
   - No credentials are transmitted to third parties

## Security Best Practices

1. **Request Security**
   - All requests are authenticated
   - Content integrity verification through hashing
   - Secure URL encoding for paths and parameters

2. **Error Handling**
   - Secure error messages that don't expose sensitive information
   - Comprehensive logging with masked sensitive data
   - Proper validation of credentials and settings

3. **Access Control**
   - Minimal required permissions model
   - Time-limited access tokens
   - Resource-specific access restrictions
   - Use of separate restricted service accounts instead of root accounts
   - Dedicated IAM roles and service principals with limited scope

## User Privacy

- All synchronization happens directly between client device and cloud storage
- No analytics or tracking
- No remote data collection
- Local data collection: timestamp of last synch and list of remote files

## Recommendations for Users

1. Store `data.json` securely - it includes cloud credentials
2. Follow the cloud provider's security best practices
3. Regularly rotate access keys and credentials
4. Monitor cloud storage billing

CloudSync is designed with security as a primary concern, ensuring Obsidian vault data remains private and protected while enabling seamless synchronization across devices.
