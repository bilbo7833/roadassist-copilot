# Policy Gap Research

Research date: 2026-05-08

## Coverage patterns to add to synthetic policies

### 1. Full glass / zero-deductible glass endorsement

Use for broken windshield, broken side window, rock chip, shattered safety glass.

Public references:

- Amica describes comprehensive glass coverage and optional full glass coverage; full glass can remove the deductible for repair or replacement.
  - https://www.amica.com/en/products/auto-insurance/coverages/glass-coverage.html
- South Carolina Department of Insurance explains that comprehensive coverage covers broken glass and windshield damage, and South Carolina waives the deductible for safety glass repairs/replacements when comprehensive coverage exists.
  - https://doi.sc.gov/588/Automobile-Insurance
- Massachusetts Division of Insurance explains that windshield/glass repair or replacement requires comprehensive coverage before the glass loss.
  - https://www.mass.gov/info-details/understanding-whether-auto-coverage-pays-for-damage-to-your-windshield

Synthetic policy additions:

- `fullGlassCoverage: true`
- `glassDeductibleUsd: 0`
- Clause: "Glass repair and replacement are covered without deductible for windshield, side-window, and rear-window damage caused by road debris, vandalism, weather, or falling objects."

### 2. Comprehensive physical damage

Use for vandalism, keyed paint, broken windows from vandalism, hail, falling objects, fire, theft, animal impact, non-collision windshield damage.

Public references:

- Progressive defines comprehensive as optional coverage for non-collision events including theft, vandalism, glass and windshield damage, fire, animals, weather, and nature.
  - https://www.progressive.com/answers/comprehensive-insurance/
- AAA lists broken windshields, vandalism, fire, theft, falling objects, animal impact, hail, and natural disaster damage as comprehensive scenarios.
  - https://www.ace.aaa.com/content/ace-www/en/insurance/auto-insurance/comprehensive-insurance-coverage.html
- State Farm describes comprehensive as repair/replacement for losses not caused by collision, including glass claims, vandalism, smashed windows, dented doors, fire, weather, and animal impact.
  - https://www.statefarm.com/insurance/auto/coverage-options/comprehensive-coverage

Synthetic policy additions:

- `comprehensiveDeductibleUsd`
- `coveredComprehensiveCauses: ["vandalism", "glass", "fire", "hail", "falling_object", "animal", "theft"]`
- Clause: "Comprehensive coverage applies to non-collision damage such as vandalism, broken glass, fire, hail, falling objects, theft, and animal impact, subject to deductible unless a glass waiver applies."

### 3. Collision physical damage

Use for serious accident damage, bumper damage from hitting another vehicle/object, rollover, guardrail impact, curb/pothole damage, total-loss evaluation.

Public references:

- Progressive collision coverage helps repair or replace the vehicle after an accident regardless of fault, including hitting an object such as a tree or utility pole.
  - https://www.progressive.com/auto/insurance-coverages/collision/
- State Farm describes collision coverage as damage caused when the car hits something or overturns, including another vehicle, trees, fences, telephone poles, and rollovers.
  - https://www.statefarm.com/simple-insights/auto-and-vehicles/collision-vs-comprehensive-insurance
- South Carolina Department of Insurance explains collision coverage pays for physical damage from colliding with an object, and serious damage can become a total loss based on actual cash value thresholds.
  - https://doi.sc.gov/588/Automobile-Insurance
- Washington Office of the Insurance Commissioner explains total-loss handling and actual cash value when a vehicle is not repairable or repairs exceed value.
  - https://www.insurance.wa.gov/insurance-resources/auto-insurance/auto-insurance-claims/what-happens-after-your-car-gets-totaled

Synthetic policy additions:

- `collisionDeductibleUsd`
- `totalLossThresholdPct`
- `coveredCollisionCauses: ["vehicle_collision", "object_collision", "rollover", "curb_or_pothole"]`
- Clause: "Collision coverage pays to repair or replace the insured vehicle after impact with another vehicle or object, rollover, or road-surface impact, subject to deductible and total-loss rules."

### 4. Cosmetic scratch / dent handling

Use for scratches, keyed paint, parking-lot dings, small dents, door dings, and wear-and-tear distinction.

Public references:

- Progressive explains scratches and dents may be covered by comprehensive or collision if tied to a covered incident, but wear and tear is not standard auto insurance coverage.
  - https://www.progressive.com/answers/does-car-insurance-cover-scratches/
- GEICO explains liability-only does not cover damage to the insured car, and normal wear/tear or pre-existing cosmetic issues are not covered.
  - https://www.geico.com/information/aboutinsurance/auto/does-car-insurance-cover-scratches-and-dents/
- Ford DentCARE covers minor dents and dings using paintless dent repair, no deductible, with limits such as dents no larger than four inches in accessible areas.
  - https://fordprotect.ford.com/dentcare
- Mercedes-Benz First Class Paintless Dent Repair covers repair of certain minor dents and dings without affecting original factory finish.
  - https://www.mbusa.com/en/financial-services/protection-plans/first-class-paintless-dent-repair

Synthetic policy additions:

- `cosmeticScratchCovered`
- `paintlessDentRepairCovered`
- `pdrMaxDentDiameterInches`
- Clause: "Minor dents and door dings are covered only under the paintless dent repair endorsement when no repainting or body filler is required; ordinary wear, fading, and pre-existing damage are excluded."
- Clause: "Scratches are covered when caused by a covered collision or comprehensive event, such as vandalism or impact, but not when caused by normal wear and tear."

### 5. Liability-only negative test

Use for claims where own-vehicle scratches, broken windshield, dents, or serious damage should not be covered by the customer's own policy.

Public references:

- GEICO explains liability-only pays for damage caused to other vehicles, not damage to the insured vehicle.
  - https://www.geico.com/information/aboutinsurance/auto/does-car-insurance-cover-scratches-and-dents/
- New York DFS explains that if the customer lacks collision coverage, they may need to claim against another at-fault driver for accident damage.
  - https://www.dfs.ny.gov/consumers/auto_insurance/Auto_resource_center

Synthetic policy additions:

- `ownVehiclePhysicalDamageCovered: false`
- Clause: "This policy includes liability and roadside assistance only; it does not cover first-party physical damage to the insured vehicle."

## Recommended synthetic test scenarios

1. Windshield chip from road debris: full glass policy covers repair with no deductible.
2. Shattered side window from vandalism: comprehensive covers, glass waiver may remove deductible.
3. Keyed door scratch: comprehensive covers if vandalism; not covered if normal wear.
4. Parking-lot door ding: covered only if PDR/dent endorsement exists; otherwise likely out of pocket unless tied to collision/comprehensive event.
5. Minor front bumper scrape from mailbox: collision covers if deductible is met.
6. Hail dents across hood/roof: comprehensive covers; PDR endorsement may cover small dents or deductible gap.
7. Serious front-end collision, vehicle drivable: collision covers repair minus deductible.
8. Serious crash, vehicle not safely repairable: collision/comprehensive total-loss handling applies, subject to actual cash value.
9. Liability-only customer with broken windshield: not covered under own policy unless another party is liable.
10. Pre-existing scratch discovered during claim: excluded as prior damage/wear and tear.
