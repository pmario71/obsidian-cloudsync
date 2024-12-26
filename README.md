[![Version](https://img.shields.io/github/v/release/mihakralj/obsidian-cloudsync)](https://github.com/mihakralj/obsidian-cloudsync) [![GitHub all releases](https://img.shields.io/github/downloads/mihakralj/obsidian-cloudsync/total?color=blue)](https://github.com/mihakralj/obsidian-cloudsync/releases)
 [![Stars](https://img.shields.io/github/stars/mihakralj/obsidian-cloudsync?style=flat)](https://github.com/mihakralj/obsidian-cloudsync/stargazers) [![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=ncloc)](https://sonarcloud.io/summary/overall?id=mihakralj_obsidian-cloudsync)  [![Last Commit](https://img.shields.io/github/last-commit/mihakralj/obsidian-cloudsync?color=blue)](https://github.com/mihakralj/obsidian-cloudsync/commits/main)


[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync)



# CloudSync for Obsidian

Secure cloud synchronization for Obsidian vaults using Azure Blob Storage, AWS S3, or Google Cloud Storage. Maintain real-time backups, sync across devices, and access  Obsidian notes remotely while keeping data secure.

## 🚀 Features

- **Multi-Cloud Support**: Azure Blob Storage, AWS S3, Google Cloud Storage
- **Multi-Vault**: Sync multiple vaults to a single storage account/bucket with isolated containers/folders/prefixes
- **Direct Cloud Connection**: No intermediary servers - data flows directly between Obsidian client and cloud storage
- **Enterprise-Grade Security**: TLS encryption in transit, cloud provider encryption at rest
- **Smart Sync**: Intelligent conflict resolution with diff-merge capabilities when files change both locally and in the cloud
- **Auto Sync**: Configurable automatic synchronization at various intervals
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

**Q: Where is CloudSync? How to use it?**
A: CloudSync adds a Sync icon to Obsidian ribbon; when clicked (and when at least one cloud storage is enabled and configured), CloudSync follows the [full sync process](doc/internals.md)

**Q: Does it work on Android/iPhone?**
A: No, current version of CloudSync uses many direct filesystem and node API calls that are not supported on Android/iPhone.

**Q: How are sync conflicts handled?**
A: Plugin tracks MD5 hashes for change detection. When both sides change, it performs diff-merge, preserving and marking deleted content.

**Q: Are files encrypted?**
A: Plugin uses TLS for transfer and cloud provider's native encryption at rest.

**Q: Where are credentials stored?**
A: Locally in `data.json` in plugin directory with selective field obfuscation.

**Q: Can files be deleted by CloudSync? Can they be recovered?**
A: Yes, if file is deleted in the cloud storage, CloudSync will delete the same file locally. Deleted files can be recovered through:
- Obsidian's deletion settings in *Settings - Files and Links - Deleted Files* (set to Obsidian .trash). Install Trash Explorer plugin if you want to manage deleted files within Obsidian
- Cloud provider's retention features can be configured to keep deleted files for a set period (e.g., Azure Soft Delete, AWS/GCP versioning and storage policies)

**Q: Is my data private?**
A: Yes. CloudSync establishes direct and TLS-encrypted cloud connection with no third-party servers involved.
