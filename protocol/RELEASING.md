# Releasing IRSB Packages

## SDK (`irsb`)

### Automated Release (Recommended)

1. Update version in `sdk/package.json`
2. Update `CHANGELOG.md` with release notes
3. Commit changes:
   ```bash
   git add sdk/package.json CHANGELOG.md
   git commit -m "chore(release): prepare sdk v0.x.x"
   ```
4. Create and push tag:
   ```bash
   git tag sdk-v0.x.x
   git push origin sdk-v0.x.x
   ```

The `release-sdk.yml` workflow will:
- Validate package name is `irsb`
- Build the SDK
- Publish to npm with provenance
- Create GitHub release with notes

### Manual Release (Emergency Only)

```bash
cd sdk
npm run build
npm publish --access public --provenance
```

Requires `NPM_TOKEN` environment variable.

## x402 Integration (`irsb-x402`)

### Automated Release

1. Update version in `packages/x402-irsb/package.json`
2. Update `CHANGELOG.md`
3. Create and push tag:
   ```bash
   git tag x402-v0.x.x
   git push origin x402-v0.x.x
   ```

## Provenance

All packages are published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), linking each published version to its source commit and build.

Verify provenance on npmjs.com package page or via:
```bash
npm audit signatures
```

## Version Policy

- **Patch** (0.0.x): Bug fixes, docs
- **Minor** (0.x.0): New features, non-breaking
- **Major** (x.0.0): Breaking changes

## Checklist

- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Tag matches version (e.g., `sdk-v0.1.0` for version `0.1.0`)
