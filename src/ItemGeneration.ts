import * as fs from "fs";
import * as path from "path";
import { WTTInstanceManager } from "./WTTInstanceManager";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { 
    ConfigItem, raritySettings, traderIDs,
    findSlotWithName

 } from "./references/configConsts";
import { ItemConfiguration } from "./references/generationConsts";

export class ItemGeneration
{
    private Instance: WTTInstanceManager;
    private modConfig: any;
    private ShortNames: { [shortName: string]: string };

    public preSptLoad(Instance: WTTInstanceManager, config: any): void
    {
        this.Instance = Instance;
        this.modConfig = config;
    }

    public generateItems(): ConfigItem
    {
        const generatedItems: ConfigItem = {};

        // load from cache
        if (this.modConfig.useCache ? this.Instance.helpers.fileWasChanged : false) {
            const itemsFromCache = JSON.parse(fs.readFileSync(path.join(__dirname, "../db/Cache/generatedItems.json"), "utf-8", (err) => {}));
            Object.assign(generatedItems, itemsFromCache);
            return generatedItems;
        }

        const itemsIds = this.Instance.helpers.dbItemsIds;
        const items = this.Instance.helpers.dbAttachments;
        this.ShortNames = this.Instance.helpers.dbShortnames;
        const newIds: {[ItemName: string]: string} = {};

        for (const itemName in items) {
            const item = items[itemName];
            const copiedItem = this.Instance.database.templates.items[item.itemTplToClone];
            const copiedItemHandbook = this.Instance.database.templates.handbook.Items.filter(Item => Item.Id === item.itemTplToClone)[0];
            const rarity = raritySettings[item.rarity];

            if (!itemsIds[itemName]) {
                this.Instance.logger.log(
                    `[${this.Instance.modName}] itemGeneration.ItemGeneration: Generating mongoids for '${itemName}'`,
                    LogTextColor.GREEN
                );
                itemsIds[itemName] = this.Instance.hashUtil.generate()
                newIds[itemName] = itemsIds[itemName];
            }
            const id = itemsIds[itemName];

            const newItem: ConfigItem = {};
            newItem[id] = {
                itemTplToClone: item.itemTplToClone,
                overrideProperties:
                    Object.assign({BackgroundColor: this.Instance.helpers.colorConverterAPILoaded ? `${rarity.color}ff` : rarity.bgColor}, item.props),
                parentId: item.additionalChanges?._parent ? item.additionalChanges._parent : copiedItem._parent, 
                handbookParentId: copiedItemHandbook.ParentId,
                locales: {
                    en: {
                        name: `<b><color=${rarity.color}>${itemName}</color></b>`,
                        shortName: item.ShortName,
                        description: [
                            `<align="center">${item.Description}`,
                            ``,
                            `Part of <color=${rarity.color}><b>${item.variant} Variant</b></color>`,
                            ``,
                            `This item is integral part of weapon from Definitive Weapon Variants mod and can't be used without proper variant weapon.`,
                            `${!item.barterScheme ? `Can't be bought from traders` : `Can be bought in ${item.barterScheme.traderId} LL${item.barterScheme.loyalLevel}`}</align>`
                        ].join('\n')
                    }
                },
                fleaPriceRoubles: item.handbookPriceRoubles*2,
                handbookPriceRoubles: item.handbookPriceRoubles,
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
                masteries: false,
                masterySections: {},
                addweaponpreset: false,
                weaponpresets: [],
                addtoHallOfFame: false,
                addtoSpecialSlots: false
            };
            this.changeAdditionalPropertiesSlots(newItem, id, copiedItem, item, itemsIds);
            this.changeAdditionalPropertiesCartridges(newItem, id, copiedItem, item);
            this.addTraderInfo(newItem, id, item);
            Object.assign(generatedItems, newItem);
        }
        if (Object.keys(newIds).length > 0) this.Instance.helpers.saveJsonToFile(newIds, "ItemsIds");
        fs.writeFileSync(path.join(__dirname, "../db/Cache/generatedItems.json"), JSON.stringify(generatedItems, null, 2));
        return generatedItems;
    }

