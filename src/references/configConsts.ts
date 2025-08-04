/* eslint-disable @typescript-eslint/naming-convention */
export interface CombinedConfigItem 
{
    [itemId: string]: ConfigItem;
}
export interface ConfigItem 
{
    [itemId: string]: {
        itemTplToClone: string;
        overrideProperties: {
            [prop: string]: (string | number | string[])
        };
        parentId: string;
        fleaPriceRoubles: number;
        handbookPriceRoubles: number;
        handbookParentId: string;
        locales: {
            [locale: string]: {
                name: string;
                shortName: string;
                description: string;
            };
        };
        clearClonedProps: boolean;
        addtoInventorySlots: string[];
        addtoModSlots: boolean;
        modSlot: string[];
        ModdableItemWhitelist: string;
        ModdableItemBlacklist: string;
        addtoTraders: boolean;
        traderId: traderIDs;
        traderItems: {
            unlimitedCount: boolean;
            stackObjectsCount: number;
        }[];
        barterScheme: {
            count: number;
            _tpl: string;
        }[];
        loyallevelitems: number;
        addtoBots: boolean;
        addtoStaticLootContainers: boolean;
        StaticLootContainers: string;
        Probability: number;
        masteries: boolean;
        masterySections: {
            Name?: string;
            Templates?: string[];
        };
        addweaponpreset: boolean;
        weaponpresets: Preset[];
        addtoHallOfFame: boolean;
        addtoSpecialSlots: boolean;
        additionalInfo?: {
            rarity: string;
            variantType: string;
            contributesToQuestsAsWeapon: string;
        }
    };
    };
}

export interface Item 
{
    _id: string;
    _tpl: string;
    parentId?: string;
    slotId?: string;
}
  
export interface Preset 
{
    _changeWeaponName: boolean;
    _encyclopedia?: string;
    _id: string;
    _items: Item[];
    _name: string;
    _parent: string;
    _type: string;
}
  

export interface VoiceConfig 
{
    [voiceId: string]: {
        locale: {
            [localeId: string]: {
                [itemId: string]: string;
            };
        };
        addVoiceToPlayer: boolean;
        sideSpecificVoice: string;
    };
}

//#region Added

export interface WeaponClones {
    [key: string]: string[];
}

export function findPresetsWithEncyclopedia(
    obj: Record<string, Preset>,
    searchString: string
): Preset[] {
    return Object.values(obj).filter(
        preset => preset._encyclopedia === searchString
    );
}

export interface Slot
{
    _id: string,
    _mergeSlotWithChildren: boolean,
    _name: string,
    _parent: string,
    _props: {
        filters: [ { Filter: string[], Shift: number } ]
    },
    _proto: string,
    _required: boolean
}

export function findSlotWithName(
    slots: Slot[],
    searchString: string
): Slot {
    return slots.filter(slot => slot._name === searchString)[0];
}

export function findItemWithSlotId(
    items: Item[],
    searchString: string
): Item {
    return items.filter(item => item.slotId === searchString)[0];
}

export interface variantIDsInterface
{
    [key: string]: {
        [key: string]: string[]
    }
}

export function getShortNameById(object: { [key: string]: string }, id: string): string | undefined {
    for (const [key, value] of Object.entries(object)) {
        if (value === id) {
            return key;
        }
    }
    return undefined;
};

export interface markedRoomsLoot
{
    [map: string]: {
        [id: string]: {
            keys: number[],
            maxProbability: number,
            map: string
        }
    }
}

export const markedRoomsNames = {
    bigmap: [
        "Loot 135 (8)",
        "Loot 135 (9)",
        "Loot 135 (10)",
        "Loot 135 (11)",
        "Loot 135 (12)"
    ],
    rezervbase: [
        "cult_Loot 135 (11)",
        "cult_Loot 135 (12)",
        "cult_Loot 135 (13)",
        "Loot 135 (9)",
        "Loot 135 (10) [3",
        "Loot 135 (10) [c",
        "Loot 135 (11) [4",
        "Loot 135 (11) [5",
        "Loot 135 (12) [4b",
        "Loot 135 (12) [73",
        "Loot 135 (13) [7",
        "Loot 135 (13) [a",
        "Loot 135 (14)"
    ],
    tarkovstreets: [
        "Loot 135_Leo_Rare (8)",
        "Loot 135_Leo_Rare (9)",
        "Loot 135_Leo_Rare (10)",
        "Loot 135_Leo_Rare (13)",
        "Loot 135_Leo_Rare (15)",
        "Loot 135_Leo_Rare (29)",
        "Loot 135_Leo_Rare (30)",
        "Loot 135_Leo_Rare (31)",
        "Loot 135_Leo_Rare (40)",
        "Loot 135_Leo_Rare (41)",
        "Loot 135_Leo_Rare (43)",
    ]
}

