# GitHub Custom Properties

This document explains GitHub's custom properties feature and proposes a schema for the organization.

## What Are Custom Properties?

Custom properties are **organization-level metadata** attached to repositories. They are:

- Set in GitHub organization settings, NOT in repository files
- Used for filtering, rulesets, and org-wide policies
- Only available to organization admins

Reference: [GitHub Docs - Managing custom properties](https://docs.github.com/en/organizations/managing-organization-settings/managing-custom-properties-for-repositories-in-your-organization)

## Nothing to Commit

Custom properties are configured in the GitHub UI, not in code.

This document only provides recommendations for the org admin.

## Proposed Schema

### Property: `risk_level`

**Type:** Single select
**Values:** `low`, `medium`, `high`
**Default:** `medium`

Use for:
- Targeting security rulesets (high-risk repos require more reviews)
- Prioritizing security scans

**For this repo:** `high` (financial protocol)

### Property: `data_sensitivity`

**Type:** Single select
**Values:** `public`, `internal`, `restricted`
**Default:** `public`

Use for:
- Compliance tracking
- Access control policies

**For this repo:** `public` (open source)

### Property: `release_tier`

**Type:** Single select
**Values:** `experimental`, `beta`, `ga` (general availability)
**Default:** `experimental`

Use for:
- Indicating production readiness
- Filtering in dashboards

**For this repo:** `beta` (Sepolia deployment, not mainnet)

### Property: `owner_team`

**Type:** Single select
**Values:** `protocol`, `sdk`, `infra`, `community`
**Default:** None

Use for:
- Routing notifications
- CODEOWNERS automation

**For this repo:** `protocol`

## How to Configure (Org Admin)

1. Go to **Organization Settings**
   - `https://github.com/organizations/intent-solutions-io/settings`

2. Navigate to **Repository** → **Custom properties**

3. Click **New property** for each property above

4. Set the property values for `irsb-protocol`:
   - risk_level: `high`
   - data_sensitivity: `public`
   - release_tier: `beta`
   - owner_team: `protocol`

## Using Properties in Rulesets

Example: Require 2 reviewers for high-risk repos

1. Go to **Organization Settings** → **Rules** → **Rulesets**
2. Create new ruleset
3. Under **Target repositories**, select by property: `risk_level = high`
4. Add rule: Require 2 pull request reviews

## Integration with This Repo

No code changes needed. Once the org admin configures properties:

1. Properties appear on the repo's main page
2. Rulesets automatically apply based on property values
3. Organization dashboards can filter by properties
