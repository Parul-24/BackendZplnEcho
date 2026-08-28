import {appOptions} from "./environments";

import axios from 'axios';

const BRANCH_API_URL = 'https://api2.branch.io/v1/url';
const BRANCH_TIMEOUT_MS = 5000;
const BRANCH_MAX_RETRIES = 2;
const BRANCH_KEY_HARDCODED = 'key_live_jFvVDb189BrWBeFyan01WgdexBiOQAIP';
const DEFAULT_BRANCH_INVITE_OG_TITLE = 'Strategy Games';
const DEFAULT_BRANCH_INVITE_OG_DESCRIPTION = 'Boost cognitive performance and compete for valuables on a platform with no method to receive payments from its community. Easy to Join. Easy to Play.';
const DEFAULT_BRANCH_INVITE_OG_IMAGE_URL = 'https://cdn.branch.io/user-uploads/link-og-images/42aaf43d-fdea-4425-8425-0e6591b18353.png';

const productionOptions = {
    desktopLink: 'https://apps.apple.com/app/id1660906375',
    androidBundleId: 'tv.zpln.game',
    iosBundleId: 'tv.zpln.game',
    iosFallbackLink: 'https://apps.apple.com/app/id1660906375',
  branchDomain: 'https://t5sgz.app.link'
};

const dynamicLinkParams = productionOptions;

function getOptionalEnvVar(envName: string): string | undefined {
  const value = String(process.env[envName] || '').trim();
  return value === '' ? undefined : value;
}

function getSafeUserName(userName: string): string {
  return String(userName || '').trim();
}

function getBranchAliasUserName(userName: string): string {
  return getSafeUserName(userName).replace(/\s+/g, '_');
}

function sanitizeBranchAliasSegment(aliasSegment: string): string {
  return String(aliasSegment || '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64);
}

function getBranchInvitePreviewData(inviteCode: string): Record<string, string> {
  const ogTitle = getOptionalEnvVar('BRANCH_INVITE_OG_TITLE') || DEFAULT_BRANCH_INVITE_OG_TITLE;
  const ogDescription = getOptionalEnvVar('BRANCH_INVITE_OG_DESCRIPTION') || DEFAULT_BRANCH_INVITE_OG_DESCRIPTION;
  const ogImageUrl = getOptionalEnvVar('BRANCH_INVITE_OG_IMAGE_URL') || DEFAULT_BRANCH_INVITE_OG_IMAGE_URL;
  const ogUrl = getOptionalEnvVar('BRANCH_INVITE_OG_URL');

  const previewData: Record<string, string> = {
    '$og_title': ogTitle,
    '$og_description': ogDescription,
  };
  if (ogImageUrl) {
    previewData['$og_image_url'] = ogImageUrl;
  }
  if (ogUrl) {
    previewData['$og_url'] = ogUrl;
  }

  return previewData;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function getRetryDelayMs(attempt: number, retryAfterHeader: unknown): number {
  const retryAfterSeconds = Number(retryAfterHeader);
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.round(retryAfterSeconds * 1000);
  }
  return Math.min(1000 * Math.pow(2, attempt), 8000);
}

function getBranchKey(): string {
  const branchKey = String(process.env.BRANCH_KEY_PROD || process.env.BRANCH_KEY || BRANCH_KEY_HARDCODED || '').trim();
  return branchKey;
}

async function createBranchShortUrl(inviteCode: string, requestBody: Record<string, unknown>): Promise<string> {
  for (let attempt = 0; attempt <= BRANCH_MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(BRANCH_API_URL, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: BRANCH_TIMEOUT_MS,
        validateStatus: () => true,
      });

      const status = Number(response.status || 0);
      const url = String(response.data?.url || '').trim();

      if (status >= 200 && status < 300 && url !== '') {
        return url;
      }

      if (!isRetriableStatus(status) || attempt === BRANCH_MAX_RETRIES) {
        console.error('Branch invite link request failed', {
          inviteCode,
          status,
          attempt,
          responseData: response.data,
        });
        return 'Error';
      }

      const delayMs = getRetryDelayMs(attempt, response.headers?.['retry-after']);
      await wait(delayMs);
    } catch (error) {
      const status = Number((error as any)?.response?.status || 0);
      const responseData = (error as any)?.response?.data;

      if (!isRetriableStatus(status) || attempt === BRANCH_MAX_RETRIES) {
        console.error('Branch invite link request exception', {
          inviteCode,
          status,
          attempt,
          message: (error as Error)?.message,
          responseData,
        });
        return 'Error';
      }

      const retryAfterHeader = (error as any)?.response?.headers?.['retry-after'];
      const delayMs = getRetryDelayMs(attempt, retryAfterHeader);
      await wait(delayMs);
    }
  }

  return 'Error';
}

