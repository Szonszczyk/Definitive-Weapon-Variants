import * as fs from "fs";
import * as path from "path";

import { WTTInstanceManager } from "./WTTInstanceManager";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

import {
    variantIDsInterface
} from "./references/configConsts";

import { 
    ItemConfigurationKeyed,
    VariantConfigurationKeyed
} from "./references/generationConsts";

export class Helpers
{
    private Instance: WTTInstanceManager;
    public colorConverterAPILoaded: boolean;
    public fileWasChanged: boolean;
    public dbVariants: VariantConfigurationKeyed;
    public dbIds: variantIDsInterface;
    public dbShortnames: { [shortName: string]: string };
    public dbAttachments: ItemConfigurationKeyed;
    public dbItemsIds: { [ItemName: string]: string };
    public dbPresets: { [ItemName: string]: any };

    constructor(Instance: WTTInstanceManager)
    {
        this.Instance = Instance;
        this.colorConverterAPILoaded = this.colorConverterAPICheck();
        this.fileWasChanged = this.checkFiles();
        this.dbVariants = this.loadCombinedConfigVariants('../db/Variants');
        this.dbIds = this.loadCombinedConfigIds('../db/Ids');
        this.dbShortnames = this.loadCombinedShortnames('../db/Shortnames');
        this.dbAttachments = this.loadCombinedAttachments('../db/Attachments');
        this.dbItemsIds = this.loadCombinedItemsIds('../db/ItemsIds');
        this.dbPresets = this.loadCombinedPresets('../db/Presets')
    }

    private colorConverterAPICheck(): boolean 
    {
        const pluginName = "rairai.colorconverterapi.dll";
        try {
            const pluginList = fs.readdirSync("./BepInEx/plugins").map(plugin => plugin.toLowerCase());
            return pluginList.includes(pluginName);
        } catch {
            return false;
        }
    }

    private getFileStatus(filePath: string): 'OK' | 'MODIFIED' | 'MISSING' {
        try {
            const stats = fs.statSync(path.resolve(__dirname, filePath));
            const modifiedTime = stats.mtime.getTime();
            const currentTime = Date.now();
            const oneHourInMs = 60 * 60 * 1000;
    
            return (currentTime - modifiedTime <= oneHourInMs) ? 'MODIFIED' : 'OK';
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                return 'MISSING';
            } else {
                return 'MISSING';
            }
        }
    }
    
    private checkFiles(): boolean {

        const pathsToCheck = [
            "../db/Variants",
            "../db/Attachments",
            "../db/Presets",
            "../db/Shortnames"
        ];

        for (const pathToCheck of pathsToCheck) {
            const filePath = path.join(__dirname, pathToCheck);
            const variantFilePaths = fs.readdirSync(filePath).filter(file => path.extname(file).toLowerCase() === '.json');
            for (const file of variantFilePaths) {
                if (this.getFileStatus(filePath + "/" + file) == "MODIFIED") return false;
            }
        }

        const cacheFiles = [
            "../db/Cache/generatedWeapons.json",
            "../db/Cache/generatedItems.json"
        ];
        for (const file of cacheFiles) {
            if (this.getFileStatus(file) == "MISSING") return false;
        }
        if (this.getFileStatus("../config/config.jsonc") == "MISSING") {
            if (this.getFileStatus("../config/defaultConfig.jsonc") == "MODIFIED") return false;
        } else {
            if (this.getFileStatus("../config/config.jsonc") == "MODIFIED") return false;
        }
        return true;
    }

    private loadCombinedConfig<T>(
        subfolder: string,
        mergeStrategy?: (acc: T, current: T) => void
    ): T {
        const folderPath = path.join(__dirname, subfolder);
        const configFiles = fs.readdirSync(folderPath);
        const combinedConfig: T = {} as T;

        configFiles.forEach((file) => {
            const filePath = path.join(folderPath, file);
            const fileContents = fs.readFileSync(filePath, "utf-8");
            const config = JSON.parse(fileContents) as T;

            if (mergeStrategy) {
                mergeStrategy(combinedConfig, config);
            } else {
                Object.assign(combinedConfig, config);
            }
        });

        return combinedConfig;
    }

    private loadCombinedConfigVariants(usePath: string): VariantConfigurationKeyed {
        return this.loadCombinedConfig<VariantConfigurationKeyed>(usePath, (combined, config) => {
            for (const variant in config) {
                if (combined[variant]) {
                    const c = combined[variant];
                    const f = config[variant];

                    // Determine original: prefer one with Description, default to combined
                    const [original, copy] =
                        "Description" in f && !("Description" in c) ? [f, c] : [c, f];

                    // Merge Weapons with deduplication
                    if (copy.Weapons) {
                        original.Weapons = [...new Set([...(original.Weapons || []), ...copy.Weapons])];
                    }

                    // Merge additionalChanges
                    if (copy.additionalChanges) {
                        original.additionalChanges = {
                            ...(original.additionalChanges || {}),
                            ...copy.additionalChanges
                        };
                    }
                    combined[variant] = original;
                    delete config[variant];
                }
            }

            Object.assign(combined, config);
        });
    }

    private loadCombinedConfigIds(usePath: string): variantIDsInterface {
        return this.loadCombinedConfig<variantIDsInterface>(usePath, (combined, config) => {
            for (const variant in config) {
                if (combined[variant]) {
                    Object.assign(combined[variant], config[variant]);
                    delete config[variant];
                }
            }
            Object.assign(combined, config);
        });
    }

    private loadCombinedShortnames(usePath: string): { [shortName: string]: string } {
        return this.loadCombinedConfig<{ [shortName: string]: string }>(
            usePath
        );
    }

    private loadCombinedAttachments(usePath: string): ItemConfigurationKeyed {
        return this.loadCombinedConfig<ItemConfigurationKeyed>(usePath);
    }

    private loadCombinedItemsIds(usePath: string): {[ItemName: string]: string}  {
        return this.loadCombinedConfig<{[ItemName: string]: string} >(usePath);
    }

    private loadCombinedPresets(usePath: string): {[ItemName: string]: any}  {
        return this.loadCombinedConfig<{[ItemName: string]: any} >(usePath);
    }

    public saveJsonToFile(
        data: any,
        subfolder: string
    ): void {
        const formatted = JSON.stringify(data, (key, value) => value, 2)
            .replace(/\[\s*([\s\S]*?)\s*]/g, match => match.replace(/\s+/g, ' '));

        const newName = this.Instance.hashUtil.generate();
        const filePath = path.join(__dirname, `../db/${subfolder}/${newName}.json`);
        
        fs.writeFileSync(filePath, formatted);

        this.Instance.logger.log(
            `[${this.Instance.modName}] Helpers.saveJsonToFile: Database '${subfolder}/${newName}.json' was created`,
            LogTextColor.GREEN
        );
    }

}