import * as fs from "fs";
import * as path from "path";

import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

import { WTTInstanceManager } from "./WTTInstanceManager";
import { CustomItemService } from "./CustomItemService";
import { TraderChanges } from "./TraderChanges";
import { jsonc } from "jsonc";

class WeaponVariants
implements IPreSptLoadMod, IPostDBLoadMod
{
    private Instance: WTTInstanceManager = new WTTInstanceManager();
    private modName = "DefinitiveWeaponVariants";
    private config: any;
    
    private customItemService: CustomItemService = new CustomItemService();
    private traderChanges: TraderChanges = new TraderChanges();

    debug = false;

    // Anything that needs done on preSptLoad, place here.
    public preSptLoad(container: DependencyContainer): void 
    {
        // Initialize the instance manager DO NOTHING ELSE BEFORE THIS
        this.Instance.preSptLoad(container, this.modName);
        this.Instance.debug = this.debug;
        
        // EVERYTHING AFTER HERE MUST USE THE INSTANCE
        this.loadConfig(); // Maybe not that...
        this.upgradeConfig(); // and that too...

        this.displayCreditBanner(); // this is simply logging to console...
        this.traderChanges.preSptLoad(this.Instance); // ok, finally!
        this.customItemService.preSptLoad(this.Instance, this.config);
    }

    // Anything that needs done on postDBLoad, place here.
    postDBLoad(container: DependencyContainer): void 
    {
        // Initialize the instance manager DO NOTHING ELSE BEFORE THIS
        this.Instance.postDBLoad(container);
        // ok... do your thing now:
        this.traderChanges.postDBLoad();
        this.customItemService.postDBLoad();
    }

    private displayCreditBanner(): void 
    {
        const packageJsonPath = path.join(__dirname, "../package.json");
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        this.Instance.logger.log(
            `[${this.modName}] v${packageJson.version} Developers: Szonszczyk | Codebase: GroovypenguinX`,
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
                `[${this.modName}] File '${configPath}' not found - loading default configuration instead. For the best experience, please create your own config by copying the 'defaultConfig' file and renaming copied file to 'config'. This is especially important if you're using APBS and/or TheGambler. Instructions are included in the ${defaultConfigPath} and on the mod page!`,
                LogTextColor.YELLOW
            );
            this.config = jsonc.parse(fs.readFileSync(defaultConfigPath, "utf-8"));
        }
    }

    private upgradeConfig(): void
    {
        if (this.config.version < 3) {
            this.Instance.logger.log(
                `[${this.modName}] The configuration file 'config.jsonc' is outdated and can't be used. Please create a new 'config.jsonc' by copying the latest 'defaultConfig.jsonc' from the config folder. Sorry for the inconvenience!`,
                LogTextColor.RED
            );
            const defaultConfigPath = path.resolve(__dirname, "../config/defaultConfig.jsonc");
            this.config = jsonc.parse(fs.readFileSync(defaultConfigPath, "utf-8"));
            this.Instance.logger.log(
                `[${this.modName}] Loaded 'defaultConfig.jsonc' config file`,
                LogTextColor.YELLOW
            );
            return;
        }
    }
}

module.exports = { mod: new WeaponVariants() };
