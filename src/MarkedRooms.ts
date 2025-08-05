import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

import { ConfigItem, Item, markedRoomsLoot, markedRoomsNames } from "./references/configConsts";
import { WTTInstanceManager } from "./WTTInstanceManager";

export class MarkedRooms
{
    private Instance: WTTInstanceManager;
    private modConfig: any;
    public moduleEnabled: boolean;
    private markedRooms: markedRoomsLoot;
    private weaponsToAdd: {[map: string]: {Items: Item[], keys: number[]}};
    private idsInMarkedRoom: {[map: string]: number[]};
    public variantTypesMarkedRooms: {[map: string]: string[]};

    public preSptLoad(Instance: WTTInstanceManager, config: any): void 
    {
        this.Instance = Instance;
        this.modConfig = config;
        this.markedRooms = {};
        this.weaponsToAdd = {};
        this.idsInMarkedRoom = {};
        this.variantTypesMarkedRooms = {};
    }

    public postDBLoad(): void 
    {
        this.loadMarkedRoomsLoot();
        // check if module is even enabled
        if (!this.modConfig.marked.enabled
            || Object.values(this.modConfig.marked.probability).reduce((sum, val) => sum + val, 0) === 0
            || Object.values(this.variantTypesMarkedRooms).reduce((sum, arr) => sum + arr.length, 0) === 0
        ) this.moduleEnabled = false; else this.moduleEnabled = true;
    }

    private loadMarkedRoomsLoot(): void
    {
        for (const mapName in markedRoomsNames) {
            this.weaponsToAdd[mapName] = {Items: [], keys: []};
            const map = this.Instance.database?.locations?.[mapName]?.looseLoot?.spawnpoints;
            for (const spawnPoint of map) {
                for (const loot of markedRoomsNames[mapName]) {
                    if (spawnPoint.template.Id.startsWith(loot)) {
                        if (!this.markedRooms[mapName]) this.markedRooms[mapName] = {};
                        this.markedRooms[mapName][spawnPoint.template.Id] = {
                            keys: [],
                            maxProbability: 0,
                            map: mapName
                        };
                        for (const item of spawnPoint.itemDistribution) {
                            this.markedRooms[mapName][spawnPoint.template.Id].keys.push(item.composedKey.key);
                            this.markedRooms[mapName][spawnPoint.template.Id].maxProbability += item.relativeProbability;
                        }
                        break;
                    }
                    for (const item of spawnPoint.itemDistribution) {
                        if (!this.idsInMarkedRoom[mapName]) this.idsInMarkedRoom[mapName] = [];
                        if (!this.idsInMarkedRoom[mapName].includes(item.composedKey.key)) this.idsInMarkedRoom[mapName].push(item.composedKey.key);
                    }
                }
            }
        }
        // combine all variant types from config file from "per map/rarity" to "per map"
        for (const map in this.modConfig.marked.maps) {
            for (const variantType in this.modConfig.marked.maps[map]) {
                if (!this.variantTypesMarkedRooms[map]) this.variantTypesMarkedRooms[map] = [];
                this.variantTypesMarkedRooms[map].push(...this.modConfig.marked.maps[map][variantType]);
            }
        }
    }

    
    /**
   * Adds weapon to marked room database to later be added to marked room loot pool
   *
   * @param {any} itemConfig - The configuration of the item.
   * @returns {void}
   */
    public addWeaponToMarkedRoom(
        itemConfig: ConfigItem[string]
    ):void {
        if (!this.moduleEnabled) return;

        let mapName = "";
        for (const map in this.modConfig.marked.maps) {
            if (this.variantTypesMarkedRooms[map].includes(itemConfig.additionalInfo.variantType)) {
                mapName = map;
                break;
            }
        }
        if (!mapName) return;

        const weaponPreset = structuredClone(itemConfig.weaponpresets[0]._items);
        let composedKey = 0;
        do { composedKey = Math.floor(Math.random() * 6755032633141111) } while (this.idsInMarkedRoom[mapName].includes(composedKey));
        this.idsInMarkedRoom[mapName].push(composedKey);
        const oldId = structuredClone(weaponPreset[0]._id);
        weaponPreset[0]._id = String(composedKey);
        for (let i = 1; i < weaponPreset.length; i++) {
            if(weaponPreset[i].parentId === oldId) {
                weaponPreset[i].parentId = String(composedKey);
            }
        }
        this.weaponsToAdd[mapName].Items.push(...weaponPreset);
        this.weaponsToAdd[mapName].keys.push(composedKey);
    }

    /**
   * Trigger adding weapons from marked room database to marked room loot pool
   *
   * @returns {void}
   */
    public processMarkedRooms(): void
    {
        if (!this.moduleEnabled) return;
        const weaponCount: string[] = [];

        for (const mapName in this.weaponsToAdd) {
            const map = this.Instance.database?.locations?.[mapName]?.looseLoot?.spawnpoints;
            for (const spawnPointId in this.markedRooms[mapName]) {
                const markedRoom = this.markedRooms[mapName][spawnPointId];
                const spawnPoint = map.find(x => x.template.Id === spawnPointId);
                const probabilityInRoom = Math.floor((markedRoom.maxProbability * this.modConfig.marked.probability[mapName] / 100) / (1 - this.modConfig.marked.probability[mapName] / 100) / markedRoom.keys.length);
                spawnPoint.template.Items.push(...this.weaponsToAdd[mapName].Items);
                for (const key of this.weaponsToAdd[mapName].keys) {
                    spawnPoint.itemDistribution.push({
                        "composedKey": {
                            "key": String(key)
                        },
                        "relativeProbability": probabilityInRoom <= 0 ? 1 : probabilityInRoom
                    });
                }
            }
            const weaponsAdded = this.weaponsToAdd[mapName].keys.length;
            if (weaponsAdded > 0) {
                weaponCount.push(`${weaponsAdded} weapons to ${mapName}`);
            }
        }
        this.Instance.logger.log(
            `[${this.Instance.modName}] Added to marked rooms lootpool: ${weaponCount.join(", ")}`,
            LogTextColor.GREEN
        );
    }
}