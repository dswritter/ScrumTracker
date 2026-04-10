/** Bundled Slack DM / archive URLs (Adobe Enterprise). Keys must match roster display names. */
export const BUNDLED_DEFAULT_SLACK_DM_URLS: Record<string, string> = {
  'Ayush Jindal': 'https://adobe.enterprise.slack.com/archives/D03REHDLE7P',
  'Priya Agrawal': 'https://adobe.enterprise.slack.com/archives/D02JDAUFA9H',
  'Tushar Gupta': 'https://adobe.enterprise.slack.com/archives/D02J6EP2HQE',
  'Shubham Kumar': 'https://adobe.enterprise.slack.com/archives/D05K0SY7D3L',
  'Akshat Bhatnagar': 'https://adobe.enterprise.slack.com/archives/D03LAMQPDEW',
  'Sunil Kumar': 'https://adobe.enterprise.slack.com/archives/D02HMSVSKCP',
  'Saikat Chakrabarty': 'https://adobe.enterprise.slack.com/archives/D02JA3MA4JH',
  'Shivendra Kumar': 'https://adobe.enterprise.slack.com/archives/D0AGJA1DU5D',
  'Kuldeep Singh': 'https://adobe.enterprise.slack.com/archives/D03RC9Q49KM',
  'Milind Anand': 'https://adobe.enterprise.slack.com/archives/D02VCU3NJ69',
  'Shubham Thakral': 'https://adobe.enterprise.slack.com/archives/D02KKML8JMP',
}

/** Default Confluence wiki page for weekly paste workflow. */
export const DEFAULT_WEEKLY_WIKI_PAGE_URL =
  'https://wiki.corp.adobe.com/spaces/coretech/pages/3485756824/Scrum+Tracker'

export function mergeBundledSlackDefaults(
  existing: Record<string, string> | undefined,
): Record<string, string> {
  const base = { ...(existing ?? {}) }
  for (const [name, url] of Object.entries(BUNDLED_DEFAULT_SLACK_DM_URLS)) {
    if (base[name] == null || String(base[name]).trim() === '') {
      base[name] = url
    }
  }
  return base
}
