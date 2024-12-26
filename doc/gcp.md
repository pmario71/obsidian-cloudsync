## GCP Setup

## Sign in to Google Cloud Console
- Make sure you have a Google Cloud account with billing enabled
- You can use an existing (or default) project or create a new one
-  Navigate to Cloud Storage:
![](img/GCP01.png)

## Create a Cloud Storage bucket
- Click "Create Bucket"
- Choose a unique bucket name (must be globally unique across all GCP)
- One bucket will host many Obsidian vaults - each one in its own directory
- Select your preferred location type and region
- Choose default storage class (Standard is recommended)

![](img/GCP02.png)

## Create Service Account Credentials
- Go to "IAM & Admin" > "Service Accounts"
![](img/GCP03.png)
- Click "Create Service Account"
![](img/GCP04.png)
Note down the **email address** of created service account

## Configure CORS Settings
- Open GCP Cloud Shell in top right corner:
![](img/GCP05.png)

- Once Cloud Shell opens, execute:

```bash
echo '[{"origin": ["*"],"method": ["GET", "PUT", "DELETE"],"responseHeader": ["*"],"maxAgeSeconds": 86400}]' > cors.json
gsutil cors set cors.json gs://<BUCKET-NAME>
```

- Change *BUCKET-NAME* with the name of actual bucket you created

- This should set CORS permissions for the bucket. Verify CORS settings by executing:

```
gsutil cors get gs://<BUCKET-NAME>
```

expected response:

```
[{"maxAgeSeconds": 86400, "method": ["GET", "PUT", "DELETE"], "origin": ["*"], "responseHeader": ["*"]}]
```

## Configure Service Account Permissions
- Still in cloud shell, execute:

```
gsutil iam ch serviceAccount:<SERVICE-ACCOUNT-EMAIL>>:objectAdmin gs://<BUCKET-NAME>>
```

- Change *SERVICE-ACCOUNT-EMAIL* with the name of actual service account email

- this should set Access permissions correctly for Service Account. Verify IAM permissions by executing:

```
gsutil iam get gs://<BUCKET-NAME>>
```

expected response should include the objectAdmin role for your service account:

```
{
  "members": [
	"serviceAccount:<SERVICE-ACCOUNT-EMAIL>"
  ],
  "role": "roles/storage.objectAdmin"
}
```

## Get your GCP Credentials
![](img/GCP06.png)

- Create and download JSON file with private key:
![](img/GCP07.png)

Open the downloaded JSON file. From its JSON content you'll need to extract:
- private_key (everything, including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----)
- client_email

```
private_key	"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCg3hLL22M/uPFv\n5xd47dXvVWhuQ
...
Yf4lzgaEEDqSzacouBPoR/8IstvZv59RBZG2mm\naIiAphBpQqQLkEBPj9kZFdD42T9YWFo7WtpHlW0UT2dhVUF/mzSB4LBqgIMfkTnI\nUbJvsZjOMLIVc+6yAIpYyBA=\n-----END PRIVATE KEY-----\n"
client_email	"obsidianserviceaccount@obsidian-443303.iam.gserviceaccount.com"
```

Now we are ready to configure CloudSync plugin

## Configure CloudSync Settings
- Enter your GCP credentials in CloudSync settings
- Test the connection
![](img/GCP08.png)

If setup is correct, you should see the message: **GCP connection test successful**

Note: This process makes a minimal CORS permissions and separate Service Account with minimal required permissions.
