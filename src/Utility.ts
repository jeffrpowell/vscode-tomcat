'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import * as vscode from "vscode";
import { instrumentOperationStep, sendInfo } from "vscode-extension-telemetry-wrapper";
import * as xml2js from "xml2js";
import * as Constants from "./Constants";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';

const isWindows = process.platform.indexOf('win') === 0;
const JAVA_FILENAME = 'java' + (isWindows ? '.exe' : '');
const SCRIPT_EXTENSION = isWindows ? '.bat' : '.sh';

interface IEnv {
    environmentVariable: string;
    value: string
}

/* tslint:disable:no-any */
export namespace Utility {
    export async function executeCMD(outputPane: vscode.OutputChannel, serverName: string, command: string, options: child_process.SpawnOptions, isStartupOrShutdown: boolean, ...args: string[]): Promise<void> {
        await new Promise<void>((resolve: () => void, reject: (e: Error) => void): void => {
            outputPane.show();
            let stderr: string = '';
            options.env = {...Utility.getCustomEnv(), ...(options.env ?? {})};
            const useStartupScripts: boolean = this.getVSCodeConfigBoolean(Constants.CONF_USE_STARTUP_SCRIPTS);
            const commandToSpawn = command.includes(" ") ? `"${command}"` : command; // workaround for path containing whitespace.
            const p: child_process.ChildProcess = (isStartupOrShutdown && useStartupScripts && isWindows) ? spawnWindowsScript(commandToSpawn, args, options) : child_process.spawn(commandToSpawn, args, options);
            p.stdout.on('data', (data: string | Buffer): void =>
                outputPane.append(serverName ? `[${serverName}]: ${data.toString()}` : data.toString()));
            p.stderr.on('data', (data: string | Buffer) => {
                stderr = stderr.concat(data.toString());
                outputPane.append(serverName ? `[${serverName}]: ${data.toString()}` : data.toString());
            });
            p.on('error', (err: Error) => {
                reject(err);
            });
            p.on('exit', (code: number) => {
                if (code !== 0) {
                    reject(new Error(localize('tomcatExt.commandfailed', 'Command failed with exit code {0}', code)));
                }
                resolve();
            });
        });

        function spawnWindowsScript(scriptFile: string, args: string[], options: child_process.SpawnOptions): child_process.ChildProcess {
            args.unshift(scriptFile);
            const quotedArgs: string = '"'.concat(args.reduce((accumulator: string, currentVal: string) => accumulator.concat(" ", currentVal), ""), '"');
            return child_process.spawn(Constants.WINDOWS_CMD, ['/c', quotedArgs], options);
        }
    }

    export async function openFile(file: string): Promise<void> {
        if (!await fse.pathExists(file)) {
            throw new Error(localize('tomcatExt.fileNotExist', `File ${file} does not exist.`));
        }
        vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
    }

    export function trackTelemetryStep(operationId: string, step: string, callback: (...args: any[]) => any): any {
        return instrumentOperationStep(operationId, step, callback)();
    }

    export function infoTelemetryStep(operationId: string, step: string): void {
        sendInfo(operationId, { finishedStep: step });
    }

    export function disableAutoRestart(): void {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tomcat');
        if (config) {
            config.update(Constants.RESTART_CONFIG_ID, false, true);
        }
    }

    export async function getServerStoragePath(defaultStoragePath: string, serverName: string): Promise<string> {
        return path.join(await getWorkspace(defaultStoragePath), serverName);
    }

    export async function getServerName(installPath: string, defaultStoragePath: string, existingServerNames: string[], runInPlace: boolean): Promise<string> {
        const workspace: string = await getWorkspace(defaultStoragePath);
        await fse.ensureDir(workspace);
        const fileNames: string[] = runInPlace ? [] : await fse.readdir(workspace);
        let serverName: string = path.basename(installPath);
        let index: number = 1;
        while (fileNames.indexOf(serverName) >= 0 || existingServerNames.indexOf(serverName) >= 0) {
            serverName = path.basename(installPath).concat(`-${index}`);
            index += 1;
        }
        return serverName;
    }

    async function getWorkspace(defaultStoragePath: string): Promise<string> {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tomcat');
        if (config) {
            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const workspace: string = config.get<string>('workspace');
            if (workspace && workspace !== '') {
                await fse.ensureDir(workspace);
                return workspace;
            }
        }
        return path.join(defaultStoragePath, 'tomcat');
    }

