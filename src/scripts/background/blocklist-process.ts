import { startImportChainBlock } from './request-sender.js'
import { MAX_USER_LIMIT } from '../common.js'

export interface Blocklist {
  userIds: Set<string>
  duplicated: number
  invalid: number
}

export const emptyBlocklist: Blocklist = {
  userIds: new Set(),
  duplicated: 0,
  invalid: 0,
}

/*
function* iterateRegexp(pattern: RegExp, text: string) {
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    yield match[0]
  }
}
*/

function parseAsImportChainJson(text: string): Blocklist {
  const json = JSON.parse(text)
  if (!Array.isArray(json.users)) {
    throw new Error('invalid file?')
  }
  const importedJson = json as ImportChainJson
  const userIds = new Set<string>()
  let duplicated = 0
  let invalid = 0
  for (const { id } of importedJson.users) {
    if (!/^\d+$/.test(id)) {
      invalid++
      continue
    }
    if (userIds.has(id)) {
      duplicated++
      continue
    }
    userIds.add(id)
    if (userIds.size >= MAX_USER_LIMIT) {
      break
    }
  }
  return { userIds, duplicated, invalid }
}

function parseAsCsvBlocklist(text: string): Blocklist {
  const splitted = text.split('\n')
  const userIds = new Set<string>()
  let duplicated = 0
  let invalid = 0
  for (const line_ of splitted) {
    const line = line_.trim()
    if (line === '') {
      continue
    }
    if (!/^\d+$/.test(line)) {
      invalid++
      continue
    }
    if (userIds.has(line)) {
      duplicated++
      continue
    }
    userIds.add(line)
    if (userIds.size >= MAX_USER_LIMIT) {
      break
    }
  }
  return { userIds, duplicated, invalid }
}

export function parse(text: string): Blocklist {
  if (text.startsWith('{')) {
    return parseAsImportChainJson(text)
  } else {
    return parseAsCsvBlocklist(text)
  }
}

export async function importBlocklist(userIds: Set<string>) {
  if (userIds.size <= 0) {
    throw new Error('empty file')
  }
  startImportChainBlock({
    purpose: 'chainblock',
    target: {
      type: 'import',
      userIds: Array.from(userIds),
    },
    options: {
      myFollowers: 'Skip',
      myFollowings: 'Skip',
    },
  })
}
