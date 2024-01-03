import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { LocalFileManager } from './classes/LocalFileManager';
import { AzureFileManager } from './classes/AzureFileManager';
import { Synchronize, SyncRule, File } from './classes/Synchronize';
import { S3FileManager } from './classes/AwsFileManager';

export const readFileAsync = promisify(fs.readFile);
export const writeFileAsync = promisify(fs.writeFile);
export const unlinkAsync = promisify(fs.unlink);
export const readdirAsync = promisify(fs.readdir);
export const statAsync = promisify(fs.stat);

///////////////////////////////////////////////////////////
//                       main loop                       //
///////////////////////////////////////////////////////////
async function main() {

  const localDir = "/Users/miha/Library/CloudStorage/OneDrive-Personal/logseq/personal";
  //const localDir = "C:\\Users\\miha\\OneDrive\\logseq\\personal";
  const settingsJson = await readFileAsync(localDir+'/secrets.json', 'utf-8');
  const settings = JSON.parse(settingsJson);

  const accountName = settings.azureConnString.split(';').find((part: string) => part.startsWith('AccountName=')).split('=')[1]
  //const remoteVault = new AzureFileManager(settings.azureConnString, accountName, path.basename(localDir));

  const awsAccessKey = settings.awsConnString.split(';').find((part: string) => part.startsWith('AccessKey=')).split('=')[1]
  const awsSecretKey = settings.awsConnString.split(';').find((part: string) => part.startsWith('SecretKey=')).split('=')[1]
  const awsBucket = settings.awsConnString.split(';').find((part: string) => part.startsWith('Bucket=')).split('=')[1]
  const awsRegion = settings.awsConnString.split(';').find((part: string) => part.startsWith('Region=')).split('=')[1]
  const remoteVault = new S3FileManager(awsAccessKey, awsSecretKey, awsBucket, awsRegion)

  const gcpProjectId = ""
  const gcpKeyFileName = ""
  const gcpBucket = path.basename(localDir)


  const localVault = new LocalFileManager(localDir);
  const synchronizer = new Synchronize(localVault, remoteVault);

  const actions = await synchronizer.syncActions();
  //synchronizer.runAllScenarios(actions);
  console.log(`Files: ${actions.length}`);

  actions.filter(action => action.rule !== 'TO_CACHE')
    .forEach(action => {
      const fileName = action.local ? action.local.name : action.remote ? action.remote.name : 'N/A';
      console.log(`Rule: ${action.rule}, File: ${fileName}`);
    });

}

main();