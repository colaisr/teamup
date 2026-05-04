# TeamUp MVP Role Permissions

## Roles

- owner
- admin
- member

## Permissions Matrix

| Action | owner | admin | member |
| --- | --- | --- | --- |
| View dashboards | yes | yes | yes |
| View attention list | yes | yes | yes |
| View impact screen | yes | yes | yes |
| Create workspace | yes | no | no |
| Manage workspace settings | yes | yes | no |
| Invite/remove members | yes | yes | no |
| Change member roles | yes | yes | no |
| Configure ClickUp connection | yes | yes | no |
| Edit workflow mappings | yes | yes | no |
| Trigger historical import | yes | yes | no |

## Security Notes

- Integration secrets are visible only as masked values.
- Invite acceptance token must be one-time and expire.
- Only owner/admin may change mapping versions.

