## Sign in to AWS Management Console
   - Make sure you have an AWS account with appropriate permissions
   - You can use an existing S3 bucket (skip to [Configure CORS for your S3 bucket](#configure-cors-for-your-s3-bucket)) or create a new S3 bucket
![](img/AWS01.png)

![](img/AWS02.png)
## Create an S3 bucket
   - Navigate to S3 in the AWS Console
   - Click "Create bucket"
   - Choose a unique bucket name (must be globally unique across all AWS)
	   - One S3 bucket can host multiple Obsidian vaults - each in its own directory
   - Keep all default settings on the form
   - Click "Create bucket" at the bottom of the form
![](img/AWS03.png)

![](img/AWS04.png)
## Configure CORS for your S3 bucket
   - Select your bucket and go to the "Permissions" tab
   - Scroll down to the "Cross-origin resource sharing (CORS)" section
   - Click "Edit" and add the following CORS configuration:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "DELETE"],
        "AllowedOrigins": ["app://obsidian.md"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 86400
    }
]
```
![](img/AWS05.png)

## Create IAM credentials for CloudSync
   - Go to IAM in the AWS Console
   - Create a new IAM user or use an existing one
   - Add the following IAM policy to the user (replace `your-bucket-name` with your actual bucket name):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name/*",
                "arn:aws:s3:::your-bucket-name"
            ]
        }
    ]
}
```
![](img/AWS06.png)

![](img/AWS07.png)

![](img/AWS08.png)
## Get your AWS credentials
   - After creating the IAM user, Create access key:
![](img/AWS09.png)
   - at "Access key best practices & alternatives" choose **Other**
![](img/AWS10.png)

![](img/AWS11.png)

   - save the following credentials:
     - Access Key ID
     - Secret Access Key (note: this is the only time you'll see Secret key)
     - S3 Bucket name

## Configure CloudSync settings
   - Enter your AWS credentials in the CloudSync settings
   - Test the connection
![](img/AWS12.png)

If setup is correct, you should see the message: **AWS connection test successful**

Note: Make sure to never share your AWS credentials and store them securely. It's recommended to use an IAM user with minimal required permissions rather than root credentials.
