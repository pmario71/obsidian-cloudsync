import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { LocalFileManager } from './classes/LocalFileManager';
import { AzureFileManager } from './classes/AzureFileManager';
import { Synchronize, SyncRule, File } from './classes/Synchronize';
import { S3FileManager } from './classes/AwsFileManager';
import { GCPFileManager } from './classes/GcpFileManager';
import { FileManager } from './classes/AbstractFileManager';

export const readFileAsync = promisify(fs.readFile);
export const writeFileAsync = promisify(fs.writeFile);
export const unlinkAsync = promisify(fs.unlink);
export const readdirAsync = promisify(fs.readdir);
export const statAsync = promisify(fs.stat);

///////////////////////////////////////////////////////////
//                       main loop                       //
///////////////////////////////////////////////////////////
async function main() {

  //const localDir = "/Users/miha/Library/CloudStorage/OneDrive-Personal/logseq/personal";
  const localDir = "C:\\Users\\miha\\OneDrive\\logseq\\personal";

  const settingsJson = await readFileAsync(localDir+'/secrets.json', 'utf-8');
  const settings = JSON.parse(settingsJson);

  let remoteVault: FileManager
  if (settings.target == "azure") {
    remoteVault = new AzureFileManager(settings.azure.connection_string, path.basename(localDir));
  } else if (settings.target == "aws") {
    remoteVault = new S3FileManager(settings.aws.access_key, settings.aws.secret_key, settings.aws.bucket, settings.aws.region)
  } else if (settings.target == "gcp") {
    remoteVault = new GCPFileManager(settings.project_id, settings.gcp, settings.gcp.bucket )
  } else {
    console.error(`Invalid target: ${settings.target}`);
    return;
  }

  const localVault = new LocalFileManager(localDir);
  const synchronizer = new Synchronize(localVault, remoteVault);
  const actions = await synchronizer.syncActions();
  synchronizer.runAllScenarios(actions);

  console.log(`Files: ${actions.length}`);

  actions.filter(action => action.rule !== 'TO_CACHE')
    .forEach(action => {
      const fileName = action.local ? action.local.name : action.remote ? action.remote.name : 'N/A';
      console.log(`Rule: ${action.rule}, File: ${fileName}`);
    });

}

main();