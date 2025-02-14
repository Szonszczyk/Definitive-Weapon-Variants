import { HashUtil } from "@spt/utils/HashUtil";
import { Item } from "@spt/models/eft/common/tables/IItem";
import { Money } from "@spt/models/enums/Money";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

import { WTTInstanceManager } from "./WTTInstanceManager";

export class TraderChanges
{
    private Instance: WTTInstanceManager;
    protected hashUtil: HashUtil;

    public preSptLoad(Instance: WTTInstanceManager, hashutil: HashUtil): void 
    {
    	this.hashUtil = hashutil;
        this.Instance = Instance;
    }

    public postDBLoad(): void 
    {
    	this.addItemsToTrader();
    }

    private addItemsToTrader(): void {

        const items = [
            {
                "id": "5cde8864d7f00c0010373be1",
                "name": "12.7x108mm B-32",
                "price": 2500,
                "traderId": "58330581ace78e27b8b10cee"
            }
        ];

        const barterDefault = Money.ROUBLES;
        const countDefault = 999;
        const lvlDefault = 1;
        let numItemsAdded = 0;
        
        for (const item of items) {
            const traderId = item.traderId;
        	const newItemToAdd: Item = {
	            _id: this.hashUtil.generate(),
	            _tpl: item.id,
	            parentId: "hideout", // Should always be "hideout"
	            slotId: "hideout", // Should always be "hideout"
	            upd: {
	                UnlimitedCount: true,
	                StackObjectsCount: item.count ? item.count*5 : countDefault
	            }
	        };
	        this.Instance.database.traders[traderId].assort.items.push(newItemToAdd);
            this.Instance.database.traders[traderId].assort.barter_scheme[newItemToAdd._id] = [[{ count: item.price, _tpl: item.barter ? item.barter : barterDefault }]];
            this.Instance.database.traders[traderId].assort.loyal_level_items[newItemToAdd._id] = item.lvl ? item.lvl : lvlDefault;
            numItemsAdded++;
        }

        this.Instance.logger.log(
            `[${this.Instance.modName}] Database: Added ${numItemsAdded} items to trader assort.`,
            LogTextColor.GREEN
        );

    }

    private removeItemFromTrader(itemTpl, traderID): void {
        const assort = this.Instance.database.traders[traderID].assort
        const assortID = assort.items.find(item => item._tpl === itemTpl)._id;

        if (assortID) {
            assort.items = assort.items.filter(item => item._id !== assortID);
            delete assort.barter_scheme[assortID];
            delete assort.loyal_level_items[assortID];
        } else {
            this.Instance.logger.log(
                `[${this.Instance.modName}] removeItemFromTrader: assort for ${itemTpl}/${traderID} not found`,
                LogTextColor.RED
            );
        }
    }

    private changeTraderBarter(
        traderID: string,
        itemId: string, //new item - price
        barterName: string, //old item
        price: number
    ): void {

        const barterToChange = this.Instance.database.traders[traderID].assort.items.find(item => item._tpl === barterName);
        if (!barterToChange) {
            this.Instance.logger.log(
                `[${this.Instance.modName}] changeTraderBarter: barterToChange for ${barterName}/${traderID} not found`,
                LogTextColor.RED
            );
            return;
        }
        const itemIDToChange = barterToChange._id;

        if (this.Instance.database.traders[traderID].assort.barter_scheme[itemIDToChange]) {
            this.Instance.database.traders[traderID].assort.barter_scheme[itemIDToChange] = [[{
                "count": price,
                "_tpl": itemId
            }]];
        } else {
            this.Instance.logger.log(
                `[${this.Instance.modName}] changeTraderBarter: barter_scheme for ${barterName}/${itemIDToChange} not found`,
                LogTextColor.RED
            );
        }
    }
}