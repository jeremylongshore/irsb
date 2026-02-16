# GitHub Discussions Setup Guide

This document explains how to enable and configure GitHub Discussions for the repository.

## Enabling Discussions

GitHub Discussions must be enabled in repository settings (not via code).

### Steps

1. Go to **Repository Settings**
   - `https://github.com/intent-solutions-io/irsb-protocol/settings`

2. Scroll to **Features** section

3. Check **Discussions**

4. Click **Set up discussions** button

Reference: [GitHub Docs - Enabling Discussions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/enabling-or-disabling-github-discussions-for-a-repository)

## Recommended Categories

After enabling, configure these categories:

| Category | Format | Description |
|----------|--------|-------------|
| Announcements | Announcement | Project updates (maintainers only) |
| Q&A | Question/Answer | Technical questions |
| Ideas | Open | Feature suggestions and brainstorming |
| Show and Tell | Open | Share integrations and projects |
| General | Open | Everything else |

### Category Setup

1. Go to **Discussions** tab
2. Click gear icon → **Edit categories**
3. Create categories as listed above
4. Set "Announcements" to maintainers-only posting

## Pinned Discussion: Start Here

Create a pinned welcome discussion:

**Title:** Welcome to IRSB Protocol Discussions

**Content:**
```markdown
## Welcome

This is the place for questions, ideas, and community discussion.

### Where to Post

| Topic | Where |
|-------|-------|
| Questions about usage | Q&A category |
| Feature ideas | Ideas category |
| Bug reports | [GitHub Issues](../issues/new?template=bug_report.yml) |
| Security issues | [SECURITY.md](../blob/master/SECURITY.md) |

### Resources

- [Documentation](../tree/master/000-docs)
- [Contributing Guide](../blob/master/CONTRIBUTING.md)
- [SDK README](../tree/master/sdk)

### Community Guidelines

Please follow our [Code of Conduct](../blob/master/CODE_OF_CONDUCT.md).
```

## Migration from Issues

If existing issues should move to Discussions:

1. Open the issue
2. Click "..." menu → **Convert to discussion**
3. Select appropriate category

Only convert Q&A-style issues, not bugs or feature requests.

## Moderation

- Maintainers can lock, delete, or convert discussions
- Mark helpful answers in Q&A threads
- Pin important announcements
