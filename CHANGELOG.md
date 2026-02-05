# Change Log

# 0.0.1

- Initial Release

# 0.0.2

- Small bug fixes & documentation improvement

# 0.1.1

- Add replugged support
- Lower required vscode version to 70 for time being

# 0.1.2

- Fix codelens position for webpack finds

# 0.1.3

- Now also supports plugin definitions stored in variables, like `const p: PluginDef = { ... }`

# 0.2.0

TODO: write notes

# 0.2.1

Added diagnostics for patches and finds

# 0.2.2

Minor bugfixes for new bundler settings

# 0.2.3

Added a live patch helper, make sure to update the plugin as well, as things will break without it

# 0.2.4

Added hover on intl keys and minor bugfixes

# 1.6.0

Support enums in discord modules

# 1.6.1

Increase timeout for initial websocket connection

# 1.7.0

Improve error message when formatting fails
Switch to new intl hashes

# 1.7.1

Add more hints on hover for constants

# 1.7.2

- Add setting to control delay between diagnostic updates
- Fix weird behavior while updating diagnostics for more than one document
- Cancel all pending messages if the connection is closed. This should give better errors.
