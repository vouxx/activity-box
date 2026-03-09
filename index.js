require('dotenv').config()

const { Toolkit } = require('actions-toolkit')
const { GistBox, MAX_LINES, MAX_LENGTH } = require('gist-box')

const capitalize = str => str.slice(0, 1).toUpperCase() + str.slice(1)
const truncate = str =>
  str.length <= MAX_LENGTH ? str : str.slice(0, MAX_LENGTH - 3) + '...'

const serializers = {
  IssueCommentEvent: item => {
    return `🗣 Commented on #${item.payload.issue.number} in ${item.repo.name}`
  },
  IssuesEvent: item => {
    return `❗️ ${capitalize(item.payload.action)} issue #${
      item.payload.issue.number
    } in ${item.repo.name}`
  },
  PullRequestEvent: item => {
    const emoji = item.payload.action === 'opened' ? '💪' : '❌'
    const line = item.payload.pull_request.merged
      ? '🎉 Merged'
      : `${emoji} ${capitalize(item.payload.action)}`
    return `${line} PR #${item.payload.pull_request.number} in ${
      item.repo.name
    }`
  },
  PushEvent: item => {
    const count = (item.payload && item.payload.size) || 1
    return `⬆️ Pushed ${count} commit${count > 1 ? 's' : ''} to ${item.repo.name}`
  },
  CreateEvent: item => {
    if (item.payload.ref_type === 'repository') {
      return `📦 Created repository ${item.repo.name}`
    }
    return `🌿 Created ${item.payload.ref_type} ${item.payload.ref} in ${item.repo.name}`
  },
  ForkEvent: item => {
    return `🍴 Forked ${item.repo.name}`
  },
  WatchEvent: item => {
    return `⭐ Starred ${item.repo.name}`
  }
}

Toolkit.run(
  async tools => {
    const { GIST_ID, GH_USERNAME, GH_PAT } = process.env

    // Get the user's public events
    tools.log.debug(`Getting activity for ${GH_USERNAME}`)
    const events = await tools.github.activity.listPublicEventsForUser({
      username: GH_USERNAME,
      per_page: 100
    })
    tools.log.debug(
      `Activity for ${GH_USERNAME}, ${events.data.length} events found.`
    )

    const content = events.data
      .filter(event => serializers.hasOwnProperty(event.type))
      .slice(0, MAX_LINES)
      .map(item => {
        try { return serializers[item.type](item) }
        catch { return `📌 ${item.type} in ${item.repo.name}` }
      })
      .map(truncate)
      .join('\n')

    const box = new GistBox({ id: GIST_ID, token: GH_PAT })
    try {
      tools.log.debug(`Updating Gist ${GIST_ID}`)
      await box.update({ content })
      tools.exit.success('Gist updated!')
    } catch (err) {
      tools.log.debug('Error getting or update the Gist:')
      return tools.exit.failure(err)
    }
  },
  {}
)
