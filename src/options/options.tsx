import React from 'react'
import ReactDOM from 'react-dom'
import * as MaterialUI from '@material-ui/core'
import throttle from 'lodash-es/throttle'

import { onStorageChanged } from '../scripts/background/storage'
import * as RedBlockOptionsStorage from '../scripts/background/storage/options'
import { TabPanel } from '../popup/popup-ui/components'
import { RedBlockOptionsContext } from './pages/contexts'
import ChainBlockOptionsPage from './pages/chainblock'
import OneClickBlockOptionsPage from './pages/oneclickblock'
import ExperimentalOptionsPage from './pages/experimentals'
import UserInterfaceOptionsPage from './pages/userinterface'
import TroubleShootingsPage from './pages/troubleshooting'

const M = MaterialUI

const optionsTabPages = [
  'chainblock',
  'oneclickblock',
  'userinterface',
  'troubleshooting',
  'experimental',
] as const
type OptionsTabPage = typeof optionsTabPages[number]

function RedBlockOptionsUITheme(darkMode: boolean) {
  return MaterialUI.createMuiTheme({
    typography: {
      fontSize: 14,
    },
    palette: {
      type: darkMode ? 'dark' : 'light',
      primary: MaterialUI.colors.pink,
      secondary: darkMode ? MaterialUI.colors.lightBlue : MaterialUI.colors.indigo,
    },
  })
}

function OptionsApp() {
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  const theme = React.useMemo(() => RedBlockOptionsUITheme(darkMode), [darkMode])
  const [options, setOptions] = React.useState<RedBlockOptions>(
    RedBlockOptionsStorage.defaultOptions
  )
  const [uiOptions, setUIOptions] = React.useState<RedBlockUIOptions>(
    RedBlockOptionsStorage.defaultUIOptions
  )
  const [tabPage, setTabPage] = React.useState<OptionsTabPage>('chainblock')
  const throttledSaveOptions = throttle(
    (newOptions: RedBlockOptions) => RedBlockOptionsStorage.saveOptions(newOptions),
    50
  )
  async function updateOptions(newOptionsPart: Partial<RedBlockOptions>) {
    const newOptions: RedBlockOptions = { ...options, ...newOptionsPart }
    throttledSaveOptions(newOptions)
  }
  async function updateUIOptions(newOptionsPart: Partial<RedBlockUIOptions>) {
    const newOptions: RedBlockUIOptions = { ...uiOptions, ...newOptionsPart }
    await RedBlockOptionsStorage.saveUIOptions(newOptions)
  }
  React.useEffect(() => {
    RedBlockOptionsStorage.loadOptions().then(setOptions)
    return onStorageChanged('options', setOptions)
  }, [])
  React.useEffect(() => {
    RedBlockOptionsStorage.loadUIOptions().then(setUIOptions)
    return onStorageChanged('uiOptions', setUIOptions)
  }, [])
  return (
    <M.ThemeProvider theme={theme}>
      <RedBlockOptionsContext.Provider
        value={{ options, updateOptions, uiOptions, updateUIOptions }}
      >
        <M.AppBar position="static">
          <M.Tabs
            variant="scrollable"
            scrollButtons="auto"
            value={tabPage}
            onChange={(_ev, val) => setTabPage(val)}
          >
            {optionsTabPages.map((value, index) => (
              <M.Tab key={index} value={value} label={value} />
            ))}
          </M.Tabs>
        </M.AppBar>
        <M.Container maxWidth="md">
          <TabPanel value={tabPage} index="chainblock">
            <ChainBlockOptionsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="oneclickblock">
            <OneClickBlockOptionsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="userinterface">
            <UserInterfaceOptionsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="troubleshooting">
            <TroubleShootingsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="experimental">
            <ExperimentalOptionsPage />
          </TabPanel>
          <M.Divider />
        </M.Container>
      </RedBlockOptionsContext.Provider>
    </M.ThemeProvider>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
