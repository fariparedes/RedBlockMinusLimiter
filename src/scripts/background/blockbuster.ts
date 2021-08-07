import { TwClient } from './twitter-api'
import { iterateAvailableTwClients } from './multitude'

export async function examineRetrieverByTargetUser(
  primaryActor: Actor,
  targetUser: TwitterUser
): Promise<Actor> {
  if (!targetUser.blocked_by) {
    // 차단당하지 않았다면 primary 그대로 사용
    return primaryActor
  }
  const twClients = iterateAvailableTwClients()
  for await (const { client, user } of twClients) {
    if (user.id_str === primaryActor.user.id_str) {
      continue
    }
    const target = await client.getSingleUser({ user_id: targetUser.id_str }).catch(() => null)
    if (target && !target.blocked_by) {
      console.debug('[BlockBuster]: Found! will use %o', client)
      return { user, clientOptions: client.options }
    }
  }
  console.warn('[BlockBuster]: Failed to Found!')
  return primaryActor
}

export async function examineRetrieverByTweetId(
  primaryActor: Actor,
  tweetId: string
): Promise<ExamineTweetResult> {
  const primaryTwClient = new TwClient(primaryActor.clientOptions)
  const tweetRetrievedFromPrimaryActor = await primaryTwClient
    .getTweetById(tweetId)
    .catch(() => null)
  if (tweetRetrievedFromPrimaryActor) {
    return {
      actor: primaryActor,
      targetTweet: tweetRetrievedFromPrimaryActor,
      tweetRetrievedFromPrimary: true,
    }
  }
  const twClients = iterateAvailableTwClients()
  for await (const { client, user } of twClients) {
    if (user.id_str === primaryActor.user.id_str) {
      continue
    }
    const targetTweet = await client.getTweetById(tweetId).catch(() => null)
    if (targetTweet && !targetTweet.user.blocked_by) {
      console.debug('[BlockBuster]: Found! will use %o', client)
      return {
        actor: {
          user,
          clientOptions: client.options,
        },
        targetTweet,
        tweetRetrievedFromPrimary: false,
      }
    }
  }
  return {
    actor: primaryActor,
    targetTweet: null,
    tweetRetrievedFromPrimary: true,
  }
}

interface ExamineTweetResult {
  actor: Actor
  targetTweet: Tweet | null
  tweetRetrievedFromPrimary: boolean
}
