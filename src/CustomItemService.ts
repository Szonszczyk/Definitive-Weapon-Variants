/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from "fs";
import * as path from "path";
import { NewItemFromCloneDetails } from "@spt/models/spt/mod/NewItemDetails";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { ILocation } from "@spt/models/eft/common/ILocation";
import { HashUtil } from "@spt/utils/HashUtil";
import { WTTInstanceManager } from "./WTTInstanceManager";
import { WeaponGeneration } from "./WeaponGeneration";
import { ItemMap } from "./references/items";
import { ItemBaseClassMap } from "./references/itemBaseClasses";
import { ItemHandbookCategoryMap } from "./references/itemHandbookCategories";
import {
    Preset, Item, ConfigItem, traderIDs, currencyIDs,
    allBotTypes, inventorySlots, WeaponClones
} from "./references/configConsts";

export class CustomItemService
{
    private configs: ConfigItem;
    private Instance: WTTInstanceManager;
    private modConfig: any;
    private weaponGeneration: WeaponGeneration = new WeaponGeneration();

    constructor() 
    {
        this.configs = this.loadCombinedConfig();
    }

    public preSptLoad(Instance: WTTInstanceManager, config: any, hashutil: HashUtil): void 
    {
        this.Instance = Instance;
        this.modConfig = config;
        this.weaponGeneration.preSptLoad(this.Instance, config, hashutil);
    }

    public postDBLoad(): void 
    {
        const newWeapons = this.weaponGeneration.generateWeapons();
        Object.assign(this.configs, newWeapons);

        let numItemsAdded = 0;

        const airdropLoot = this.Instance.configServer.configs["spt-airdrop"].loot;
        const blacklist = this.Instance.configServer.configs["spt-trader"].fence.blacklist;
        const flea = this.Instance.configServer.configs["spt-ragfair"].dynamic.blacklist.custom;

        const weaponClones: WeaponClones = {};

        for (const itemId in this.configs)
        {
            const itemConfig = this.configs[itemId];

            const { exampleCloneItem, finalItemTplToClone } = this.createExampleCloneItem(itemConfig, itemId);
            if (this.Instance.debug) {
                console.log(`Item ID: ${itemId}`);
            }

            if (!this.Instance.database.templates.items[finalItemTplToClone]) {
                if (this.Instance.debug) {
                    this.Instance.logger.log(
                        `[${this.Instance.modName}] Skip: '${itemConfig.locales.en.shortName}' - cloned item not exist in this version of the game.`,
                        LogTextColor.YELLOW
                    );
                }
            } else {

                this.Instance.customItem.createItemFromClone(exampleCloneItem);
                this.processStaticLootContainers(itemConfig, itemId);
                this.processModSlots(itemConfig, [finalItemTplToClone], itemId); // Wrap finalItemTplToClone in an array
                this.processInventorySlots(itemConfig, itemId); // Pass itemId and inventorySlots in the correct order
                this.processMasterySections(itemConfig, itemId);
                this.processWeaponPresets(itemConfig, itemId);
                this.processBotInventories(
                    itemConfig,
                    finalItemTplToClone,
                    itemId
                );
                this.processTraders(itemConfig, itemId);

                //special area only for weapons
                if (itemConfig?.additionalInfo) {
                    const variantRarity = itemConfig.additionalInfo.rarity;
                    //for weapons that were changed caliber, add them to different weapon for kill quests
                    let weaponToUseForKillQuests = finalItemTplToClone;
                    if (itemConfig.additionalInfo.contributesToQuestsAsWeapon != "") {
                        weaponToUseForKillQuests = itemConfig.additionalInfo.contributesToQuestsAsWeapon;
                    }
    
                    //add to weapon clones database to later add to quests
                    if (!weaponClones[weaponToUseForKillQuests]) {
                        weaponClones[weaponToUseForKillQuests] = [];
                    }
                    weaponClones[weaponToUseForKillQuests].push(itemId);
    
                    // Add to fence blacklist
                    if (this.modConfig.fence.blacklist.includes(variantRarity)) {
                        blacklist.push(itemId);
                    }
    
                    // Add to flea blacklist
                    if (this.modConfig.flea.blacklist.includes(variantRarity)) {
                        flea.push(itemId);
                    }
                    
                    // Add to airdrop blacklist
                    if (this.modConfig.airdrop.blacklist.includes(variantRarity)) {
                        for(const loot in airdropLoot) {
                            airdropLoot[loot].itemBlacklist.push(itemId);
                        }
                    }
                }
                numItemsAdded++;
            }
        }

        this.processWeaponKillsQuests(weaponClones);

        if (numItemsAdded > 0) 
        {
            this.Instance.logger.log(
                `[${this.Instance.modName}] Loaded '${numItemsAdded}' custom items`,
                LogTextColor.GREEN
            );
        }
        else 
        {
            this.Instance.logger.log(
                `[${this.Instance.modName}] No custom items loaded`,
                LogTextColor.GREEN
            );
        }

    }