    export async function validateInstallPath(installPath: string): Promise<boolean> {
        const configFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'conf', 'server.xml'));
        const serverWebFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'conf', 'web.xml'));
        const serverBootstrapJarFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'bin', 'bootstrap.jar'));
        const serverJuliJarFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'bin', 'tomcat-juli.jar'));

        return await configFileExists && await serverWebFileExists && await serverBootstrapJarFileExists && await serverJuliJarFileExists;
    }

    export async function needRestart(httpPort: string, httpsPort: string, serverConfog: string): Promise<boolean> {
        const newHttpPort: string = await getPort(serverConfog, Constants.PortKind.Http);
        const newHttpsPort: string = await getPort(serverConfog, Constants.PortKind.Https);
        let restartConfig: boolean = Utility.getVSCodeConfigBoolean(Constants.RESTART_CONFIG_ID);
        return restartConfig && (httpPort !== newHttpPort || httpsPort !== newHttpsPort);
    }

    export async function readFileLineByLine(file: string, filterFunction?: (value: string) => boolean): Promise<string[]> {
        let result: string[] = [];
        await new Promise<void>((resolve) => {
            const lineReader: readline.ReadLine = readline.createInterface({
                input: fse.createReadStream(file),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line: string) => {
                if (!filterFunction || filterFunction(line)) {
                    result = result.concat(line);
                }
            });
            lineReader.on('close', () => {
                resolve();
            });
        });
        return result;
    }

    export function getTempStoragePath(): string {
        const chars: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
        let result: string = '';
        for (let i: number = 0; i < 5; i += 1) {
            // tslint:disable-next-line:insecure-random
            const idx: number = Math.floor(chars.length * Math.random());
            result += chars[idx];
        }
        return path.resolve(os.tmpdir(), `vscodetomcat_${result}`);
    }

    export async function getPort(serverXml: string, kind: Constants.PortKind): Promise<string> {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(DialogMessage.noServer);
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        let port: string;
        try {
            const jsonObj: any = await parseXml(xml);
            if (kind === Constants.PortKind.Server) {
                port = jsonObj.Server.$.port;
            } else if (kind === Constants.PortKind.Http) {
                port = jsonObj.Server.Service.find((item: any) => item.$.name === Constants.CATALINA).Connector.find((item: any) =>
                    (item.$.protocol === undefined || item.$.protocol.startsWith(Constants.HTTP))).$.port;
            } else if (kind === Constants.PortKind.Https) {
                port = jsonObj.Server.Service.find((item: any) => item.$.name === Constants.CATALINA).Connector.find((item: any) =>
                    (item.$.SSLEnabled.toLowerCase() === 'true')).$.port;
            }
        } catch (err) {
            port = undefined;
        }
        return port;
    }

    export async function setPort(serverXml: string, kind: Constants.PortKind, value: string): Promise<void> {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(DialogMessage.noServer);
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        const jsonObj: any = await parseXml(xml);
        if (kind === Constants.PortKind.Server) {
            jsonObj.Server.$.port = value;
        } else {
            const catalinaService: any = jsonObj.Server.Service.find((item: any) => item.$.name === Constants.CATALINA);

            if (kind === Constants.PortKind.Http) {
                const httpConnector: any = catalinaService.Connector.find((item: any) => (!item.$.protocol || item.$.protocol.startsWith(Constants.HTTP)));
                httpConnector.$.port = value;
            } else if (kind === Constants.PortKind.Https) {
                const httpsConnector: any = catalinaService.Connector.find((item: any) => (item.$.SSLEnabled.toLowerCase() === 'true'));
                httpsConnector.$.port = value;
            }
        }
        const builder: xml2js.Builder = new xml2js.Builder();
        const newXml: string = builder.buildObject(jsonObj);
        await fse.writeFile(serverXml, newXml);
    }

    export async function copyServerConfig(source: string, target: string): Promise<void> {
        const xml: string = await fse.readFile(source, 'utf8');
        const jsonObj: {} = await parseXml(xml);
        const builder: xml2js.Builder = new xml2js.Builder();
        const newXml: string = builder.buildObject(jsonObj);
        await fse.ensureFile(target);
        await fse.writeFile(target, newXml);
    }

    export async function parseXml(xml: string): Promise<any> {
        return new Promise((resolve: (obj: {}) => void, reject: (e: Error) => void): void => {
            xml2js.parseString(xml, { explicitArray: true }, (err: Error, res: {}) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    export function getStartExecutable(tomcatInstallPath: string): string {
        const useStartupScripts: boolean = this.getVSCodeConfigBoolean(Constants.CONF_USE_STARTUP_SCRIPTS);
        if (useStartupScripts) {
            return path.join(tomcatInstallPath, 'bin', Constants.TOMCAT_STARTUP_SCRIPT_NAME + SCRIPT_EXTENSION);
        }
        else {
            return this.getJavaExecutable();
        }
    }

    export function getShutdownExecutable(tomcatInstallPath: string): string {
        const useStartupScripts: boolean = this.getVSCodeConfigBoolean(Constants.CONF_USE_STARTUP_SCRIPTS);
        if (useStartupScripts) {
            return path.join(tomcatInstallPath, 'bin', Constants.TOMCAT_SHUTDOWN_SCRIPT_NAME + SCRIPT_EXTENSION);
        }
        else {
            return this.getJavaExecutable();
        }
    }

    export function getJavaExecutable(): string {
        const customEnv: { [key: string]: string } = getCustomEnv();
        let javaPath = customEnv["JAVA_HOME"];

        if (!javaPath) {
            // fallback to read java.home from redhat.java extension
            const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('java');
            if (config) {
                javaPath = config.get<string>('home');
            }
        }

        return javaPath ? path.join(javaPath, 'bin', JAVA_FILENAME) : JAVA_FILENAME;
    }

    export function getCustomEnv(): { [key: string]: string } {
        const tomcatConfig = vscode.workspace.getConfiguration('tomcat');
        const config = tomcatConfig?.get<IEnv[]>('customEnv') ?? [];

        const customEnv: { [key: string]: string } = {};
        config.forEach((env: IEnv) => {
            customEnv[env.environmentVariable] = env.value;
        });
        
        return {...process.env, ...customEnv};
    }

    export function getVSCodeConfigBoolean(key: string): boolean {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tomcat');
        if (config) {
            return config.get<boolean>(key);
        }
        else {
            return false;
        }
    }
}
