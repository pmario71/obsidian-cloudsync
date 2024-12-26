[![Version](https://img.shields.io/github/v/release/mihakralj/obsidian-cloudsync)](https://github.com/mihakralj/obsidian-cloudsync) [![GitHub all releases](https://img.shields.io/github/downloads/mihakralj/obsidian-cloudsync/total?color=blue)](https://github.com/mihakralj/obsidian-cloudsync/releases)
 [![Stars](https://img.shields.io/github/stars/mihakralj/obsidian-cloudsync?style=flat)](https://github.com/mihakralj/obsidian-cloudsync/stargazers) [![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=ncloc)](https://sonarcloud.io/summary/overall?id=mihakralj_obsidian-cloudsync)  [![Last Commit](https://img.shields.io/github/last-commit/mihakralj/obsidian-cloudsync?color=blue)](https://github.com/mihakralj/obsidian-cloudsync/commits/main)


[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=mihakralj_obsidian-cloudsync&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=mihakralj_obsidian-cloudsync)

View Full Documentation: https://mihakralj.github.io/obsidian-cloudsync/#/

# CloudSync for Obsidian

Secure cloud synchronization for Obsidian vaults using Azure Blob Storage, AWS S3, or Google Cloud Storage. CloudSync enables real-time backups, cross-device synchronization, and secure remote access to your Obsidian notes through enterprise-grade cloud storage providers.

## 🎯 Overview

CloudSync is a cost-effective alternative to [Obsidian Sync](doc/comparison.md), providing direct synchronization between your Obsidian vault and enterprise cloud storage providers. Key benefits include:
- Enterprise-grade security with end-to-end encryption
- Smart conflict resolution with line-level diff and merge
- Support for multiple cloud providers and vaults
- Significant cost savings (typically < $1/month vs $8/month for Obsidian Sync)
- Direct control over your cloud storage and data

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

1. **Cloud Provider Account**
   - Azure Storage Account, AWS S3 Bucket, or Google Cloud Storage
   - CORS configuration enabled for your storage
   - Access credentials with minimal required permissions

2. **Obsidian Setup**
   - Obsidian v1.0.0 or higher
   - Local vault with read/write permissions
   - Internet connectivity for sync operations

## 📖 Documentation

### User Documentation
- [Installation Guide](doc/install.md) - Step-by-step installation instructions
- [Cloud Cost Analysis](doc/cost.md) - Detailed cost breakdown and estimates
- [CloudSync vs Obsidian Sync](doc/comparison.md) - Feature comparison
- [Security Model](doc/security.md) - Security implementation details

### Developer Documentation
- [Technical Architecture](doc/architecture.md) - System architecture and implementation
- [Internal Architecture](doc/internals.md) - Sync process and components
- Cloud Provider Implementations:
  - [AWS Implementation](doc/awsFetch.md)
  - [Azure Implementation](doc/azureFetch.md)
  - [GCP Implementation](doc/gcpFetch.md)

## ❓ FAQ

### General Usage

A: CloudSync adds a Sync icon to the Obsidian ribbon. When clicked (with at least one cloud storage configured), it initiates the [sync process](doc/internals.md).

**Q: Does it work on mobile devices?**
A: Yes, CloudSync works on both Android and iOS devices, as well as desktop platforms.

**Q: Is my data private and secure?**
A: Yes. CloudSync uses:
- Direct, TLS-encrypted connections to cloud storage
- No intermediary servers
- Cloud provider's native encryption at rest
- Minimal required permissions model

### Technical Details

**Q: How are sync conflicts handled?**
A: CloudSync uses:
- MD5 hash tracking for change detection
- Line-level diff and merge for conflicting changes
- Preservation of both versions in conflict cases
- Clear conflict markers in content

**Q: Where are credentials stored?**
A: Credentials are stored:
- Locally in `data.json` in the plugin directory
- With selective field obfuscation
- Never transmitted to third parties

**Q: How does file deletion work?**
A: File deletion is handled through:
1. **Sync Process**
   - If deleted in cloud, file is removed locally
   - If deleted locally, file is removed from cloud

2. **Recovery Options**
   - Obsidian's `.trash` folder (configure in Settings → Files & Links)
   - Cloud provider retention features:
     - Azure Soft Delete
     - AWS/GCP versioning
     - Storage lifecycle policies