    /**
   * Creates an example clone item with the provided item configuration and item ID.
   *
   * @param {any} itemConfig - The configuration of the item to clone.
   * @param {string} itemId - The ID of the item.
   * @return {{ exampleCloneItem: NewItemFromCloneDetails, finalItemTplToClone: string }} The created example clone item and the final item template to clone.
   */
    private createExampleCloneItem(
        itemConfig: ConfigItem[string],
        itemId: string
    ): {
            exampleCloneItem: NewItemFromCloneDetails;
            finalItemTplToClone: string;
        } 
    {
        const itemTplToCloneFromMap = ItemMap[itemConfig.itemTplToClone] || itemConfig.itemTplToClone;
        const finalItemTplToClone = itemTplToCloneFromMap;

        const parentIdFromMap = ItemBaseClassMap[itemConfig.parentId] || itemConfig.parentId;
        const finalParentId = parentIdFromMap;

        const handbookParentIdFromMap = ItemHandbookCategoryMap[itemConfig.handbookParentId] || itemConfig.handbookParentId;
        const finalHandbookParentId = handbookParentIdFromMap;

        const exampleCloneItem: NewItemFromCloneDetails = {
            itemTplToClone: finalItemTplToClone,
            overrideProperties: itemConfig.overrideProperties ? itemConfig.overrideProperties : undefined,
            parentId: finalParentId,
            newId: itemId,
            fleaPriceRoubles: itemConfig.fleaPriceRoubles,
            handbookPriceRoubles: itemConfig.handbookPriceRoubles,
            handbookParentId: finalHandbookParentId,
            locales: itemConfig.locales
        };

        if (this.Instance.debug)
        {
            console.log(`Cloning item ${finalItemTplToClone} for itemID: ${itemId}`);
        }
        return { exampleCloneItem, finalItemTplToClone };
    }

   /**
     * Adds an item to a static loot container with a given probability.
     *
     * @param {string} containerID - The ID of the loot container.
     * @param {string} itemToAdd - The item to add to the loot container.
     * @param {number} probability - The probability of the item being added.
     * @return {void} This function does not return anything.
     */
    private addToStaticLoot(
        containerID: string,
        itemToAdd: string,
        probability: number
    ): void {
        const locations = this.Instance.database.locations;

        for (const locationID in locations) {
            if (locations.hasOwnProperty(locationID)) {
                const location: ILocation = locations[locationID];

                if (location.staticLoot) {
                    const staticLoot = location.staticLoot;

                    if (staticLoot.hasOwnProperty(containerID)) {
                        const lootContainer = staticLoot[containerID];

                        if (lootContainer) {
                            const lootDistribution = lootContainer.itemDistribution;
                            const templateFromMap = ItemMap[itemToAdd];
                            const finalTemplate = templateFromMap || itemToAdd;

                            const newLoot = [
                                {
                                    tpl: finalTemplate,
                                    relativeProbability: probability
                                }
                            ];

                            lootDistribution.push(...newLoot);
                            lootContainer.itemDistribution = lootDistribution;
                            if (this.Instance.debug) { 
                                console.log(`Added ${itemToAdd} to loot container: ${containerID} in location: ${locationID}`);
                            }
                        } else {
                            if (this.Instance.debug) {
                                console.log(`Error: Loot container ID ${containerID} not found in location: ${locationID}`);
                            }
                        }
                    } else {
                        if (this.Instance.debug) {
                            console.log(`Error: Loot container ID ${containerID} not found in location: ${locationID}`);
                        }
                    }
                } else {
                    if (this.Instance.debug) {
                        console.warn(`Warning: No static loot found in location: ${locationID}`);
                    }
                }
            }
        }
    }

