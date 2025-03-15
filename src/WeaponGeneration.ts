import * as fs from "fs";
import * as path from "path";
import variantIds from "../db/Ids/variantIds.json";
import { WTTInstanceManager } from "./WTTInstanceManager";
import { ModsCompatibility } from "./modsCompatibility";
import { HashUtil } from "@spt/utils/HashUtil";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { ShortNames, getShortNameById, raritySettings } from "./references/shortNames";
import {
    ConfigItem, VariantType, traderIDs, findPresetsWithEncyclopedia,
    findSlotWithName, findItemWithSlotId, WeaponDescription
} from "./references/configConsts";


export class WeaponGeneration
{
    private Instance: WTTInstanceManager;
    private modConfig: any;
    private variantTypes: any;
    protected hashUtil: HashUtil;
    private modsCompatibility: ModsCompatibility = new ModsCompatibility();
    private loadFromCache: boolean;
    private colorConverterAPILoaded: boolean;

    constructor() 
    {
        this.variantTypes = this.loadCombinedConfig();
        this.colorConverterAPILoaded = this.colorConverterAPICheck();
    }

    public preSptLoad(Instance: WTTInstanceManager, config: any, hashutil: HashUtil): void
    {
        this.Instance = Instance;
        this.modConfig = config;
        this.hashUtil = hashutil;
        this.loadFromCache = this.modConfig.useCache ? this.checkFiles() : false;
        this.modsCompatibility.preSptLoad(this.Instance, config, this.loadFromCache);
    }

