'use strict';

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogMessage {
    export const yes: MessageItem = { title: localize('tomcatExt.yes', 'Yes') };
    export const no: MessageItem = { title: localize('tomcatExt.no', 'No'), isCloseAffordance: true };
    export const cancel: MessageItem = { title: localize('tomcatExt.cancel', 'Cancel'), isCloseAffordance: true };
    export const never: MessageItem = { title: localize('tomcatExt.never', 'Never') };
    export const moreInfo: MessageItem = { title: localize('tomcatExt.moreInfo', 'More Info') };
    export const selectServer: string = localize('tomcatExt.selectServer', 'Select Tomcat Server');
    export const addServer: string = localize('tomcatExt.addServer', 'Add New Server');
    export const noServer: string = localize('tomcatExt.noServer', 'There are no Tomcat Servers.');
    export const noPackage: string = localize('tomcatExt.noPackage', 'The selected package is not under current workspace.');
    export const noServerConfig: string = localize('tomcatExt.noServerConfig', 'The Tomcat Server is broken. It does not have server.xml');
    export const selectWarPackage: string = localize('tomcatExt.selectWarPackage', 'Select War Package');
    export const selectDirectory: string = localize('tomcatExt.selectDirectory', 'Select Tomcat Directory');
    export const deleteConfirm: string = localize('tomcatExt.deleteConfirm', 'Are you sure you want to delete this server?');
    export const serverRunning: string = localize('tomcatExt.serverRunning', 'This Tomcat Server is already started.');
    export const serverStopped: string = localize('tomcatExt.serverStopped', 'This Tomcat Server was stopped.');
    export const startServer: string = localize('tomcatExt.startServer', 'The Tomcat server needs to be started before browsing. Would you like to start it now?');
    export const invalidWebappFolder: string = localize('tomcatExt.invalidWebappFolder', 'The folder is not a valid web app to run on Tomcat Server.');
    export const invalidWarFile: string = localize('tomcatExt.invalidWarFile', 'Please select a .war file.');
    export const pickFolderToGenerateWar: string = localize('tomcatExt.pickFolderToGenerateWar', 'Please select the folder(s) you want to generate war package');
    export const serverAlreadyAdded: string = localize('tomcatExt.serverAlreadyAdded', 'That server has already been added to the list.');

    export function getServerPortChangeErrorMessage(serverName: string, serverPort: string): string {
        return localize('tomcatExt.serverPortChangeError', 'Changing the server port of a running server {0} will cause it unable to shutdown. Would you like to change it back to {1}?', serverName, serverPort);
    }
    export function getConfigChangedMessage(serverName: string): string {
        return localize('tomcatExt.configChanged', 'server.xml of running server {0} has been changed. Would you like to restart it?', serverName);
    }
    export function getWarGeneratedInfo(count: number): string {
        return localize('tomcatExt.warGenerated', '{0} war package(s) was generated.', count);
    }
}