    /**
   * Processes the static loot containers for a given item.
   *
   * @param {any} itemConfig - The configuration object for the item.
   * @param {string} itemId - The ID of the item.
   * @return {void} This function does not return a value.
   */
    private processStaticLootContainers(itemConfig: any, itemId: string): void {
        if (itemConfig.addtoStaticLootContainers) {
            if (this.Instance.debug) {
                console.log("Processing static loot containers for item:", itemId);
            }
            if (Array.isArray(itemConfig.StaticLootContainers)) {
                if (this.Instance.debug) {
                    console.log("Adding item to multiple static loot containers:");
                }
                itemConfig.StaticLootContainers.forEach((container) => {
                    const staticLootContainer =
                        ItemMap[container.ContainerName] || container.ContainerName;
                    this.addToStaticLoot(
                        staticLootContainer,
                        itemId,
                        container.Probability
                    );
                    if (this.Instance.debug) {
                        console.log(` - Added to container '${staticLootContainer}' with probability ${container.Probability}`);
                    }
                });
            }
            else {
                const staticLootContainer =
                    ItemMap[itemConfig.StaticLootContainers] ||
                    itemConfig.StaticLootContainers;
                this.addToStaticLoot(
                    staticLootContainer,
                    itemId,
                    itemConfig.Probability
                );
                if (this.Instance.debug) {
                    console.log(`Added to container '${staticLootContainer}' with probability ${itemConfig.Probability}`);
                }
            }
        }
    }