    public generateWeapons(): { any: any }
    {
        const generatedItems: any = {};
        let skippedItems: number = 0;
        if (this.loadFromCache) {
            const weaponsFromCache = JSON.parse(fs.readFileSync(path.join(__dirname, "../db/Cache/generatedWeapons.json"), "utf-8", (err) => {}));
            Object.assign(generatedItems, weaponsFromCache);
            this.logWeapons(generatedItems, "Loaded from cache", 0);
            return generatedItems;
        }
        const weaponDescriptions = this.createWeaponDescriptions();
        let saveIds = false;
        
        for (const variantName in this.variantTypes) {
            const variant = this.variantTypes[variantName];
            const rarity = raritySettings[variant.rarity];
            const weapons = this.checkWeaponsInVariant(variant.Weapons, variantName, variant);
            skippedItems += variant.Weapons.length - weapons.length;
            const weaponsNamesInVariant = weapons.join(" | ");

            if (!variantIds[variantName]) variantIds[variantName] = {};
            const weaponsIds = variantIds[variantName];

            
            for(const weaponShortname of weapons) {
                const variantShortName = `${weaponShortname} ${variant.ShortName}`;
                const copiedWeaponId = ShortNames[weaponShortname];
                const copiedItem = this.Instance.database.templates.items[copiedWeaponId];
                const copiedItemHandbook = this.Instance.database.templates.handbook.Items.filter(item => item.Id === copiedWeaponId)[0];
                const copiedItemName = this.Instance.database.locales.global.en[`${copiedWeaponId} Name`];
                if (!weaponsIds[weaponShortname]) {
                    weaponsIds[weaponShortname] = [];
                }
                const ids = weaponsIds[weaponShortname];
                if (ids.length == 0) {
                    this.Instance.logger.log(
                        `[${this.Instance.modName}] weaponGeneration.generateWeapons: Generating mongoids for '${variantShortName}'`,
                        LogTextColor.GREEN
                    );
                    saveIds = true;
                    for(let i = 0; i < 5; i++) {
                        ids.push(this.hashUtil.generate())
                    }
                }

                const id = ids[0];

                const newWeapon: ConfigItem = {};
                newWeapon[id] = {
                    itemTplToClone: copiedWeaponId,
                    overrideProperties: {
                        BackgroundColor: this.colorConverterAPILoaded ? `${rarity.color}ff` : rarity.bgColor
                    },
                    parentId: copiedItem._parent,
                    handbookParentId: copiedItemHandbook.ParentId,
                    locales: {
                        en: {
                            name: `<b><color=${rarity.color}>${copiedItemName} ${variantName} Variant</color></b>`,
                            shortName: variantShortName,
                            description: [
                                `<align="center">${variant.Description}`,
                                ``,
                                `<color=${rarity.color}><b>${variantName} Variant</b></color>`,
                                `<i>${variant.Explanation}</i>`,
                                `${weaponsNamesInVariant.replace(weaponShortname, `<b>${weaponShortname}</b>`)}`,
                                ``,
                                `<color=${rarity.color}><b>${rarity.starRating} ${variant.rarity} Quality ${rarity.starRating}</b></color>`,
                                `<i>${rarity.flavour}</i>`,
                                `<color=${rarity.color}>${rarity.description}`,
                                `${weaponDescriptions[variant.rarity]}</color>`,
                                `This weapon counts toward ${getShortNameById(ShortNames, variant.quests?.id) || "original"} weapon kills for quest completion</align>`
                            ].join('\n')
                        }
                    },
                    fleaPriceRoubles: Math.ceil(copiedItemHandbook.Price * rarity.priceMultiplier * 2),
                    handbookPriceRoubles: Math.ceil(copiedItemHandbook.Price * rarity.priceMultiplier),
                    clearClonedProps: false,
                    addtoInventorySlots: [],
                    addtoModSlots: false,
                    modSlot: [],
                    ModdableItemWhitelist: "",
                    ModdableItemBlacklist: "",
                    addtoTraders: false,
                    traderId: traderIDs.PEACEKEEPER,
                    traderItems: [],
                    barterScheme: [],
                    loyallevelitems: 1,
                    addtoBots: false,
                    addtoStaticLootContainers: false,
                    StaticLootContainers: "",
                    Probability: 0,
                    masteries: true,
                    masterySections: {},
                    addweaponpreset: true,
                    weaponpresets: [],
                    addtoHallOfFame: true,
                    addtoSpecialSlots: false,
                    additionalInfo: {
                        rarity: variant.rarity,
                        variantType: variantName,
                        contributesToQuestsAsWeapon: variant?.quests?.id ? variant.quests.id : ""
                    }
                };

                //add to mastery section - blame grenade launchers that do not have their own section
                if (!this.Instance.database.globals.config.Mastering.filter(item => item.Templates.includes(copiedWeaponId))[0]?.Name) {
                    newWeapon[id].masteries = false;
                } else {
                    newWeapon[id].masterySections = {
                        "Name": this.Instance.database.globals.config.Mastering.filter(item => item.Templates.includes(copiedWeaponId))[0].Name,
                        "Templates": [
                            id
                        ]
                    }
                }

                this.addToInventorySlots(newWeapon, id, weaponShortname, copiedItem, variant);
                this.changeNormalProperties(newWeapon, id, weaponShortname, copiedItem, variant);
                this.addPreset(newWeapon, id, weaponShortname, copiedItem, variant, ids);
                this.changeAdditionalPropertiesSlots(newWeapon, id, weaponShortname, copiedItem, variant);
                this.changeAdditionalPropertiesChambers(newWeapon, id, weaponShortname, copiedItem, variant);
                this.modsCompatibility.addToAPBSBlacklist(id, variant.rarity, variantName, weaponShortname);
                this.modsCompatibility.createPresetForGambler(newWeapon[id].weaponpresets[0], ids, variant.rarity, variantName);
                Object.assign(generatedItems, newWeapon);
            }
        }
        this.logWeapons(generatedItems, "Generated", skippedItems);
        if (saveIds) this.saveVariantWeapons(variantIds);
        this.modsCompatibility.saveAPBSBlacklist();
        this.modsCompatibility.saveGamblerPresets();
        fs.writeFileSync(path.join(__dirname, "../db/Cache/generatedWeapons.json"), JSON.stringify(generatedItems, null, 2));
        return generatedItems;
    }

