import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
import * as OctokitTypes from '@octokit/types'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'

type GitHub = ReturnType<typeof github.getOctokit>

export interface GitHubContext {
  octokit: GitHub
  context: Context
  configPath: string
}

const fetchContent = async (
  actionContext: GitHubContext,
  repoPath: string
): Promise<string> => {
  const {octokit, context} = actionContext
  const response: OctokitTypes.OctokitResponse<any> = await octokit.repos.getContent(
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: repoPath,
      ref: context.sha
    }
  )
  if (!response.data.content) {
    return Promise.reject(new Error('fetchContent wrong Path'))
  }

  return Buffer.from(response.data.content, response.data.encoding).toString()
}

interface GitHubActionConfig {
  projectsDoneColumns: {
    [key: string]: number
  }
}

const loadConfig = async (
  actionContext: GitHubContext,
  configPath: string
): Promise<GitHubActionConfig> => {
  const configurationContent: string = await fetchContent(
    actionContext,
    configPath
  )
  const config:
    | string
    | number
    | object
    | null
    | undefined = yaml.load(configurationContent, {filename: configPath})
  if (!config || typeof config != 'object') {
    return Promise.reject(new Error('Config yml projectsDoneColumns missing'))
  } else {
    core.info(`Config successfully loaded`)
    return config as GitHubActionConfig
  }
}

interface ProjectCard {
  url: string
  id: number
  node_id: string
  note: string
  creator: {
    login: string
    id: number
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    received_events_url: string
    type: string
    site_admin: boolean
  }
  created_at: string
  updated_at: string
  archived: boolean
  column_url: string
  content_url: string
  project_url: string
}

const listCardsFromProjectColumn = async (
  actionContext: GitHubContext,
  projectColumnId: number
): Promise<ProjectCard[]> => {
  const {octokit} = actionContext
  const response = await octokit.projects.listCards({
    column_id: projectColumnId,
    archived_state: 'not_archived'
  })
  return response.data as ProjectCard[]
}

const archiveProjectCard = async (
  actionContext: GitHubContext,
  projectCardId: number
): Promise<void> => {
  const {octokit} = actionContext
  await octokit.projects.updateCard({
    card_id: projectCardId,
    archived: true
  })
  core.info(`Card ${projectCardId} is archived`)
}

export const archivePRCardsFromProject = async (
  actionContext: GitHubContext,
  releaseBranch: string
): Promise<void> => {
  core.info(`Start archiving for release branch [${releaseBranch}]`)
  const {configPath} = actionContext
  const config = await loadConfig(actionContext, configPath)
  if (!config.projectsDoneColumns.hasOwnProperty(releaseBranch)) {
    return Promise.reject(new Error('Config projectsDoneColumns missing'))
  }
  const projectColumnId = config.projectsDoneColumns[releaseBranch]
  core.info(`Found project column id=${projectColumnId}`)
  const cards = await listCardsFromProjectColumn(actionContext, projectColumnId)
  core.info(`Found ${cards.length} cards`)
  for (const card of cards) {
    await archiveProjectCard(actionContext, card.id)
  }
}
