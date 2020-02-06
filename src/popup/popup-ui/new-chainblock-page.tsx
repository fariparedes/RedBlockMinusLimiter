import * as Storage from '../../scripts/background/storage.js'
import * as TwitterAPI from '../../scripts/background/twitter-api.js'
import { TwitterUser } from '../../scripts/background/twitter-api.js'
import { TwitterUserMap, getFollowersCount } from '../../scripts/common.js'
import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { insertUserToStorage, removeUserFromStorage, startFollowerChainBlock } from '../popup.js'
import { DialogContext, SnackBarContext } from './contexts.js'
import { TabPanel } from './ui-common.js'

const M = MaterialUI
const T = MaterialUI.Typography

type SessionOptions = FollowerBlockSessionRequest['options']
type SelectUserGroup = 'invalid' | 'current' | 'saved'

const useStylesForExpansionPanels = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    details: {
      padding: '8px 16px',
    },
  })
)

const DenseExpansionPanelSummary = MaterialUI.withStyles({
  root: {
    minHeight: 16,
    '&$expanded': {
      minHeight: 16,
    },
  },
  content: {
    '&$expanded': {
      margin: 0,
    },
  },
  expanded: {},
})(MaterialUI.ExpansionPanelSummary)

// const SelectedUserContext = React.createContext<TwitterUser | null>(null)
const TargetUserContext = React.createContext<{
  currentUser: TwitterUser | null
  selectedUser: TwitterUser | null
  setSelectedUser: (maybeUser: TwitterUser | null) => void
  targetList: FollowKind
  setTargetList: (fk: FollowKind) => void
  targetOptions: SessionOptions
  setTargetOptions: (options: SessionOptions) => void
  mutateOptions: (optionsPart: Partial<SessionOptions>) => void
  selectedMode: ChainKind
  setSelectedMode: (ck: ChainKind) => void
}>({
  currentUser: null,
  selectedUser: null,
  setSelectedUser: () => {},
  targetList: 'followers',
  setTargetList: () => {},
  targetOptions: {
    quickMode: false,
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
  },
  setTargetOptions: () => {},
  mutateOptions: () => {},
  selectedMode: 'chainblock',
  setSelectedMode: () => {},
})

function TargetSavedUsers(props: {
  currentUser: TwitterUser | null
  selectedUserGroup: SelectUserGroup
  savedUsers: TwitterUserMap
  changeUser: (userName: string, group: SelectUserGroup) => Promise<void>
}) {
  const { currentUser, selectedUserGroup, savedUsers, changeUser } = props
  const snackBarCtx = React.useContext(SnackBarContext)
  const { selectedUser } = React.useContext(TargetUserContext)
  async function insertUser() {
    if (selectedUser) {
      insertUserToStorage(selectedUser)
      snackBarCtx.snack(i18n.getMessage('user_xxx_added', selectedUser.screen_name))
    }
  }
  async function removeUser() {
    if (selectedUser) {
      removeUserFromStorage(selectedUser)
      snackBarCtx.snack(i18n.getMessage('user_xxx_removed', selectedUser.screen_name))
    }
  }
  const sortedByName = (usersMap: TwitterUserMap): TwitterUser[] =>
    _.sortBy(usersMap.toUserArray(), user => user.screen_name.toLowerCase())
  const selectUserFromOption = (elem: EventTarget) => {
    if (!(elem instanceof HTMLSelectElement)) {
      throw new Error('unreachable')
    }
    const selectedOption = elem.selectedOptions[0]
    const group = selectedOption.getAttribute('data-group') as SelectUserGroup
    const userName = selectedOption.getAttribute('data-username')!
    changeUser(userName, group)
  }
  const currentUserOption = ({ screen_name, name }: TwitterUser) => (
    <optgroup label={i18n.getMessage('current_user')}>
      <option value={`current/${screen_name}`} data-group="current" data-username={screen_name}>
        @{screen_name} &lt;{name}&gt;
      </option>
    </optgroup>
  )
  return (
    <div style={{ width: '100%' }}>
      <M.FormControl fullWidth>
        <M.InputLabel shrink htmlFor="target-user-select">
          {i18n.getMessage('select_user')}:
        </M.InputLabel>
        <M.Select
          native
          id="target-user-select"
          fullWidth
          value={selectedUser ? `${selectedUserGroup}/${selectedUser.screen_name}` : 'invalid/???'}
          onChange={({ target }) => selectUserFromOption(target)}
        >
          <option value="invalid/???" data-group="invalid" data-username="???">
            {i18n.getMessage('user_not_selected')}
          </option>
          {currentUser && currentUserOption(currentUser)}
          <optgroup label={i18n.getMessage('saved_user')}>
            {sortedByName(savedUsers).map(({ screen_name, name }, index) => (
              <option key={index} value={'saved/' + screen_name} data-group="saved" data-username={screen_name}>
                @{screen_name} &lt;{name}&gt;
              </option>
            ))}
          </optgroup>
        </M.Select>
      </M.FormControl>
      {selectedUser && (
        <M.Box margin="10px 0" display="flex" flexDirection="row-reverse">
          <M.ButtonGroup>
            <M.Button
              disabled={selectedUserGroup !== 'current'}
              onClick={insertUser}
              startIcon={<M.Icon>add_circle</M.Icon>}
            >
              {i18n.getMessage('add')}
            </M.Button>
            <M.Button disabled={selectedUserGroup !== 'saved'} onClick={removeUser} startIcon={<M.Icon>delete</M.Icon>}>
              {i18n.getMessage('remove')}
            </M.Button>
          </M.ButtonGroup>
        </M.Box>
      )}
    </div>
  )
}

