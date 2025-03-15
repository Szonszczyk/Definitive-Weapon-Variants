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
                `[${this.modName}] Found old version of config, upgrading and removing old files`,
                LogTextColor.CYAN
            );
            const configPath = path.resolve(__dirname, "../config/config.jsonc");
            let configTxt: string = fs.readFileSync(configPath, "utf-8");
            const toReplace = {
                "\"OP\"": "\"Ultimate\"",
                "\"Meta\"": "\"Superior\"",
                "\"Decent\"": "\"Advanced\"",
                "\"Gimmick\"": "\"Niche\"",
                "\"Base\"": "\"Baseline\"",
                "\"Scav\"": "\"Flawed\"",
                "\"Laser\"": "\"Meta\"",
                "\"notGenerateRarity\"": "\"notGenerateQuality\"",
                "\"version\": 2,": "\"version\": 2.1,"
            };
            for (const replace in toReplace) {
                configTxt = configTxt.replaceAll(replace, toReplace[replace]);
                this.Instance.logger.log(
                    `[${this.modName}] Replacing '${replace}' with '${toReplace[replace]}' in config...`,
                    LogTextColor.CYAN
                );
            }
            fs.writeFileSync(configPath, configTxt);
            this.Instance.logger.log(
                `[${this.modName}] Config updated`,
                LogTextColor.GREEN
            );
            const filesToDelete = [
                "db/Items/0205 Karabin Spetsialniy Items.json",
                "db/Items/0207 Endless Items.json",
                "db/Items/0303 Anti-materiel Rifle Items.json",
                "db/Items/0304 Anti-materiel Revolver Items.json",
                "db/Items/0404 Rifle Grenade Launcher Items.json",
                "db/Items/0502 Sniper Items.json",
                "db/Items/0507 20 70 Items.json",
                "db/Items/0508 Shotgun-o-Revolver Items.json",
                "db/Variants/01 OPVariants.json",
                "db/Variants/02 MetaVariants.json",
                "db/Variants/03 DecentVariants.json",
                "db/Variants/04 GimmickVariants.json",
                "db/Variants/05 BaseVariants.json",
                "db/Variants/06 ScavVariants.json"
            ];
            for (const file of filesToDelete) {
                const filePath = path.resolve(__dirname, `../${file}`);
                try {
                    fs.unlinkSync(filePath);
                    this.Instance.logger.log(
                        `[${this.modName}] Removed '${filePath}'...`,
                        LogTextColor.CYAN
                    );
                } catch (error) {}
            }
            this.Instance.logger.log(
                `[${this.modName}] Upgrading old version of config has completed`,
                LogTextColor.GREEN
            );
            this.loadConfig();
            this.Instance.logger.log(
                `[${this.modName}] New config version: '${this.config.version}'. Should be '2.1'`,
                LogTextColor.CYAN
            );
        }
    }
}

module.exports = { mod: new WeaponVariants() };
