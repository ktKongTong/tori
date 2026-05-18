# Admin Operations

Admin 可以：

- 查看全部 connection、binding、subscription、notification event、task。
- 管理公共 token-proxy instance registry。
- 管理可信 bot instance。
- rotate bot credential。
- 检查 failed notification、failed task、unhealthy proxy、inactive bot。
- 执行各资源 owner module 暴露的管理命令。

Admin Dashboard 需要提供：

- system health summary
- failed delivery list
- failed task run list
- suspended channel binding list
- unhealthy proxy list
- bot runtime status

Admin 操作必须由后端权限校验保护。
