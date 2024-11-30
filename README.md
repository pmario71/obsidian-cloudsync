# CloudSync for Obsidian

CloudSync is an Obsidian plugin that synchronizes vault contents using cloud object storage services from major providers (AWS S3, Azure Storage, GCP Cloud Storage). The plugin maintains bidirectional synchronization between local vaults and cloud storages, enabling backups and multi-device Obsidian synchronization. Synchronized cloud content remains accessible through standard cloud provider console, with typical storage costs ranging from cents to a few dollars per month depending on vault size and usage patterns.

**Important:** Implementation requires cloud provider account configuration and secure credential management. The complexity of setup varies by provider:

- Azure Storage offers the most straightforward setup through its web console
- AWS S3 requires intermediate configuration, including creation of a JSON access policy
- GCP Cloud Storage has the most complex setup, requiring execution of multiple commands in Google Cloud Shell

While the setup instructions are detailed and systematic, users without prior experience with cloud platforms should expect some learning curve, particularly for AWS and GCP implementations.

## 🚀 Features

- **Multi-Cloud Support**: Connect to leading three cloud providers:
  - Azure Blob Storage
  - AWS S3
  - Google Cloud Storage
- **Multi-Vault support**: Synchronizes multiple Obsidian vaults into a single storage bucket/account
- **Cross-Device Compatibility**: Synchronize Obsidian vaults between devices
- **Direct Cloud Connection**: No intermediate servers - data flows directly from Obsidian to cloud storage
- **Secure Transfer**: Uses transport encryption (TLS) and cloud provider's encryption at rest
- **Least privilege access**: Access credentials have lowest possible access rights to minimize the impact if credentials are compromised

## 📚 Documentation

This README provides only a high-level overview of CloudSync. [Access Wiki for detailed instructions](../../wiki).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.