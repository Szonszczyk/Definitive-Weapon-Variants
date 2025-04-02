import * as fs from "fs";
import * as path from "path";

import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { HashUtil } from "@spt/utils/HashUtil";

import { WTTInstanceManager } from "./WTTInstanceManager";
import { CustomItemService } from "./CustomItemService";
import { TraderChanges } from "./TraderChanges";
import { jsonc } from "jsonc";

class WeaponVariants
implements IPreSptLoadMod, IPostDBLoadMod
{
    private Instance: WTTInstanceManager = new WTTInstanceManager();
    private version: string;
    private modName = "DefinitiveWeaponVariants";
    private config: any;
    private hashUtil: HashUtil;
    private customItemService: CustomItemService = new CustomItemService();
    private traderChanges: TraderChanges = new TraderChanges();

    debug = false;

    // Anything that needs done on preSptLoad, place here.
    public preSptLoad(container: DependencyContainer): void 
    {
        // Initialize the instance manager DO NOTHING ELSE BEFORE THIS
        this.Instance.preSptLoad(container, this.modName);
        const hashUtil: HashUtil = container.resolve<HashUtil>("HashUtil");
        this.Instance.debug = this.debug;
        
        // EVERYTHING AFTER HERE MUST USE THE INSTANCE
        this.loadConfig();
        this.upgradeConfig();

        this.hashUtil = hashUtil;
        this.getVersionFromJson();
        this.displayCreditBanner();
        this.traderChanges.preSptLoad(this.Instance, this.hashUtil);
        this.customItemService.preSptLoad(this.Instance, this.config, this.hashUtil);
    }

    // Anything that needs done on postDBLoad, place here.
    postDBLoad(container: DependencyContainer): void 
    {
    // Initialize the instance manager DO NOTHING ELSE BEFORE THIS
        this.Instance.postDBLoad(container);
        this.traderChanges.postDBLoad();
        this.customItemService.postDBLoad();
    }

    private getVersionFromJson(): void 
    {
        const packageJsonPath = path.join(__dirname, "../package.json");

        fs.readFile(packageJsonPath, "utf-8", (err, data) => 
        {
            if (err) 
            {
                console.error("Error reading file:", err);
                return;
            }

            const jsonData = JSON.parse(data);
            this.version = jsonData.version;
        });
    }

    private displayCreditBanner(): void 
    {
        this.Instance.logger.log(
            `[${this.modName}] Developers: Szonszczyk | Codebase: GroovypenguinX`,
            LogTextColor.GREEN
        );
    }

    private loadConfig(): void
    {
        const configPath = path.resolve(__dirname, "../config/config.jsonc");
        const defaultConfigPath = path.resolve(__dirname, "../config/defaultConfig.jsonc");

        if (fs.existsSync(configPath)) {
            this.config = jsonc.parse(fs.readFileSync(configPath, "utf-8"));
        } else {
            this.Instance.logger.log(
                `[${this.modName}] Warning: config.jsonc not found at ${configPath}, loading defaultConfig.jsonc instead. Please consider configuring this mod for better experience`,
                LogTextColor.RED
            );
            this.config = jsonc.parse(fs.readFileSync(defaultConfigPath, "utf-8"));
        }
    }

    private upgradeConfig(): void
    {
        if (this.config.version == 2) {
            this.Instance.logger.log(
                `[${this.modName}] Found too old version of config, please remove 'config.jsoc' and create new from 'defaultConfig.jsonc'`,
                LogTextColor.RED
            );
            return;
        }
        if (this.config.version == 2.1) {
            this.Instance.logger.log(
                `[${this.modName}] Found old version of config, upgrading...`,
                LogTextColor.CYAN
            );
            const configPath = path.resolve(__dirname, "../config/config.jsonc");
            let configTxt: string = fs.readFileSync(configPath, "utf-8");
            const toReplace = {
                "\"version\": 2.1,": "\"version\": 2.2,",
                "// change to true if you want to enable it": `// change to true if you want to enable it
	},
 // Can bosses spawn with variants?
 // This uses APBS Presets to add variants to bosses loadouts
	"bossesHaveVariants": {
		"enabled": false, // change to true if you want to enable it
		// If using APBS preset already and did not change any of boss weapons, change below to your preset name
		"presetName": "BossesHaveVariants", // If not using APBS Preset - leave it as it is
		// If not using APBS preset:
		// Run APBSConfig.exe and change - Presets => Enable Preset => True | Preset Options => Preset Folder Name => BossesHaveVariants
		// "[APBS] Preset name "BossesHaveVariants" is invalid." - should appear in red in console, don't worry - DWV will create this folder for you!

		// Advanced configuration:
		// Level 1 boss will have 500/(10000+500)% (~4.8%) chance to have a variant weapon in each of his slots
		// Level 8 boss will have 4000/(10000+4000)% (~28.5%) chance to have a variant weapon in each of his slots
		"baseWeaponWeights": 10000,
		"variantWeaponsWeightPerLevel": 500`
            };
            for (const replace in toReplace) {
                configTxt = configTxt.replaceAll(replace, toReplace[replace]);
            }
            fs.writeFileSync(configPath, configTxt);
            this.Instance.logger.log(
                `[${this.modName}] Config updated`,
                LogTextColor.GREEN
            );
            this.Instance.logger.log(
                `[${this.modName}] Upgrading old version of config has completed`,
                LogTextColor.GREEN
            );
            this.loadConfig();
            this.Instance.logger.log(
                `[${this.modName}] New config version: '${this.config.version}'. Should be '2.2'`,
                LogTextColor.CYAN
            );
        }
    }
}

module.exports = { mod: new WeaponVariants() };
