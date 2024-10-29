import { graphql } from "@octokit/graphql";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Attachment, Collection, Message } from "discord.js";
import { config } from "../config";
import { GitIssue, Thread } from "../interfaces";
import {
  ActionValue,
  Actions,
  Triggerer,
  getGithubUrl,
  logger,
} from "../logger";
import { store } from "../store";

// Verify the repository format
const [owner, repo] = config.GITHUB_REPOSITORY.split('/');
if (!owner || !repo) {
  throw new Error('GITHUB_REPOSITORY must be in the format "owner/repo"');
}

export const repoCredentials = {
  owner,
  repo,
};

export const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: config.GITHUB_APP_ID,
    privateKey: config.GITHUB_APP_PRIVATE_KEY,
    installationId: config.GITHUB_INSTALLATION_ID,
    clientId: config.GITHUB_CLIENT_ID,
    clientSecret: config.GITHUB_CLIENT_SECRET,
  },
  baseUrl: "https://api.github.com",
});

const info = (action: ActionValue, thread: Thread) =>
  logger.info(`${Triggerer.Discord} | ${action} | ${getGithubUrl(thread)}`);
const error = (action: ActionValue | string, thread?: Thread) =>
  logger.error(
    `${Triggerer.Discord} | ${action} ` +
    (thread ? `| ${getGithubUrl(thread)}` : ""),
  );

function attachmentsToMarkdown(attachments: Collection<string, Attachment>) {
  let md = "";
  attachments.forEach(({ url, name, contentType }) => {
    switch (contentType) {
      case "image/png":
      case "image/jpeg":
        md += `![${name}](${url} "${name}")`;
        break;
    }
  });
  return md;
}

function getIssueBody(params: Message) {
  const { guildId, channelId, id, content, author, attachments } = params;
  const { globalName, avatar } = author;

  return (
    `<kbd>[![${globalName}](https://cdn.discordapp.com/avatars/${author.id}/${avatar}.webp?size=40)](https://discord.com/channels/${guildId}/${channelId}/${id})</kbd> [${globalName}](https://discord.com/channels/${guildId}/${channelId}/${id})  \`BOT\`\n\n` +
    `${content}\n` +
    `${attachmentsToMarkdown(attachments)}\n`
  );
}

const regexForDiscordCredentials =
  /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)(?=\))/;
export function getDiscordInfoFromGithubBody(body: string) {
  const match = body.match(regexForDiscordCredentials);
  if (!match || match.length !== 4)
    return { channelId: undefined, id: undefined };
  const [, , channelId, id] = match;
  return { channelId, id };
}

function formatIssuesToThreads(issues: GitIssue[]): Thread[] {
  const res: Thread[] = [];
  issues.forEach(({ title, body, number, node_id, locked, state }) => {
    const { id } = getDiscordInfoFromGithubBody(body);
    if (!id) return;
    res.push({
      id,
      title,
      number,
      body,
      node_id,
      locked,
      comments: [],
      appliedTags: [],
      archived: state === "closed",
    });
  });
  return res;
}

async function update(issue_number: number, state: "open" | "closed") {
  try {
    await octokit.rest.issues.update({
      ...repoCredentials,
      issue_number,
      state,
    });
    return true;
  } catch (err) {
    return err;
  }
}

export async function closeIssue(thread: Thread) {
  const { number: issue_number } = thread;

  if (!issue_number) {
    error("Thread does not have an issue number", thread);
    return;
  }

  const response = await update(issue_number, "closed");
  if (response === true) info(Actions.Closed, thread);
  else if (response instanceof Error)
    error(`Failed to close issue: ${response.message}`, thread);
  else error("Failed to close issue due to an unknown error", thread);
}

export async function openIssue(thread: Thread) {
  const { number: issue_number } = thread;

  if (!issue_number) {
    error("Thread does not have an issue number", thread);
    return;
  }

  const response = await update(issue_number, "open");
  if (response === true) info(Actions.Reopened, thread);
  else if (response instanceof Error)
    error(`Failed to open issue: ${response.message}`, thread);
  else error("Failed to open issue due to an unknown error", thread);
}