export const mapNames = {
    bigmap: "Customs",
    rezervbase: "Reserve",
    tarkovstreets: "Streets of Tarkov"
}


export const raritySettings: {
    [rarityName: string]: {
        color: string,
        bgColor: string,
        description: string,
        flavour: string,
        starRating: string,
        priceMultiplier: number
    }
} = {
    "Ultimate": {
        "color": "#ca1f2b",
        "bgColor": "red",
        "description": "This Ultimate-quality variant is capable of outperforming even the best modified weapons",
        "flavour": "You earned it, now use it to your advantage. Kick some scav ass or something!",
        "starRating": "★★★★",
        "priceMultiplier": 1.8
    },
    "Superior": {
        "color": "#ca741f",
        "bgColor": "orange",
        "description": "This Superior-quality variant offers outstanding performance",
        "flavour": "With some training and good attachments, this weapon can turn you into a machine of destruction!",
        "starRating": "★★★",
        "priceMultiplier": 1.4
    },
    "Advanced": {
        "color": "#f6f15d",
        "bgColor": "yellow",
        "description": "This Advanced-quality variant offers better performance than standard weapons",
        "flavour": "This is a very good weapon, but don't rely only on its power. Weapons don't play, users do!",
        "starRating": "★★",
        "priceMultiplier": 1.2
    },
    "Niche": {
        "color": "#75339c",
        "bgColor": "violet",
        "description": "This Niche-quality variant is best used in very specific circumstances and situations",
        "flavour": "Maybe you don't know when you'll need the help of a 'Blicky Rifle Grenade Launcher' right now, but you will when the time comes...",
        "starRating": "★",
        "priceMultiplier": 1.2
    },
    "Baseline": {
        "color": "#2694da",
        "bgColor": "blue",
        "description": "This Baseline-quality variant performs on par with the original weapon",
        "flavour": "Shiny weapon, but not that original. The stats are changed, but not by much. It's mid, I would say",
        "starRating": "✧✧✧",
        "priceMultiplier": 1
    },
    "Flawed": {
        "color": "#157230",
        "bgColor": "green",
        "description": "This Flawed-quality variant delivers worse performance than the original weapon",
        "flavour": "Despite being flawed, this weapon is still desired and used mostly by scavs, but only because of the low price and frequent sales",
        "starRating": "✧✧",
        "priceMultiplier": 0.7
    },
    "Meme": {
        "color": "#808080",
        "bgColor": "tracerGreen",
        "description": "This Meme-quality variant may be unusable in most situations",
        "flavour": "A clown weapon for clown users, but remember to have fun before you die trying to kill someone with this god-forgotten thing",
        "starRating": "✧",
        "priceMultiplier": 0.7
    }
};

//#region MCompatibility

export interface APBSSettings
{
    1: string[];
    2: string[];
    3: string[];
    4: string[];
    5: string[];
    6: string[];
    7: string[];
}

export interface gamblerPreset
{
    Id: string;
    Name: string;
    Root: string;
    Items: Item[];
}

export interface gamblerPresets
{
    Meta: gamblerPreset[];
    Decent: gamblerPreset[];
    Base: gamblerPreset[];
    Scav: gamblerPreset[];
    Meme: gamblerPreset[];
}

export enum gamblerRarity
{
    Ultimate = "Meta",
    Superior = "Meta",
    Advanced = "Decent",
    Niche = "Decent",
    Baseline = "Base",
    Flawed = "Scav",
    Meme = "Meme"
}

export const bossesToChange: string[] = [
    "bossboar",
    "bossbully",
    "bossgluhar",
    "bosskilla",
    "bossknight",
    "bosskojaniy",
    "bosskolontay",
    "bosssanitar",
    "bosstagilla",
    "bosspartisan",
    "bosszryachiy",
    "followerbigpipe",
    "followerbirdeye"
];



