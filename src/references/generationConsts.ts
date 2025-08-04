export interface VariantConfigurationKeyed
{
    [variantName: string]: VariantConfiguration
}

export interface VariantConfiguration
{
    Description: string,
    Explanation: string,
    ShortName: string,
    props: any,
    additionalChanges: any,
    quests: {
        id: string,
        description: string
    },
    Weapons: string[],
    ID: string,
    rarity: string
}

export interface ItemConfigurationKeyed
{
    [ItemName: string]: ItemConfiguration
}

export interface ItemConfiguration
{
    Description: string,
    ShortName: string,
    itemTplToClone: string,
    props: any,
    additionalChanges: any,
    barterScheme?: {
        traderId: string,
        loyalLevel: number,
        unlimitedCount: boolean,
        stackObjectsCount: number,
        price: number,
        barter: string
    }
    handbookPriceRoubles: number,
    variant: string,
    rarity: string
}