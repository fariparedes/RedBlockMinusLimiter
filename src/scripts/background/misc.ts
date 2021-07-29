import { loadOptions } from './storage'
import {
  getAllCookies,
  removeCookie,
  getCookieStoreIdFromTab,
} from '../../scripts/background/cookie-handler'

export async function markUser(params: MarkUserParams) {
  const tabs = await browser.tabs.query({
    discarded: false,
    url: [
      'https://twitter.com/*',
      'https://mobile.twitter.com/*',
      'https://tweetdeck.twitter.com/*',
    ],
  })
  tabs.forEach(tab => {
    const id = tab.id
    if (typeof id !== 'number') {
      return
    }
    browser.tabs
      .sendMessage<RBMessageToContent.MarkUser>(id, {
        messageType: 'MarkUser',
        messageTo: 'content',
        ...params,
      })
      .catch(() => {})
  })
}

export async function getCurrentTab(): Promise<browser.tabs.Tab> {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })
  const currentTab = tabs[0]!
  return currentTab
}

export async function toggleOneClickBlockMode(tab: browser.tabs.Tab, enabled: boolean) {
  const tabIds: number[] = []
  const { oneClickBlockModeForAllTabs } = await loadOptions()
  if (oneClickBlockModeForAllTabs) {
    const tabs = await browser.tabs.query({
      discarded: false,
      url: [
        'https://twitter.com/*',
        'https://mobile.twitter.com/*',
        'https://tweetdeck.twitter.com/*',
      ],
    })
    tabs.forEach(tab => {
      if (typeof tab.id === 'number') {
        tabIds.push(tab.id)
      }
    })
  } else {
    const tabId = tab.id
    if (typeof tabId === 'number') {
      tabIds.push(tabId)
    }
  }
  return await Promise.all(
    tabIds.map(tabId =>
      browser.tabs.sendMessage(tabId, {
        messageType: 'ToggleOneClickBlockMode',
        messageTo: 'content',
        enabled,
      })
    )
  )
}

export async function deleteTwitterCookies(tab: browser.tabs.Tab) {
  const storeId = await getCookieStoreIdFromTab(tab)
  const cookies = await getAllCookies({
    storeId,
  })
  const promises: Promise<any>[] = []
  for (const cookie of cookies) {
    promises.push(
      removeCookie({
        storeId,
        name: cookie.name,
      }).catch(() => {})
    )
  }
  await Promise.allSettled(promises)
}

export async function nukeRedBlockSettings() {
  const msg: RBMessageToBackground.RequestCleanup = {
    messageTo: 'background',
    messageType: 'RequestCleanup',
    cleanupWhat: 'nuke-all',
  }
  await browser.runtime.sendMessage(msg)
  await browser.storage.local.clear()
  localStorage.clear()
}