export async function lockIssue(thread: Thread) {
  const { number: issue_number } = thread;
  if (!issue_number) {
    error("Thread does not have an issue number", thread);
    return;
  }

  try {
    await octokit.rest.issues.lock({
      ...repoCredentials,
      issue_number,
    });

    info(Actions.Locked, thread);
  } catch (err) {
    if (err instanceof Error) {
      error(`Failed to lock issue: ${err.message}`, thread);
    } else {
      error("Failed to lock issue due to an unknown error", thread);
    }
  }
}

export async function unlockIssue(thread: Thread) {
  const { number: issue_number } = thread;
  if (!issue_number) {
    error("Thread does not have an issue number", thread);
    return;
  }

  try {
    await octokit.rest.issues.unlock({
      ...repoCredentials,
      issue_number,
    });

    info(Actions.Unlocked, thread);
  } catch (err) {
    if (err instanceof Error) {
      error(`Failed to unlock issue: ${err.message}`, thread);
    } else {
      error("Failed to unlock issue due to an unknown error", thread);
    }
  }
}

export async function createIssue(thread: Thread, params: Message) {
  const { title, appliedTags, number } = thread;

  if (number) {
    error("Thread already has an issue number", thread);
    return;
  }

  try {
    const labels = appliedTags?.map(
      (id) => store.availableTags.find((item) => item.id === id)?.name || "",
    );
    const additionalLabels = (process.env.ADDITIONAL_LABELS || "")
      .split(",")
      .filter(label => label.trim());
    labels.push(...additionalLabels);
    const body = getIssueBody(params);
    const response = await octokit.rest.issues.create({
      ...repoCredentials,
      labels,
      title,
      body,
    });

    if (response && response.data) {
      thread.node_id = response.data.node_id;
      thread.body = response.data.body!;
      thread.number = response.data.number;
      info(Actions.Created, thread);
    } else {
      error("Failed to create issue - No response data", thread);
    }
  } catch (err) {
    if (err instanceof Error) {
      error(`Failed to create issue: ${err.message}`, thread);
    } else {
      error("Failed to create issue due to an unknown error", thread);
    }
  }
}

export async function createIssueComment(thread: Thread, params: Message) {
  const body = getIssueBody(params);
  const { number: issue_number } = thread;

  if (!issue_number) {
    error("Thread does not have an issue number", thread);
    return;
  }

  try {
    const response = await octokit.rest.issues.createComment({
      ...repoCredentials,
      issue_number: thread.number!,
      body,
    });
    if (response && response.data) {
      const git_id = response.data.id;
      const id = params.id;
      thread.comments.push({ id, git_id });
      info(Actions.Commented, thread);
    } else {
      error("Failed to create comment - No response data", thread);
    }
  } catch (err) {
    if (err instanceof Error) {
      error(`Failed to create comment: ${err.message}`, thread);
    } else {
      error("Failed to create comment due to an unknown error", thread);
    }
  }
}

// Add this function to get an installation access token
async function getInstallationAccessToken() {
  try {
    const { token } = await octokit.auth({
      type: "installation",
      installationId: config.GITHUB_INSTALLATION_ID,
    });
    return token;
  } catch (error) {
    console.error('Failed to get installation token:', error);
    return null;
  }
}

