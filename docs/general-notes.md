# General Notes

## RG520N-NA Supported Bands

Source:
- `Quectel_RG520N_Series_5G_Module_Specification_V1.7.pdf`

This is the module-level band list for the `RG520N-NA` variant used in the Casa Systems `CFW-3212` project.

Important:
- this is Quectel module capability information
- Casa firmware, carrier policy, certification scope, RF path population, and board implementation can narrow what is actually exposed or usable on a given unit

### 5G NR NSA

`n2, n5, n7, n12, n13, n14, n25, n26, n29, n30, n38, n41, n48, n66, n70, n71, n77, n78`

### 5G NR SA

`n2, n5, n7, n12, n13, n14, n25, n26, n29, n30, n38, n41, n48, n66, n70, n71, n77, n78`

### LTE-FDD

`B2, B4, B5, B7, B12, B13, B14, B17, B25, B26, B29, B30, B66, B71`

### LTE-TDD

`B38, B41, B42, B43, B48`

### WCDMA

`B1, B5, B8`

### MIMO Notes From The Spec

- 5G NR DL 4x4 MIMO list matches the NR band list above
- the spec notes that `n13` and `n26` currently support only DL `2x2 MIMO`
- LTE DL 4x4 MIMO is listed for `B2, B4, B5, B7, B12, B13, B14, B17, B25, B26, B29, B30, B38, B41, B42, B43, B48, B66, B71`
