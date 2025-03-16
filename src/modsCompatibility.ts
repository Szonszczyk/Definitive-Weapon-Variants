import * as fs from "fs";
import * as path from "path";
import { WTTInstanceManager } from "./WTTInstanceManager";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { Preset, Item } from "./references/configConsts";

interface APBSSettings
{
    1: string[];
    2: string[];
    3: string[];
    4: string[];
    5: string[];
    6: string[];
    7: string[];
}

interface gamblerPreset
{
    Id: string;
    Name: string;
    Root: string;
    Items: Item[];
}

interface gamblerPresets
{
    Meta: gamblerPreset[];
    Decent: gamblerPreset[];
    Base: gamblerPreset[];
    Scav: gamblerPreset[];
    Meme: gamblerPreset[];
}

enum gamblerRarity
{
    Ultimate = "Meta",
    Superior = "Meta",
    Advanced = "Decent",
    Niche = "Decent",
    Baseline = "Base",
    Flawed = "Scav",
    Meme = "Meme"
}


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
        //{ "tier1Blacklist": [], "tier2Blacklist": [], "tier3Blacklist": [], "tier4Blacklist": [], "tier5Blacklist": [], "tier6Blacklist": [], "tier7Blacklist": [] };

        // load proper blacklist config setting
        if (this.modConfig.apbs.settingSelected.onlyBaseWeapons) this.APBSSetting = this.modConfig.apbs.settings.onlyBaseWeapons;
        if (this.modConfig.apbs.settingSelected.allWeapons) this.APBSSetting = this.modConfig.apbs.settings.allWeapons;
        if (this.modConfig.apbs.settingSelected.progressive) this.APBSSetting = this.modConfig.apbs.settings.progressive;
        if (this.modConfig.apbs.settingSelected.custom) this.APBSSetting = this.modConfig.apbs.settings.custom;
    }

    public addToAPBSBlacklist(id: string, rarity: string, variantName: string, weaponShortname: string): void 
    {
        if (!this.modsEnabled.APBS) return;
        for (let i = 1; i < 8; i++) {
            if (this.APBSSetting[i].includes(rarity) || this.modConfig.apbs.notAddVariantTypes.includes(variantName) || this.modConfig.apbs.notAddWeapons.includes(`${weaponShortname} ${variantName}`)) {
                this.compatLayer.APBS.weaponBlacklist[`tier${i}Blacklist`].push(id);
            }
        }
    }

    public saveAPBSBlacklist(): void 
    {
        if (!this.modsEnabled.APBS) return;

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