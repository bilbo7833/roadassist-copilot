# RoadAssist Prototype Datasets

This folder contains small datasets for the RoadAssist Co-Pilot prototype.

## `car-damage-images/`

- `damage_001.jpg` through `damage_050.jpg`: 50 car-damage images downloaded from Wikimedia Commons.
- `manifest.json`: source page, image URL, license, attribution, and basic metadata for each image.

Images were sourced from the Wikimedia Commons `Category:Damaged automobiles` API and downloaded as resized copies suitable for prototype testing. Check `manifest.json` before reusing outside the interview prototype because individual files have different Creative Commons licenses and attribution requirements.

## `synthetic-policies/`

- `policies.json`: 10 synthetic auto insurance policies for roadside assistance and accident-related coverage testing.

The policies are fictional and intentionally varied across towing limits, tire coverage, rental/taxi reimbursement, EV-specific exclusions, commercial-use limitations, and liability-only edge cases.