function TargetUserProfile(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { selectedUser, targetList, setTargetList, targetOptions, mutateOptions } = React.useContext(TargetUserContext)
  // selectedUser가 null일 땐 이 컴포넌트를 렌더링하지 않으므로
  const user = selectedUser!
  const { quickMode } = targetOptions
  const quickModeIsAvailable = isAvailable && targetList !== 'mutual-followers'
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  function radio(fk: FollowKind, label: string) {
    return (
      <M.FormControlLabel
        control={<M.Radio size="small" />}
        onChange={() => setTargetList(fk)}
        disabled={!isAvailable}
        checked={targetList === fk}
        label={label}
      />
    )
  }
  function quickModeAwareCount(count: number) {
    return quickMode ? Math.min(count, 200) : count
  }
  return (
    <div className="target-user-info">
      <div className="profile-image-area">
        <img alt={i18n.getMessage('profile_image')} className="profile-image" src={biggerProfileImageUrl} />
      </div>
      <div className="profile-right-area">
        <div className="profile-right-info">
          <div className="nickname" title={user.name}>
            {user.name}
          </div>
          <div className="username">
            <a
              target="_blank"
              rel="noopener noreferer"
              href={`https://twitter.com/${user.screen_name}`}
              title={`https://twitter.com/${user.screen_name} 로 이동`}
            >
              @{user.screen_name}
            </a>
          </div>
        </div>
        {isAvailable || (
          <div className="profile-blocked">
            {user.protected && `\u{1f512} ${i18n.getMessage('cant_chainblock_to_protected')}`}
            {user.blocked_by && `\u26d4 ${i18n.getMessage('cant_chainblock_to_blocked')}`}
          </div>
        )}
        <div className="profile-right-targetlist">
          <M.RadioGroup row>
            {radio('followers', i18n.formatFollowsCount('followers', quickModeAwareCount(user.followers_count)))}
            {radio('friends', i18n.formatFollowsCount('friends', quickModeAwareCount(user.friends_count)))}
            {radio('mutual-followers', i18n.getMessage('mutual_followers'))}
          </M.RadioGroup>
          <hr />
          <M.FormControlLabel
            control={<M.Checkbox />}
            disabled={!quickModeIsAvailable}
            checked={quickMode}
            onChange={() => mutateOptions({ quickMode: !quickMode })}
            label={i18n.getMessage('quick_mode_label')}
            title={i18n.getMessage('quick_mode_description')}
          />
        </div>
      </div>
    </div>
  )
}

const useStylesForCircularProgress = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    center: {
      margin: '10px auto',
    },
  })
)
function TargetUserProfileEmpty(props: { reason: 'invalid-user' | 'loading' }) {
  const classes = useStylesForCircularProgress()
  let message = ''
  if (props.reason === 'loading') {
    return <M.CircularProgress className={classes.center} color="secondary" />
  }
  return <div>{message}</div>
}

function TargetChainBlockOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(TargetUserContext)
  const { myFollowers, myFollowings } = targetOptions
  const verbs: Array<[Verb, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['Mute', i18n.getMessage('mute')],
    ['Block', i18n.getMessage('block')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">내 팔로워</M.FormLabel>
        <M.RadioGroup row>
          {verbs.map(([verb, vKor], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowers === verb}
              onChange={() => mutateOptions({ myFollowers: verb })}
              label={vKor}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">내 팔로잉</M.FormLabel>
        <M.RadioGroup row>
          {verbs.map(([verb, vKor], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowings === verb}
              onChange={() => mutateOptions({ myFollowings: verb })}
              label={vKor}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetUserSelectUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { currentUser, targetList, selectedUser, setSelectedUser, selectedMode } = React.useContext(TargetUserContext)
  const { openModal } = React.useContext(DialogContext)
  const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
  const [selectedUserGroup, selectUserGroup] = React.useState<SelectUserGroup>('current')
  const [isLoading, setLoadingState] = React.useState(false)
  const localizedMode = i18n.getMessage(selectedMode)
  async function changeUser(userName: string, group: SelectUserGroup) {
    const validUserNamePattern = /^[0-9a-z_]{1,15}$/i
    if (!validUserNamePattern.test(userName)) {
      setSelectedUser(null)
      selectUserGroup('invalid')
      return
    }
    try {
      setLoadingState(true)
      const newUser = await getUserByNameWithCache(userName).catch(() => null)
      if (newUser) {
        setSelectedUser(newUser)
        selectUserGroup(group)
      } else {
        openModal({
          dialogType: 'alert',
          message: {
            title: `사용자 @${userName}을(를) 찾을 수 없습니다.`,
          },
        })
        setSelectedUser(null)
        selectUserGroup('invalid')
      }
    } finally {
      setLoadingState(false)
    }
  }
  React.useEffect(() => {
    async function loadUsers() {
      const users = await Storage.loadUsers()
      setSavedUsers(users)
      return users
    }
    loadUsers()
    return Storage.onSavedUsersChanged(async users => {
      await loadUsers()
      if (!(selectedUser && users.has(selectedUser.id_str))) {
        setSelectedUser(currentUser)
        selectUserGroup('current')
      }
    })
  }, [])
  const classes = useStylesForExpansionPanels()
  let targetSummary = ''
  if (selectedUser) {
    targetSummary += '('
    targetSummary += `@${selectedUser.screen_name} `
    switch (targetList) {
      case 'followers':
        targetSummary += '팔로워'
        break
      case 'friends':
        targetSummary += '팔로잉'
        break
      case 'mutual-followers':
        targetSummary += '맞팔로워'
        break
    }
    targetSummary += ')'
  }
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>
          {localizedMode} 대상 {targetSummary}
        </T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        <div style={{ width: '100%' }}>
          <M.FormControl component="fieldset" fullWidth>
            <TargetSavedUsers
              currentUser={currentUser}
              selectedUserGroup={selectedUserGroup}
              savedUsers={savedUsers}
              changeUser={changeUser}
            />
            <M.Divider />
            {isLoading ? (
              <TargetUserProfileEmpty reason="loading" />
            ) : selectedUser ? (
              <TargetUserProfile isAvailable={isAvailable} />
            ) : (
              <TargetUserProfileEmpty reason="invalid-user" />
            )}
          </M.FormControl>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}

function TargetOptionsUI() {
  const { selectedMode, setSelectedMode } = React.useContext(TargetUserContext)
  const classes = useStylesForExpansionPanels()
  const modeKor = selectedMode === 'chainblock' ? '체인블락' : '언체인블락'
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>{modeKor} 옵션</T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        <div>
          <M.Tabs value={selectedMode} onChange={(_ev, val) => setSelectedMode(val)}>
            <M.Tab value={'chainblock'} label={`\u{1f6d1} 체인블락`} />
            <M.Tab value={'unchainblock'} label={`\u{1f49a} 언체인블락`} />
          </M.Tabs>
          <M.Divider />
          <TabPanel value={selectedMode} index={'chainblock'}>
            <TargetChainBlockOptionsUI />
            <div className="description">
              위 조건에 해당하지 않는 나머지 사용자를 모두 <mark>차단</mark>합니다. (단, <b>나와 맞팔로우</b>인 사용자는
              위 옵션과 무관하게 <b>뮤트나 차단하지 않습니다</b>.)
            </div>
          </TabPanel>
          <TabPanel value={selectedMode} index={'unchainblock'}>
            <TargetUnChainBlockOptionsUI />
            <div className="description">
              위 조건에 해당하지 않는 나머지 사용자를 모두 <mark>차단 해제</mark>합니다.
            </div>
          </TabPanel>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}

function TargetUnChainBlockOptionsUI() {
  // const { options, mutateOptions } = props
  const { targetOptions, mutateOptions } = React.useContext(TargetUserContext)
  const { mutualBlocked } = targetOptions
  const verbs: Array<[Verb, string]> = [
    ['Skip', '(맞차단인 상태로) 냅두기'],
    ['UnBlock', '차단 해제하기'],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">서로 맞차단</M.FormLabel>
        <M.RadioGroup row>
          {verbs.map(([verb, vKor], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={mutualBlocked === verb}
              onChange={() => mutateOptions({ mutualBlocked: verb })}
              label={vKor}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { selectedMode, selectedUser, targetList, targetOptions } = React.useContext(TargetUserContext)
  const { openModal } = React.useContext(DialogContext)
  function onExecuteChainBlockButtonClicked() {
    const request: FollowerBlockSessionRequest = {
      purpose: 'chainblock',
      target: {
        type: 'follower',
        user: selectedUser!,
        list: targetList,
        count: getFollowersCount(selectedUser!, targetList),
      },
      options: targetOptions,
    }
    openModal({
      dialogType: 'confirm',
      message: TextGenerate.generateFollowerBlockConfirmMessage(request),
      callback() {
        startFollowerChainBlock(request)
      },
    })
  }
  function onExecuteUnChainBlockButtonClicked() {
    const request: FollowerBlockSessionRequest = {
      purpose: 'unchainblock',
      target: {
        type: 'follower',
        user: selectedUser!,
        list: targetList,
        count: getFollowersCount(selectedUser!, targetList),
      },
      options: targetOptions,
    }
    openModal({
      dialogType: 'confirm',
      message: TextGenerate.generateFollowerBlockConfirmMessage(request),
      callback() {
        startFollowerChainBlock(request)
      },
    })
  }
  return (
    <M.Box padding="10px">
      {selectedMode === 'chainblock' && (
        <BigExecuteChainBlockButton disabled={!isAvailable} onClick={onExecuteChainBlockButtonClicked}>
          <span>{'\u{1f6d1}'} 체인블락 실행</span>
        </BigExecuteChainBlockButton>
      )}
      {selectedMode === 'unchainblock' && (
        <BigExecuteUnChainBlockButton disabled={!isAvailable} onClick={onExecuteUnChainBlockButtonClicked}>
          <span>{'\u{1f49a}'} 언체인블락 실행</span>
        </BigExecuteUnChainBlockButton>
      )}
    </M.Box>
  )
}

const userCache = new Map<string, TwitterUser>()
async function getUserByNameWithCache(userName: string): Promise<TwitterUser> {
  const key = userName.replace(/^@/, '').toLowerCase()
  if (userCache.has(key)) {
    return userCache.get(key)!
  }
  const user = await TwitterAPI.getSingleUserByName(key)
  userCache.set(user.screen_name, user)
  return user
}

const BigExecuteChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    width: '100%',
    padding: '10px',
    fontSize: 'larger',
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(MaterialUI.Button)
const BigExecuteUnChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    width: '100%',
    padding: '10px',
    fontSize: 'larger',
    backgroundColor: MaterialUI.colors.green[700],
    color: theme.palette.getContrastText(MaterialUI.colors.green[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.green[500],
      color: theme.palette.getContrastText(MaterialUI.colors.green[500]),
    },
  },
}))(MaterialUI.Button)

export default function NewChainBlockPage(props: { currentUser: TwitterUser | null }) {
  const { currentUser } = props
  const [targetOptions, setTargetOptions] = React.useState<SessionOptions>({
    quickMode: false,
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
  })
  const [selectedUser, setSelectedUser] = React.useState<TwitterUser | null>(currentUser)
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const firstMode = selectedUser && selectedUser.following ? 'unchainblock' : 'chainblock'
  const [selectedMode, setSelectedMode] = React.useState<ChainKind>(firstMode)
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  const isAvailable = React.useMemo((): boolean => {
    if (!selectedUser) {
      return false
    }
    if (selectedUser.following) {
      return true
    }
    if (selectedUser.protected || selectedUser.blocked_by) {
      return false
    }
    return true
  }, [selectedUser])
  return (
    <div>
      <TargetUserContext.Provider
        value={{
          currentUser,
          selectedUser,
          setSelectedUser,
          targetList,
          setTargetList,
          targetOptions,
          setTargetOptions,
          mutateOptions,
          selectedMode,
          setSelectedMode,
        }}
      >
        <div className="chainblock-target">
          <TargetUserSelectUI isAvailable={isAvailable} />
          <TargetOptionsUI />
          <TargetExecutionButtonUI isAvailable={isAvailable} />
        </div>
      </TargetUserContext.Provider>
    </div>
  )
}