// Traders and Task related items

//#region Enums
export enum traderIDs 
    {
    MECHANIC = "5a7c2eca46aef81a7ca2145d",
    SKIER = "58330581ace78e27b8b10cee",
    PEACEKEEPER = "5935c25fb3acc3127c3d8cd9",
    THERAPIST = "54cb57776803fa99248b456e",
    PRAPOR = "54cb50c76803fa8b248b4571",
    JAEGAR = "5c0647fdd443bc2504c2d371",
    RAGMAN = "5ac3b934156ae10c4430e83c",
    FENCE = "579dc571d53a0658a154fbec"
}

export enum currencyIDs 
    {
    ROUBLES = "5449016a4bdc2d6f028b456f",
    EUROS = "569668774bdc2da2298b4568",
    DOLLARS = "5696686a4bdc2da3298b456a"
}
    
export enum allBotTypes 
    {
    ARENAFIGHTER  = "arenafighter",
    ARENAFIGHTEREVENT = "arenafighterevent",
    ASSAULT = "assault",
    BEAR = "bear",
    RESHALA = "bossbully",
    GLUHAR = "bossgluhar",
    KILLA = "bosskilla",
    KNIGHT = "bossknight",
    SHTURMAN = "bosskojaniy",
    SANITAR = "bosssanitar",
    TAGILLA = "bosstagilla",
    ZRYACHIY = "bosszryachiy",
    CRAZYASSAULTEVENT = "crazyassaultevent",
    CURSEDASSAULT = "cursedassault",
    EXUSEC = "exusec",
    FOLLOWERBIGPIPE = "followerbigpipe",
    FOLLOWERBIRDEYE = "followerbirdeye",
    FOLLOWERRESHALA = "followerbully",
    FOLLOWERGLUHARASSAULT = "followergluharassault",
    FOLLOWERGLUHARSCOUT = "followergluharscout",
    FOLLOWERGLUHARSECURITY = "followergluharsecurity",
    FOLLOWERGLUHARSNIPER = "followergluharsnipe",
    FOLLOWERSHTURMAN = "followerkojaniy",
    FOLLOWERSANITAR = "followersanitar",
    FOLLOWERTAGILLA = "followertagilla",
    FOLLOWERZRYACHIY = "followerzryachiy",
    GIFTER = "gifter",
    MARKSMAN = "marksman",
    PMC = "pmcbot",
    CULTISTPRIEST = "sectantpriest",
    CULTISTWARRIOR = "sectantwarrior",
    USEC = "usec"
}

export enum inventorySlots 
    {
    FirstPrimaryWeapon = "55d729c64bdc2d89028b4570",
    SecondPrimaryWeapon = "55d729d14bdc2d86028b456e",
    Holster = "55d729d84bdc2de3098b456b",
    Scabbard = "55d729e34bdc2d1b198b456d",
    FaceCover = "55d729e84bdc2d8a028b4569",
    Headwear = "55d729ef4bdc2d3a168b456c",
    TacticalVest = "55d729f74bdc2d87028b456e",
    SecuredContainer = "55d72a054bdc2d88028b456e",
    Backpack = "55d72a104bdc2d89028b4571",
    ArmorVest = "55d72a194bdc2d86028b456f",
    Pockets = "55d72a274bdc2de3098b456c",
    Earpiece = "5665b7164bdc2d144c8b4570",
    Dogtag = "59f0be1e86f77453be490939",
    Eyewear = "5a0ad9313f1241000e072755",
    ArmBand = "5b3f583786f77411d552fb2b"
}

export enum Stashes 
    {
    LEVEL1 = "566abbc34bdc2d92178b4576",
    LEVEL2 = "5811ce572459770cba1a34ea",
    LEVEL3 = "5811ce662459770f6f490f32",
    LEVEL4 = "5811ce772459770e9e5f9532"
}

//Interfaces

export interface QuestZone 
{
    zoneId: string;
    zoneName: string;
    zoneType: string;
    flareType?: string;
    zoneLocation: string;
    position: {
        x: string;
        y: string;
        z: string;
    };
    rotation: {
        x: string;
        y: string;
        z: string;
    };
    scale: {
        x: string;
        y: string;
        z: string;
    };
}


//#endregion