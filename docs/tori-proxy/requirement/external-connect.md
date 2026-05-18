# External Connect Product Spec

## Entry

用户在 Tori Dashboard 创建 connection 时先选择 proxy instance。选择 proxy instance 后，表单直接进入 token-proxy external connect flow。

## Existing Tokens

Tori Proxy external connect 页面优先展示已有 token：

- provider account name
- provider account id
- avatar
- last refreshed time
- capability summary

用户选择账号后点击确认。

## New Token

页面提供新建 token 按钮。用户点击后进入 provider auth flow。Provider auth 成功后回到账号确认页。

## Completion

成功后 popup callback 通知 Tori Dashboard：

- connection created
- selected provider account
- proxy instance

失败状态：

- user cancelled
- session expired
- provider auth failed
- exchange failed

Dashboard 收到失败结果后保留 create connection dialog，并展示可重试操作。
