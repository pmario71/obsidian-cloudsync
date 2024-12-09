# Cloud Storage Cost Components

All three cloud providers have similar storage cost structure:

1. **Storage Costs**
   - Monthly fee per GB of data stored
   - Typically ranges from $0.02 to $0.05 per GB/month
   - Some providers offer free tiers, there are other specialized tiers with different costs (archival or multi-geo redundant tiers)

2. **Data Transfer Costs**
   - Ingress (uploading): Typically free
   - Egress (downloading): Charged per GB
   - Slightly varies by region and volume of transfer
   - First few GB are often free

3. **Operation Costs**
   - API calls (read/write/list operations)
   - Usually negligible for normal (non-enterprise) usage
   - First few thousand operations often free

## Typical Obsidian Vault Sizes

| Size    | Total Size | Description                                    |
|---------|------------|------------------------------------------------|
| Small   | 1-5 GB     | Text-heavy notes, few attachments             |
| Medium  | 5-20 GB    | Regular attachments, some PDFs/images         |
| Large   | 20-50 GB   | Heavy media usage, many PDFs/images/backups   |

## Monthly Cost Comparison (USD)

### Small Vault (5 GB)

| Component      | Azure          | AWS            | GCP            |
|---------------|----------------|----------------|----------------|
| Storage       | $0.10         | $0.12         | $0.11         |
| Transfer*     | Free**        | Free***       | Free****      |
| Operations    | Free          | Free          | Free          |
| **Total**     | **$0.10**     | **$0.12**     | **$0.11**     |

### Medium Vault (20 GB)

| Component      | Azure          | AWS            | GCP            |
|---------------|----------------|----------------|----------------|
| Storage       | $0.40         | $0.48         | $0.44         |
| Transfer*     | $0.08         | $0.09         | $0.08         |
| Operations    | Free          | Free          | Free          |
| **Total**     | **$0.48**     | **$0.57**     | **$0.52**     |

### Large Vault (50 GB)

| Component      | Azure          | AWS            | GCP            |
|---------------|----------------|----------------|----------------|
| Storage       | $1.00         | $1.20         | $1.10         |
| Transfer*     | $0.20         | $0.23         | $0.20         |
| Operations    | $0.01         | $0.01         | $0.01         |
| **Total**     | **$1.21**     | **$1.44**     | **$1.31**     |

\* Transfer costs assume 10% of vault size transferred monthly
\** Azure: First 5 GB/month free
\*** AWS: First 1 GB/month free
\**** GCP: First 1 GB/month free

## Cost Optimization Tips

1. **Region Selection**
   - Choose a region closest to your location for better performance
   - Some regions have lower costs - check regional prices
   - Data transfer between regions incurs additional costs

2. **Lack of Transfer Optimization**
   - Plugin is transferring full files, not just deltas - diff and match is done on the client.
   - There is no RENAME api in any of cloud storages, so renaming will result in a delete and create operation.

3. **Free Tier Usage**
   - Azure: 5 GB free transfer/month
   - AWS: 1 GB free transfer/month
   - GCP: 1 GB free transfer/month
   - All providers offer free operations quota

4. **Automatic Sync Considerations**
   - Each sync interval triggers API operations to check for changes
   - Operation costs remain negligible for typical usage patterns

## Notes

- Prices are approximate and may vary by region
- Actual costs depend on usage patterns
- Most users fall in small/medium categories
- Free tier limits usually sufficient for small vaults
- Prices as of 2024, check provider pricing pages for current rates:
  - [Azure Blob Storage Pricing](https://azure.microsoft.com/pricing/details/storage/blobs/)
  - [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/)
  - [Google Cloud Storage Pricing](https://cloud.google.com/storage/pricing)
