module Yoga.Test.Docker
  ( ComposeFile(..)
  , Timeout(..)
  , startService
  , stopService
  , waitForHealthy
  , dockerComposeUp
  , dockerComposeDown
  , isServiceHealthy
  ) where

import Prelude

import Data.Newtype (class Newtype, un)
import Data.Time.Duration (Milliseconds(..))
import Effect.Aff (Aff, delay, throwError)
import Effect.Aff.Compat (EffectFnAff, fromEffectFnAff)
import Effect.Exception (error)

newtype ComposeFile = ComposeFile String

derive instance Newtype ComposeFile _

newtype Timeout = Timeout Milliseconds

derive instance Newtype Timeout _

foreign import dockerComposeUpImpl :: String -> EffectFnAff Unit

dockerComposeUp :: ComposeFile -> Aff Unit
dockerComposeUp cf = fromEffectFnAff (dockerComposeUpImpl (un ComposeFile cf))

foreign import dockerComposeDownImpl :: String -> EffectFnAff Unit

dockerComposeDown :: ComposeFile -> Aff Unit
dockerComposeDown cf = fromEffectFnAff (dockerComposeDownImpl (un ComposeFile cf))

foreign import isServiceHealthyImpl :: String -> EffectFnAff Boolean

isServiceHealthy :: ComposeFile -> Aff Boolean
isServiceHealthy cf = fromEffectFnAff (isServiceHealthyImpl (un ComposeFile cf))

waitForHealthy :: ComposeFile -> Timeout -> Aff Unit
waitForHealthy composeFile (Timeout (Milliseconds timeout)) = go 0.0
  where
  go elapsed
    | elapsed >= timeout = throwError $ error "Service failed to become healthy"
    | otherwise = do
        healthy <- isServiceHealthy composeFile
        if healthy then pure unit
        else do
          let interval = Milliseconds 1000.0
          delay interval
          go (elapsed + 1000.0)

startService :: ComposeFile -> Timeout -> Aff Unit
startService composeFile timeout = do
  dockerComposeUp composeFile
  waitForHealthy composeFile timeout

stopService :: ComposeFile -> Aff Unit
stopService = dockerComposeDown
