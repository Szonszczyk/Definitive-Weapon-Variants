import * as fs from "fs";
import * as path from "path";

import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";

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
        this.loadConfig(container);

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

    private loadConfig(container: DependencyContainer): void
    {
        const vfs = container.resolve<VFS>("VFS");
        const configPath = path.resolve(__dirname, "../config/config.jsonc");
        const defaultConfigPath = path.resolve(__dirname, "../config/defaultConfig.jsonc");
        if (fs.existsSync(configPath)) {
            this.config = jsonc.parse(vfs.readFile(configPath));
        } else {
            this.Instance.logger.log(
                `[${this.modName}] Warning: config.jsonc not found at ${configPath}, loading defaultConfig.jsonc instead. Please consider configuring this mod for better experience`,
                LogTextColor.RED
            );
            this.config = jsonc.parse(vfs.readFile(defaultConfigPath));
        }
    }
}

module.exports = { mod: new WeaponVariants() };