async function createBranchLink(inviteCode: string, userName: string): Promise<string> {
  const branchKey = getBranchKey();
  if (!branchKey) {
    console.error('Branch key is missing. Set BRANCH_KEY_PROD or BRANCH_KEY.');
    const encodedUserName = encodeURIComponent(getSafeUserName(userName));
    return `${dynamicLinkParams.branchDomain}/?parent-id=${encodeURIComponent(inviteCode)}&parent-user-name=${encodedUserName}`;
  }

  try {
    const safeUserName = getSafeUserName(userName);
    const encodedUserName = encodeURIComponent(safeUserName);
    const aliasUserName = sanitizeBranchAliasSegment(getBranchAliasUserName(userName));
    const branchAlias = aliasUserName ? `${aliasUserName}/invited-${inviteCode}` : `invited-${inviteCode}`;

    const baseRequestBody = {
      branch_key: branchKey,
      campaign: 'zpln-free-invite',
      channel: 'referral',
      feature: 'sharing',
      stage: 'new share',
      domain: dynamicLinkParams.branchDomain,
      data: {
        parentId: inviteCode,
        'parent-id': inviteCode,
        parentUserName: safeUserName,
        'parent-user-name': safeUserName,
        '$desktop_url': dynamicLinkParams.desktopLink,
        '$android_url': `https://play.google.com/store/apps/details?id=${dynamicLinkParams.androidBundleId}&parent-id=${inviteCode}&parent-user-name=${encodedUserName}`,
        '$ios_url': `${dynamicLinkParams.iosFallbackLink}?parent-id=${inviteCode}&parent-user-name=${encodedUserName}`,
        '$fallback_url': dynamicLinkParams.desktopLink,
        '$deeplink_path': `/invite?parent-id=${inviteCode}&parent-user-name=${encodedUserName}`,
        ...getBranchInvitePreviewData(inviteCode)
      }
    };

    const withAliasBody: Record<string, unknown> = {
      ...baseRequestBody,
      alias: branchAlias
    };

    const withAliasResult = await createBranchShortUrl(inviteCode, withAliasBody);
    if (withAliasResult !== 'Error') {
      return withAliasResult;
    }

    console.warn('Branch invite link failed with alias. Retrying without alias.', {
      inviteCode,
      branchAlias
    });

    const withoutAliasResult = await createBranchShortUrl(inviteCode, baseRequestBody);
    if (withoutAliasResult !== 'Error') {
      return withoutAliasResult;
    }

    const fallbackInviteLink = `${dynamicLinkParams.branchDomain}/?parent-id=${encodeURIComponent(inviteCode)}&parent-user-name=${encodedUserName}`;
    console.warn('Branch invite link failed after retries; using fallback invite link.', {
      inviteCode,
      fallbackInviteLink
    });
    return fallbackInviteLink;
  } catch (error) {
    const encodedUserName = encodeURIComponent(getSafeUserName(userName));
    const fallbackInviteLink = `${dynamicLinkParams.branchDomain}/?parent-id=${encodeURIComponent(inviteCode)}&parent-user-name=${encodedUserName}`;
    console.error('Error preparing Branch invite link request:', {
      inviteCode,
      message: (error as Error)?.message,
      fallbackInviteLink,
    });
    return fallbackInviteLink;
  }
}

export async function createDynamicLinkForInviteCode(
  inviteCode: string,
  userName: string,
): Promise<string> {
  return createBranchLink(inviteCode, userName);
}

// Echo links stay unchanged and continue using the existing Firebase flow.

export async function createDynamicLinkForEchoProInvite(inviteCode: string): Promise<string> {
  try {
    const apiKey = appOptions.webAPIKey;
    const url = `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${apiKey}`;

    const requestBody = {
      dynamicLinkInfo: {
        domainUriPrefix: "https://zpln.page.link",
        link: `https://echopro.zpln.app/register?echo-parent-id=${inviteCode}`
      },
      suffix: {
        option: "SHORT"
      }
    };

    const response = await axios.post(url, requestBody, {
      headers: { "Content-Type": "application/json" }
    });

    return response.data?.shortLink ?? "Error";
  } catch (error) {
    console.error("Error creating Echo Pro dynamic link:", error);
    return "Error";
  }
}
