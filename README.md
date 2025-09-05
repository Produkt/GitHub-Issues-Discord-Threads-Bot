# Managing GitHub Issues via Discord Threads

This Discord bot serves as a seamless bridge between Discord thread channel and GitHub repository issues, enabling efficient issue management and synchronization between the two platforms. This integration allows for efficient project management, ensuring that actions performed on either Discord or GitHub are reflected in both platforms, facilitating smoother collaboration and issue tracking across teams.

## Functionality Overview

#### Issues

-   \[x] Discord Post Creation -> Automatically generates a corresponding GitHub issue.
-   \[ ] GitHub Issue Creation -> Pending feature: Creation of Discord posts from GitHub issues.

#### Comments

-   \[x] Discord Post Comments -> Mirrored as comments on associated GitHub issues.
-   \[ ] GitHub Issue Comments -> Pending feature: Synchronization with Discord post comments.

#### Tags & Labels

-   \[x] Discord Post Tags -> Translated into GitHub issue labels for better categorization.
-   \[ ] Discord Post Tag Changes -> Future implementation: Update GitHub issue labels from Discord.
-   \[ ] GitHub Issue Label Changes -> Future implementation: Reflect changes in Discord post tags from GitHub.

#### Locking & Unlocking

-   \[x] Discord Post Lock/Unlock -> Corresponding action on GitHub issues for security or access control.
-   \[x] GitHub Issue Lock/Unlock -> Syncing locking status with Discord posts.

#### Open/Close Management

-   \[x] Discord Post Open/Close -> Triggers opening or closing of related GitHub issues.
-   \[x] GitHub Issue Open/Close -> Update Discord post status based on GitHub issue status.

#### Deletion Actions

-   \[x] Discord Post Deletion -> Initiates the removal of the associated GitHub issue.
-   \[x] GitHub Issue Deletion -> Sync deletion actions from GitHub to Discord posts.

#### Attachment Support

-   \[x] Supported File Types: png, jpeg
-   \[ ] Planned Support: gif, text, video

## Installation Steps

#### Creating bot

Create bot https://discord.com/developers/applications?new_application=true

Bot settings:

-   \[x] PRESENCE INTENT
-   \[x] MESSAGE CONTENT INTENT

Invite url: https://discord.com/api/oauth2/authorize?client_id=APPLICATION_ID&permissions=0&scope=bot

#### Creating GitHub App

1. Go to [GitHub Apps settings](https://github.com/settings/apps) and click "New GitHub App"
2. Fill in the required information:
   - **GitHub App name**: Choose a unique name
   - **Homepage URL**: Your app's homepage (can be a placeholder)
   - **User authorization callback URL**: Your app's callback URL (can be a placeholder)
   - **Webhook URL**: Your webhook endpoint (optional, for future webhook support)
   - **Webhook secret**: Generate a random secret (optional)
3. Set the following permissions:
   - **Repository permissions**:
     - Issues: Read & Write
     - Metadata: Read
     - Contents: Read (if you need to access repository content)
4. Subscribe to events (optional, for future webhook support):
   - Issues
   - Issue comment
5. Choose installation options:
   - **Where can this GitHub App be installed?**: Any account
6. Click "Create GitHub App"
7. After creation, you'll need:
   - **App ID**: Found on the app's general settings page
   - **Client ID**: Found on the app's general settings page
   - **Client Secret**: Generate one in the app's general settings page
   - **Private Key**: Generate and download from the app's general settings page
8. Install the app on your repository:
   - Go to the app's "Install App" tab
   - Click "Install" on your target repository
   - Note the **Installation ID** from the URL after installation

#### env

-   DISCORD_TOKEN - Discord developer bot page "Settings->bot->reset token" (https://discord.com/developers/applications/APPLICATION_ID/bot)
-   DISCORD_CHANNEL_ID - In the Discord server, create a forum channel and right-click (RMB) to copy the channel ID (developer settings must be turned on for this). Alternatively, you can copy the ID from the link. Example:
https://discord.com/channels/<GUILD_ID>/<DISCORD_CHANNEL_ID>
-   GITHUB_REPOSITORY - Repository in the format "owner/repo" (e.g., "produkt/panels")
-   PORT - Server port (default: 3000)
-   ADDITIONAL_LABELS - Comma-separated list of additional labels to add to GitHub issues (e.g., "discord,bug")

#### GitHub App Configuration

-   GITHUB_APP_ID - Your GitHub App ID
-   GITHUB_APP_PRIVATE_KEY - Your GitHub App private key (PEM format)
-   GITHUB_INSTALLATION_ID - Installation ID for your GitHub App
-   GITHUB_CLIENT_ID - GitHub App client ID (for OAuth)
-   GITHUB_CLIENT_SECRET - GitHub App client secret (for OAuth)

> **_NOTE:_** For detailed information about GitHub Apps, visit the [GitHub Apps documentation](https://docs.github.com/en/apps).

#### Start bot

```bash
npm run dev
```

or

```bash
npm run build && npm run start
```

Forward for github webhooks:
```bash
ssh -R 80:localhost:5000 serveo.net
```