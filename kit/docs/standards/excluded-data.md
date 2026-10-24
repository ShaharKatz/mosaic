# Excluded data

Run outputs, downloaded assets, generated analysis, large datasets, customer data and personal information belong under the chosen `{{EXCLUDED_DATA_DIR}}/` folder, namespaced by tool or purpose. This path is relative to the installed project root. In a multi-repo project, choose a folder inside the repository whose scripts write the data; the folder and its ignore line belong to that repository, not to the link repo that ignores the member. Scripts default their output roots there.

1. Ignore this one folder once in its owning repository's `.gitignore`; this convention builds on Git's ignore mechanism, not a replacement for it. Do not add per-path ignore entries for data outputs: route those outputs into the chosen folder instead. The mechanical kit installer never edits `.gitignore`; `/mosaic-install` adds the chosen folder's ignore line during migration. Verify the folder itself with `git check-ignore -q <dir>/` from its owning repository, using the owner-relative directory path.
2. Deliberately copy only small, reviewed, sanitized samples into committed test fixtures. Never promote an entire run or large/generated/customer dataset into git.
3. Credentials are not data. Follow the project's existing secrets handling; this folder is not a secret-management workaround.
