import { getUserNameFromURL } from '../common.js'
import * as TextGenerate from '../text-generate.js'
import { alert } from './background.js'
import {
  checkFollowerBlockTarget,
  checkTweetReactionBlockTarget,
  followerBlockDefaultOption,
  tweetReactionBlockDefaultOption,
} from './chainblock-session/session.js'
import { loadOptions, onOptionsChanged, RedBlockStorage } from './storage.js'
import { getSingleUserByName, getTweetById } from './twitter-api.js'

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
const tweetUrlPatterns = ['https://twitter.com/*/status/*', 'https://mobile.twitter.com/*/status/*']

function getTweetIdFromUrl(url: URL) {
  const match = /\/status\/(\d+)/.exec(url.pathname)
  return match && match[1]
}

async function sendFollowerChainBlockConfirm(tab: browser.tabs.Tab, userName: string, followKind: FollowKind) {
  const user = await getSingleUserByName(userName)
  const request: FollowerBlockSessionRequest = {
    purpose: 'chainblock',
    options: followerBlockDefaultOption,
    target: {
      type: 'follower',
      list: followKind,
      user,
    },
  }
  const [isOk, alertMessage] = checkFollowerBlockTarget(request.target)
  if (!isOk) {
    alert(alertMessage)
    return
  }
  const confirmMessageObj = TextGenerate.generateFollowerBlockConfirmMessage(request)
  const confirmMessage = TextGenerate.objToString(confirmMessageObj)
  browser.tabs.sendMessage<RBMessages.ConfirmChainBlock>(tab.id!, {
    messageType: 'ConfirmChainBlock',
    confirmMessage,
    action: {
      actionType: 'StartFollowerChainBlock',
      request,
    },
  })
}

async function sendTweetReactionChainBlockConfirm(tab: browser.tabs.Tab, tweetId: string, reaction: ReactionKind) {
  const tweet = await getTweetById(tweetId)
  const request: TweetReactionBlockSessionRequest = {
    purpose: 'chainblock',
    options: tweetReactionBlockDefaultOption,
    target: {
      type: 'tweetReaction',
      reaction,
      tweet,
    },
  }
  const [isOk, alertMessage] = checkTweetReactionBlockTarget(request.target)
  if (!isOk) {
    alert(alertMessage)
    return
  }
  const confirmMessageObj = TextGenerate.generateTweetReactionBlockMessage(request)
  const confirmMessage = TextGenerate.objToString(confirmMessageObj)
  browser.tabs.sendMessage<RBMessages.ConfirmChainBlock>(tab.id!, {
    messageType: 'ConfirmChainBlock',
    confirmMessage,
    action: {
      actionType: 'StartTweetReactionChainBlock',
      request,
    },
  })
}

async function createContextMenu(options: RedBlockStorage['options']) {
  // 크롬에선 browser.menus 대신 비표준 이름(browser.contextMenus)을 쓴다.
  // 이를 파이어폭스와 맞추기 위해 이걸 함
  const menus = new Proxy<typeof browser.menus>({} as any, {
    get(_target, name, receiver) {
      const menu = Reflect.get(browser.menus || {}, name, receiver)
      const ctxMenu = Reflect.get((browser as any).contextMenus || {}, name, receiver)
      return menu || ctxMenu
    },
  })

  await menus.removeAll()

  menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: urlPatterns,
    title: '이 사용자의 팔로워에게 체인블락 실행',
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      sendFollowerChainBlockConfirm(tab, userName, 'followers')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: urlPatterns,
    title: '이 사용자의 팔로잉에게 체인블락 실행',
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      sendFollowerChainBlockConfirm(tab, userName, 'friends')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: urlPatterns,
    title: '이 사용자의 맞팔로워에게 체인블락 실행',
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      sendFollowerChainBlockConfirm(tab, userName, 'mutual-followers')
    },
  })

  if (options.experimental_tweetReactionBasedChainBlock) {
    menus.create({
      type: 'separator',
    })

    menus.create({
      contexts: ['link'],
      documentUrlPatterns: urlPatterns,
      targetUrlPatterns: tweetUrlPatterns,
      title: '이 트윗을 리트윗한 사용자에게 체인블락 실행(β)',
      onclick(clickEvent, tab) {
        const url = new URL(clickEvent.linkUrl!)
        const tweetId = getTweetIdFromUrl(url)!
        sendTweetReactionChainBlockConfirm(tab, tweetId, 'retweeted')
      },
    })
    menus.create({
      contexts: ['link'],
      documentUrlPatterns: urlPatterns,
      targetUrlPatterns: tweetUrlPatterns,
      title: '이 트윗을 마음에 들어한 사용자에게 체인블락 실행(β)',
      onclick(clickEvent, tab) {
        const url = new URL(clickEvent.linkUrl!)
        const tweetId = getTweetIdFromUrl(url)!
        sendTweetReactionChainBlockConfirm(tab, tweetId, 'liked')
      },
    })
  }
}

export function initializeContextMenu() {
  loadOptions().then(createContextMenu)
  onOptionsChanged(createContextMenu)
}
