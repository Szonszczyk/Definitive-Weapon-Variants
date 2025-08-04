# Weapon Variant JSON Format Documentation

> ⚠️ The example below is **not** a real variant — it's a conglomerate of multiple Variants to show all available options.

---

## JSON Format

```jsonc
{
  // Full name of the variant. It will be used in the weapon's full name.
  "Automatic": {
    // Flavour text
    "Description": "The fire selector is stuck on a non-existent setting",

    // Technical description of the variant's effect
    "Explanation": "Weapon variant with only a full-auto fire mode, featuring an increased fire rate but reduced ergonomics",

    // Short version used in the weapon miniature name
    "ShortName": "Auto",

    // Core property changes applied to all weapons using this variant
    "props": {
      "weapFireType": ["fullauto"],
      "bFirerate": "+10%",
      "Ergonomics": "-15%",
      "Velocity": "-50",
      "BurstShotsCount": 100
    },

    // Additional property changes that depend on original weapon values or specific rules
    "additionalChanges": {
      // Enforces minimum values before applying props
      "minimum": {
        "bFirerate": 450
      },

      // Used to replace ammo used to this of other weapon
      "Chambers": {
        "fromWeapons": ["M4A1"]
      },

      // Custom magazines based on weapon class
      "Slots": {
        "mod_magazine": {
          "basedOn": "weapClass",
          "variants": {
            "assaultRifle": [
              "M60 500-round \"Endless\" ammo box"
            ],
            "smg": [
              "M60 800-round \"Endless\" ammo box"
            ],
            "marksmanRifle": [
              "M60 500-round \"Endless\" ammo box"
            ],
            "assaultCarbine": [
              "M60 500-round \"Endless\" ammo box"
            ],
            "shotgun": [
              "M60 100-round \"Endless\" ammo box"
            ]
          }
        }
      },

      // Weapon-specific changes (must be listed in "Weapons")
      "Blicky": {
        // Is using the same variables as "additionalChanges" except minimum
        "weapFireType": ["single", "fullauto"],
        "Slots": {
          "mod_magazine": [
            "Blicky Special Magical Unbelievable Magazine"
          ],
          "add": ["5bae13ded4351e44f824bf38"]
        }
      }
    },

    // Optional: Variant weapon counts toward another weapon’s quest progress
    "quests": {
      "id": "5448bd6b4bdc2dfc2f8b4569"
    },

    // Weapon shortnames this variant applies to
    "Weapons": [
      "TX-15 DML", "G28", "M1A", "Mk-18 Mjölnir", "RSASS",
      "SR-25", "SVDS", "OP-SKS", "RFB", "AK-545",
      "AK-545 Short", "VPO-101 Vepr-Hunter"
    ],

    // Optional: no longer used
    "ID": "0201",

    // Rarity tier: must use an existing one (e.g. Meme, Flawed, Superior)
    "rarity": "Superior"
  }
}
```

---

## Notes

### ✅ General Rules

- **Always match types**: Don’t change a number to a string or an array to a string etc.
- You can create new variants by duplicating this structure and editing the values.

### 🔄 Modification Types

| Syntax    | Meaning                      |
|-----------|------------------------------|
| `+10%`    | Increase original by 10%     |
| `-15%`    | Decrease original by 15%     |
| `+50`     | Add 50 to original           |
| `-30`     | Subtract 30 from original    |
| `123`     | Set value exactly to 123     |

### 🎯 Special Keys

| Key                | Description                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| `props`            | Core changes applied to all listed weapons                                  |
| `additionalChanges`| Context-based or weapon-specific overrides (optional)                       |
| `minimum`          | Ensures minimum original values before applying props (optional)            |
| `Slots`            | Adds or replaces magazines or parts; uses item names or mongoIDs (optional) |
| `Chambers`         | Replaces chambered ammo  (optional)                                         |
| `quests`           | Tracks quest progress as a different weapon (optional)                      |

---

For more examples and contributions, see the other variant files in `/db/Variants`.