// Update GraphQL client to use the installation token
async function getGraphQLClient() {
  const token = await getInstallationAccessToken();
  if (!token) {
    throw new Error('Failed to get installation token');
  }

  return graphql.defaults({
    baseUrl: "https://api.github.com",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function deleteIssue(thread: Thread) {
  const { node_id } = thread;
  if (!node_id) {
    error("Thread does not have a node ID", thread);
    return;
  }

  try {
    // Check permissions first
    const { hasRequiredPermissions } = await checkAppPermissions();
    if (!hasRequiredPermissions) {
      error("GitHub App lacks required permissions to delete issues", thread);
      return;
    }

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const graphqlClient = await getGraphQLClient();
        await graphqlClient(
          `mutation {deleteIssue(input: {issueId: "${node_id}"}) {clientMutationId}}`,
        );
        info(Actions.Deleted, thread);
        return;
      } catch (err: any) {
        if (err.message?.includes('not authorized')) {
          error("GitHub App is not authorized to delete issues. Please check permissions.", thread);
          return;
        }
        if (err.message?.includes('rate limit') && retryCount < maxRetries - 1) {
          retryCount++;
          const waitTime = 1000 * Math.pow(2, retryCount);
          console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${retryCount}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      error(`Error deleting issue: ${err.message}`, thread);
    } else {
      error("Error deleting issue due to an unknown error", thread);
    }
  }
}

export async function deleteComment(thread: Thread, comment_id: number) {
  try {
    await octokit.rest.issues.deleteComment({
      ...repoCredentials,
      comment_id,
    });
    info(Actions.DeletedComment, thread);
  } catch (err) {
    if (err instanceof Error) {
      error(`Failed to delete comment: ${err.message}`, thread);
    } else {
      error("Failed to delete comment due to an unknown error", thread);
    }
  }
}

export async function getIssues() {
  try {
    const response = await octokit.rest.issues.listForRepo({
      ...repoCredentials,
      state: "all",
    });

    if (!response || !response.data) {
      error("Failed to get issues - No response data");
      return [];
    }

    await fillCommentsData(); // Wait for comments data to be filled

    return formatIssuesToThreads(response.data as GitIssue[]);
  } catch (err) {
    if (err instanceof Error) {
      error(`Failed to get issues: ${err.message}`);
    } else {
      error("Failed to get issues due to an unknown error");
    }
    return [];
  }
}

async function fillCommentsData() {
  try {
    const response = await octokit.rest.issues.listCommentsForRepo({
      ...repoCredentials,
    });

    if (response && response.data) {
      response.data.forEach((comment) => {
        const { channelId, id } = getDiscordInfoFromGithubBody(comment.body!);
        if (!channelId || !id) return;

        const thread = store.threads.find((i) => i.id === channelId);
        thread?.comments.push({ id, git_id: comment.id });
      });
    } else {
      error("Failed to load comments - No response data");
    }
  } catch (err) {
    if (err instanceof Error) {
      error(`Failed to load comments: ${err.message}`);
    } else {
      error("Failed to load comments due to an unknown error");
    }
  }
}

async function checkAppPermissions() {
  try {
    const { data: installation } = await octokit.rest.apps.getInstallation({
      installation_id: Number(config.GITHUB_INSTALLATION_ID)
    });

    console.log('Current GitHub App permissions:', installation.permissions);

    const hasIssuesWrite = installation.permissions?.issues === 'write';
    const hasAdminAccess = installation.permissions?.administration === 'write';

    console.log('Permissions check:', {
      hasIssuesWrite,
      hasAdminAccess,
      repository: installation.repository_selection,
      targetType: installation.target_type,
    });

    return {
      hasRequiredPermissions: hasIssuesWrite,
      currentPermissions: installation.permissions
    };
  } catch (error) {
    console.error('Failed to check permissions:', error);
    return {
      hasRequiredPermissions: false,
      currentPermissions: null
    };
  }
}

async function verifyGitHubAppAuth() {
  try {
    const response = await octokit.rest.apps.getAuthenticated();
    console.log('Successfully authenticated as GitHub App:', response.data.name);
    return true;
  } catch (error) {
    console.error('GitHub App authentication failed:', error);
    return false;
  }
}

async function checkRateLimit() {
  try {
    const { data } = await octokit.rest.rateLimit.get();
    console.log('Rate limit status:', {
      remaining: data.rate.remaining,
      limit: data.rate.limit,
      reset: new Date(data.rate.reset * 1000).toLocaleString(),
    });
    return data.rate.remaining > 0;
  } catch (error) {
    console.error('Failed to check rate limit:', error);
    return false;
  }
}

// Startup checks
(async () => {
  const isAuthenticated = await verifyGitHubAppAuth();
  if (!isAuthenticated) {
    console.error('Failed to authenticate with GitHub App. Please check your credentials.');
    return;
  }

  const { hasRequiredPermissions, currentPermissions } = await checkAppPermissions();
  if (!hasRequiredPermissions) {
    console.error('GitHub App lacks required permissions!', currentPermissions);
    console.error('Please update the GitHub App permissions to include:');
    console.error('- Issues: Read & Write');
    console.error('Then reinstall the app at: https://github.com/settings/installations');
  }

  // Check initial rate limit status
  await checkRateLimit();
})();

