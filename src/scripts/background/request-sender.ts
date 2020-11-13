export async function startFollowerChainBlock(request: FollowerBlockSessionRequest) {
  return browser.runtime.sendMessage<RBMessageToBackground.CreateFollowerChainBlockSession>({
    messageType: 'CreateFollowerChainBlockSession',
    messageTo: 'background',
    request,
  })
}

export async function startTweetReactionChainBlock(request: TweetReactionBlockSessionRequest) {
  return browser.runtime.sendMessage<RBMessageToBackground.CreateTweetReactionChainBlockSession>({
    messageType: 'CreateTweetReactionChainBlockSession',
    messageTo: 'background',
    request,
  })
}

export async function startImportChainBlock(request: ImportBlockSessionRequest) {
  return browser.runtime.sendMessage<RBMessageToBackground.CreateImportChainBlockSession>({
    messageType: 'CreateImportChainBlockSession',
    messageTo: 'background',
    request,
  })
}

export async function cancelChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.Cancel>({
    messageType: 'Cancel',
    messageTo: 'background',
    sessionId,
  })
}

export async function stopChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.Stop>({
    messageType: 'StopChainBlock',
    messageTo: 'background',
    sessionId,
  })
}

export async function stopAllChainBlock() {
  return browser.runtime.sendMessage<RBMessageToBackground.StopAll>({
    messageType: 'StopAllChainBlock',
    messageTo: 'background',
  })
}

export async function rewindChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.Rewind>({
    messageType: 'RewindChainBlock',
    messageTo: 'background',
    sessionId,
  })
}

export async function requestProgress() {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestProgress>({
    messageType: 'RequestProgress',
    messageTo: 'background',
  })
}

export async function cleanupInactiveSessions() {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestCleanup>({
    messageType: 'RequestCleanup',
    messageTo: 'background',
    cleanupWhat: 'inactive',
  })
}

export async function cleanupNotConfirmedSessions() {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestCleanup>({
    messageType: 'RequestCleanup',
    messageTo: 'background',
    cleanupWhat: 'not-confirmed',
  })
}

export async function insertUserToStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBMessageToBackground.InsertUserToStorage>({
    messageType: 'InsertUserToStorage',
    messageTo: 'background',
    user,
  })
}

export async function removeUserFromStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBMessageToBackground.RemoveUserFromStorage>({
    messageType: 'RemoveUserFromStorage',
    messageTo: 'background',
    user,
  })
}

export async function refreshSavedUsers() {
  return browser.runtime.sendMessage<RBMessageToBackground.RefreshSavedUsers>({
    messageType: 'RefreshSavedUsers',
    messageTo: 'background',
  })
}

export async function requestResetCounter() {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestResetCounter>({
    messageType: 'RequestResetCounter',
    messageTo: 'background',
  })
}
