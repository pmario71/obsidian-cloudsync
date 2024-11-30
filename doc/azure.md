## Sign in to Azure Portal
- Make sure that your Azure subscription allows Azure storage
- You can reuse an existing Storage Account (skip to next step)
![](img/Azure01.png)

## Create a Storage Account
- Storage account name has to be **globally** unique
- One storage account will host many Obsidian vaults - each one in its own blob container
- Choose the name of storage account wisely
- Go to storage account after it is created
![](img/Azure02.png)

## Configure CORS Settings
- Go to Azure Portal > Your Storage Account > Settings > Resource sharing (CORS)
- Add a new CORS rule:
    - Allowed origins: *
    - Allowed methods: GET, PUT, DELETE
    - Allowed headers: *
    - Exposed headers: *
    - Max age: 86400
![](img/Azure05.png)

## Get your Azure Credentials
- Navigate to `Access keys` under `Security + networking` and copy the following credentials:
    - Storage Account Name
    - Connection String or Account Key
![](img/Azure04.png)

## Configure CloudSync Settings
- Use these credentials in CloudSync settings and test the connection
![](img/Azure06.png)

If setup is correct, you should see the message: **Azure connection test successful**
