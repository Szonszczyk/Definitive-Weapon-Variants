import * as fs from "fs";
import * as path from "path";
import { WTTInstanceManager } from "./WTTInstanceManager";
import { ModsCompatibility } from "./modsCompatibility";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { MarkedRooms } from "./MarkedRooms";
import {
    getShortNameById, raritySettings,
    ConfigItem, traderIDs, findPresetsWithEncyclopedia,
    findSlotWithName, findItemWithSlotId, variantIDsInterface,
    mapNames
} from "./references/configConsts";

import {
    VariantConfiguration,
    VariantConfigurationKeyed
} from "./references/generationConsts";

export class WeaponGeneration
{
    private Instance: WTTInstanceManager;
    private modConfig: any;
    private modsCompatibility: ModsCompatibility = new ModsCompatibility();
    private loadFromCache: boolean;
    private ShortNames: { [shortName: string]: string };
    private markedRooms: MarkedRooms = new MarkedRooms();

    public preSptLoad(Instance: WTTInstanceManager, config: any): void
    {
        this.Instance = Instance;
        this.modConfig = config;
        this.loadFromCache = this.modConfig.useCache ? this.Instance.helpers.fileWasChanged : false;
        this.ShortNames = this.Instance.helpers.dbShortnames;
        this.modsCompatibility.preSptLoad(this.Instance, config, this.loadFromCache);
        this.markedRooms.preSptLoad(this.Instance, config);
    }

