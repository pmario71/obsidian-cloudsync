# CloudSync for Obsidian

Secure cloud synchronization for Obsidian vaults using Azure Blob Storage, AWS S3, or Google Cloud Storage. Maintain real-time backups, sync across devices, and access  Obsidian notes remotely while keeping data secure.

## 🚀 Features

- **Multi-Cloud Support**: Azure Blob Storage, AWS S3, Google Cloud Storage
- **Multi-Vault**: Sync multiple vaults to a single storage account/bucket with isolated containers/folders/prefixes
- **Direct Cloud Connection**: No intermediary servers - data flows directly between Obsidian client and cloud storage
- **Enterprise-Grade Security**: TLS encryption in transit, cloud provider encryption at rest
- **Smart Sync**: Intelligent conflict resolution with diff-merge capabilities when files change both locally and in the cloud
- **Minimal Permissions**: Least-privilege access model to cloud storage for enhanced security
- **Extremely low cost**: Depending on the vault size and usage, but typically less than $1/month
- **Caution**: Setting up cloud storage account, service account and CORS permissions is a bit complex process

## ⚡ Quick Start

1. [Install plugin](doc/install.md)
2. Configure cloud provider:
   - [Azure Storage](doc/azure.md) - Relatively simple
   - [AWS S3](doc/aws.md) - Intermediate level of complexity
   - [GCP Storage](doc/gcp.md) - Advanced level
3. Set credentials in plugin settings
4. Start syncing

## 🔧 Requirements

- Account with supported cloud provider
- Storage bucket/container with CORS enabled
- Access credentials with minimal required permissions

## 📖 Documentation

- [Cloud Cost Analysis](doc/cost.md)
- [Internal Architecture](doc/internals.md)
- [Security Model](doc/security.md)

## ❓ FAQ

**Q: How are sync conflicts handled?**
A: Plugin tracks MD5 hashes for change detection. When both sides change, it performs diff-merge, preserving and marking deleted content.

**Q: Are files encrypted?**
A: Plugin uses TLS for transfer and cloud provider's native encryption at rest.

**Q: Where are credentials stored?**
A: Locally in `data.json` in plugin directory with selective field obfuscation.

**Q: Can files be recovered?**
A: Yes, through:
- Obsidian's deletion settings in *Settings - Files and Links - Deleted Files* (set to Obsidian .trash)
- Cloud provider's retention features (e.g., Azure Soft Delete)

**Q: Is my data private?**
A: Yes. Direct cloud connection with no third-party servers involved.

## 🤝 Contributing

PRs welcome! Open an issue first for major changes.

## 📄 License

[MIT](LICENSE.md)
