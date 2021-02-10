import { Epic, ofType } from "redux-observable"
import { filter, map, switchMap, tap } from "rxjs/operators"
import { NEVER, of, timer } from "rxjs"

import { actions } from "store"
import {
  BootstrapAction,
  ConfigurationShape,
  ConsoleAction,
  ConsoleAT,
  RefreshAuthTokenAction,
  StoreAction,
  StoreShape,
} from "types"
import { fromFetch } from "utils"

type AuthPayload = Readonly<
  Partial<{
    expiry: number
    refreshRoute: string
  }>
>

export const getConfiguration: Epic<StoreAction, ConsoleAction, StoreShape> = (
  action$,
) =>
  action$.pipe(
    ofType<StoreAction, BootstrapAction>(ConsoleAT.BOOTSTRAP),
    switchMap(() =>
      fromFetch<ConfigurationShape>("assets/console-configuration.json").pipe(
        map((response) => {
          if (!response.error) {
            return actions.console.setConfiguration(response.data)
          }
        }),
        filter((a): a is ConsoleAction => !!a),
      ),
    ),
  )

export const triggerRefreshTokenOnBootstrap: Epic<
  StoreAction,
  ConsoleAction,
  StoreShape
> = (action$) =>
  action$.pipe(
    ofType<StoreAction, BootstrapAction>(ConsoleAT.BOOTSTRAP),
    switchMap(() => {
      const authPayload = localStorage.getItem("AUTH_PAYLOAD")

      if (authPayload != null) {
        return of(actions.console.refreshAuthToken())
      }

      return NEVER
    }),
  )

export const refreshToken: Epic<StoreAction, ConsoleAction, StoreShape> = (
  action$,
) =>
  action$.pipe(
    ofType<StoreAction, RefreshAuthTokenAction>(ConsoleAT.REFRESH_AUTH_TOKEN),
    switchMap(() => {
      const authPayload = localStorage.getItem("AUTH_PAYLOAD")

      if (authPayload != null) {
        try {
          const { expiry, refreshRoute } = JSON.parse(
            authPayload,
          ) as AuthPayload

          if (expiry != null && refreshRoute != null) {
            const waitUntil = expiry * 1e3 - 30e3 - Date.now()

            if (waitUntil < 0) {
              return NEVER
            }

            return timer(waitUntil).pipe(
              switchMap(() => fromFetch<AuthPayload>(refreshRoute)),
              tap((response) => {
                if (!response.error) {
                  localStorage.setItem(
                    "AUTH_PAYLOAD",
                    JSON.stringify(response.data),
                  )
                }
              }),
              switchMap(() => of(actions.console.refreshAuthToken())),
            )
          }
        } catch (error) {
          return NEVER
        }
      }

      return NEVER
    }),
  )

export default [getConfiguration, triggerRefreshTokenOnBootstrap, refreshToken]
