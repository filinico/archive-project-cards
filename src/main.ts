import * as core from '@actions/core'
import * as github from '@actions/github'
import {archivePRCardsFromProject, GitHubContext} from './githubApi'

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN', {required: true})
    let configPath = core.getInput('CONFIG_PATH', {})
    if (!configPath) {
      configPath = '.github/archive-project-cards-config.yml'
    }
    core.info(`GITHUB_EVENT_NAME=${process.env.GITHUB_EVENT_NAME}`)
    core.info(`GITHUB context action=${github.context.payload.action}`)
    core.info(`GITHUB context=${JSON.stringify(github.context.payload)}`)

    const octokit = github.getOctokit(githubToken)
    const gitHubContext: GitHubContext = {
      octokit,
      context: github.context,
      configPath
    }
    await archivePRCardsFromProject(gitHubContext, github.context.payload.ref)
  } catch (error) {
    core.info(`process terminated, an error happened:`)
    core.setFailed(error.message)
  }
}

run()