    /**
   * Processes the mod slots of an item.
   *
   * @param {any} itemConfig - The configuration of the item.
   * @param {string[]} finalItemTplToClone - The final item template to clone.
   * @param {string} itemId - The ID of the item.
   * @returns {void}
   */
    private processModSlots(
        itemConfig: ConfigItem[string],
        finalItemTplToClone: string[],
        itemId: string
    ): void 
    {
        const tables = this.Instance.database;

        const moddableItemWhitelistIds = Array.isArray(
            itemConfig.ModdableItemWhitelist
        )
            ? itemConfig.ModdableItemWhitelist.map((shortname) => ItemMap[shortname])
            : itemConfig.ModdableItemWhitelist
                ? [ItemMap[itemConfig.ModdableItemWhitelist]]
                : [];

        const moddableItemBlacklistIds = Array.isArray(
            itemConfig.ModdableItemBlacklist
        )
            ? itemConfig.ModdableItemBlacklist.map((shortname) => ItemMap[shortname])
            : itemConfig.ModdableItemBlacklist
                ? [ItemMap[itemConfig.ModdableItemBlacklist]]
                : [];

        const modSlots = Array.isArray(itemConfig.modSlot)
            ? itemConfig.modSlot
            : itemConfig.modSlot
                ? [itemConfig.modSlot]
                : [];

        const lowercaseModSlots = modSlots.map((modSlotName) =>
            modSlotName.toLowerCase()
        );

        if (itemConfig.addtoModSlots) 
        {
            if (this.Instance.debug)
            {
                console.log("Processing mod slots for item:", itemId);
            }
            for (const parentItemId in tables.templates.items) 
            {
                const parentItem = tables.templates.items[parentItemId];

                if (!parentItem._props.Slots) 
                {
                    continue;
                }

                const isBlacklisted = moddableItemBlacklistIds.includes(parentItemId);
                const isWhitelisted = moddableItemWhitelistIds.includes(parentItemId);

                if (isBlacklisted) 
                {
                    continue;
                }

                let addToModSlots = false;

                if (isWhitelisted && itemConfig.modSlot) 
                {
                    addToModSlots = true;
                }
                else if (!isBlacklisted && itemConfig.modSlot) 
                {
                    for (const modSlot of parentItem._props.Slots) 
                    {
                        if (
                            modSlot._props.filters &&
              modSlot._props.filters[0].Filter.some((filterItem) =>
                  finalItemTplToClone.includes(filterItem)
              )
                        ) 
                        {
                            if (lowercaseModSlots.includes(modSlot._name.toLowerCase())) 
                            {
                                addToModSlots = true;
                                break;
                            }
                        }
                    }
                }

                if (addToModSlots) 
                {
                    for (const modSlot of parentItem._props.Slots) 
                    {
                        if (lowercaseModSlots.includes(modSlot._name.toLowerCase())) 
                        {
                            if (!modSlot._props.filters) 
                            {
                                modSlot._props.filters = [
                                    {
                                        AnimationIndex: 0,
                                        Filter: []
                                    }
                                ];
                            }
                            if (!modSlot._props.filters[0].Filter.includes(itemId)) 
                            {
                                modSlot._props.filters[0].Filter.push(itemId);
                                if (this.Instance.debug)
                                {
                                    console.log(`Successfully added item ${itemId} to the filter of mod slot ${modSlot._name} for parent item ${parentItemId}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /**
   * Processes the inventory slots for a given item.
   *
   * @param {any} itemConfig - The configuration object for the item.
   * @param {string} itemId - The ID of the item.
   * @param {any} defaultInventorySlots - The default inventory slots.
   * @return {void} This function does not return a value.
   */
    private processInventorySlots(
        itemConfig: ConfigItem[string],
        itemId: string
    ): void 
    {
        const tables = this.Instance.database;

        if (itemConfig.addtoInventorySlots) 
        {
            if (this.Instance.debug)
            {
                console.log("Processing inventory slots for item:", itemId);
            }
            const defaultInventorySlots =
        tables.templates.items["55d7217a4bdc2d86028b456d"]._props.Slots;

            const allowedSlots = Array.isArray(itemConfig.addtoInventorySlots)
                ? itemConfig.addtoInventorySlots
                : [itemConfig.addtoInventorySlots];

            // Iterate over the slots and push the item into the filters per the config
            for (const slot of defaultInventorySlots) 
            {
                const slotName = inventorySlots[slot._name];
                const slotId = Object.keys(inventorySlots).find(
                    (key) => inventorySlots[key] === slot._name
                );

                if (
                    allowedSlots.includes(slot._name) ||
          allowedSlots.includes(slotName) ||
          allowedSlots.includes(slotId)
                ) 
                {
                    if (!slot._props.filters[0].Filter.includes(itemId)) 
                    {
                        slot._props.filters[0].Filter.push(itemId);
                        if (this.Instance.debug)
                        {
                            console.log(`Successfully added item ${itemId} to the filter of slot ${slot._name}`);
                        }
                    }
                }
            }
        }
    }

    /**
   * Processes the mastery sections for an item.
   *
   * @param {any} itemConfig - The configuration object for the item.
   * @param {string} itemId - The ID of the item.
   * @param {any} tables - The tables object containing global configuration.
   * @return {void} This function does not return a value.
   */
    private processMasterySections(
        itemConfig: ConfigItem[string],
        itemId: string
    ): void 
    {
        const tables = this.Instance.database;
        if (itemConfig.masteries) 
        {
            if (this.Instance.debug)
            {
                console.log("Processing mastery sections for item:", itemId);
            }
            const masterySections = Array.isArray(itemConfig.masterySections)
                ? itemConfig.masterySections
                : [itemConfig.masterySections];

            for (const mastery of masterySections) 
            {
                const existingMastery = tables.globals.config.Mastering.find(
                    (existing) => existing.Name === mastery.Name
                );
                if (existingMastery) 
                {
                    existingMastery.Templates.push(...mastery.Templates);
                    if (this.Instance.debug)
                    {
                        console.log(` - Adding to existing mastery section for item: ${itemId}`);
                    }
                }
                else 
                {
                    tables.globals.config.Mastering.push(mastery);
                    if (this.Instance.debug)
                    {
                        console.log(` - Adding new mastery section for item: ${itemId}`);
                    }
                }
            }
        }
    }

    /**
   * Processes weapon presets based on the provided item configuration and tables.
   *
   * @param {any} itemConfig - The item configuration.
   * @return {void} This function does not return anything.
   */
    private processWeaponPresets(
        itemConfig: ConfigItem[string],
        itemId: string
    ): void {
        const tables = this.Instance.database;
        const { addweaponpreset, weaponpresets } = itemConfig;
        const itemPresets = tables.globals.ItemPresets;

        if (addweaponpreset) {
            if (this.Instance.debug) {
                console.log("Processing weapon presets for item:", itemId);
            }
            weaponpresets.forEach((presetData) => {
                const preset: Preset = {
                    _changeWeaponName: presetData._changeWeaponName,
                    _encyclopedia: presetData._encyclopedia || undefined,
                    _id: presetData._id,
                    _items: presetData._items.map((itemData: any) => {
                        const item: Item = {
                            _id: itemData._id,
                            _tpl: itemData._tpl
                        };

                        // Add parentId and slotId only if they are present in itemData
                        if (itemData.parentId) {
                            item.parentId = itemData.parentId;
                        }
                        if (itemData.slotId) {
                            item.slotId = itemData.slotId;
                        }

                        return item;
                    }),
                    _name: presetData._name,
                    _parent: presetData._parent,
                    _type: "Preset"
                };

                itemPresets[preset._id] = preset;
                if (this.Instance.debug) {
                    console.log(` - Added weapon preset: ${preset._name}`);
                    console.log(` - Preset: ${JSON.stringify(preset)}`);
                }
            });
        }
    }

    /**
   * Processes traders based on the item configuration.
   *
   * @param {any} itemConfig - The configuration of the item.
   * @param {string} itemId - The ID of the item.
   * @return {void} This function does not return a value.
   */

    private processTraders(
        itemConfig: ConfigItem[string],
        itemId: string
    ): void 
    {
        const tables = this.Instance.database;
        if (!itemConfig.addtoTraders) 
        {
            return;
        }

        const { traderId, traderItems, barterScheme } = itemConfig;

        const traderIdFromMap = traderIDs[traderId];
        const finalTraderId = traderIdFromMap || traderId;
        const trader = tables.traders[finalTraderId];

        if (!trader) 
        {
            return;
        }

        for (const item of traderItems) 
        {
            if (this.Instance.debug)
            {
                console.log("Processing traders for item:", itemId);
            }
            const newItem = {
                _id: itemId,
                _tpl: itemId,
                parentId: "hideout",
                slotId: "hideout",
                upd: {
                    UnlimitedCount: item.unlimitedCount,
                    StackObjectsCount: item.stackObjectsCount
                }
            };

            trader.assort.items.push(newItem);
            if (this.Instance.debug)
            {
                console.log(`Successfully added item ${itemId} to the trader ${traderId}`);
            }
        }

        trader.assort.barter_scheme[itemId] = [];

        for (const scheme of barterScheme) 
        {
            if (this.Instance.debug)
            {
                console.log("Processing trader barter scheme for item:", itemId);
            }
            const count = scheme.count;
            const tpl = currencyIDs[scheme._tpl] || ItemMap[scheme._tpl];

            if (!tpl) 
            {
                throw new Error(
                    `Invalid _tpl value in barterScheme for item: ${itemId}`
                );
            }

            trader.assort.barter_scheme[itemId].push([
                {
                    count: count,
                    _tpl: tpl
                }
            ]);
            if (this.Instance.debug)
            {
                console.log(`Successfully added item ${itemId} to the barter scheme of trader ${traderId}`);
            }
        }

        trader.assort.loyal_level_items[itemId] = itemConfig.loyallevelitems;
    }

    /**
   * Processes the bot inventories based on the given item configuration.
   *
   * @param {any} itemConfig - The item configuration.
   * @param {string} finalItemTplToClone - The final item template to clone.
   * @param {string} itemId - The item ID.
   * @return {void} This function does not return anything.
   */
    private processBotInventories(
        itemConfig: ConfigItem[string],
        finalItemTplToClone: string,
        itemId: string
    ): void 
    {
        const tables = this.Instance.database;
        if (itemConfig.addtoBots) 
        {
            if (this.Instance.debug) 
            {
                console.log("Processing traders for item:", itemId);
            }
            for (const botId in tables.bots.types) 
            {
                const botType = allBotTypes[botId];
                if (botType) 
                {
                    for (const lootSlot in tables.bots.types[botId].inventory.items) 
                    {
                        const items = tables.bots.types[botId].inventory.items;
                        // Check if the loot slot contains the final item template
                        if (items[lootSlot][finalItemTplToClone] !== undefined) 
                        {
                            const weight = items[lootSlot][finalItemTplToClone];
                            if (this.Instance.debug) 
                            {
                                console.log(` - Adding item to bot inventory for bot type: ${botType} in loot slot: ${lootSlot} with weight: ${weight}`);
                            }
                            // Push the item to the loot slot with the corresponding weight
                            items[lootSlot][itemId] = weight;
                        }
                    }
                }
            }
        }
    }
    /**
   * Processes the kill quests AvailableForFinish Conditions Weapons and adds new weapons if copy was found
   *
   * @param {any} weaponClones - Arrays of newIds with keys of original weapons
   * @return {void} This function does not return anything.
   */
    private processWeaponKillsQuests(
        weaponClones: WeaponClones
    ): void {
        const quests = this.Instance.database.templates.quests;
        for (const questId in quests) {
            const quest = quests[questId];
            for (const aff of quest.conditions.AvailableForFinish) {
                if (aff?.counter?.conditions) {
                    for (const condition of aff.counter.conditions) {
                        if (condition?.weapon) {
                            condition.weapon = condition.weapon.concat(this.getCloneIDs(weaponClones, condition.weapon));
                        }
                    }
                }
            }
        }
    }

    private getCloneIDs(
        weaponClones: WeaponClones,
        originalWeaponIDs: string[]
    ): string[] {
      const cloneIDs: string[] = [];
      for (const originalID of originalWeaponIDs) {
        if (weaponClones[originalID]) {
          // Add the clones of this original weapon to the result
          cloneIDs.push(...weaponClones[originalID]);
        }
      }
      return cloneIDs;
    }
    
    /**
   * Loads and combines multiple configuration files into a single ConfigItem object.
   *
   * @return {any} The combined configuration object.
   */
    private loadCombinedConfig(): any 
    {
        const configFiles = fs
            .readdirSync(path.join(__dirname, "../db/Items"))
            .filter((file) => !file.includes("BaseItemReplacement"));

        const combinedConfig: any = {};

        configFiles.forEach((file) => 
        {
            const configPath = path.join(__dirname, "../db/Items", file);
            const configFileContents = fs.readFileSync(configPath, "utf-8");
            const config = JSON.parse(configFileContents) as ConfigItem;

            Object.assign(combinedConfig, config);
        });

        return combinedConfig;
    }

}