    public generateWeapons(): ConfigItem
    {
        this.markedRooms.postDBLoad();

        const generatedItems: ConfigItem = {};
        let skippedItems: number = 0;
        if (this.loadFromCache) {
            const weaponsFromCache = JSON.parse(fs.readFileSync(path.join(__dirname, "../db/Cache/generatedWeapons.json"), "utf-8", (err) => {}));
            Object.assign(generatedItems, weaponsFromCache);
            this.logWeapons(generatedItems, "Loaded from cache", 0);
            for (const weapon in generatedItems) {
                this.markedRooms.addWeaponToMarkedRoom(generatedItems[weapon]);
            }
            this.markedRooms.processMarkedRooms();
            return generatedItems;
        }
        const variantTypes = this.Instance.helpers.dbVariants;
        const weaponDescriptions = this.createWeaponDescriptions(variantTypes).descriptions;
        const variantIds = this.Instance.helpers.dbIds;

        // save combined variantIds
        //const formatted = JSON.stringify(variantIds, (key, value) => value, 2).replace(/\[\s*([\s\S]*?)\s*]/g, (match) => match.replace(/\s+/g, ' '));
        //fs.writeFileSync(path.join(__dirname, "../db/Cache/variantIds.json"), formatted);

        const newIds: variantIDsInterface = {};
        
        for (const variantName in variantTypes) {
            const variant = variantTypes[variantName];
            const rarity = raritySettings[variant.rarity];
            const weapons = this.checkWeaponsInVariant(variant.Weapons, variantName, variant);
            skippedItems += variant.Weapons.length - weapons.length;
            const weaponsNamesInVariant = weapons.join(" | ");

            if (!variantIds[variantName]) variantIds[variantName] = {};
            const weaponsIds = variantIds[variantName];

            for (const weaponShortname of weapons) {
                const variantShortName = `${weaponShortname} ${variant.ShortName}`;
                const copiedWeaponId = this.ShortNames[weaponShortname];
                const copiedItem = this.Instance.database.templates.items[copiedWeaponId];
                const copiedItemHandbook = this.Instance.database.templates.handbook.Items.filter(item => item.Id === copiedWeaponId)[0];
                const copiedItemName = this.Instance.database.locales.global.en[`${copiedWeaponId} Name`];
                if (!weaponsIds[weaponShortname]) weaponsIds[weaponShortname] = [];
                const ids = weaponsIds[weaponShortname];
                if (ids.length == 0) {
                    this.Instance.logger.log(
                        `[${this.Instance.modName}] weaponGeneration.generateWeapons: Generating mongoids for '${variantShortName}'`,
                        LogTextColor.GREEN
                    );
                    for(let i = 0; i < 5; i++) {
                        ids.push(this.Instance.hashUtil.generate());
                    }
                    if (!newIds[variantName]) newIds[variantName] = {};
                    newIds[variantName][weaponShortname] = ids;
                }

                const id = ids[0];

                const newWeapon: ConfigItem = {};
                newWeapon[id] = {
                    itemTplToClone: copiedWeaponId,
                    overrideProperties: {
                        BackgroundColor: this.Instance.helpers.colorConverterAPILoaded ? `${rarity.color}ff` : rarity.bgColor
                    },
                    parentId: variant.additionalChanges?._parent ? variant.additionalChanges._parent : copiedItem._parent, 
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
                                `${weaponDescriptions[variantName]}</color>`,
                                `This weapon counts toward ${getShortNameById(this.ShortNames, variant.quests?.id) || "original"} weapon kills for quest completion</align>`
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
                this.markedRooms.addWeaponToMarkedRoom(newWeapon[id]);
                this.modsCompatibility.addToAPBSBlacklist(id, variant.rarity, variantName, variantShortName);
                this.modsCompatibility.createPresetForGambler(newWeapon[id].weaponpresets[0], ids, variant.rarity, variantName);
                Object.assign(generatedItems, newWeapon);
            }
        }
        this.logWeapons(generatedItems, "Generated", skippedItems);
        if (Object.keys(newIds).length > 0) this.Instance.helpers.saveJsonToFile(newIds, "Ids");
        this.markedRooms.processMarkedRooms();
        this.modsCompatibility.saveAPBSBlacklist();
        this.modsCompatibility.createOrUpdateAPBSPreset(generatedItems);
        this.modsCompatibility.saveGamblerPresets();
        fs.writeFileSync(path.join(__dirname, "../db/Cache/generatedWeapons.json"), JSON.stringify(generatedItems, null, 2));
        return generatedItems;
    }

    private checkWeaponsInVariant(weapons: string[], variantName: string, variant: VariantConfiguration): string[] {
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
        for (const weaponShortname of weapons) {
            const copiedWeaponId = this.ShortNames[weaponShortname];
            const variantShortName = `${weaponShortname} ${variant.ShortName}`;
            // check if base weapon is in the game
            if (!copiedWeaponId) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] weaponGeneration.generateWeapons: Shortname '${weaponShortname}' missing in 'id/Shortnames' file. Skipping '${variantShortName}'`,
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
        variant: VariantConfiguration
    ): void {

        //replace if additionalChanges
        if (variant.additionalChanges && variant.additionalChanges["addtoInventorySlots"]) {
            itemConfig[id].addtoInventorySlots = variant.additionalChanges["addtoInventorySlots"];
        }
        switch(itemConfig[id].parentId) {
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
        if (weaponShortname.includes("Sawed-off")) {
            itemConfig[id].addtoInventorySlots.push("Holster");
        }
    }
    private changeNormalProperties(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantConfiguration
    ): void {

        const integerProps = [
            "SingleFireRate",
            "RecoilForceBack",
            "RecoilForceUp",
            "bFirerate",
            "Ergonomics",
            "RecoilStableIndexShot"
        ];

        const props = structuredClone(variant.props);

        if (variant?.additionalChanges?.[weaponShortname]) {
            // add additional changes to props changes
            Object.assign(props, variant?.additionalChanges?.[weaponShortname])
        }

        for (const propName in props) {
            // can't change prop that does not exist
            if (!copiedItem._props[propName]) continue;

            let oldWeaponPropValue = copiedItem._props[propName];
            // check and replace minimum values if present
            if (variant.additionalChanges?.minimum?.[propName]) {
                if (oldWeaponPropValue < variant.additionalChanges.minimum[propName]) {
                    oldWeaponPropValue = variant.additionalChanges.minimum[propName];
                }
            }
            
            const propValue = props[propName];
            //fix for firemode and other props that are objects/arrays
            let newValue: any;
            if (typeof propValue === 'string' && /^[+-]\d+%?$/.test(propValue)) {
                newValue = this.calculateValue(oldWeaponPropValue, propValue);
            } else {
                newValue = propValue;
            }
            itemConfig[id].overrideProperties[propName] = integerProps.includes(propName) ? Math.ceil(newValue) : newValue;
        }
    }

    private addPreset(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantConfiguration,
        ids: string[]
    ): void {
        const variantName = `${weaponShortname} ${variant.ShortName}`;
        const basePreset = this.Instance.helpers.dbPresets[weaponShortname] ?? findPresetsWithEncyclopedia(this.Instance.database.globals.ItemPresets, copiedItem._id)[0];
        const preset = this.Instance.helpers.dbPresets[variantName] ?? basePreset;
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
        const replaceIds: {[key: string]: string} = {};
        replaceIds[defaultPreset._items[0]._id] = ids[2];

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
        
        for (let i = 1; i < defaultPreset._items.length; i++) {
            const item = defaultPreset._items[i];
            if (!replaceIds[item._id]) {
                replaceIds[item._id] = this.Instance.hashUtil.generate();
            }
            item._id = replaceIds[item._id];
            item.parentId = replaceIds[item!.parentId];
        }
        defaultPreset._changeWeaponName = false;
        defaultPreset._name = `${variantName} Variant Default Preset`;

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
        variant: VariantConfiguration
    ): void {
        if (!variant.additionalChanges?.Slots && !variant.additionalChanges?.[weaponShortname]?.Slots) return;
        //made additional changes based on "additionalChanges" property from variant object
        //this is after creating preset because we need to change some preset parts according to variant
        
        let slotsOriginal = structuredClone(copiedItem._props.Slots);
        let slots = structuredClone(variant.additionalChanges?.Slots ? variant.additionalChanges.Slots : variant.additionalChanges?.[weaponShortname]?.Slots);
        if (variant.additionalChanges?.Slots && variant.additionalChanges?.[weaponShortname]?.Slots) {
            Object.assign(slots, variant.additionalChanges?.[weaponShortname]?.Slots);
        }
        for(const slot in slots) {
            const slotOriginal = findSlotWithName(slotsOriginal, slot);

            // can't change slot that does not exist
            if (!slotOriginal) continue;

            const newFilter = slots[slot];
            if (typeof newFilter === 'object' && newFilter.length == 0) {
                // remove if no filter
                slotsOriginal = slotsOriginal.filter(element => element._name != slot);
                itemConfig[id].weaponpresets[0]._items = itemConfig[id].weaponpresets[0]._items.filter(presetItem => {
                    return !(presetItem.slotId && presetItem.slotId === slot);
                });
            } else {
                // allow choosing eg. different magazines if external/internal magazine
                let choosenFilter = newFilter.basedOn ? newFilter.variants[copiedItem._props[newFilter.basedOn]] : newFilter;
                // allow using multiple filters from different weapons
                if (choosenFilter?.fromWeapons) {
                    let filterFromWeapons: string[] = [];
                    for (const fromWeapon of choosenFilter.fromWeapons) {
                        // allow using shortname or weapon ID
                        const fromWeaponID = this.ShortNames[fromWeapon] ? this.ShortNames[fromWeapon] : fromWeapon;
                        const filterFromWeapon = findSlotWithName(this.Instance.database.templates.items[fromWeaponID]._props.Slots, slot)._props.filters[0].Filter;
                        if (filterFromWeapon) {
                            filterFromWeapons = filterFromWeapons.concat(filterFromWeapon);
                        }
                    }
                    // allow adding different filters - not from weapons
                    if (choosenFilter.add) filterFromWeapons = filterFromWeapons.concat(choosenFilter.add);
                    choosenFilter = filterFromWeapons;
                }
                // change internal names of created items to proper mongoIds
                const itemsIds = this.Instance.helpers.dbItemsIds;
                for (let i = 0; i < choosenFilter.length; i++) {
                    if (itemsIds[choosenFilter[i]]) choosenFilter[i] = itemsIds[choosenFilter[i]]
                }
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
        // Change id of changed slots to new weapon
        slotsOriginal.forEach(e => e._parent = id);
        itemConfig[id].overrideProperties.Slots = slotsOriginal;
    }

    private changeAdditionalPropertiesChambers(
        itemConfig: ConfigItem,
        id: string,
        weaponShortname: string,
        copiedItem: any,
        variant: VariantConfiguration
    ): void {

        // copied item does not have chambers
        if (copiedItem._props.Chambers.length === 0) return;

        // nothing to change
        if (!variant?.additionalChanges?.Chambers && !variant.additionalChanges?.[weaponShortname]?.Chambers) return;

        const changeChamber = variant?.additionalChanges?.Chambers ?? variant.additionalChanges?.[weaponShortname]?.Chambers;
        let newFilter = [];

        if (changeChamber?.fromWeapons) {
            for (const fromWeapon of changeChamber.fromWeapons) {
                // allow using shortname or weapon ID
                const fromWeaponID = this.ShortNames[fromWeapon] ? this.ShortNames[fromWeapon] : fromWeapon;
                const filterFromWeapon = this.Instance.database.templates.items[fromWeaponID]._props.Chambers[0]._props.filters[0].Filter;
                if (filterFromWeapon) {
                    newFilter = newFilter.concat(filterFromWeapon);
                }
            }
            if (changeChamber?.add) {
                newFilter = newFilter.concat(changeChamber.add);
            }
        } else {
            newFilter = changeChamber;
        }
        
        if (newFilter.length === 0) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] weaponGeneration.changeAdditionalPropertiesChambers: ${variant.ShortName} Variant: You are trying to copy Chambers of weapon that does not have any: ${changeChamber}. Skipping`,
                LogTextColor.RED
            );
            return;
        }

