# GymSheet Web: deployment policy

Preserve the existing implementation, UI and local user data. Keep changes scoped to the user's request.

For future BUG/CR work, build and test locally using AVVIA-TELEFONO.cmd.
Never dispatch the GitHub Pages workflow or otherwise update the public Alpha unless the user explicitly requests publication after local testing.
The production workflow must remain workflow_dispatch-only, with no automatic push, PR, tag or schedule deployment.
Do not commit or publish personal Excel workbooks, backups or browser databases.
