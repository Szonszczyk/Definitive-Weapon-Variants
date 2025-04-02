import * as fs from "fs";
import * as path from "path";

import { WTTInstanceManager } from "./WTTInstanceManager";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import {
    Preset,
    APBSSettings,
    gamblerPreset,
    gamblerPresets,
    gamblerRarity,
    ConfigItem,
    bossesToChange,
    canBeUsedForBosses
} from "./references/configConsts";


export class ModsCompatibility
{
    private Instance: WTTInstanceManager;
    private modConfig: any;
    private loadFromCache: boolean;
    public APBSSetting: APBSSettings;
    private gamblerPresetsDB: gamblerPresets = { "Meta": [], "Decent": [], "Base": [], "Scav": [], "Meme": [] };
    public modsEnabled: any = { "APBS": false, "Gambler": false };
    private originalFile: any = { "APBS": {}, "Gambler": {} };
    private compatLayer: any = { "APBS": {}, "Gambler": {} };
    private modsDetected: any = { "APBS": false, "Gambler": false };
    
    public preSptLoad(Instance: WTTInstanceManager, config: any, loadFromCache: boolean): void 
    {
        this.Instance = Instance;
        this.modConfig = config;
        this.loadFromCache = loadFromCache;
        this.checkAndLoadAPBSBlacklist();
        this.checkAndLoadGamblerPresets();
        if ((this.modsDetected.APBS && !this.modsEnabled.APBS) || (this.modsDetected.Gambler && !this.modsEnabled.Gambler) ) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] ${this.modsDetected.APBS ? `APBS detected, additional compatibility can be set is config!` : ""} | ${this.modsDetected.Gambler ? `The Gambler detected, additional compatibility can be set is config!` : ""}`,
                LogTextColor.CYAN
            );
        }
    }

    public checkAndLoadAPBSBlacklist(): void
    {
        // check if APBS is even enabled in config
        if (this.Instance.PreSptModLoader.getImportedModsNames().includes(this.modConfig.apbs.apbsName)) this.modsDetected.APBS = true;
        const setSel = this.modConfig.apbs.settingSelected;
        const apbsSettingsEnabled: number = +setSel.custom + +setSel.progressive + +setSel.allWeapons + +setSel.onlyBaseWeapons;
        if (apbsSettingsEnabled === 0) return;
        this.modsEnabled.APBS = true;
        // show random error message when user is being silly lol
        if (apbsSettingsEnabled >= 2) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] modsCompatibility.checkAndLoadAPBSBlacklist: 2 or more APBS configs (config => apbs.settingSelected) are 'true', but only 1 is needed. Please remove unnecessary one`,
                LogTextColor.RED
            );
        }
        // check if APBS is even loaded
        if (!this.modsDetected.APBS) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] modsCompatibility.checkAndLoadAPBSBlacklist: APBS folder '${this.modConfig.apbs.apbsName}' was not found. Check the name and adjust it in config file. Skipping generating/updating of APBS Blacklist`,
                LogTextColor.RED
            );
            this.modsEnabled.APBS = false;
            return;
        }

        // check if blacklists.json is present in default folder
        const filePath = path.join(__dirname, `../../${this.modConfig.apbs.apbsName}/config/blacklists.json`);
        if (!fs.existsSync(filePath)) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] modsCompatibility.checkAndLoadAPBSBlacklist: APBS blacklists was not found in default path: '${filePath}'. Check config file if 'apbsName' is correct or check if you have installed APBS correctly. Skipping generating/updating of APBS Blacklist`,
                LogTextColor.RED
            );
            this.modsEnabled.APBS = false;
            return;
        }
        // load file and check structure
        const APBSConfig = JSON.parse(fs.readFileSync(filePath, "utf-8", (err) => {}));
        if (APBSConfig?.weaponBlacklist?.tier1Blacklist == undefined) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] modsCompatibility.checkAndLoadAPBSBlacklist: APBS blacklists is different then default one. It's probably due to some change in APBS or incorrect load of blacklists file. Skipping generating/updating of APBS Blacklist`,
                LogTextColor.RED
            );
            return;
        }
        this.originalFile.APBS = APBSConfig;
        this.compatLayer.APBS = structuredClone(APBSConfig);
        this.compatLayer.APBS.weaponBlacklist = this.modConfig.apbs.blacklistOtherWeapons;

        // load proper blacklist config setting
        if (this.modConfig.apbs.settingSelected.onlyBaseWeapons) this.APBSSetting = this.modConfig.apbs.settings.onlyBaseWeapons;
        if (this.modConfig.apbs.settingSelected.allWeapons) this.APBSSetting = this.modConfig.apbs.settings.allWeapons;
        if (this.modConfig.apbs.settingSelected.progressive) this.APBSSetting = this.modConfig.apbs.settings.progressive;
        if (this.modConfig.apbs.settingSelected.custom) this.APBSSetting = this.modConfig.apbs.settings.custom;
    }

    public addToAPBSBlacklist(id: string, rarity: string, variantName: string, variantShortName: string): void 
    {
        if (!this.modsEnabled.APBS) return;
        for (let i = 1; i < 8; i++) {
            if (this.APBSSetting[i].includes(rarity) || this.modConfig.apbs.notAddVariantTypes.includes(variantName) || this.modConfig.apbs.notAddWeapons.includes(variantShortName)) {
                this.compatLayer.APBS.weaponBlacklist[`tier${i}Blacklist`].push(id);
            }
        }
    }

    public saveAPBSBlacklist(): void 
    {
        if (!this.modsEnabled.APBS) return;
        this.checkAPBSConfig();
        // save file if automatic update of APBS blacklist is disabled to not do double the job
        if (!this.modConfig.apbs.automaticUpdate.enabled && (JSON.stringify(this.compatLayer.APBS) != JSON.stringify(this.originalFile.APBS))) {
            fs.writeFileSync(path.join(__dirname, "../config/blacklists.json"), JSON.stringify(this.compatLayer.APBS, null, 8).replace(/\n/g, '\r\n'), "utf-8");
            this.Instance.logger.log(
                `[${this.Instance.modName}] New file '/config/blacklists.json' was generated. You can now move it to '${this.modConfig.apbs.apbsName}/config/blacklists.json' and replace file there`,
                LogTextColor.CYAN
            );
            return;
        }
        // automatic update of APBS blacklist here
        if (!this.modConfig.apbs.automaticUpdate.enabled) return;
        if ((JSON.stringify(this.compatLayer.APBS) != JSON.stringify(this.originalFile.APBS)) && !this.loadFromCache) {
            const filePath = path.join(__dirname, `../../${this.modConfig.apbs.apbsName}/config/blacklists.json`);
            fs.writeFileSync(filePath, JSON.stringify(this.compatLayer.APBS, null, 8).replace(/\n/g, '\r\n'), "utf-8");
            this.Instance.logger.log(
                `[${this.Instance.modName}] Automatic update of APBS Blacklist was finished. Restart server to make changes`,
                LogTextColor.RED
            );
        } else {
            this.Instance.logger.log(
                `[${this.Instance.modName}] Automatic update of APBS Blacklist was finished successfully!`,
                LogTextColor.GREEN
            );
        }
    }

    public createOrUpdateAPBSPreset(items: ConfigItem): void
    {
        if (!this.modsEnabled.APBS) return;
        const BHVconfig = this.modConfig.apbs.bossesHaveVariants;
        if (!BHVconfig.enabled) return;
        
        const targetPath = path.join(path.join(__dirname, `../../${this.modConfig.apbs.apbsName}/presets/`), BHVconfig.presetName);
        const sourcePath = path.join(path.join(__dirname, `../../${this.modConfig.apbs.apbsName}/presets/`), "example");
        if (!fs.existsSync(targetPath)) {
            try {
                this.copyFolderSync(sourcePath, targetPath);
                this.Instance.logger.log(
                    `[${this.Instance.modName}] APBS preset folder '${BHVconfig.presetName}' has been created`,
                    LogTextColor.CYAN
                );
            } catch (error) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] modsCompatibility.createOrUpdateAPBSPreset: Failed to create preset folder ${BHVconfig.presetName} in location ${targetPath}`,
                    LogTextColor.RED
                );
                return;
            }
        }
        let fileChanged = 0;
        for (let i = 1; i < 8; i++) {
            const exampleFilePath = path.join(__dirname, `../../${this.modConfig.apbs.apbsName}/presets/example/Tier${i}_equipment.json`);
            const exampleFile = JSON.parse(fs.readFileSync(exampleFilePath, "utf-8", (err) => {}));
            const presetFilePath = path.join(__dirname, `../../${this.modConfig.apbs.apbsName}/presets/${BHVconfig.presetName}/Tier${i}_equipment.json`);
            const presetFileOriginal = JSON.parse(fs.readFileSync(presetFilePath, "utf-8", (err) => {}));
            const presetFile = structuredClone(presetFileOriginal);

            for (const bossName of bossesToChange) {
                const eq = exampleFile[bossName].equipment;
                const newBossEq = presetFile[bossName].equipment;

                newBossEq.FirstPrimaryWeapon.LongRange = this.bossesHaveVariantsCalculations(items, i, eq.FirstPrimaryWeapon.LongRange);
                newBossEq.FirstPrimaryWeapon.ShortRange = this.bossesHaveVariantsCalculations(items, i, eq.FirstPrimaryWeapon.ShortRange);
                newBossEq.SecondPrimaryWeapon.LongRange = this.bossesHaveVariantsCalculations(items, i, eq.SecondPrimaryWeapon.LongRange);
                newBossEq.SecondPrimaryWeapon.ShortRange = this.bossesHaveVariantsCalculations(items, i, eq.SecondPrimaryWeapon.ShortRange);
                newBossEq.Holster = this.bossesHaveVariantsCalculations(items, i, eq.Holster);
            }
            if (JSON.stringify(presetFileOriginal) != JSON.stringify(presetFile)) {
                fs.writeFileSync(presetFilePath, JSON.stringify(presetFile, null, 4), "utf-8");
                fileChanged++;
            }
        }
        if (fileChanged > 0) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] Bosses Have Variants - APBS preset creation was finished. Restart server to make changes`,
                LogTextColor.RED
            );
        } else {
            this.Instance.logger.log(
                `[${this.Instance.modName}] Bosses Have Variants - APBS preset creation was finished successfully!`,
                LogTextColor.GREEN
            );
        }
    }

    private copyFolderSync(source: string, target: string) {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }
    
        const entries = fs.readdirSync(source, { withFileTypes: true });
    
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const targetPath = path.join(target, entry.name);
    
            if (entry.isDirectory()) {
                this.copyFolderSync(sourcePath, targetPath); // Recursively copy subdirectories
            } else {
                fs.copyFileSync(sourcePath, targetPath); // Copy files
            }
        }
    }

    private bossesHaveVariantsCalculations(
        items: ConfigItem,
        level: number,
        baseWeapons: Record<string, number>
    ): Record<string, number> {
        const bossWeapons: Record<string, number> = structuredClone(baseWeapons);
        const BHVconfig = this.modConfig.apbs.bossesHaveVariants;
        const weightSum: number = Object.values(bossWeapons).reduce((acc: number, value: number) => acc + value, 0);
        const variantsToAdd: Record<string, number> = {};
        const baseWeaponsToAdd: Record<string, number> = {};
        for (const weapon in bossWeapons) {
            const weight = bossWeapons[weapon];
            baseWeaponsToAdd[weapon] = Math.ceil( weight/weightSum * BHVconfig.baseWeaponWeights ); 
            for (const itemID in items) {
                const item = items[itemID];
                if (item.itemTplToClone === weapon && canBeUsedForBosses[item.additionalInfo.variantType]) {
                    variantsToAdd[itemID] = Math.ceil( canBeUsedForBosses[item.additionalInfo.variantType] * (weight/weightSum) );
                }
            }
        }
        const variantWeaponsWeightSum: number = Object.values(variantsToAdd).reduce((acc: number, value: number) => acc + value, 0);
        for (const key in variantsToAdd) {
            variantsToAdd[key] *= Math.ceil( (BHVconfig.variantWeaponsWeightPerLevel * level) / variantWeaponsWeightSum );
        }
        return Object.assign(variantsToAdd, baseWeaponsToAdd);
    }

    private checkAPBSConfig(): void
    {
        const filePath = path.join(__dirname, `../../${this.modConfig.apbs.apbsName}/config/config.json`);
        const APBSConfig = JSON.parse(fs.readFileSync(filePath, "utf-8", (err) => {}));
        if (!APBSConfig.compatibilityConfig.enableModdedWeapons) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] APBS compatibility is enabled in DWV config, but modded weapons are disabled in APBS config. Variants won't be added to enemies. You can change it in user/mods/acidphantasm-progressivebotsystem/APBSConfig.exe`,
                LogTextColor.RED
            );
        }
        if (this.modConfig.apbs.bossesHaveVariants.enabled) {
            if (!APBSConfig.usePreset) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] Bosses Have Variants in enabled in DWV config, but preset is not enabled in APBS config! Bosses Have Variants feature will not work! You can change it in user/mods/acidphantasm-progressivebotsystem/APBSConfig.exe`,
                    LogTextColor.RED
                );
            }
            if (APBSConfig.presetName != this.modConfig.apbs.bossesHaveVariants.presetName) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] Bosses Have Variants preset name in DWV config is different than APBS config! Bosses Have Variants feature will not work!`,
                    LogTextColor.RED
                );
            }
        }
    }

    public checkAndLoadGamblerPresets(): void
    {
        if (this.Instance.PreSptModLoader.getImportedModsNames().includes(this.modConfig.theGambler.gamblerName)) this.modsDetected.Gambler = true;
        if(!this.modConfig.theGambler.enabled) return;
        this.modsEnabled.Gambler = true;

        // check if theGambler is even loaded
        if (!this.modsDetected.Gambler) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] modsCompatibility.checkAndLoadGamblerPresets: Gambler folder '${this.modConfig.theGambler.gamblerName}' was not found. Check the name and adjust it in config file. Skipping generating/updating of Gambler presets`,
                LogTextColor.RED
            );
            this.modsEnabled.Gambler = false;
            return;
        }
        const filePath = path.join(__dirname, `../../${this.modConfig.theGambler.gamblerName}/src/containers/Weapons.ts`);
        // check if file is present
        if (!fs.existsSync(filePath)) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] modsCompatibility.saveGamblerPresets: Gambler Weapons was not found in default path: '${filePath}'. Skipping generating/updating of Gambler presets`,
                LogTextColor.RED
            );
            this.modsEnabled.Gambler = false;
            return;
        }
        // load file
        const gamblerPresets = fs.readFileSync(filePath, "utf-8", (err) => {});
        this.originalFile.Gambler = gamblerPresets;
        this.compatLayer.Gambler = structuredClone(gamblerPresets);
    }


    public createPresetForGambler(basePreset: Preset, ids: string[], rarity: string, variantName: string): void
    {
        if(!this.modsEnabled.Gambler || !basePreset) return;

        const basePresetCopy = structuredClone(basePreset);
        const newPreset: gamblerPreset = {
            Id: ids[4],
            Name: basePresetCopy._name.replace("Default Preset", "Gambler Preset"),
            Root: ids[3],
            Items: basePresetCopy._items
        };
        newPreset.Items[0]._id = ids[3];
        for (const partOfPreset of newPreset.Items) {
            if (partOfPreset.parentId == basePresetCopy._parent) partOfPreset.parentId = ids[3];
        }
        if (!this.modConfig.theGambler.notAddVariantTypes.includes(variantName)) {
            const category = gamblerRarity[rarity];
            if (!category || !this.gamblerPresetsDB[category]) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] modsCompatibility.createPresetForGambler: '${newPreset.Name}' rarity '${rarity}' is invalid`,
                    LogTextColor.RED
                );
            } else {
                this.gamblerPresetsDB[category].push(newPreset);
            }
        }
    }

    public saveGamblerPresets(): void
    {
        if(!this.modsEnabled.Gambler) return;
        
        // bastardized text file because why would anyone cares? Its only a text file, chill
        const gamblerPresetsTxt = `
public variantPresets = [
  	${JSON.stringify(this.gamblerPresetsDB.Meta, null, 2)},
	${JSON.stringify(this.gamblerPresetsDB.Decent, null, 2)},
	${JSON.stringify(this.gamblerPresetsDB.Base, null, 2)},
	${JSON.stringify(this.gamblerPresetsDB.Scav, null, 2)},
	${JSON.stringify(this.gamblerPresetsDB.Meme, null, 2)}
]
constructor() {
	this.presets = this.presets.map((p, i) => p.concat(this.variantPresets[i]));
}
}
`;
        const searchText = "public variantPresets";
        const index = this.originalFile.Gambler.indexOf(searchText);
        let gamblerPresetsNew = "";
        if (index !== -1) {
            gamblerPresetsNew = this.originalFile.Gambler.substring(0, index-1) + gamblerPresetsTxt;
        } else {
            gamblerPresetsNew = structuredClone(this.originalFile.Gambler);
            let count = 0;
            while (!gamblerPresetsNew.endsWith("}") && count < 5) {
                gamblerPresetsNew = gamblerPresetsNew.slice(0, -1); // Remove last character
                count++;
            }
            if (!gamblerPresetsNew.endsWith("}")) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] modsCompatibility.saveGamblerPresets: Gambler Weapons file is different then default one. Skipping generating/updating of Gambler Presets`,
                    LogTextColor.RED
                );
                return;
            }
            gamblerPresetsNew = gamblerPresetsNew.slice(0, -1) + gamblerPresetsTxt;
        }
        // save file if automatic update of Gambler Presets is disabled to not do double the job
        if (!this.modConfig.theGambler.automaticUpdate.enabled && (this.originalFile.Gambler != gamblerPresetsNew)) {
            fs.writeFileSync(path.join(__dirname, "../config/Weapons.ts"), gamblerPresetsNew);
            this.Instance.logger.log(
                `[${this.Instance.modName}] Updated file '/config/Weapons.ts' was generated. You can now move it to '${this.modConfig.theGambler.gamblerName}/src/containers/Weapons.ts' and replace file there`,
                LogTextColor.CYAN
            );
            return;
        }

        // automatic update of Gambler Presets here
        if (!this.modConfig.theGambler.automaticUpdate.enabled) return;
        if ((this.originalFile.Gambler != gamblerPresetsNew) && !this.loadFromCache) {
            const filePath = path.join(__dirname, `../../${this.modConfig.theGambler.gamblerName}/src/containers/Weapons.ts`);
            fs.writeFileSync(filePath, gamblerPresetsNew);
            this.Instance.logger.log(
                `[${this.Instance.modName}] Automatic update of Gambler Presets was finished. Restart server to make changes`,
                LogTextColor.RED
            );
        } else {
            this.Instance.logger.log(
                `[${this.Instance.modName}] Automatic update of Gambler Presets was finished successfully!`,
                LogTextColor.GREEN
            );
        }
    }
}