        for (let i = 0; i < copiedItem._props.Chambers.length; i++) {
            const chambersOriginal = structuredClone(copiedItem._props.Chambers[i]);
            chambersOriginal._id = this.Instance.hashUtil.generate();
            chambersOriginal._parent = id;
            chambersOriginal._props.filters[0].Filter = newFilter;
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
            // If invalid string, return first as default
            return first;
        }
    }

    private createWeaponDescriptions(variantTypes: VariantConfigurationKeyed): { descriptions: Record<string, string> } {

        const descriptions: Record<string, string> = {};

        for(const variantTypeName in variantTypes) {
            const variantType = variantTypes[variantTypeName];
            const rarity = variantType.rarity;
            const textArray: string[] = [];
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

            if (this.markedRooms.moduleEnabled) {
                const foundMaps = Object.entries(this.markedRooms.variantTypesMarkedRooms)
                    .filter(([_, arr]) => arr.includes(variantTypeName))
                    .map(([key]) => key);
                if (foundMaps.length === 1) {
                    textArray.push(`in marked room(s) on ${mapNames[foundMaps[0]]} map`);
                }
                if (foundMaps.length >= 2) {
                    textArray.push(`in marked room(s) on maps: ${foundMaps.forEach(e => mapNames[e])}`);
                }
            }
            descriptions[variantTypeName] = `Weapons of this quality can be found: ${textArray.join(", ")}`;
        }
        return { descriptions };
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
}