import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { LocalFileManager } from './classes/LocalFileManager';
import { AzureFileManager } from './classes/AzureFileManager';
import { Synchronize, SyncRule, File } from './classes/Synchronize';

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

  const settingsJson = await readFileAsync(localDir+'/secrets.json', 'utf-8');
  const settings = JSON.parse(settingsJson);
  const accountName = settings.azureConnString.split(';').find((part: string) => part.startsWith('AccountName=')).split('=')[1]

  const localVault = new LocalFileManager(localDir);
  const remoteVault = new AzureFileManager(settings.azureConnString, accountName, path.basename(localDir));
  const synchronizer = new Synchronize(localVault, remoteVault);

  const actions = await synchronizer.syncActions();
  synchronizer.runAllScenarios(actions);

  actions.filter(action => action.rule !== 'TO_CACHE')
    .forEach(action => {
      const fileName = action.local ? action.local.name : action.remote ? action.remote.name : 'N/A';
      console.log(`Rule: ${action.rule}, File: ${fileName}`);
    });

}

main();