    private checkWeaponsInVariant(weapons: string[], variantName: string, variant: VariantType): string[] {
        if (this.modConfig.notGenerateVariantTypes.includes(variantName) || this.modConfig.notGenerateQuality.includes(variant.rarity)) return [];
        if (!weapons || weapons.length == 0) {
            // check for missing weapons property or blank array
            this.Instance.logger.log(
                `[${this.Instance.modName}] weaponGeneration.generateWeapons: Variant type '${variantName}' do not have any weapons attached to it. Skipping whole variant type`,
                LogTextColor.YELLOW
            );
            return [];
        }
        if (weapons.length !== new Set(weapons).size) {
            // check for duplicates
            this.Instance.logger.log(
                `[${this.Instance.modName}] weaponGeneration.generateWeapons: Variant type '${variantName}' have duplicates. Skipping whole variant type`,
                LogTextColor.RED
            );
            return [];
        }
        const newWeapons: string[] = [];
        for(const weaponShortname of weapons) {
            const copiedWeaponId = ShortNames[weaponShortname];
            const variantShortName = `${weaponShortname} ${variant.ShortName}`;
            // check if base weapon is in the game
            if (!copiedWeaponId) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] weaponGeneration.generateWeapons: Shortname '${weaponShortname}' missing in 'references/shortNames.ts' file. Skipping '${variantShortName}'`,
                    LogTextColor.RED
                );
            } else 
            if (!this.Instance.database.templates.items[copiedWeaponId]) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] weaponGeneration.generateWeapons: Base weapon '${weaponShortname}/${copiedWeaponId}' not found. Skipping '${variantShortName}'`,
                    LogTextColor.YELLOW
                );
            } else
            if (!this.modConfig.notGenerateWeapons.includes(variantShortName)) {
                newWeapons.push(weaponShortname);
            }
        }
        return newWeapons;
    }

    private addToInventorySlots(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantType
    ): void {

        //replace if additionalChanges
        if (variant.additionalChanges && variant.additionalChanges["addtoInventorySlots"]) {
            itemConfig[id].addtoInventorySlots = variant.additionalChanges["addtoInventorySlots"];
        }
        switch(copiedItem._parent) {
            //add to inventory slots if shotgun
            case "5447b6094bdc2dc3278b4567":
            //add to inventory slots if grenade launcher
            case "5447bedf4bdc2d87278b4568":
                itemConfig[id].addtoInventorySlots.push("FirstPrimaryWeapon");
                itemConfig[id].addtoInventorySlots.push("SecondPrimaryWeapon");
                break;
            //add to inventory slots if revolver
            case "617f1ef5e8b54b0998387733":
                itemConfig[id].addtoInventorySlots.push("Holster");
                break;
        }
        //add to inventory slots if sawed-off
        if (weaponShortname.includes("MP-43 sawed-off")) {
            itemConfig[id].addtoInventorySlots.push("Holster");
        }
    }
    private changeNormalProperties(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantType
    ): void {

        const integerProps = [
            "SingleFireRate",
            "RecoilForceBack",
            "RecoilForceUp",
            "bFirerate",
            "Ergonomics",
            "RecoilStableIndexShot"
        ];
        for (const prop in variant.props) {
            let oldWeaponPropValue = copiedItem._props[prop];
            //add check type of prop
            //check minimum values
            if (variant.additionalChanges?.minimum?.[prop]) {
                if (oldWeaponPropValue < variant.additionalChanges["minimum"][prop]) {
                    oldWeaponPropValue = variant.additionalChanges["minimum"][prop];
                }
            }
            //fix for firemode and other props that are objects/arrays
            let newValue: any;
            if (typeof variant.props[prop] === 'string' && /^[+-]\d+%?$/.test(variant.props[prop])) {
                newValue = this.calculateValue(oldWeaponPropValue, variant.props[prop]);
            } else {
                newValue = variant.props[prop];
            }
            //made additional changes according to variant
            if (variant.additionalChanges && variant.additionalChanges[weaponShortname] && variant.additionalChanges[weaponShortname][prop]) {
                if (this.Instance.debug) {
                    console.log(`Changing property of ${weaponShortname} ${variant.ShortName} / ${variant.additionalChanges[weaponShortname][prop]}`);
                }
                newValue = variant.additionalChanges[weaponShortname][prop];
            }
            itemConfig[id].overrideProperties[prop] = integerProps.includes(prop) ? Math.ceil(newValue) : newValue;
        }
    }

    private calculateValue(first: number, second: string | number): number {
        if (typeof second === 'string' && /^[+-]\d+%?$/.test(second)) {
            const isPercentage = second.endsWith('%');
            const value = parseFloat(second);
    
            if (isPercentage) {
                return +(first + (first * (value / 100))).toFixed(3);
            } else {
                return +(first + value).toFixed(3);
            }
        } else if (typeof second === 'number') {
            return second;
        } else {
            // If invalid string, return first as default or handle differently
            return first;
        }
    }

    private addPreset(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantType,
        ids: string[]
    ): void {
        const preset = findPresetsWithEncyclopedia(this.Instance.database.globals.ItemPresets, copiedItem._id)[0];
        if (!preset) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] WeaponGeneration.addPreset: Preset not found for '${copiedItem._id}'. Skipping...`,
                LogTextColor.YELLOW
            );
            itemConfig[id].addweaponpreset = false;
            return;
        }
        const defaultPreset = structuredClone(preset);
        defaultPreset._encyclopedia = id;
        const oldId = defaultPreset._items[0]._id;
        defaultPreset._id = ids[1];
        defaultPreset._parent = ids[2];
        defaultPreset._items[0] = {
            _id: ids[2],
            _tpl: id,
            upd: {
                "Repairable": { "MaxDurability": 100, "Durability": 100},
                "FireMode": { "FireMode": "single" }
            }
        };
        for (const partOfPreset of defaultPreset._items) {
            if (partOfPreset.parentId == oldId) partOfPreset.parentId = ids[2];
        }
        defaultPreset._changeWeaponName = false;
        defaultPreset._name = `${weaponShortname} ${variant.ShortName} Variant Default Preset`;

        if (variant.props["weapFireType"]) {
            defaultPreset._items[0].upd.FireMode.FireMode = variant.props["weapFireType"][0];
        }
        itemConfig[id].weaponpresets.push(defaultPreset);
    }

    private changeAdditionalPropertiesSlots(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantType
    ): void {
        //made additional changes based on "additionalChanges" property from variant object
        //this is after creating preset because we need to change some preset parts according to variant
        if (variant.additionalChanges?.Slots || variant.additionalChanges?.[weaponShortname]?.Slots) {
            let slotsOriginal = structuredClone(copiedItem._props.Slots);
            let slots = structuredClone(variant.additionalChanges?.Slots ? variant.additionalChanges.Slots : variant.additionalChanges?.[weaponShortname]?.Slots);
            if (variant.additionalChanges?.Slots && variant.additionalChanges?.[weaponShortname]?.Slots) {
                Object.assign(slots, variant.additionalChanges?.[weaponShortname]?.Slots);
            }
            for(const slot in slots) {
                const slotOriginal = findSlotWithName(slotsOriginal, slot);
                const newFilter: string[] = slots[slot];
                if (slotOriginal) {
                    if (typeof newFilter === 'object' && newFilter.length == 0) {
                        // remove if no filter
                        slotsOriginal = slotsOriginal.filter(element => element._name != slot);
                        itemConfig[id].weaponpresets[0]._items = itemConfig[id].weaponpresets[0]._items.filter(presetItem => {
                            return !(presetItem.slotId && presetItem.slotId === slot);
                        });
                    } else {
                        //allow choosing eg. different magazines if external/internal magazine
                        let choosenFilter = newFilter[0].basedOn ? newFilter[0].variants[copiedItem._props[newFilter[0].basedOn]] : newFilter;
                        //if filter is text => replace it with filter from slot of item that text is representing
                        choosenFilter = typeof choosenFilter === 'string' ? findSlotWithName(this.Instance.database.templates.items[choosenFilter]._props.Slots, slot)._props.filters[0].Filter : choosenFilter;
                        slotOriginal._props.filters[0].Filter = choosenFilter;
                        //add defMagType property if magazine is changed
                        if (slot == "mod_magazine") {
                            itemConfig[id].overrideProperties.defMagType = choosenFilter[0];
                        }
                        //make changes to preset
                        const slotToChange = findItemWithSlotId(itemConfig[id].weaponpresets[0]._items, slot);

                        if (slotToChange) {
                            slotToChange._tpl = choosenFilter[0];
                        }
                    }
                }
            }
            itemConfig[id].overrideProperties.Slots = slotsOriginal;
        }
    }

    private changeAdditionalPropertiesChambers(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantType
    ): void {
        if ((variant?.additionalChanges?.Chambers || variant.additionalChanges?.[weaponShortname]?.Chambers) && copiedItem._props.Chambers.length > 0) {
            const changeChamber = variant?.additionalChanges?.Chambers ? variant.additionalChanges.Chambers.patron_in_weapon : variant.additionalChanges[weaponShortname].Chambers.patron_in_weapon;
            if (typeof changeChamber === 'string' && this.Instance.database.templates.items[changeChamber]._props.Chambers.length === 0) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] weaponGeneration.changeAdditionalPropertiesChambers: ${variant.ShortName} Variant: You are trying to copy Chambers of weapon that does not have any: ${changeChamber}. Skipping`,
                    LogTextColor.RED
                );
                return;
            }
            //if filter is text => replace it with filter from slot of item that text is representing
            const chambers = typeof changeChamber === 'string' ? this.Instance.database.templates.items[changeChamber]._props.Chambers[0]._props.filters[0].Filter : changeChamber;
            if (chambers) {
                //chambersOriginal is copy of original property that we want to change
                for (let i = 0; i < copiedItem._props.Chambers.length; i++) {
                    const chambersOriginal = structuredClone(copiedItem._props.Chambers[i]);
                    chambersOriginal._id = this.hashUtil.generate();
                    chambersOriginal._parent = id;
                    chambersOriginal._props.filters[0].Filter = chambers;
                    if (!itemConfig[id].overrideProperties.Chambers) {
                        itemConfig[id].overrideProperties.Chambers = [];
                    }
                    //add defAmmo property if chamber is changed
                    if (i == 0) {
                        itemConfig[id].overrideProperties.defAmmo = chambersOriginal._props.filters[0].Filter[0];
                        itemConfig[id].overrideProperties.ammoCaliber = this.Instance.database.templates.items[chambersOriginal._props.filters[0].Filter[0]]._props.Caliber;
                    }
                    itemConfig[id].overrideProperties.Chambers.push(chambersOriginal);
                }
            }
        }
    }

    private saveVariantWeapons(
        variantWeapons: any
    ): void {
        const formatted = JSON.stringify(variantWeapons, (key, value) => value, 2).replace(/\[\s*([\s\S]*?)\s*]/g, (match) => match.replace(/\s+/g, ' '));
        fs.writeFileSync(path.join(__dirname, "../db/Ids/variantIds.json"), formatted);
        this.Instance.logger.log(
            `[${this.Instance.modName}] weaponGeneration.saveVariantWeapons: Database 'Ids/variantIds' was saved`,
            LogTextColor.GREEN
        );
    }

    private createWeaponDescriptions(): WeaponDescription {

        const weaponRarity: string[] = Object.keys(raritySettings);
        const descriptions: WeaponDescription = {};
        for (const rarity of weaponRarity) {
            const textArray: string[] = [];
            //if (modConfig.containers.probability.overall > 0 && modConfig.containers.probability[`${quality}Weapons`] > 0) { textArray.push("in containers"); };
            if (!this.modConfig.airdrop.blacklist.includes(rarity)) { textArray.push("in airdrop"); };
            if (!this.modConfig.fence.blacklist.includes(rarity)) { textArray.push("on Fence"); };
            if (!this.modConfig.flea.blacklist.includes(rarity)) { textArray.push("on flea market"); };
            if (this.modConfig.theGambler.enabled) { textArray.push("in weapon boxes sold by Gambler"); };
            if (this.modsCompatibility.modsEnabled.APBS) {
                const apbsLvls: number[] = [];
                for (let i = 1; i < 8; i++) {
                    if (!this.modsCompatibility.APBSSetting[i].includes(rarity)) apbsLvls.push(i);
                }
                if (apbsLvls.length > 0) {
                    textArray.push(`on enemies of level: ${this.groupConsecutiveNumbers(apbsLvls).join(", ")}`);
                }
            }
            descriptions[rarity] = `Weapons of this quality can be found: ${textArray.join(", ")}`;
        }
        return descriptions;
    }

    private groupConsecutiveNumbers(arr: number[]): (string | number)[] {
        if (arr.length === 0) return [];
        let groups: number[][] = [];
        let currentGroup: number[] = [arr[0]];
        for (let i = 1; i < arr.length; i++) {
            const prev = currentGroup[currentGroup.length - 1];
            const curr = arr[i];
            if (curr === prev + 1) {
                currentGroup.push(curr);
            } else {
                groups.push(currentGroup);
                currentGroup = [curr];
            }
        }
        groups.push(currentGroup);
        return groups.map(group => 
            group.length > 1 ? `${group[0]}-${group[group.length - 1]}` : group[0]
        );
    }

    private logWeapons(items: any, description: string, skipped: number): void {
        const info = Object.fromEntries(Object.keys(raritySettings).map(key => [key, 0]));
        const types: string[] = [];
        for (const item in items) {
            const w = items[item].additionalInfo;
            info[w.rarity]++;
            if (!types.includes(w.variantType)) types.push(w.variantType);
        }
        const weaponCount = Object.values(info).map(i => `  ${i.toString().padStart(3)}   `);
        this.Instance.logger.log(
            [
                `[${this.Instance.modName}] ${description}: |ULTIMATE|SUPERIOR|ADVANCED|  NICHE |BASELINE| FLAWED |  MEME  |`,
                `[${this.Instance.modName}] ${description}: |${weaponCount.join("|")}|`,
                `[${this.Instance.modName}] ${description}: ${Object.keys(items).length} weapons of ${types.length} variant types${skipped > 0 ? `. Skipped generation of ${skipped} Weapons` : ""}`,
            ].join('\n'),
            LogTextColor.GREEN
        );
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

        const variantFilePath = path.join(__dirname, "../db/Variants");
        const variantFilePaths = fs.readdirSync(variantFilePath).filter(file => path.extname(file).toLowerCase() === '.json');
        for (const file of variantFilePaths) {
            if (this.getFileStatus(variantFilePath + "/" + file) == "MODIFIED") return false;
        }

        const itemsFilePath = path.join(__dirname, "../db/Items");
        const itemsFilePaths = fs.readdirSync(itemsFilePath).filter(file => path.extname(file).toLowerCase() === '.json');
        for (const file of itemsFilePaths) {
            if (this.getFileStatus(itemsFilePath + "/" + file) == "MODIFIED") return false;
        }

        const cacheFiles = [
            "../db/Cache/generatedWeapons.json"
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

    private loadCombinedConfig(): any 
    {
        const configFiles = fs.readdirSync(path.join(__dirname, "../db/Variants"));
        const combinedConfig: any = {};

        configFiles.forEach((file) => 
        {
            const configPath = path.join(__dirname, "../db/Variants", file);
            const configFileContents = fs.readFileSync(configPath, "utf-8");
            const config = JSON.parse(configFileContents) as VariantType;

            // add new weapons to exisiting types in different file - combine Weapon property and remove duplicates
            for (const variant in config) {
                if (combinedConfig[variant]) {
                    combinedConfig[variant].Weapons = combinedConfig[variant].Weapons.concat(config[variant].Weapons);
                    combinedConfig[variant].Weapons = [...new Set(combinedConfig[variant].Weapons)];
                }
            }
            Object.assign(combinedConfig, config);
        });

        return combinedConfig;
    }

    private colorConverterAPICheck(): boolean 
    {
        const pluginName = "rairai.colorconverterapi.dll";
            // Fails if there's no ./BepInEx/plugins/ folder
        try 
        {
            const pluginList = fs.readdirSync("./BepInEx/plugins").map(plugin => plugin.toLowerCase());
            return pluginList.includes(pluginName);
        }
        catch 
        {
            return false;
        }
    }

}