    private changeAdditionalPropertiesSlots(
        itemConfig: ConfigItem,
        id: string,
        copiedItem: any,
        config: ItemConfiguration,
        itemsIds: { [shortName: string]: string }
    ): void {
        if (!config.additionalChanges?.Slots) return;

        let slotsOriginal = structuredClone(copiedItem._props.Slots);
        const slots = config.additionalChanges.Slots;

        for(const slot in slots) {
            const slotOriginal = findSlotWithName(slotsOriginal, slot);

            // can't change slot that does not exist
            if (!slotOriginal) continue;
            const newFilter = slots[slot];
            if (typeof newFilter === 'object' && newFilter.length == 0) {
                // remove if no filter
                slotsOriginal = slotsOriginal.filter(element => element._name != slot);
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
                for (let i = 0; i < choosenFilter.length; i++) {
                    choosenFilter[i] = itemsIds[choosenFilter[i]] ? itemsIds[choosenFilter[i]] : choosenFilter[i];
                }
                slotOriginal._props.filters[0].Filter = choosenFilter;
            }
        }
        // Change id of changed slots to new weapon
        slotsOriginal.forEach(e => e._parent = id);
        // Change if of each slot to new one
        slotsOriginal.forEach(e => e._id = this.Instance.hashUtil.generate());
        itemConfig[id].overrideProperties.Slots = slotsOriginal;
    }

    private changeAdditionalPropertiesCartridges(
        itemConfig: ConfigItem,
        id: string,
        copiedItem: any,
        config: ItemConfiguration
    ): void {
        if (!config.additionalChanges?.Cartridges) return;

        const change = config.additionalChanges.Cartridges;

        const filters: {Filter: string[]}[] = [];

        const cartridgesNew = {
            "_name": "cartridges",
            "_id": this.Instance.hashUtil.generate(),
            "_parent": id,
            "_max_count": change._max_count,
            "_props": { "filters": filters },
            "_proto": copiedItem._props.Cartridges[0]._proto
        };


        const filterFromOtherItems: string[] = [];

        // Helper to safely add filters from items
        const addFilters = (ids: string[] | undefined, getSlotFn: (itemId: string) => any) => {
            if (!ids) return;
            for (const id of ids) {
                const realId = this.ShortNames[id] ?? id;
                const item = this.Instance.database.templates.items[realId];
                const slot = getSlotFn(item);
                const filters = slot?._props?.filters?.[0]?.Filter;
                if (filters) {
                    filterFromOtherItems.push(...filters);
                }
            }
        };

        addFilters(change.Filter.fromWeapons, (item) =>
            findSlotWithName(item._props.Chambers, "patron_in_weapon")
        );

        addFilters(change.Filter.fromMagazines, (item) =>
            findSlotWithName(item._props.Cartridges, "cartridges")
        );

        if (change.Filter.add) {
            filterFromOtherItems.push(...change.Filter.add);
        }

        cartridgesNew._props.filters.push({
            Filter: filterFromOtherItems.length > 0 ? filterFromOtherItems : change.Filter as any
        });

        itemConfig[id].overrideProperties.Cartridges = [ cartridgesNew ];

        const slots = itemConfig[id].overrideProperties.Slots ? itemConfig[id].overrideProperties.Slots : structuredClone(copiedItem._props.Slots);
        if (slots.length > 0) {
            for (const slot of slots) {
                if (slot._name.includes("camora_")) {
                    slot._props.filters[0].Filter = cartridgesNew._props.filters[0].Filter;
                }
            }
            slots.forEach(e => e._parent = id);
            slots.forEach(e => e._id = this.Instance.hashUtil.generate());
            itemConfig[id].overrideProperties.Slots = slots;
        }
    }

    private addTraderInfo(
        itemConfig: ConfigItem,
        id: string,
        config: ItemConfiguration
    ): void {
        if (!config.barterScheme) return;

        const info = config.barterScheme;

        Object.assign(itemConfig[id], {
            addtoTraders: true,
            traderId: info.traderId,
            loyallevelitems: info.loyalLevel
        });

        itemConfig[id].traderItems.push({
            unlimitedCount: info.unlimitedCount,
            stackObjectsCount: info.stackObjectsCount
        });

        itemConfig[id].barterScheme.push({
            count: info.price,
            _tpl: info.barter
        });
    }
}